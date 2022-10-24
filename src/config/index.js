const config = {
  servers: [
    { name: 'Нидерланды', ip: '185.105.108.208', port: '1194' },
    { name: 'Аргентина', ip: '178.208.86.97', port: '1194' },
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
      text: '1 год', termUnit: "year", term: 1, price: 3000, description: 'Подписку на год пока не продаем, только показываем. Но скоро точно будем продавать, когда нарисуем лягушку-рэпера, чтобы подчеркнуть всю роскошь и богатство этой опции',
    },
  },
  lastStableVersion: '1.20',
}

module.exports = {
  config
}
