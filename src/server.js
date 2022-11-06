const express = require('express');
const fs = require('fs');
const cors = require('cors');
const {bot} = require("./api");
const { createCertificate, prolongueSubscription, createBasicBillfields, notifySupport, hasNotExpiredBillWithSameTerm } = require("./utils");
const { qiwiApi, Client } = require("./api");
const path = require("path");
const config = require('./config/index')

const app = express();
const port = 4003;

app.use(express.json())
app.use(cors());



const saveClientPayment = async (telegramId, status, res) => {

    const client = await Client.findOne({telegramId});

    try {
        console.log(`Сохранен счет у клиента с telegramId: ${telegramId}, статус счета: ${status.value} billId: ${client.currentBill.id}`)
        if (status.value === 'PAID' && client.currentBill.billId) {
            const prolongueDate = prolongueSubscription(client.expiresIn, client.currentBill.term, client.currentBill.termUnit)
            let certificatePath;
            if (client.isSubscriptionActive) {
                certificatePath = path.join('/root/', `${client.telegramId}.ovpn`)
            } else {
                certificatePath = await createCertificate(client.telegramId)
            }
            const cert = fs.readFileSync(certificatePath, 'utf8');
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
    console.log(authCode,'code')
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
});

app.get('/getConfig', async (req, res) => {
    res.send(config).status(200)
});

app.get('/setAppVersion', async (req, res) => {
    const {telegramId, version} = req.query;
    try {
        const client = await Client.findOne({ telegramId });
        client.appVersion = version;
        client.save();

        return res.sendStatus(200)
    } catch (e) {
        return res.sendStatus(500)
    }
});

app.post('/createNewBill', async (req, res) => {
    try {
        const { subscribe, telegramId } = req.body
        const client = await Client.findOne({ telegramId })
        const hasCurrentBill = await hasNotExpiredBillWithSameTerm(client.currentBill, subscribe.term)
        if (hasCurrentBill) {
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
        console.log(e, 'e')
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
        console.log(messageList, 'messageList before send')
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
