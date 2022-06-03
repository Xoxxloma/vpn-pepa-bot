const express = require('express');
const fs = require('fs');
const cors = require('cors');
const {bot} = require("./api");
const { createCertificate, prolongueSubscription, createBasicBillfields, notifySupport } = require("./utils");
const { qiwiApi } = require("./api");
const { Client } = require('./api')

const app = express();
const port = 4003;

app.use(express.json())
app.use(cors());

const saveClientPayment = async (telegramId, status, res) => {

    const client = await Client.findOne({telegramId})

    try {
        if (status.value === 'PAID') {
            const prolongueDate = prolongueSubscription(client.expiresIn, client.currentBill.term, client.currentBill.termUnit)
            const certificatePath = await createCertificate(client.telegramId)
            const cert = fs.readFileSync(certificatePath)
            client.isSubscriptionActive = true
            client.expiresIn = prolongueDate
            client.certificate = Buffer.from(cert)
            await notifySupport(bot, `Приобретена подписка через приложение!\n\nПользователь ${client.name}`)
        }

        client.currentBill.status = status
        client.paymentsHistory.push(client.currentBill)
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
        console.log(client, 'client')
        if (client) {
            return res.send(client).status(200)
        }
            return res.sendStatus(404)
    } catch (e) {
        return res.sendStatus(500)
    }
});

app.post('/createNewBill', async (req, res) => {
    try {
        const { subscribe, telegramId } = req.body
        const client = await Client.findOne({ telegramId })
        const billId = qiwiApi.generateId()
        const billForSubscription = createBasicBillfields(subscribe.price)
        const paymentDetails = await qiwiApi.createBill(billId, billForSubscription)
        client.currentBill = { id: billId, term: subscribe.term, termUnit: subscribe.termUnit, expirationDateTime: billForSubscription.expirationDateTime, payUrl: paymentDetails.payUrl }
        await client.save()
        return res.send(paymentDetails).status(200)
    } catch (e) {
        return res.sendStatus(500)
    }

})

app.get('/pollPaymentStatus', async (req, res) => {
    const {billId} = req.query
    const result = await qiwiApi.getBillInfo(billId)
    return res.send(result.status)
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


app.listen(port, () => {
    console.log(`User monitoring app listening on port ${port}`)
});
