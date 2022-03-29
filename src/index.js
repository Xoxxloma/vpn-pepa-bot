const { Markup } = require('telegraf');
const { qiwiApi, bot, Client } = require('./api')
const fs = require('fs')

const { createBasicBillfields, basicKeyboard, subscribes, prolongueSubscription, getTelegramId, getUserByTelegramId, createCertificate, isThatSameBill } = require('./utils')

const dayjs = require('dayjs')

const operationResultPoller = async(billId, chatId, termUnit, interval) => {

    const client = await Client.findOne({'bill.id': billId })
    const checkCondition = async () => {
        try {
            const result = await qiwiApi.getBillInfo(billId)
            if (result.status.value === "WAITING") {
                setTimeout(checkCondition, interval)
            }
            if (result.status.value === 'PAID') {
                client.isSubscriptionActive = true
                const prolongueDate = prolongueSubscription(client.expiresIn, client.bill.term, termUnit)
                const certificatePath = await createCertificate(client.telegramId)
                const cert = fs.readFileSync(certificatePath)
                client.expiresIn = prolongueDate
                client.certificate = Buffer.from(cert)
                client.bill = {}
                await client.save()
                await bot.telegram.sendMessage('Успешно оплачено! Инструкцию по настройке VPN вы можете найти в разделе FAQ, приятного пользования!')
                await bot.telegram.sendDocument(chatId,  {source: certificatePath, filename: `${client.telegramId}.ovpn`})
            }
        }  catch (e) {
            console.log(e)
            await bot.telegram.sendMessage(chatId, 'Произошла ошибка, повторите попытку позже или напишите нам')
        }
    }
    checkCondition()
}

const paymentHandler = async (ctx, subscription) => {
    const telegramId = getTelegramId(ctx)
    const { chat } = ctx
    const name = `${chat.first_name} ${chat.last_name}`
    const findedUser = await getUserByTelegramId(telegramId)

    if (findedUser && isThatSameBill(findedUser.bill, subscription.term)) {
        return await ctx.reply(`Ваша ссылка для оплаты подписки\n${findedUser?.bill?.payUrl}`)
    }

    const billId = qiwiApi.generateId()
    const billForSubscription = createBasicBillfields(subscription.price)
    const paymentDetails = await qiwiApi.createBill(billId, billForSubscription)

    const billToBase = { id: billId, term: subscription.term, expirationDateTime: billForSubscription.expirationDateTime, payUrl: paymentDetails.payUrl }

    if (findedUser) {
        findedUser.bill = billToBase
        await findedUser.save()
    } else {
        const userToBase = {telegramId, name, isSubscriptionActive: false, expiresIn: dayjs(), bill: billToBase}
        await Client.create(userToBase)
    }

    operationResultPoller(billId, ctx.from.id, subscription.termUnit, 10000)
    return await ctx.reply(`Ваша ссылка для оплаты подписки \n${paymentDetails.payUrl}`)
}


bot.telegram.setMyCommands([{command: '/keyboard', description: 'Начало работы'}, {command: '/keyboard', description: 'Вызов клавиатуры бота'}])

bot.use(async(ctx, next) => {
    const payText = "Оплатить"
    const message = ctx.update.message.text
    if (Object.keys(subscribes).includes(message)) {
        return await ctx.reply(`${message} стоит ${subscribes[message].price} рублей, нажми оплатить, чтобы получить ссылку для оплаты`, Markup
        .keyboard([[`Оплатить ${subscribes[message].text}`, 'Обратно к выбору подписки']])
        .oneTime()
        .resize()
    )}

    if (message.startsWith(payText)) {
        const text = message.substring(payText.length + 1)
        const subscription = subscribes[text]
        try {
            await paymentHandler(ctx, subscription)
        } catch (e) {
            console.log(e)
            return await ctx.reply('Произошла ошибка, попробуйте позже')
        }
    }

    await next()
})

bot.command('start', async (ctx) => {
    await bot.telegram.sendMessage(ctx.from.id, "<b>Добрый день, я VPN бот, рад приветствовать тебя.</b>\n" +
        "Здесь ты можешь приобрести подписку на мой сервис и пользоваться интернетом без ограничений.\n" +
        "Чтобы вызвать клавиатуру для взаимодействия со мной - напиши команду /keyboard.\n" +
        "Основные разделы:\n- <b>«Выбрать подписку»</b> приведет тебя к выбору тарифа и дальнейшей оплате\n" +
        "- <b>«Моя подписка»</b> покажет срок действия подписки и поможет получить файл .ovpn заново, если вдруг не можешь его найти\n" +
        "- <b>«FAQ»</b> расскажет процедуру подключения и работы с VPN\n" +
        "- <b>«Помощь»</b> если возникнут какие нибудь вопросы или проблемы - контакты найдешь тут.\n" +
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


// bot.hears('Подписка на месяц', async (ctx) => {
//     return await ctx.reply('Подписка на один месяц стоит 100р, нажми оплатить, чтобы получить ссылку для оплаты', Markup
//         .keyboard([['Оплатить подписку на месяц', 'В главное меню']])
//         .oneTime()
//         .resize()
//     )
// })
//
//
// bot.hears('Подписка на три месяца', async (ctx) => {
//     return await ctx.reply('Подписка на три месяц стоит 300р, нажми оплатить, чтобы получить ссылку для оплаты', Markup
//         .keyboard([['Оплатить подписку на три месяца', 'В главное меню']])
//         .oneTime()
//         .resize()
//     )
// })

// bot.hears('Оплатить подписку на месяц', async (ctx) => {
//     try {
//         await paymentHandler(ctx, 1)
//     } catch (e) {
//         console.log(e)
//         return await ctx.reply('Произошла ошибка, попробуйте позже')
//     }
// })
//
// bot.hears('Оплатить подписку на три месяца', async (ctx) => {
//     try {
//         await paymentHandler(ctx, 3)
//     } catch (e) {
//         console.log(e)
//         return await ctx.reply('Произошла ошибка, попробуйте позже')
//     }
// })

bot.hears('Моя подписка', async (ctx) => {
    try {
        const telegramId = ctx.update.message.from.id
        const findedUser = await Client.findOne({telegramId})
        if (!findedUser) return ctx.reply('Пользователь не найден в базе')
        const message = findedUser.isSubscriptionActive ? `Ваша подписка истекает ${dayjs(findedUser.expiresIn).format("DD-MM-YYYY")}` : 'У вас нет активной подписки'
        await ctx.reply(message)
        const buttons = findedUser.isSubscriptionActive ? ['Получить заново сертификат'] : ['Выбрать подписку']
        return await ctx.reply('Выберите опцию', Markup
            .keyboard([buttons,['Получить инструкцию'], ['В главное меню']])
            .oneTime()
            .resize()
        )
    } catch (e) {
        return ctx.reply("Произошла ошибка, попробуйте позднее")
    }
})

bot.hears('Получить заново сертификат', async (ctx) => {
    const telegramId = getTelegramId(ctx)
    const findedUser = await Client.findOne({telegramId})
    const certificate = findedUser.certificate
    return await ctx.replyWithDocument({source: Buffer.from(certificate), filename: `${findedUser.telegramId}.ovpn`})
})

bot.hears('Получить инструкцию', async (ctx) => {
    return await ctx.replyWithDocument({source: './howTo.pdf', filename: 'Инструкция.pdf'})
})

bot.hears('Помощь', async (ctx) => {
    return await ctx.reply('По всем вопросам на почту pepeSmile@mail.ru или в телеграм @botFather')
})

bot.hears('FAQ', async (ctx) => {
    return await ctx.replyWithHTML('После оплаты бот в течение нескольких минут пришлет вам файл ******.ovpn.' +
        'Для того чтобы начать пользоваться VPN Вам необходимо установить программу OpenVPN.Ссылки на официальные источники для скачивания:\n' +
        '<a href="https://apps.apple.com/ru/app/openvpn-connect/id590379981">AppleStore</a>\n' +
        '<a href="https://play.google.com/store/apps/details?id=net.openvpn.openvpn">Google Play</a>\n' +
        '<a href="https://openvpn.net/community-downloads/">Desktop</a>\n' +
        'Далее:\n' +
        '- скачиваете файл, присланный ботом (далее <b>Конфигурационный файл</b>)\n' +
        '- открываете OpenVpn\n' +
        '- <b>Мобильные устройства</b> выбираете вкладку File(Файл), в появившемся списке файлов находите свой <b>Конфигурационный файл</b>, нажимаете кнопку Import(Импорт), на следующем экране нажимаете на кнопку справа вверху Add(Добавить)\n' +
            '- <b>Стационарные компьютеры</b> правой кнопкой мыши кликаете по иконке в панели задач, далее нажимаете импорт конфигурации, указываете свой <b>Конфигурационный файл</b>, после успешного импорта снова правой кнопкой мыши кликаете по иконке в панели задач и выбираете свежедобавленный профиль с таким же именем как и ваш <b>Конфигурационный файл</b>, далее выбираете опцию подключиться'+
        '- Ваш профиль работает, для отключения впн на <b>мобильных устройствах</b> достаточно сдвинуть слайдер влево, на <b>Стационарных компьютерах</b> правой кнопкой мыши кликаете по иконке в панели задач и находите свой профиль и выбираете опцию отключиться',
        { disable_web_page_preview: true})
})


bot.hears('В главное меню', async (ctx) => {
    return await ctx.reply('Выберите опцию', Markup
        .keyboard(basicKeyboard)
        .oneTime()
        .resize()
    )
})

bot.launch()

