const express = require('express');
const fs = require('fs');
const cors = require('cors');
const {isThatSameBill} = require("./utils");
const {bot} = require("./api");
const { createCertificate, prolongueSubscription, createBasicBillfields, notifySupport } = require("./utils");
const { qiwiApi } = require("./api");
const { Client } = require('./api')

const app = express();
const port = 4003;

app.use(express.json())
app.use(cors());

const config = {
    servers: [
        { name: 'Нидерланды', ip: '185.105.108.208 1194' },
        { name: 'Аргентина', ip: '178.208.86.97 1194' },
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

const saveClientPayment = async (telegramId, status, res) => {

    const client = await Client.findOne({telegramId})

    try {
        console.log(`Сохранен счет у клиента с telegramId: ${telegramId}, статус счета: ${status.value} billId: ${client.currentBill.id}`)
        if (status.value === 'PAID' && client.currentBill.billId) {
            const prolongueDate = prolongueSubscription(client.expiresIn, client.currentBill.term, client.currentBill.termUnit)
            const certificatePath = await createCertificate(client.telegramId)
            const cert = fs.readFileSync(certificatePath)
            client.isSubscriptionActive = true
            client.expiresIn = prolongueDate
            client.certificate = Buffer.from(cert)
            await notifySupport(bot, `Приобретена подписка через приложение!\n\nПользователь ${client.name}`)
            client.currentBill.status = status
            client.paymentsHistory.push(client.currentBill)
        }

        client.currentBill = {}
        await client.save()
        return res.send({client, status: status.value}).status(200)
    }  catch (e) {
        console.log(e)
        return res.sendStatus(500)
    }
}

app.get('/getClientByAuthCode/:authCode', async (req, res) => {
    const authCode = req.params.authCode
    try {
        const client = await Client.findOne({ authCode })
        if (client) {
            return res.send(client).status(200)
        }
            return res.sendStatus(404)
    } catch (e) {
        return res.sendStatus(500)
    }
});

app.get('/news', async (req, res) => {
    res.send('Первая строчка текста$SEPARATORвторая строчка текста').status(200)
})

app.get('/getConfig', async (req, res) => {
    res.send(config).status(200)
})

app.post('/createNewBill', async (req, res) => {
    try {
        const { subscribe, telegramId } = req.body
        const client = await Client.findOne({ telegramId })
        if (isThatSameBill(client.currentBill, subscribe.term)) {
            return res.send(client.currentBill).status(200)
        }
        const billId = qiwiApi.generateId()
        console.log(`Создан новый счет у клиента с telegramId: ${telegramId}, billId: ${billId}`)
        const billForSubscription = createBasicBillfields(subscribe.price, telegramId)
        const paymentDetails = await qiwiApi.createBill(billId, billForSubscription)
        client.currentBill = { billId, term: subscribe.term, termUnit: subscribe.termUnit, expirationDateTime: billForSubscription.expirationDateTime, payUrl: paymentDetails.payUrl }
        await client.save()
        return res.send(paymentDetails).status(200)
    } catch (e) {
        return res.sendStatus(500)
    }

})

app.get('/pollPaymentStatus', async (req, res) => {
    const {billId} = req.query
    try {
        const result = await qiwiApi.getBillInfo(billId)
        return res.send(result.status)
    } catch (e) {
        return res.sendStatus(404)
    }
})

app.post('/savePayment', async (req, res) => {
    try {
        const {telegramId, status} = req.body
        await saveClientPayment(telegramId, status, res)
    } catch (e){
        return res.sendStatus(500)
    }
})

app.post('/messageToSupport', async (req, res) => {
    const { sender, telegramId, timestamp, text } = req.body
    // в первой версии приложения приходит только поле месседж, чтобы не упасть - проверяем на наличие полей
    if (!sender || !text) {
        await notifySupport(bot, req.body.message)
        return res.sendStatus(200)
    }
    const message = `#Поддержка\nСообщение от\n@${sender} с id ${telegramId}\n${text}`
    const client = await Client.findOne({ telegramId })
    client.messageList.push({sender, telegramId, timestamp, text})
    client.save()
    try {
        await notifySupport(bot, message)
        res.send(client.messageList).status(200)
    } catch (e) {
        res.sendStatus(500)
    }
})

app.get('/messageList', async (req, res) => {
    try {
        const { telegramId } = req.query
        const { messageList } = await Client.findOne({ telegramId }).select('messageList')
        res.send(messageList).status(200);
    } catch (e) {
        res.sendStatus(404)
    }
})

app.get('/userStatistics/:telegramId', async (req, res) => {
    const telegramId = req.params.telegramId
    try {
        const parsedUsers = JSON.parse(fs.readFileSync('./prometheusStatistics.txt'))
        const userReceivedBytes = parsedUsers.find(u => u.telegramId === Number.parseInt(telegramId))?.receiveBytesCount ?? 0
        const sum = parsedUsers.reduce((acc, val) => acc + val.receiveBytesCount, 0) / parsedUsers.length
        res.send({ userReceivedBytes, sum }).status(200)
    } catch (e) {
        console.log(e, 'error')
        res.sendStatus(404)
    }
})


app.listen(port, () => {
    console.log(`User monitoring app listening on port ${port}`)
});
