const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { createCertificate, prolongateSubscription, createBasicBillfields, isThatSameBill } = require("./utilswithoutBot");
const { qiwiApi } = require("./api");
const { Client } = require('./api');

const app = express();
const port = 4003;

app.use(express.json());
app.use(cors());

const saveClientPayment = async (telegramId, status, res) => {

    const client = await Client.findOne({telegramId});
    try {
        console.log(`Сохранен счет у клиента с telegramId: ${telegramId}, статус счета: ${status.value} billId: ${client.currentBill.id}`);
        if (status.value === 'PAID' && client.currentBill.billId) {
            const prolongueDate = prolongateSubscription(client.expiresIn, client.currentBill.term, client.currentBill.termUnit);
            const certificatePath = await createCertificate(client.telegramId);
            const cert = fs.readFileSync(certificatePath);
            client.isSubscriptionActive = true;
            client.expiresIn = prolongueDate;
            client.certificate = Buffer.from(cert);
            client.currentBill.status = status;
            client.paymentsHistory.push(client.currentBill)
        }

        client.currentBill = {};
        await client.save();
        return res.send({client, status: status.value}).status(200)
    }  catch (e) {
        console.log(e);
        return res.sendStatus(500)
    }
};

app.get('/getClientByAuthCode/:authCode', async (req, res) => {
    const authCode = req.params.authCode;
    try {
        const client = await Client.findOne({ authCode });
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
        const { subscribe, telegramId } = req.body;
        const client = await Client.findOne({ telegramId });
        if (isThatSameBill(client.currentBill, subscribe.term)) {
            return res.send(client.currentBill).status(200)
        }
        const billId = qiwiApi.generateId();
        console.log(`Создан новый счет у клиента с telegramId: ${telegramId}, billId: ${billId}`);
        const billForSubscription = createBasicBillfields(subscribe.price, telegramId);
        const paymentDetails = await qiwiApi.createBill(billId, billForSubscription);
        client.currentBill = {
            billId,
            term: subscribe.term,
            termUnit: subscribe.termUnit,
            expirationDateTime: billForSubscription.expirationDateTime,
            payUrl: paymentDetails.payUrl
        };
        await client.save();
        return res.send(paymentDetails).status(200)
    } catch (e) {
        return res.sendStatus(500)
    }

});

app.get('/pollPaymentStatus', async (req, res) => {
    const {billId} = req.query;
    try {
        const result = await qiwiApi.getBillInfo(billId);
        return res.send(result.status)
    } catch (e) {
        return res.sendStatus(404)
    }
});

app.post('/savePayment', async (req, res) => {
    const {telegramId, status} = req.body;
    await saveClientPayment(telegramId, status, res)
});

app.post('/messageToSupport', async (req, res) => {
    const { sender, telegramId, timestamp, text } = req.body;

    if (!sender || !text) {
        return res.sendStatus(200)
    }

    const client = await Client.findOne({ telegramId });
    client.messageList.push({sender, telegramId, timestamp, text});
    client.save();
    try {
            res.send(client.messageList).status(200)
    } catch (e) {
        res.sendStatus(500)
    }
});

app.get('/messageList', async (req, res) => {
    try {
        const { telegramId } = req.query;
        const { messageList } = await Client.findOne({ telegramId }).select('messageList');
        res.send(messageList).status(200);
    } catch (e) {
        res.sendStatus(404)
    }
});

app.listen(port, () => {
    console.log(`User monitoring app listening on port ${port}`)
});
