const {qiwiApi, Client} = require("./api");
const util = require('util');
const path = require('path')
const exec = util.promisify(require('child_process').exec);
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore')
const dayjs = require('dayjs')
dayjs.extend(isSameOrBefore)

const createBasicBillfields = (amount) => ({
    amount,
    currency: 'RUB',
    comment: `VPN-pepe. Оплата подписки на ${amount} рублей`,
    expirationDateTime: qiwiApi.getLifetimeByDay(0.02),
});

const basicKeyboard = [['Выбрать подписку'], ["Моя подписка"], ['FAQ', 'Контакты']]


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

const isThatSameBill = (bill, term) => dayjs().isSameOrBefore(dayjs(bill.expirationDateTime)) && bill.term === term

module.exports = {
    createBasicBillfields,
    prolongueSubscription,
    getTelegramId,
    getUserByTelegramId,
    createCertificate,
    removeCertificate,
    isThatSameBill,
    basicKeyboard,
    subscribes
}