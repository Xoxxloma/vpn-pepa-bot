const { Client, conn, bot } = require('./api')

const quizActiveUsersHandler = async () => {
    try {
        const users = await Client.find({ isSubscriptionActive: true })
        const usersPromises = users.map(async(user) => {
            await bot.telegram.sendPhoto(user.telegramId, "https://ru-static.z-dn.net/files/d20/4aa2877ed84590b5b8d0a9359170e3a1.png", {
                caption: 'Оцените, пожалуйста, общее впечатление от пользования сервисом.',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '😃 Отлично', callback_data: 'Good'},
                            { text: '😡 Плохо', callback_data: 'Bad'}
                        ]
                    ]
                }
            })
        })
        await Promise.all(usersPromises)
        await conn.close()
        console.log('quiz has been finished!')
    } catch (e) {
        console.log(e)
    }
}

quizActiveUsersHandler()