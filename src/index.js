const { Markup, Telegraf } = require('telegraf');
const { qiwiApi, bot, Client } = require('./api')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid');
const { basicKeyboard, helpRequest, helpResponse, feedbackRequest, payText, telegramIdRegexp, webAppButton } = require('./consts')
const {
    createBasicBillfields,
    prolongueSubscription,
    getTelegramId,
    getUserByTelegramId,
    getUserName,
    createCertificate,
    notifySupport,
    sendPhotoToSupport,
    isBotBlocked,
    createMessagesToSupport,
    availableIpsWithRemote,
    hasNotExpiredBillWithSameTerm,
    removeCertificate
} = require('./utils')
const dayjs = require('dayjs')
const path = require("path");
const {faqInfoMessage, downloadFrom, startInfoMessage} = require("./consts");
const config = require('./config/index')

const subscribes = config.tariffs

bot.use(Telegraf.log())

const operationResultPoller = async(billId, chatId, interval) => {

    const client = await Client.findOne({'currentBill.billId': billId })


    const checkCondition = async () => {
        try {
            const result = await qiwiApi.getBillInfo(billId)
            if (result.status.value === "WAITING") {
                setTimeout(checkCondition, interval)
            }
            if (result.status.value === 'PAID') {
                const prolongueDate = prolongueSubscription(client.expiresIn, client.currentBill.term, client.currentBill.termUnit)
                let certificatePath;
                let ips = client.ips;

                if (client.isSubscriptionActive) {
                    certificatePath = path.join('/root/', `${client.telegramId}.ovpn`)
                } else {
                    const certificateData = await createCertificate(client.telegramId)
                    ips = certificateData.ips
                    certificatePath = certificateData.certificatePath
                }

                const cert = fs.readFileSync(certificatePath, 'utf8')
                let certToUser = cert

                if (!!ips) {
                    client.ips = ips
                    certToUser = cert.replaceAll('$remotes_here$', availableIpsWithRemote(ips).join('\n'))
                }
                client.isSubscriptionActive = true
                client.expiresIn = prolongueDate
                client.certificate = Buffer.from(cert)
                client.currentBill.status = result.status
                client.paymentsHistory.push(client.currentBill)
                client.currentBill = {}
                await client.save()
                await bot.telegram.sendDocument(chatId,
                    {source: Buffer.from(certToUser), filename: `${client.telegramId}.ovpn`},
                    {
                        parse_mode: 'HTML',
                        caption:`Успешно оплачено!\n\nТвоя подписка активна до: ${prolongueDate.format("DD.MM.YYYY")}\n\n` + downloadFrom
                    })
                await notifySupport(bot, `Приобретена подписка через бота!\n\nПользователь ${client.name}`)
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
            console.log('Error in checkCondition: ', e)
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
    const username = chat.username || ""
    const findedUser = await getUserByTelegramId(telegramId)
    const hasCurrentBill = await hasNotExpiredBillWithSameTerm(findedUser?.currentBill, subscription.term)
    if (findedUser && hasCurrentBill) {
        return await ctx.reply(`Ваша ссылка для оплаты подписки\n${findedUser?.currentBill?.payUrl}`)
    }

    const billId = qiwiApi.generateId()
    const billForSubscription = createBasicBillfields(subscription.price, telegramId)
    const paymentDetails = await qiwiApi.createBill(billId, billForSubscription)

    const billToBase = { billId, term: subscription.term, termUnit: subscription.termUnit, expirationDateTime: billForSubscription.expirationDateTime, payUrl: paymentDetails.payUrl }

    if (findedUser) {
        findedUser.currentBill = billToBase
        await findedUser.save()
    } else {
        const userToBase = {telegramId, name, username, isSubscriptionActive: false, expiresIn: dayjs(), currentBill: billToBase}
        await Client.create(userToBase)
    }

    operationResultPoller(billId, ctx.from.id, 10000)
    return await ctx.reply(`Ваша ссылка для оплаты подписки \n${paymentDetails.payUrl}`)
}

bot.command('testAdd', async (ctx) => {
    const telegramId = ctx.message.text.split(' ')[1]
    const {certificatePath} = await createCertificate(telegramId)
    return await ctx.reply('certificatePath: '+certificatePath)
})

bot.command('testRevoke', async (ctx) => {
    const telegramId = ctx.message.text.split(' ')[1]
    const certificatePath = await removeCertificate(telegramId)
    return await ctx.reply('certificatePath: '+certificatePath)
})
bot.telegram.setMyCommands([{command: '/keyboard', description: 'Вызов клавиатуры бота'}])

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
            console.log('Error in bot.use', e)
            fs.appendFileSync('./log.txt', JSON.stringify(e))
            return await ctx.reply('Произошла ошибка, попробуйте позже')
        }
    }

    await next()
})

//-------------- COMMANDS BLOCK -------------- //

bot.command('start', async (ctx) => {
    const telegramId = getTelegramId(ctx)
    const findedUser = await Client.findOne({ telegramId })
    try {
        if (ctx.message.text.includes('auth')) {
            const authCode = uuidv4()
            const username = ctx.update.message.from.username
            if (findedUser) {
                if (findedUser.authCode) {
                    await bot.telegram.sendMessage(telegramId, 'Используй этот код для регистрации в приложении')
                    return await ctx.reply(findedUser.authCode)
                } else {
                    findedUser.authCode = authCode
                    await findedUser.save()
                }
            } else {
                const { chat } = ctx
                const name = `${chat.first_name} ${chat.last_name || ''}`.trim()
                const prolongueDate = prolongueSubscription(dayjs(), 3, "day")
                const { certificatePath, ips } = await createCertificate(telegramId)
                const cert = fs.readFileSync(certificatePath, 'utf8')
                const userToBase = {telegramId, name, username, expiresIn: prolongueDate, isSubscriptionActive: true, certificate: Buffer.from(cert), authCode, ips }
                await Client.create(userToBase)
                await bot.telegram.sendMessage(telegramId, 'Для тебя активирован триал период сроком на 3 дня. Приятного пользования!')
            }
            await bot.telegram.sendMessage(telegramId, 'Используй этот код для регистрации в приложении')
            return await ctx.reply(authCode)
        } else {
            if (findedUser) {
                await ctx.reply("Я рад снова вас видеть, с возвращением!")
                return await ctx.reply('Выберите опцию', Markup
                  .keyboard(basicKeyboard)
                  .oneTime()
                  .resize()
                )
            } else {
                await bot.telegram.sendPhoto(
                  ctx.from.id,
                  'AgACAgIAAxkBAAIMwGJubUyAb1RGDkmlt2YVLS-LwerHAAI1uDEbchFwS3mlZ3Pg0niAAQADAgADeQADJAQ',
                  {parse_mode: 'HTML', caption: startInfoMessage}
                )
                await bot.telegram.sendMessage(ctx.from.id, "Для тебя активна <b>бесплатная подписка на 3 дня\n<tg-spoiler>/getTrial</tg-spoiler> !</b> Попробуй, понравится - присоединяйся :)", { parse_mode: 'HTML' })
                return await ctx.reply('Выберите опцию', Markup
                  .keyboard(basicKeyboard)
                  .oneTime()
                  .resize()
                )
            }
        }
    } catch (e) {
        console.log('Error on Start', e)
        await bot.telegram.sendMessage(ctx.from.id, "Произошла ошибка, попробуйте позднее")
    }
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
    const username = ctx.message.from.username || ''

    try {
        if (!findedUser) {
            const prolongueDate = prolongueSubscription(dayjs(), 3, "day")
            const { certificatePath, ips } = await createCertificate(telegramId)
            const cert = fs.readFileSync(certificatePath, 'utf8')
            const certToClient = cert.replaceAll('$remotes_here$', availableIpsWithRemote(ips).join('\n'))
            const userToBase = {telegramId, name, username, isSubscriptionActive: true, expiresIn: prolongueDate, currentBill: {}, certificate: Buffer.from(cert), ips}
            await Client.create(userToBase)
            await ctx.telegram.sendDocument(ctx.from.id,
                {source: Buffer.from(certToClient), filename: `${telegramId}.ovpn`},
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
        console.log('Error on get trial', e)
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
        console.log('Error in help feedback', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return await ctx.reply('Произошла ошибка, попробуйте снова')
    }
})

bot.hears(helpResponse, async(ctx) => {
    const {message: { text}} = ctx
    try {
        const {message: {from : { id }}} = ctx
        const clientTelegramId = text.match(telegramIdRegexp)[0]
        const responseText = text.replace(telegramIdRegexp, '').replace(helpResponse, '').trimLeft()
        const client = await Client.findOne({ telegramId: clientTelegramId })
        client.messageList.push({ sender: 'Поддержка', timestamp: dayjs(), text: responseText, telegramId: id })
        await client.save()
        await notifySupport(bot, `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`)
        return await bot.telegram.sendMessage(clientTelegramId, `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`, { parse_mode: 'HTML'})
    } catch (e) {
        console.log('Error in helpResponse', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return await ctx.reply('Ошибка, проверьте правильность введенной информации по паттерну [ответ поддержки] [id пользователя] [текст ответа]')
    }
})
//-------------- SUPPORT BLOCK -------------- //

//-------------- SUBSCRIPTION BLOCK -------------- //

bot.hears('Моя подписка', async (ctx) => {
    try {
        const telegramId = ctx.update.message.from.id
        const findedUser = await Client.findOne({telegramId})
        if (!findedUser) {
            await ctx.telegram.sendMessage(telegramId, 'Не можем найти вас среди наших клиентов, давайте исправим это недоразумение?)')
            return await ctx.reply('Выберите опцию', Markup
              .keyboard([[webAppButton], ['В главное меню']])
              .oneTime()
              .resize()
            )
        }
        if (findedUser.isSubscriptionActive) {
            await ctx.reply(`Срок действия подписки: ${dayjs(findedUser.expiresIn).format("DD.MM.YYYY")}г.` , Markup
              .inlineKeyboard([
                  [{text: 'Посмотреть новый личный кабинет в боте', web_app: { url: 'https://pepavpn.ru/'} }]
              ]))
        } else {
            await ctx.reply('У вас нет активной подписки')
        }

        const buttons = findedUser.isSubscriptionActive ? ['Получить заново сертификат'] : ['Выбрать подписку']
        return await ctx.reply('Выберите опцию', Markup
            .keyboard([buttons, ['В главное меню']])
            .oneTime()
            .resize()
        )
    } catch (e) {
        console.log('Error in Моя подписка', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return ctx.reply("Произошла ошибка, попробуйте позднее")
    }
})

bot.hears(['Получить заново сертификат', 'Обратно к выбору сервера'], async (ctx) => {
    const telegramId = getTelegramId(ctx)
    try {
        const client = await Client.findOne({telegramId})
        const bttns = config.servers.filter((s) => client.ips.includes(s.ip)).map((s) => [s.name])

        if (!bttns.length) {
            await ctx.telegram.sendDocument(ctx.from.id,
              {source: Buffer.from(client.certificate), filename: `${telegramId}.ovpn`},
              {
                  parse_mode: 'HTML',
                  caption: 'Кажется у вас всего один доступный сервер, вот ваш сертификат :) Если Вам кажется, что здесь должно было быть больше опций - обратитесь в службу поддержки и мы Вам поможем.'
              })
        } else {
            return await ctx.reply('Выберите сервер из списка ниже и мы сформируем сертификат', Markup
              .keyboard([...bttns, ['В главное меню']])
              .oneTime()
              .resize()
            )
        }
    } catch (e) {
        console.log('Error in Получить заново сертификат', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return ctx.reply("Произошла ошибка, попробуйте позднее или обратитесь в поддержку, мы обязательно Вам поможем.")
    }
})

bot.hears(config.servers.map(s => s.name), async (ctx) => {
    const serverName = ctx?.message?.text
    const telegramId = getTelegramId(ctx)
    try {
        const client = await Client.findOne({telegramId})
        const pickedInstance = config.servers.find((s) => s.name === serverName)
        if (!pickedInstance) {
            return await ctx.reply('Произошла чудовищная ошибка и мы не распознали желаемый сервер, выберите новый или обратитесь в поддержку', Markup
              .keyboard([['Обратно к выбору сервера'], ['В главное меню']])
              .oneTime()
              .resize()
            )
        }
        let cert = ''
        if (pickedInstance.protocol === 'tcp') {
            cert = client.certificate
              .replace('explicit-exit-notify', '')
              .replace('udp', 'tcp')
              .replace('$remotes_here$', `remote ${pickedInstance.ip} ${pickedInstance.port}`)

        } else {
            cert = client.certificate.replace('$remotes_here$', `remote ${pickedInstance.ip} ${pickedInstance.port} ${pickedInstance.protocol}`)
        }

        await ctx.telegram.sendDocument(ctx.from.id,
          {source: Buffer.from(cert), filename: `${telegramId}_${serverName}.ovpn`},
          {
              parse_mode: 'HTML',
              caption: `Вот он с пылу с жару, мудрость и опыт поколений сжатый до одного текстового файла. Вы же точно хотели сервер ${serverName}? Надеемся мы ничего там внутри не перепутали.`
          })

        return await ctx.reply('Выберите опцию', Markup
          .keyboard([['Обратно к выбору сервера'], ['В главное меню']])
          .oneTime()
          .resize()
        )
    } catch (e) {
        console.log('Error in Выбор сертификата', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return ctx.reply("Произошла ошибка, попробуйте позднее или обратитесь в поддержку, мы обязательно Вам поможем.")
    }
})

//-------------- SUBSCRIPTION BLOCK -------------- //

//-------------- FAQ BLOCK -------------- //

bot.hears('Инструкция', async (ctx) => {
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
bot.hears('О нас', async (ctx) => {
    await bot.telegram.sendMessage(ctx.from.id, '<b>VPN Сервис "Pepa VPN"</b>\n' +
      'Когда то основаны, чтобы когда то прекратить существование. Мчимся словно бабочка сознанья из ниоткуда в никуда\n\n' +
      'По всем вопросам обращайтесь на почту vpnpepa@gmail.com или просто напишите в бота - мы обязательно ответим.' , { parse_mode: 'HTML' })

    return await ctx.reply('Выберите опцию', Markup
      .keyboard([['В главное меню']])
      .oneTime()
      .resize()
    )
})
//-------------- CONTACTS BLOCK -------------- //

bot.hears(/./, async (ctx) => {
    const { message } = ctx
    const name = getUserName(message)
    const messageToSupport = `Сообщение от пользователя ${name} с id <b>${message.from.id}</b>\n${message.text}`
    await notifySupport(bot, messageToSupport)
})

bot.on('message', async(ctx) => {
    if (ctx?.message?.web_app_data) {
        const subscription = JSON.parse(ctx.message.web_app_data.data)
        try {
            const { message } = ctx
            const {from : {id, username, first_name, last_name }} = message
            const name = username ? `@${username}` : `${first_name} ${last_name ?? ''}`
            const messageToSupport = `Сообщение от пользователя ${name} с id <b>${id}</b>\n${message.web_app_data.data}`
            await notifySupport(bot, messageToSupport)
            await paymentHandler(ctx, subscription)
        } catch (e) {
            console.log('Error on message', e)
            fs.appendFileSync('./log.txt', JSON.stringify(e))
            return await ctx.reply('Произошла ошибка, попробуйте позже')
        }
    }
    if (ctx?.message?.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1]
        const name = getUserName(ctx.message)
        const caption = `Фото от пользователя ${name} с id <b>${ctx.message.from.id}</b>\n${ctx.message?.caption || ''}`
        await sendPhotoToSupport(bot, photo.file_id, {caption, parse_mode: "HTML"} )
    }
})

bot.launch()

bot.catch((err) => {
    console.log(`bot crashed cause of ${err} DATE TIME IS ${new Date()}`)
    bot.stop()
    bot.launch()
})


// bot.action(['Good', 'Bad'], async(ctx) => {
//     const { data, from, message } = ctx.update.callback_query
//     const userName = from.username ? `@${from.username}` : `${from.first_name} ${from.last_name ?? ''}`
//
//     if (data === 'Good') {
//         await bot.telegram.sendMessage(ctx.from.id, 'Благодарим за участие в опросе, очень рады что вам все нравится ❤️️️')
//     } else {
//         await bot.telegram.sendMessage(ctx.from.id, 'Нам крайне жаль, что у вас осталось негативное впечатление от использование сервиса.\n' +
//             'Напишите нам, что вызвало трудности и не понравилось и мы обязательно станем лучше 💔.\n' +
//             'Отправьте нам свой фидбэк на почту vpnpepa@gmail.com или же напишите боту, предложение начните со слова фидбэк.\n\n' +
//             'Например: фидбэк хотелось бы более гибкие тарифы.')
//     }
//     await bot.telegram.editMessageReplyMarkup(from.id, message.message_id)
//     await notifySupport(bot, `#Опрос\nПользователь ${userName}, оценка: #${data}`)
// })
