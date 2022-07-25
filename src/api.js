const mongoose = require('mongoose')
const QiwiBillPaymentsAPI = require('@qiwi/bill-payments-node-js-sdk');
const { Telegraf } = require('telegraf');
const clientModel = require('./models/client');
require('dotenv').config();


const qiwiApi = new QiwiBillPaymentsAPI(process.env.QIWI_SECRET_KEY_DIMA);
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
const conn = mongoose.createConnection(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true  })

conn.on('error', err => console.log(`Connection failed ${err}`))
conn.once('open', () => console.log('Connected to DB!'))

const Client = conn.model('Client', clientModel);

module.exports = {
    qiwiApi,
    conn,
    bot,
    Client
}
