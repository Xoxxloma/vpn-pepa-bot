const mongoose = require('mongoose')
const Schema = mongoose.Schema

const billSchema = new Schema({
    id: String,
    term: Number,
    termUnit: String,
    expirationDateTime: Date,
    payUrl: String,
    status: {
        value: String,
        changedDateTime: String,
    }
},{ _id: false })



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
})

module.exports = clientSchema