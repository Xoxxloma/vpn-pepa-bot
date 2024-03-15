const { Markup, Telegraf } = require('telegraf');
const { bot } = require('./api')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid');
const { basicKeyboard, helpRequest, helpResponse, feedbackRequest, payText, telegramIdRegexp, webAppButton } = require('./consts')
const {
    prolongueSubscription,
    getTelegramId,
    getUserName,
    createCertificate,
    notifySupport,
    sendPhotoToSupport,
    isBotBlocked,
    createMessagesToSupport,
    availableIpsWithRemote,
    removeCertificate,
    createUserFields
} = require('./utils')
const dayjs = require('dayjs')
const path = require("path");
const {faqInfoMessage, downloadFrom, startInfoMessage} = require("./consts");
const config = require('./config/index')
const axios = require("axios");

bot.use(Telegraf.log())

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


//-------------- COMMANDS BLOCK -------------- //

bot.command('start', async (ctx) => {
    const telegramId = getTelegramId(ctx)
    try {
        const { data: findedUser } = await axios.get(`http://localhost:4003/getClientByTelegramId/${telegramId}`)
        if (ctx.message.text.includes('auth')) {
            if (findedUser) {
                if (findedUser.authCode) {
                    await bot.telegram.sendMessage(telegramId, 'Используй этот код для регистрации в приложении')
                    return await ctx.reply(findedUser.authCode)
                } else {
                    const authCode = uuidv4()
                    await axios.post('http://localhost:4003/updateUser', { telegramId, user: { authCode }})
                    await bot.telegram.sendMessage(telegramId, 'Используй этот код для регистрации в приложении')
                    return await ctx.reply(authCode)
                }
            } else {
                const userFields = await createUserFields(ctx)
                await axios.post('http://localhost:4003/createUser', userFields)
                await bot.telegram.sendMessage(telegramId, 'Твой аккаунт активирован.\nИспользуй код ниже, для регистрации в приложении.\nПриятного пользования!')
                return await ctx.reply(userFields.authCode)
            }
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
                const userFields = await createUserFields(ctx)
                await axios.post('http://localhost:4003/createUser', userFields)
                const certToClient = userFields.certificate.replaceAll('$remotes_here$', availableIpsWithRemote(userFields.ips).join('\n'))
                await ctx.telegram.sendDocument(ctx.from.id,
                  {source: Buffer.from(certToClient), filename: `${telegramId}.ovpn`},
                  {
                      parse_mode: 'HTML',
                      caption: `Приветствуем тебя избранный!\n\nСообщаем что твой аккаунт активирован.\n\n` + downloadFrom
                  })
                return await ctx.reply('Выберите опцию', Markup
                  .keyboard(basicKeyboard)
                  .oneTime()
                  .resize()
                )
            }
        }
    } catch (e) {
        console.log('Error on Start', e)
        await notifySupport(bot, `Произошла ошибка в команде start, telegramId ${telegramId}, reason: ${e}`)
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

//-------------- COMMANDS BLOCK -------------- //


//-------------- NAVIGATION BLOCK -------------- //

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
        const telegramId = text.match(telegramIdRegexp)[0]
        const responseText = text.replace(telegramIdRegexp, '').replace(helpResponse, '').trimLeft()
        const { data: client } = await axios.get(`http://localhost:4003/getClientByTelegramId/${telegramId}`)
        const messageList = [...client.messageList, { sender: 'Поддержка', timestamp: dayjs(), text: responseText, telegramId: id }]
        await axios.post(`http://localhost:4003/updateUser`, { telegramId, user: {messageList}})
        const message = `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`
        await notifySupport(bot, message)
        return await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML'})

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
        const { data: findedUser } = await axios.get(`http://localhost:4003/getClientByTelegramId/${telegramId}`)
        if (!findedUser) {
            await ctx.telegram.sendMessage(telegramId, 'Не можем найти вас среди наших клиентов, давайте исправим это недоразумение?)')
            return await ctx.reply('Выберите опцию', Markup
              .keyboard([['Активировать профиль'], ['В главное меню']])
              .oneTime()
              .resize()
            )
        }
        if (!findedUser.isSubscriptionActive) {
            await ctx.reply('Кажется у вас нет активированного профиля')
        }

        const buttons = findedUser.isSubscriptionActive ? ['Выбор сервера'] : ['Активировать профиль']
        return await ctx.reply('Выберите опцию', Markup
            .keyboard([buttons, ['В главное меню']])
            .oneTime()
            .resize()
        )
    } catch (e) {
        console.log('Error in Моя подписка', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return ctx.reply("Произошла ошибка, попробуйте позднее или обратитесь в поддержку написав в бота")
    }
})

bot.hears(['Активировать профиль'], async (ctx) => {
    const telegramId = getTelegramId(ctx)
    try {
        const { certificatePath, ips } = await createCertificate(telegramId)
        const certificate = fs.readFileSync(certificatePath, 'utf8')
        await axios.post(`http://localhost:4003/updateUser`, { telegramId, user: { certificate, isSubscriptionActive: true, ips, expiresIn: dayjs().add(10, 'year') }})
        const certToClient = certificate.replaceAll('$remotes_here$', availableIpsWithRemote(ips).join('\n'))
        await ctx.telegram.sendDocument(ctx.from.id,
            {source: Buffer.from(certToClient), filename: `${telegramId}.ovpn`},
            {
                parse_mode: 'HTML',
                caption: `Приветствуем тебя избранный!\n\nСообщаем что твой аккаунт активирован.\n\n` + downloadFrom
            })
        return await ctx.reply('Выберите опцию', Markup
            .keyboard(basicKeyboard)
            .oneTime()
            .resize()
        )
    } catch (e) {
        console.log('Error in Активировать профиль', e)
        return ctx.reply("Произошла ошибка, попробуйте позднее или обратитесь в поддержку написав в бота")
    }

})

bot.hears(['Выбор сервера', 'Обратно к выбору сервера'], async (ctx) => {
    const telegramId = getTelegramId(ctx)
    try {
        const { data: client } = await axios.get(`http://localhost:4003/getClientByTelegramId/${telegramId}`)
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
        console.log('Error in Выбор сервера', e)
        fs.appendFileSync('./log.txt', JSON.stringify(e))
        return ctx.reply("Произошла ошибка, попробуйте позднее или обратитесь в поддержку, мы обязательно Вам поможем.")
    }
})

bot.hears(config.servers.map(s => s.name), async (ctx) => {
    const serverName = ctx?.message?.text
    const telegramId = getTelegramId(ctx)
    try {
        const { data: client } = await axios.get(`http://localhost:4003/getClientByTelegramId/${telegramId}`)
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
        if (helpResponse.test(ctx?.message?.caption)) {
            const { caption } = ctx.message
            const telegramId = caption.match(telegramIdRegexp)[0]
            const responseText = caption.replace(telegramIdRegexp, '').replace(helpResponse, '').trimLeft()
            const message = `#Поддержка\n<b>Ответ службы поддержки</b>\n${responseText}`
            await sendPhotoToSupport(bot, photo.file_id, {caption: message, parse_mode: "HTML"} )
            await bot.telegram.sendPhoto(telegramId, photo.file_id, {caption: message, parse_mode: "HTML"})
        } else {
            const name = getUserName(ctx.message)
            const caption = `Фото от пользователя ${name} с id <b>${ctx.message.from.id}</b>\n${ctx.message?.caption || ''}`
            await sendPhotoToSupport(bot, photo.file_id, {caption, parse_mode: "HTML"} )
        }
    }
})

bot.launch()

bot.catch((err) => {
    console.log(`bot crashed cause of ${err} DATE TIME IS ${new Date()}`)
    bot.stop()
    bot.launch()
})
