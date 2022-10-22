const mongoose = require('mongoose')
const Schema = mongoose.Schema

const billSchema = new Schema({
    billId: String,
    term: Number,
    termUnit: String,
    expirationDateTime: Date,
    payUrl: String,
    status: {
        value: String,
        changedDateTime: String,
    }
},{ _id: false })

const messageSchema = new Schema({
    sender: String,
    timestamp: Date,
    text: String,
    telegramId: Number
})



const clientSchema = new Schema({
    name: String,
    expiresIn: {type: Date, default: Date.now},
    username: {type: String, default: ''},
    telegramId: Number,
    isSubscriptionActive: {type: Boolean, default: false},
    currentBill: {type: billSchema, default: {} },
    paymentsHistory: {type: [billSchema], default: []},
    certificate: {type: String, default: ''},
    authCode: {type: String, default: ''},
    messageList: {type: [messageSchema], default: []},
    ips: {type: [String], default: []}
})

module.exports = clientSchema
