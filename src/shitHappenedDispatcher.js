const { Client, conn, bot } = require('./api')

const shutdownText = '<b>Всем привет!</b>\n\nПоступает большое количество обращений, по поводу того что мы не работаем, шеф все пропало, сломалось и так далее.\n' +
    'Оперативно отвечаем:\n' +
    'Уборщица мирового интернета случайно выдернула вилку из розетки и многим сервисам сильно поплохело, наш vpn в конкретно данном случае не при чем.\n' +
    'У нас уборщицы нет и сейчас мы работаем стабильно (ну хоть когда то).\n\nПоэтому к сожалению повлиять на ситуацию мы никак не можем и остается только ждать, когда' +
    'сильные мира сего соберутся с мыслями и воткнут шнур обратно.\n\n\А чтобы данная рассылка имела еще и коммерческую ценность наш маркетолог, он же копирайтер, он же разработчик' +
    'предложил приложить к этому посту фотографию наших серверов и основателя, а так же ссылку на сервис донатов, <a href="https://pay.cloudtips.ru/p/52899e68">для тех кто пропустил, забыл или не знал</a>'

const prodStickerId = "CAACAgIAAxkBAALoOmX0PjVUce70F_r9sCKihNE9TTARAAKVQQACP8ChSwsDWmTnvKtMNAQ"
const testStickerId = "CAACAgIAAxkBAAIOU2X0ONpMKN-O6UPCF2DrKkC0wgwSAAIIRgACMXCgS6admt3Hk7ctNAQ"
const donationText = '<b>Здравствуйте!\nРазрешите обратиться.</b>\n\nВообще я успешный серийный предприниматель, стартапер, криптоинвестор и ит-евангелист, а впн это так, для души. Так вот о чем это я, <a href="https://pay.cloudtips.ru/p/52899e68">не будет немного мелочи</a>?'

const shitHappenedDispatcher = async () => {
  const users = await Client.find({ isSubscriptionActive: true })
  console.log(users, 'users')
  const usersPromises = users.map(async(user) => {

    try {
      await bot.telegram.sendMessage(user.telegramId, donationText, {parse_mode: 'HTML' })
      await bot.telegram.sendSticker(user.telegramId, prodStickerId)
    } catch (e) {
      console.log(e, 'cannot send')
    }
  })
  await Promise.all(usersPromises)
  await conn.close()
  console.log('dispatched to all clients!')

}

shitHappenedDispatcher()
