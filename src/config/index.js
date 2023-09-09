module.exports = {
  servers: [
    { name: 'Нидерланды один', ip: '185.105.108.8', port: '1194', protocol: 'udp' },
    { name: 'Голландия два', ip: '178.208.66.182', port: '1194', protocol: 'udp' },
    { name: 'Ваканда', ip: '194.190.152.98', port: '443', protocol: 'tcp' },
  ],
  tariffs: {
    "15 дней": {
      text: '15 дней', termUnit: "day", term: 15, price: 1, description: 'Это небольшие деньги, но честные',
    },
    "1 месяц": {
      text: '1 месяц', termUnit: "month", term: 1, price: 150, description: 'Между чашкой кофе и Pepa-VPN на месяц выбор очевиден',
    },
    "3 месяца": {
      text: '3 месяца', termUnit: "month", term: 3, price: 400, description: 'Это как два месяца, но на один побольше',
    },
    "6 месяцев": {
      text: '6 месяцев', termUnit: "month", term: 6, price: 800, description: 'Возможно у Вас в роду были лепреконы или русские олигархи, ПООООООЛГОДА PEPA-VPN',
    },
    "1 год": {
      text: '1 год', termUnit: "year", term: 1, price: 1500, description: 'Ни одно словосочетание не сможет в полной мере описать преимущества данной опции, 1 год/365 дней/8760 часов/525600 минут/более 31 миллиона секунд впна.',
    },
  },
  lastStableVersion: '1.26',
  newFeatures: 'Здравствуй дорогой пользователь! Тебя приветствует релизный вестник Pepa-VPN со сводкой последних доработок и новостей.\n' +
    'В этом релизе мы улучшили стабильность приложения и оплаты, а так же добавили функцию выбора сервера.' +
    'В базовой версии 3 сервера и мы надеемся на то, что список будет расширяться.\n\n' +
    'Последний месяц участились обращения в связи с ситуацией когда при подключении VPN не грузится ни одна страница. Уделим же этому особое внимание:\n' +
    'Эта ситуация связана с блокировкой VPN траффика некоторыми мобильными операторами. Для решения данной проблемы используется новейшая разработка советских ученых - сервер под названием ВАКАНДА.\n' +
    'Просто выбираете в списке серверов данную опцию - подключаетесь и все работает. Ну или не работает - тогда напишите нам :)\n' +
    'Ну и последняя доработка - кнопка Что нового?, вы спросите зачем она нужна? Да мы и сами не знаем, но вроде получилось весело, а что нового у Вас? Пишите нам в бота, подписывайтесь на канал, ставьте лайки, зовите друзей.'
}
