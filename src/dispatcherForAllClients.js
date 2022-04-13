const { Client, conn, bot } = require('./api')


const expiresSubscriptionHandler = async () => {

    const users = await Client.find()

    const promises = users.map(async(user) => {
        await bot.telegram.sendMessage(user.telegramId, 'Привет!\n\nСегодня мы объявляем о завершении тестового периода и переходе к более ' +
            'длинным срокам действия подписок:\n<b>один месяц / три месяца / полгода</b> + оставляем пробный период 15 дней.\n\n' +
            'Всем учавствовавшим в тестовом периоде и имеющим активную подписку - добавлено 3 дня к сроку действия подписки, тем у кого подписка уже истекла - при возобновлении так же будет добавлено 3 дня автоматически.\n\n' +
            'Спасибо, что остаетесь с нами!', { parse_mode: 'HTML' })
        await bot.telegram.sendSticker(user.telegramId, "CAACAgIAAxkBAAIHwWJSvU7yzY6We7E_VONLhTT2-AuoAAJnBAACierlB9ULc0Y6gUESIwQ")
    });

    await Promise.all(promises)
    await conn.close()
    console.log("Dispatched to all!")
}

expiresSubscriptionHandler()