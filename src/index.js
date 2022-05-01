const { Markup, Telegraf } = require('telegraf');
const { qiwiApi, bot, Client } = require('./api')
const fs = require('fs')
const { basicKeyboard, subscribes, helpRequest, helpResponse, feedbackRequest, payText, telegramIdRegexp, dimaID, kostyaId } = require('./consts')
const { createBasicBillfields, prolongueSubscription, getTelegramId, getUserByTelegramId, createCertificate, isThatSameBill, notifySupport, isBotBlocked, createMessagesToSupport } = require('./utils')
const dayjs = require('dayjs')
const {faqInfoMessage, downloadFrom, startInfoMessage} = require("./consts");


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
                await bot.telegram.sendDocument(chatId,
                    {source: certificatePath, filename: `${client.telegramId}.ovpn`},
                        {
                            parse_mode: 'HTML',
                            caption:`Успешно оплачено!\n\nТвоя подписка активна до: ${prolongueDate.format("DD.MM.YYYY")}\n\n` + downloadFrom
                        })
            }
            if (result.status.value === 'REJECTED') {
                client.currentBill.status = result.status
                client.paymentsHistory.push(client.currentBill)
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
            fs.appendFileSync('./log.txt', JSON.stringify(e))
            if (!isBotBlocked(e)) {
                await bot.telegram.sendMessage(chatId, 'Произошла ошибка, повторите попытку позже или напишите нам')
            }
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
            fs.appendFileSync('./log.txt', JSON.stringify(e))
            return await ctx.reply('Произошла ошибка, попробуйте позже')
        }
    }

    await next()
})

//-------------- COMMANDS BLOCK -------------- //

bot.command('start', async (ctx) => {
    await bot.telegram.sendPhoto(
        ctx.from.id,
        'AgACAgIAAxkBAAICVGJuYclbZGUMu0TT6Xd_C6oMwmv1AAJQujEbg2B4S_QdyBxs8cXsAQADAgADeQADJAQ',
        {parse_mode: 'HTML', caption: startInfoMessage}
        )
    await bot.telegram.sendMessage(ctx.from.id, "Для тебя активна <b>бесплатная подписка на 3 дня\n<tg-spoiler>/getTrial</tg-spoiler> !</b> Попробуй, понравится - присоединяйся :)", { parse_mode: 'HTML' })
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

bot.command('getTrial', async (ctx) => {
    const telegramId = ctx.message.from.id
    const { chat } = ctx
    const name = `${chat.first_name} ${chat.last_name || ''}`.trim()
    const findedUser = await getUserByTelegramId(telegramId)

    try {
        if (!findedUser) {
            const prolongueDate = prolongueSubscription(dayjs(), 3, "day")
            const certificatePath = await createCertificate(telegramId)
            const cert = fs.readFileSync(certificatePath)
            const userToBase = {telegramId, name, isSubscriptionActive: true, expiresIn: prolongueDate, currentBill: {}, certificate: Buffer.from(cert)}
            await Client.create(userToBase)
            await ctx.telegram.sendDocument(ctx.from.id,
                {source: certificatePath, filename: `${telegramId}.ovpn`},
                {
                    parse_mode: 'HTML',
                    caption: `Твоя подписка активна до: ${prolongueDate.format("DD.MM.YYYY")}\n\n` + downloadFrom
                })
        } else {
            await ctx.telegram.sendMessage(ctx.from.id, 'К сожалению, услуга доступна только для новых клиентов')
            await ctx.telegram.sendSticker(ctx.from.id, 'CAACAgIAAxkBAAICJGJuVW2T3Ldh4i6q8X3xTe5pgdvAAAJeBAACierlB5mrkRLww5GWJAQ')
        }

        return await ctx.reply('Выберите опцию', Markup
            .keyboard(basicKeyboard)
            .oneTime()
            .resize()
        )
    } catch (e) {
        if (!isBotBlocked(e)) {
            await ctx.telegram.sendMessage(ctx.from.id, 'Что то пошло не так, попробуйте позднее')
        }
    }

})

//-------------- COMMANDS BLOCK -------------- //


//-------------- NAVIGATION BLOCK -------------- //

bot.hears(['Выбрать подписку', 'Обратно к выбору подписки'], async (ctx) => {
    return await ctx.reply('Выберите опцию', Markup
        .keyboard([Object.keys(subscribes), ['В главное меню']])
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

//-------------- NAVIGATION BLOCK -------------- //


//-------------- SUPPORT BLOCK -------------- //

bot.hears([helpRequest, feedbackRequest], async (ctx) => {
    const [messageToClient, messageToSupport] = createMessagesToSupport(ctx)

    try {
        await notifySupport(bot, messageToSupport)
        return await ctx.reply(messageToClient)
    } catch (e) {
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return await ctx.reply('Произошла ошибка, попробуйте снова')
    }
})

bot.hears(helpResponse, async(ctx) => {
    const {message: { text}} = ctx
    try {
        const {message: {from : {id }}} = ctx
        const chatId = text.match(telegramIdRegexp)[0]
        const responseText = text.replace(telegramIdRegexp, '').replace(helpResponse, '').trimLeft()
        await bot.telegram.sendMessage(id === dimaID ? kostyaId : dimaID, `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`, { parse_mode: 'HTML'})
        return await bot.telegram.sendMessage(chatId, `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`, { parse_mode: 'HTML'})
    } catch (e) {
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return await ctx.reply('Ошибка, проверьте правильность введенной информации по паттерну [ответ поддержки] [id пользователя] [текст ответа]')
    }
})

bot.action(['Good', 'Bad'], async(ctx) => {
    const { data, from, message } = ctx.update.callback_query
    const userName = from.username ? `@${from.username}` : `${from.first_name} ${from.last_name ?? ''}`

    if (data === 'Good') {
        await bot.telegram.sendMessage(ctx.from.id, 'Благодарим за участие в опросе, очень рады что вам все нравится ❤️️️')
    } else {
        await bot.telegram.sendMessage(ctx.from.id, 'Нам крайне жаль, что у вас осталось негативное впечатление от использование сервиса.\n' +
            'Напишите нам, что вызвало трудности и не понравилось и мы обязательно станем лучше 💔.\n' +
            'Отправьте нам свой фидбэк на почту vpnpepa@gmail.com или же напишите боту, предложение начните со слова фидбэк.\n\n' +
            'Например: фидбэк хотелось бы более гибкие тарифы.')
    }
    await bot.telegram.editMessageReplyMarkup(from.id, message.message_id)
    await notifySupport(bot, `#Опрос\nПользователь ${userName}, оценка: #${data}`)
})

//-------------- SUPPORT BLOCK -------------- //

//-------------- SUBSCRIPTION BLOCK -------------- //

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
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return ctx.reply("Произошла ошибка, попробуйте позднее")
    }
})

bot.hears('Получить заново сертификат', async (ctx) => {
    const telegramId = getTelegramId(ctx)
    const findedUser = await Client.findOne({telegramId})
    await bot.telegram.sendMessage(ctx.from.id, 'Используйте этот файл для импорта в openVPN, более подробно в инструкции в разделе FAQ')
    return await ctx.replyWithDocument({source: Buffer.from(findedUser.certificate), filename: `${findedUser.telegramId}.ovpn`})
})

//-------------- SUBSCRIPTION BLOCK -------------- //

//-------------- FAQ BLOCK -------------- //

bot.hears('FAQ', async (ctx) => {
    await bot.telegram.sendMessage(ctx.from.id, faqInfoMessage, { parse_mode: 'HTML', disable_web_page_preview: true})
    return await ctx.reply('Выберите опцию', Markup
        .keyboard([['Получить подробную инструкцию в PDF'], ['В главное меню']])
        .oneTime()
        .resize()
    )
})

bot.hears('Получить подробную инструкцию в PDF', async (ctx) => {
    return await ctx.replyWithDocument({source: './howTo.pdf', filename: 'Инструкция.pdf'})
})
//-------------- FAQ BLOCK -------------- //


//-------------- CONTACTS BLOCK -------------- //
bot.hears('Контакты', async (ctx) => {
    return await ctx.reply('По всем вопросам на почту vpnpepa@gmail.com или напиши боту, свое сообщение начните со слова ПОМОЩЬ и далее текст своего вопроса.\n\nНапример: помощь не пришел впн профиль.')
})
//-------------- CONTACTS BLOCK -------------- //

bot.launch()
