const { Markup, Telegraf } = require('telegraf');
const { qiwiApi, bot, Client } = require('./api')
const fs = require('fs')

const { createBasicBillfields, basicKeyboard, subscribes, prolongueSubscription, getTelegramId, getUserByTelegramId, createCertificate, isThatSameBill } = require('./utils')

const dayjs = require('dayjs')
const helpRequest = /^помощь/i
const helpResponse = /^ответ поддержки/i
const payText = /^Оплатить/i
const telegramIdRegexp = /\d{7,12}/i
const dimaID = process.env.DIMA_TELEGRAM_ID
const kostyaId = process.env.KOSTYA_TELEGRAM_ID
bot.use(Telegraf.log())

const operationResultPoller = async(billId, chatId, interval) => {

    const client = await Client.findOne({'currentBill.id': billId })

    const checkCondition = async () => {
        try {
            const result = await qiwiApi.getBillInfo(billId)
            if (result.status.value === "WAITING") {
                setTimeout(checkCondition, interval)
            }
            if (result.status.value === 'PAID') {
                const prolongueDate = prolongueSubscription(client.expiresIn, client.currentBill.term, client.currentBill.termUnit)
                const certificatePath = await createCertificate(client.telegramId)
                const cert = fs.readFileSync(certificatePath)
                client.isSubscriptionActive = true
                client.expiresIn = prolongueDate
                client.certificate = Buffer.from(cert)
                client.currentBill.status = result.status
                client.paymentsHistory.push(client.currentBill)
                client.currentBill = {}
                await client.save()
                await bot.telegram.sendMessage(chatId, 'Успешно оплачено! Используйте этот файл для импорта в openVPN, более подробно в инструкции в разделе FAQ, приятного пользования!')
                await bot.telegram.sendDocument(chatId,  {source: certificatePath, filename: `${client.telegramId}.ovpn`})
            }
            if (result.status.value === 'REJECTED') {
                client.currentBill.status = result.status
                client.paymentsHistory.push(client.currentBill)
                client.currentBill = {}
                client.currentBill = {}
                await client.save()
                await bot.telegram.sendMessage(chatId, 'Счет был отклонен, попробуйте снова')
            }
            if (result.status.value === 'EXPIRED') {
                client.currentBill.status = result.status
                client.paymentsHistory.push(client.currentBill)
                client.currentBill = {}
                await client.save()
                await bot.telegram.sendMessage(chatId, 'Срок оплаты счета истек, если потребуется - создайте новый')
            }
        }  catch (e) {
            console.log(e)
            fs.appendFileSync('./log.txt', e)
            await bot.telegram.sendMessage(chatId, 'Произошла ошибка, повторите попытку позже или напишите нам')
        }
    }
    checkCondition()
}

const paymentHandler = async (ctx, subscription) => {
    const telegramId = getTelegramId(ctx)
    const { chat } = ctx
    const name = `${chat.first_name} ${chat.last_name || ''}`.trim()
    const findedUser = await getUserByTelegramId(telegramId)

    if (findedUser && isThatSameBill(findedUser.currentBill, subscription.term)) {
        return await ctx.reply(`Ваша ссылка для оплаты подписки\n${findedUser?.currentBill?.payUrl}`)
    }

    const billId = qiwiApi.generateId()
    const billForSubscription = createBasicBillfields(subscription.price)
    const paymentDetails = await qiwiApi.createBill(billId, billForSubscription)

    const billToBase = { id: billId, term: subscription.term, termUnit: subscription.termUnit, expirationDateTime: billForSubscription.expirationDateTime, payUrl: paymentDetails.payUrl }

    if (findedUser) {
        findedUser.currentBill = billToBase
        await findedUser.save()
    } else {
        const userToBase = {telegramId, name, isSubscriptionActive: false, expiresIn: dayjs(), currentBill: billToBase}
        await Client.create(userToBase)
    }

    operationResultPoller(billId, ctx.from.id, 10000)
    return await ctx.reply(`Ваша ссылка для оплаты подписки \n${paymentDetails.payUrl}`)
}


bot.telegram.setMyCommands([{command: '/start', description: 'Начало работы'}, {command: '/keyboard', description: 'Вызов клавиатуры бота'}])

bot.use(async(ctx, next) => {

    const messageText = ctx.update.message?.text
    if (Object.keys(subscribes).includes(messageText)) {
        await bot.telegram.sendMessage(ctx.from.id,`<b>${messageText}</b> подписки стоит <b>${subscribes[messageText].price} рублей</b>, нажми оплатить, чтобы получить ссылку для оплаты`, { parse_mode: 'HTML'})
        return await ctx.reply('Выберите опцию', Markup
        .keyboard([[`Оплатить ${subscribes[messageText].text}`, 'Обратно к выбору подписки']])
        .oneTime()
        .resize()
    )}

    if (payText.test(messageText)) {
        const text = messageText.replace(payText, '').trimLeft()
        const subscription = subscribes[text]
        try {
            await paymentHandler(ctx, subscription)
        } catch (e) {
            console.log(e)
            fs.appendFileSync('./log.txt', e)
            return await ctx.reply('Произошла ошибка, попробуйте позже')
        }
    }
    if (helpRequest.test(messageText)) {
        const {message: {from : {id, username, first_name, last_name }}} = ctx
        const name = username ? `@${username}` : `${first_name} ${last_name ?? ''}`
        try {
            await bot.telegram.sendMessage(dimaID, `#Поддержка\nСообщение от пользователя ${name} с id <b>${id}</b>\n${messageText.replace(helpRequest, '')}`, { parse_mode: 'HTML', disable_web_page_preview: true})
            await bot.telegram.sendMessage(kostyaId, `#Поддержка\nСообщение от пользователя ${name} с id <b>${id}</b>\n${messageText.replace(helpRequest, '')}`, { parse_mode: 'HTML', disable_web_page_preview: true})
            return await ctx.reply('Ваш запрос принят, ожидайте ответ от бота, среднее время ожидания ответа - 2 часа')
        } catch (e) {
            fs.appendFileSync('./log.txt', e)
            return await ctx.reply('Произошла ошибка, попробуйте снова')
        }
    }

    if (helpResponse.test(messageText)) {
        try {
            const {message: {from : {id }}} = ctx
            const chatId = messageText.match(telegramIdRegexp)[0]
            const responseText = messageText.replace(telegramIdRegexp, '').replace(helpResponse, '').trimLeft()
            await bot.telegram.sendMessage(id === dimaID ? kostyaId : dimaID, `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`, { parse_mode: 'HTML'})
            return await bot.telegram.sendMessage(chatId, `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`, { parse_mode: 'HTML'})
        } catch (e) {
            fs.appendFileSync('./log.txt', e)
            return await ctx.reply('Ошибка, проверьте правильность введенной информации по паттерну [ответ поддержки] [id пользователя] [текст ответа]')
        }

    }

    await next()
})

bot.command('start', async (ctx) => {
    await bot.telegram.sendMessage(ctx.from.id, "<b>Добрый день, я VPN бот, рад приветствовать тебя.</b>\n" +
        "Здесь ты можешь приобрести подписку на мой сервис и пользоваться интернетом без ограничений.\n" +
        "Чтобы вызвать клавиатуру для взаимодействия со мной - напиши команду /keyboard.\n" +
        "Основные разделы:\n- <b>«Выбрать подписку»</b> приведет тебя к выбору тарифа и дальнейшей оплате\n" +
        "- <b>«Моя подписка»</b> покажет срок действия подписки и поможет получить файл .ovpn заново, если вдруг не сможешь его найти\n" +
        "- <b>«FAQ»</b> расскажет процедуру подключения и работы с VPN\n" +
        "- <b>«Контакты»</b> если возникнут какие нибудь вопросы или проблемы - контакты найдешь тут.\n" +
        "На этом все, приятного использования сервиса.", { parse_mode: 'HTML', disable_web_page_preview: true})
    return await ctx.reply('Выберите опцию', Markup
        .keyboard(basicKeyboard)
        .oneTime()
        .resize()
    )
})

bot.command('keyboard', async (ctx) => {
    return await ctx.reply('Выберите опцию', Markup
        .keyboard(basicKeyboard)
        .oneTime()
        .resize()
    )
})

bot.hears(['Выбрать подписку', 'Обратно к выбору подписки'], async (ctx) => {
    return await ctx.reply('Выберите опцию', Markup
        .keyboard([Object.keys(subscribes), ['В главное меню']])
        .oneTime()
        .resize()
    )
})

bot.hears('Моя подписка', async (ctx) => {
    try {
        const telegramId = ctx.update.message.from.id
        const findedUser = await Client.findOne({telegramId})
        if (!findedUser) return ctx.reply('Пользователь не найден в базе')
        const message = findedUser.isSubscriptionActive ? `Срок действия подписки: ${dayjs(findedUser.expiresIn).format("DD.MM.YYYY")}г.` : 'У вас нет активной подписки'
        await ctx.reply(message)
        const buttons = findedUser.isSubscriptionActive ? ['Получить заново сертификат'] : ['Выбрать подписку']
        return await ctx.reply('Выберите опцию', Markup
            .keyboard([buttons, ['В главное меню']])
            .oneTime()
            .resize()
        )
    } catch (e) {
        fs.appendFileSync('./log.txt', e)
        return ctx.reply("Произошла ошибка, попробуйте позднее")
    }
})

bot.hears('Получить заново сертификат', async (ctx) => {
    const telegramId = getTelegramId(ctx)
    const findedUser = await Client.findOne({telegramId})
    await bot.telegram.sendMessage(ctx.from.id, 'Используйте этот файл для импорта в openVPN, более подробно в инструкции в разделе FAQ')
    return await ctx.replyWithDocument({source: Buffer.from(findedUser.certificate), filename: `${findedUser.telegramId}.ovpn`})
})

bot.hears('Получить подробную инструкцию в PDF', async (ctx) => {
    return await ctx.replyWithDocument({source: './howTo.pdf', filename: 'Инструкция.pdf'})
})

bot.hears('Контакты', async (ctx) => {
    return await ctx.reply('По всем вопросам на почту vpnpepa@gmail.com или напиши боту, свое сообщение начните со слова ПОМОЩЬ и далее текст своего вопроса.\nНапример: помощь не пришел впн профиль.')
})

bot.hears('FAQ', async (ctx) => {
    await bot.telegram.sendMessage(ctx.from.id, 'После оплаты бот в течение нескольких минут пришлет вам файл ******.ovpn.\n\n' +
        'Для того чтобы начать пользоваться VPN Вам необходимо установить программу OpenVPN.\n\nСсылки на официальные источники для скачивания:\n' +
        '<a href="https://apps.apple.com/ru/app/openvpn-connect/id590379981">AppleStore</a>\n' +
        '<a href="https://play.google.com/store/apps/details?id=net.openvpn.openvpn">Google Play</a>\n' +
        '<a href="https://openvpn.net/community-downloads/">Desktop</a>\n\n' +
        'Далее:\n' +
        '- скачиваете файл, присланный ботом (далее <b>Конфигурационный файл</b>)\n' +
        '- открываете OpenVpn\n' +
        '- <b>Мобильные устройства</b> выбираете вкладку File(Файл), в появившемся списке файлов находите свой <b>Конфигурационный файл</b>, нажимаете кнопку Import(Импорт), на следующем экране нажимаете на кнопку справа вверху Add(Добавить)\n' +
        '- <b>Стационарные компьютеры</b> правой кнопкой мыши кликаете по иконке в панели задач, далее нажимаете импорт конфигурации, указываете свой <b>Конфигурационный файл</b>, после успешного импорта снова правой кнопкой мыши кликаете по иконке в панели задач и выбираете свежедобавленный профиль с таким же именем как и ваш <b>Конфигурационный файл</b>, далее выбираете опцию подключиться \n'+
        '- Ваш профиль работает\n\n Для отключения впн на <b>мобильных устройствах</b> достаточно сдвинуть слайдер влево, на <b>Стационарных компьютерах</b> правой кнопкой мыши кликаете по иконке в панели задач и находите свой профиль и выбираете опцию отключиться\n\nВы можете скачать расширенную пошаговую инструкцию по кнопке ниже', { parse_mode: 'HTML', disable_web_page_preview: true})
    return await ctx.reply('Выберите опцию', Markup
        .keyboard([['Получить подробную инструкцию в PDF'], ['В главное меню']])
        .oneTime()
        .resize()
    )
})


bot.hears('В главное меню', async (ctx) => {
    return await ctx.reply('Выберите опцию', Markup
        .keyboard(basicKeyboard)
        .oneTime()
        .resize()
    )
})

bot.launch()

