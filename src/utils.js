const {qiwiApi, Client} = require("./api");
const util = require('util');
const path = require('path')
const exec = util.promisify(require('child_process').exec);
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore')
const { helpRequest, feedbackRequest, dimaID, kostyaId  } = require('./consts')
const dayjs = require('dayjs')
const axios = require('axios')
const {bot} = require("./api");
const config = require('./config/index')
dayjs.extend(isSameOrBefore)

const availableIps = config.servers.map((s) => s.ip)
const availableIpsWithRemote = (arr) => arr.map((s) => `remote ${s.ip} 1194`)

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
    let constructedPath = '';
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
            constructedPath = path.join('/root/', `${telegramId}.ovpn`)
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

        return { constructedPath, ips:  result.success};
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

        const promises = getAvailableIps.map(async (ip) => revokeCert(ip, telegramId))
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

const hasNotExpiredBillWithSameTerm = async (bill, term) => {
    try {
        if (bill.term === term) {
            const result = await qiwiApi.getBillInfo(bill.billId)
            return result.status.value === 'WAITING';
        }
        return false
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
    createCertificate,
    removeCertificate,
    hasNotExpiredBillWithSameTerm,
    notifySupport,
    createMessagesToSupport,
    isBotBlocked,
    availableIps,
    availableIpsWithRemote
}
