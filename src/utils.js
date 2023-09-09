const {qiwiApi, Client} = require("./api");
const util = require('util');
const path = require('path')
const { v4: uuidv4 } = require('uuid');
const exec = util.promisify(require('child_process').exec);
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore')
const { helpRequest, feedbackRequest, dimaID, kostyaId  } = require('./consts')
const dayjs = require('dayjs')
const axios = require('axios')
const {bot} = require("./api");
const config = require('./config/index')
dayjs.extend(isSameOrBefore)

const availableIps = config.servers.map((s) => s.ip)
const availableIpsWithRemote = (arr) => arr.map((ip) => `remote ${ip} 1194 udp`)

const createBasicBillfields = (amount, telegramId) => ({
    amount,
    currency: 'RUB',
    comment: `Pepa VPN. Оплата подписки на ${amount} рублей, по аккаунту ${telegramId}`,
    expirationDateTime: qiwiApi.getLifetimeByDay(0.01),
});

const prolongueSubscription = (currentExpiresIn, term, termUnit) => {
    return dayjs(currentExpiresIn).isSameOrBefore(dayjs(), "day") ? dayjs().add(term, termUnit) : dayjs(currentExpiresIn).add(term, termUnit)
}

const getTelegramId = (ctx) => ctx.update.message.from.id

const getUserByTelegramId = async (telegramId) => await Client.findOne({telegramId})

const getUserName = (message) => {
    const {from : { username, first_name, last_name }} = message
    return username ? `@${username}` : `${first_name} ${last_name ?? ''}`
}

const createUserFields = async (ctx) => {
    const { chat } = ctx
    const authCode = uuidv4()
    const telegramId = getTelegramId(ctx)
    const username = ctx.update.message.from.username
    const name = `${chat.first_name} ${chat.last_name || ''}`.trim()
    const expiresIn = prolongueSubscription(dayjs(), 3, "day")
    // TODO вернуть назад после теста
    // const { certificatePath, ips } = await createCertificate(telegramId)
    // const certificate = fs.readFileSync(certificatePath, 'utf8')
    const certificate = 'this is cert and remotes will be there $remotes_here$'
    const ips = [1, 2 ,3]
    const userToBase = {telegramId, name, username, expiresIn, isSubscriptionActive: true, certificate, authCode, ips }
    return userToBase
}

const createCert = async (ipAddress, telegramId) => {
    try {
        await axios.get(`http://${ipAddress}:1001/add?user=${telegramId}`)
        console.log(`Remote client ${telegramId} added on ${ipAddress}`)
        return ipAddress
    } catch (e) {
        console.log(`error while create cert on ${ipAddress}`)
        throw ipAddress
    }
}

const revokeCert = async (ipAddress, telegramId) => {
    try {
        await axios.get(`http://${ipAddress}:1001/revoke?user=${telegramId}`)
        console.log(`Remote client ${telegramId} revoked from ${ipAddress}`)
        return ipAddress
    } catch (e) {
        console.log(`error while remote cert on ${ipAddress}`)
        throw ipAddress
    }
}

const createCertificate = async (telegramId) => {
    let certificatePath = '';
    try {
        const { stdout, stderr, error } = await exec(`/root/openvpn-control.sh add ${telegramId}`)
        if (stderr) {
            console.log("WE ARE IN STDERR: ", stderr)
        }
        if (error) {
            console.log("WE ARE IN ERROR: ", error)
        }
        if (stdout) {
            //const root = path.resolve(__dirname, '..', '..')
            certificatePath = path.join('/root/', `${telegramId}.ovpn`)
        }

        // -- EXPERIMENTAL Soft migration --
        const promises = availableIps.map(async (ip) => createCert(ip, telegramId))
        const settledValues = await Promise.allSettled(promises)
        const result = settledValues.reduce((acc, p) => {
            if (p.status === 'fulfilled') {
                acc.success.push(p.value)
            } else {
                acc.failure.push(p.reason)
            }
            return acc;
        }, {success: [], failure: []})
        if (!result.success.length) throw new Error('Cert creation was failed on both nodes')

        console.log(`[telegramUserId: ${telegramId}].Certs was successfully created on ips: `, result.success.join(', '))
        if (result.failure.length) {
            const msg = `telegramUserId: ${telegramId}.ALARM!!! Certs was not created on ips: ${result.failure.join(', ')}`
            console.log(msg)
            await notifySupport(bot, msg)
        }

        return { certificatePath, ips:  result.success};
        // ---------------------------------
    } catch (e) {
        console.log(`create certificate error: ${e}`)
        throw e;
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
            console.log("SUCCESSFULLY DELETED USER", telegramId, stdout)
        }

        const promises = availableIps.map(async (ip) => revokeCert(ip, telegramId))
        const settledValues = await Promise.allSettled(promises)
        const result = settledValues.reduce((acc, p) => {
            if (p.status === 'fulfilled') {
                acc.success.push(p.value)
            } else {
                acc.failure.push(p.reason)
            }
            return acc;
        }, {success: [], failure: []})
        if (!result.success.length) throw new Error('Cert revocation was failed on both nodes')

        console.log(`[telegramUserId: ${telegramId}].Certs was successfully revoked on ips: `, result.success.join(', '))
        if (result.failure.length) {
            const msg = `telegramUserId: ${telegramId}.ALARM!!! Certs was not revoked on ips: ${result.failure.join(', ')}`
            console.log(msg)
            await notifySupport(bot, msg)
        }
    } catch (e) {
        console.log(`remove certificate error: ${e}`)
    }
}

const createMessagesToSupport = (ctx) => {
    const { message } = ctx
    const name = getUserName(message)
    const isHelpRequestMessage = helpRequest.test(message.text)
    const messageToClient = isHelpRequestMessage ? 'Ваш запрос принят, ожидайте ответ от бота, среднее время ожидания ответа - 2 часа' : 'Спасибо за ваш отзыв. Благодаря им мы становимся лучше!'
    const messageToSupport = `${isHelpRequestMessage ? `#Поддержка` : `#Фидбэк`}\nСообщение от пользователя ${name} с id <b>${message.from.id}</b>\n${message.text.replace(isHelpRequestMessage ? helpRequest : feedbackRequest, '').trimLeft()}`
    return [messageToClient, messageToSupport]
}

const notifySupport = async (bot, message) => {
    await bot.telegram.sendMessage(dimaID, message, { parse_mode: 'HTML'})
    await bot.telegram.sendMessage(kostyaId, message, { parse_mode: 'HTML'})
}

const sendPhotoToSupport = async (bot, photoId, extra) => {
    await bot.telegram.sendPhoto(dimaID, photoId, extra)
    await bot.telegram.sendPhoto(kostyaId, photoId, extra)
}

const hasNotExpiredBillWithSameTerm = async (bill, term) => {
    if (!bill || bill.term !== term) return false;
    try {
        const result = await qiwiApi.getBillInfo(bill.billId)
        return result.status.value === 'WAITING';
    } catch (e) {
        return false;
    }
}

const isBotBlocked = (e) => e?.response?.error_code === 403 && e?.response?.description === 'Forbidden: bot was blocked by the user'

module.exports = {
    createBasicBillfields,
    prolongueSubscription,
    getTelegramId,
    getUserByTelegramId,
    getUserName,
    createCertificate,
    removeCertificate,
    hasNotExpiredBillWithSameTerm,
    notifySupport,
    sendPhotoToSupport,
    createMessagesToSupport,
    isBotBlocked,
    availableIps,
    availableIpsWithRemote,
    createUserFields
}
