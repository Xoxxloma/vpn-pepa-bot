const { Client, conn, bot } = require('./api')

const shitHappenedDispatcher = async () => {
  const users = await Client.find({isSubscriptionActive: true })
  console.log(users, 'users')
  const usersPromises = users.map(async(user) => {

    try {
      await bot.telegram.sendMessage(user.telegramId, '#Важно\nДобрый день, уважаемые пользователи.\n\nСегодня ночью на стороне нашего провайдера произошел инцидент, результатом которого была полная недоступность нашего приложения и бота.\nНа данный момент работоспособность восстановлена, приносим свои извинения за сложившуюся ситуацию.', {parse_mode: 'HTML'})
    } catch (e) {
      // console.log(e)
    }
  })
  await Promise.all(usersPromises)
  await conn.close()
  console.log('dispatched to all clients!')

}

shitHappenedDispatcher()
