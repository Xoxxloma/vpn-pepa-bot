const { Client, conn, bot } = require('./api')

const shutdownText = '<b>Всем привет!</b>\n\nПоступает большое количество обращений, по поводу того что мы не работаем, шеф все пропало, сломалось и так далее.\n' +
    'Оперативно отвечаем:\n' +
    'Уборщица мирового интернета случайно выдернула вилку из розетки и многим сервисам сильно поплохело, наш vpn в конкретно данном случае не при чем.\n' +
    'У нас уборщицы нет и сейчас мы работаем стабильно (ну хоть когда то).\n\nПоэтому к сожалению повлиять на ситуацию мы никак не можем и остается только ждать, когда' +
    'сильные мира сего соберутся с мыслями и воткнут шнур обратно.\n\n\А чтобы данная рассылка имела еще и коммерческую ценность наш маркетолог, он же копирайтер, он же разработчик' +
    'предложил приложить к этому посту фотографию наших серверов и основателя, а так же ссылку на сервис донатов, <a href="https://pay.cloudtips.ru/p/52899e68">для тех кто пропустил, забыл или не знал</a>'

const prodStickerId = "CAACAgIAAxkBAALoOmX0PjVUce70F_r9sCKihNE9TTARAAKVQQACP8ChSwsDWmTnvKtMNAQ"
const testStickerId = "CAACAgIAAxkBAAIOU2X0ONpMKN-O6UPCF2DrKkC0wgwSAAIIRgACMXCgS6admt3Hk7ctNAQ"
const pepaOnlyFans = "CAACAgIAAxkBAALp32X0XSJO9qyXxK3qv5WUmmGnnC8hAAKiQgACP8ChSzonRCR7A_A1NAQ"
const pepaTerminator = "CAACAgIAAxkBAAL6_GZ9MOdSdSOxL623hjCH6WCswcgWAALySgACeXLoS6fNbgQvS7-tNQQ"
const weWasBanned = '<b>Скайнет повержен, апокалипсис отложен, работа сервиса восстановлена.</b>\n\nПри возникновении проблем:\nскачайте сертификат из бота заново / рефрешните наше приложение.\nЕсли данные действия не помогут - напишите нам, мы попробуем разобраться.\n\n' +
    'Раз уж появился повод для рассылки, наш PR-менеджер просил переслать следующий текст (Публикуется с сохранением орфографии):\n\n' +
    '<b>"</b>Благодарим всех, кто донатит на поддержание сервиса и напоминаем, что <b>на одежду, мотоцикл, а так же спасение Джона Коннора</b> всегда можно кинуть сотку в стакан / оформить подписку <a href="https://boosty.to/pepavpn/donate">здесь</a><b>"</b>'


const shitHappenedDispatcher = async () => {
  const users = await Client.find({ isSubscriptionActive: true })
  console.log(users, 'users')
  const usersPromises = users.map(async(user) => {

    try {
      await bot.telegram.sendMessage(user.telegramId, weWasBanned, {parse_mode: 'HTML', disable_web_page_preview: true })
      await bot.telegram.sendSticker(user.telegramId, pepaTerminator)
    } catch (e) {
      console.log(e, 'cannot send')
    }
  })
  await Promise.all(usersPromises)
  await conn.close()
  console.log('dispatched to all clients!')
}

shitHappenedDispatcher()
