const basicKeyboard = [['Выбрать подписку'], ["Моя подписка"], ['FAQ', 'Контакты']]

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

const startInfoMessage = "<b>Добрый день, я VPN бот, рад приветствовать тебя.</b>\n" +
    "Здесь ты можешь приобрести подписку на мой сервис и пользоваться интернетом без ограничений.\n" +
    "Чтобы вызвать клавиатуру для взаимодействия со мной - напиши команду /keyboard.\n" +
    "Основные разделы:\n- <b>«Выбрать подписку»</b> приведет тебя к выбору тарифа и дальнейшей оплате\n" +
    "- <b>«Моя подписка»</b> покажет срок действия подписки и поможет получить файл .ovpn заново, если вдруг не сможешь его найти\n" +
    "- <b>«FAQ»</b> расскажет процедуру подключения и работы с VPN\n" +
    "- <b>«Контакты»</b> если возникнут какие нибудь вопросы или проблемы - контакты найдешь тут.\n" +
    "На этом все, приятного использования сервиса."

const faqInfoMessage = 'После оплаты бот в течение нескольких минут пришлет вам файл ******.ovpn.\n\n' +
    'Для того чтобы начать пользоваться VPN Вам необходимо установить программу OpenVPN.\n\nСсылки на официальные источники для скачивания:\n' +
    '<a href="https://apps.apple.com/ru/app/openvpn-connect/id590379981">AppleStore</a>\n' +
    '<a href="https://play.google.com/store/apps/details?id=net.openvpn.openvpn">Google Play</a>\n' +
    '<a href="https://openvpn.net/community-downloads/">Desktop</a>\n\n' +
    'Далее:\n' +
    '- скачиваете файл, присланный ботом (далее <b>Конфигурационный файл</b>)\n' +
    '- открываете OpenVpn\n' +
    '- <b>Мобильные устройства</b> выбираете вкладку File(Файл), в появившемся списке файлов находите свой <b>Конфигурационный файл</b>, нажимаете кнопку Import(Импорт), на следующем экране нажимаете на кнопку справа вверху Add(Добавить)\n' +
    '- <b>Стационарные компьютеры</b> правой кнопкой мыши кликаете по иконке в панели задач, далее нажимаете импорт конфигурации, указываете свой <b>Конфигурационный файл</b>, после успешного импорта снова правой кнопкой мыши кликаете по иконке в панели задач и выбираете свежедобавленный профиль с таким же именем как и ваш <b>Конфигурационный файл</b>, далее выбираете опцию подключиться \n'+
    '- Ваш профиль работает\n\n Для отключения впн на <b>мобильных устройствах</b> достаточно сдвинуть слайдер влево, на <b>Стационарных компьютерах</b> правой кнопкой мыши кликаете по иконке в панели задач и находите свой профиль и выбираете опцию отключиться\n\nВы можете скачать расширенную пошаговую инструкцию по кнопке ниже'

module.exports = {
    subscribes, reminders, basicKeyboard, helpRequest, helpResponse, feedbackRequest, payText, telegramIdRegexp, dimaID, kostyaId,
    startInfoMessage, faqInfoMessage
}