const webAppButton = {text: 'Донат', web_app: { url: 'https://pepavpn.ru/' } }
const basicKeyboard = [[webAppButton], ["Моя подписка"], ['Инструкция', 'О нас']]

const dimaID = process.env.DIMA_TELEGRAM_ID
const kostyaId = process.env.KOSTYA_TELEGRAM_ID

const subscribes = {
    "15 дней": {
        text: '15 дней', termUnit: "day", term: 15, price: 85
    },
    "1 месяц": {
        text: '1 месяц', termUnit: "month", term: 1, price: 150
    },
    "3 месяца": {
        text: '3 месяца', termUnit: "month", term: 3, price: 400
    },
    "6 месяцев": {
        text: '6 месяцев', termUnit: "month", term: 6, price: 800
    },
}

const reminders = {
    0: {
        text: "Твоя подписка истекает уже сегодня",
        sticker: "CAACAgIAAxkBAAIBDWJZiG3Lqqq0ExLFi3Vny3M5Qc9OAALmAwACierlBzMAAWjb3S3WBiME"
    },
    3: {
        text: "Напоминаем, что твоя подписка истекает через 3 дня",
        sticker: "CAACAgQAAxkBAAIBDmJZiKfJRM0p1tuPUO4b46sM0fK3AAJBAQACqCEhBq9mxhtt7kuLIwQ"
    },
    5: {
        text: "Напоминаем, что твоя подписка истекает через 5 дней",
        sticker: "CAACAgIAAxkBAAIBDGJZiDP891J52w0PulOGyGHpv8QHAALlAwACierlB1lbJym0nl3aIwQ"
    }
}

const helpRequest = /^помощь/i
const feedbackRequest = /^фидбэк/i
const helpResponse = /^ответ поддержки/i
const payText = /^Оплатить/i
const telegramIdRegexp = /\d{7,12}/i

const startInfoMessage = "<b>Добрый день, я VPN бот, рад приветствовать тебя.</b>\n\n" +
    "Мы полностью бесплатный VPN сервис без рекламы, существующий на добровольных донатах пользователей.\n" +
    "Чтобы вызвать клавиатуру для взаимодействия со мной - напиши команду /keyboard.\n" +
    "Основные разделы:\n- <b>«Донат»</b> - позволит оставить тебе любую сумму в поддержку нашего сервиса и оплату серверов\n" +
    "- <b>«Моя подписка»</b> - поможет активировать аккаунт, если это еще не сделано, покажет список доступных серверов и поможет скачать сертификаты под каждый сервер\n" +
    "- <b>«Инструкция»</b> - расскажет процедуру подключения и работы с VPN\n" +
    "- <b>«О нас»</b> - если возникнут какие-нибудь вопросы или проблемы - здесь ты найдешь наши контакты.\n\n" +
    "На этом все, приятного пользования сервисом!."

const faqInfoMessage = 'После активации аккаунта бот в течение нескольких минут пришлет вам файл ******.ovpn.\n' +
    'Это базовый сервер для пользования, больше серверов ты сможешь найти в разделе Моя подписка -> Выбор сервера\n\n' +
    'Если у вас телефон на базе Android - просто скачайте наше приложение <a href="https://play.google.com/store/apps/details?id=com.pepavpn">Pepa VPN</a>\n' +
    'Для использования нашего VPN на айфонах рекомендуем VPN-клиент Passepartout или стандартный openVPN.\n\nСсылки на официальные источники для скачивания:\n' +
    '<a href="https://apps.apple.com/us/app/passepartout-vpn-client/id1433648537">Passepartout AppleStore</a>\n' +
    '<a href="https://apps.apple.com/ru/app/openvpn-connect/id590379981">openVPN AppleStore</a>\n' +
    '<a href="https://openvpn.net/community-downloads/">Desktop</a>\n\n' +
    'Далее:\n' +
    '- скачиваете файл (или файлы см. раздел Моя подписка, если хотите иметь возможность быстро переключаться между серверами), присланный ботом (далее <b>Конфигурационный файл</b>)\n' +
    '- открываете OpenVpn\n' +
    '- <b>Мобильные устройства</b> выбираете вкладку File(Файл), в появившемся списке файлов находите свой <b>Конфигурационный файл</b>, нажимаете кнопку Import(Импорт), на следующем экране нажимаете на кнопку справа вверху Add(Добавить)\n' +
    '- <b>Стационарные компьютеры</b> правой кнопкой мыши кликаете по иконке в панели задач, далее нажимаете импорт конфигурации, указываете свой <b>Конфигурационный файл</b>, после успешного импорта снова правой кнопкой мыши кликаете по иконке в панели задач и выбираете свежедобавленный профиль с таким же именем как и ваш <b>Конфигурационный файл</b>, далее выбираете опцию подключиться \n'+
    '- Ваш профиль работает\n\n Для отключения впн на <b>мобильных устройствах</b> достаточно сдвинуть слайдер влево, на <b>Стационарных компьютерах</b> правой кнопкой мыши кликаете по иконке в панели задач и находите свой профиль и выбираете опцию отключиться\n\nВы можете скачать расширенную пошаговую инструкцию по кнопке ниже'

const downloadFrom = 'Скачай свой профиль и через <b>Passepartout</b> (<a href="https://apps.apple.com/us/app/passepartout-vpn-client/id1433648537">Passepartout AppleStore</a>) подключайся с любого устройства!\n\n' +
    'Остались вопросы? Загляни в раздел<b>«Инструкция»</b>'

module.exports = {
    subscribes, reminders, basicKeyboard, helpRequest, helpResponse, feedbackRequest, payText, telegramIdRegexp, dimaID, kostyaId,
    startInfoMessage, faqInfoMessage, downloadFrom, webAppButton
}
