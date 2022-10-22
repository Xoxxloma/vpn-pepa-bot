const { Client, conn, bot } = require('./api')
const { reminders } = require('./consts')
const dayjs = require('dayjs')


const expiresSubscriptionHandler = async () => {

    const users = await Client.find()
    const usersPromises = users.map(async(user) => {
        const diff = dayjs(user.expiresIn).diff(dayjs(), 'day')
        if (Boolean(reminders[diff])) {
            try {
            await bot.telegram.sendMessage(user.telegramId, reminders[diff].text)
            await bot.telegram.sendSticker(user.telegramId, reminders[diff].sticker)
            } catch (e) {
                // console.log(e)
            }
        }
    })
    await Promise.all(usersPromises)
    await conn.close()
    console.log('dispatched to all clients!')

}

expiresSubscriptionHandler()
