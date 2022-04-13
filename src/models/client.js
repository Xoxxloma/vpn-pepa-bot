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
    telegramId: Number,
    isSubscriptionActive: Boolean,
    bill: billSchema,
    paymentsHistory: {type: [billSchema], default: []},
    certificate: String
})

module.exports = clientSchema