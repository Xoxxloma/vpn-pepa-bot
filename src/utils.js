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

//const dispatcher = () => {
    // const users = await Client.find()
    //
    // const promises = users.map(async(user) => {
    //     await bot.telegram.sendMessage(user.telegramId, 'Привет!\n\nСегодня мы объявляем о завершении тестового периода и переходе к более ' +
    //         'длинным срокам действия подписок:\n<b>один месяц / три месяца / полгода</b> + оставляем пробный период 15 дней.\n\n' +
    //         'Всем учавствовавшим в тестовом периоде и имеющим активную подписку - добавлено 3 дня к сроку действия подписки, тем у кого подписка уже истекла - при возобновлении так же будет добавлено 3 дня автоматически.\n\n' +
    //         'Спасибо, что остаетесь с нами!', { parse_mode: 'HTML' })
    //     await bot.telegram.sendSticker(user.telegramId, "CAACAgIAAxkBAAIHwWJSvU7yzY6We7E_VONLhTT2-AuoAAJnBAACierlB9ULc0Y6gUESIwQ")
    // });
    //
    // await Promise.all(promises)
    // await conn.close()
    // console.log("Dispatched to all!")
//}

module.exports = {
    createBasicBillfields,
    prolongueSubscription,
    getTelegramId,
    getUserByTelegramId,
    createCertificate,
    removeCertificate,
    isThatSameBill,
    basicKeyboard,
    subscribes,
    reminders
}