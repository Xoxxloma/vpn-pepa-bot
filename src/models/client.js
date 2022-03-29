const mongoose = require('mongoose')
const Schema = mongoose.Schema

const clientSchema = new Schema({
    name: String,
    expiresIn: {type: Date, default: Date.now},
    telegramId: Number,
    isSubscriptionActive: Boolean,
    bill: {
        id: String,
        term: Number,
        expirationDateTime: Date,
        payUrl: String
    },
    certificate: String
})

module.exports = clientSchema