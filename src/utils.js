const {qiwiApi, Client} = require("./api");
const util = require('util');
const path = require('path')
const exec = util.promisify(require('child_process').exec);
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore')
const { helpRequest, feedbackRequest, dimaID, kostyaId  } = require('./consts')
const dayjs = require('dayjs')
dayjs.extend(isSameOrBefore)

const createBasicBillfields = (amount) => ({
    amount,
    currency: 'RUB',
    comment: `VPN-pepe. Оплата подписки на ${amount} рублей`,
    expirationDateTime: qiwiApi.getLifetimeByDay(0.02),
});

const prolongueSubscription = (currentExpiresIn, term, termUnit) => {
    return dayjs(currentExpiresIn).isSameOrBefore(dayjs(), "day") ? dayjs().add(term, termUnit) : dayjs(currentExpiresIn).add(term, termUnit)
}

const getTelegramId = (ctx) => ctx.update.message.from.id

const getUserByTelegramId = async (telegramId) => await Client.findOne({telegramId})

const createCertificate = async (telegramId) => {
    try {
        const { stdout, stderr, error } = await exec(`/root/openvpn-control.sh add ${telegramId}`)
        if (stderr) {
            console.log("WE ARE IN STDERR: ", stderr)
        }
        if (error) {
            console.log("WE ARE IN ERROR: ", error)
        }
        if (stdout) {
            const root = path.resolve(__dirname, '..', '..')
            const constructedPath = path.join(root, `${telegramId}.ovpn`)
            return constructedPath;
        }
    } catch (e) {
        console.log(`create certificate error: ${e}`)
    }
}

const removeCertificate = async (telegramId) => {
    try {
        const { stdout, stderr, error } = await exec(`/root/openvpn-control.sh remove ${telegramId}`)
        if (stderr) {
            console.log("WE ARE IN STDERR: ", stderr)
        }
        if (error) {
            console.log("WE ARE IN ERROR: ", error)
        }
        if (stdout) {
            console.log("SUCCESSFULLY DELETED USER", telegramId)
        }
    } catch (e) {
        console.log(`remove certificate error: ${e}`)
    }
}

const createMessagesToSupport = (ctx) => {
    const { message } = ctx
    const {from : {id, username, first_name, last_name }} = message
    const name = username ? `@${username}` : `${first_name} ${last_name ?? ''}`
    const isHelpRequestMessage = helpRequest.test(message.text)
    const messageToClient = isHelpRequestMessage ? 'Ваш запрос принят, ожидайте ответ от бота, среднее время ожидания ответа - 2 часа' : 'Спасибо за ваш отзыв. Благодаря им мы становимся лучше!'
    const messageToSupport = `${isHelpRequestMessage ? `#Поддержка` : `#Фидбэк`}\nСообщение от пользователя ${name} с id <b>${id}</b>\n${message.text.replace(isHelpRequestMessage ? helpRequest : feedbackRequest, '').trimLeft()}`
    return [messageToClient, messageToSupport]
}

const notifySupport = async (bot, message) => {
    await bot.telegram.sendMessage(dimaID, message, { parse_mode: 'HTML'})
    await bot.telegram.sendMessage(kostyaId, message, { parse_mode: 'HTML'})
}

const isThatSameBill = (bill, term) => dayjs().isSameOrBefore(dayjs(bill.expirationDateTime)) && bill.term === term

const isBotBlocked = (e) => e?.response?.error_code === 403 && e?.response?.description === 'Forbidden: bot was blocked by the user'

module.exports = {
    createBasicBillfields,
    prolongueSubscription,
    getTelegramId,
    getUserByTelegramId,
    createCertificate,
    removeCertificate,
    isThatSameBill,
    notifySupport,
    createMessagesToSupport,
    isBotBlocked
}