const { Client, conn } = require('./api')
const { removeCertificate } = require('./utils')

const expiresSubscriptionHandler = async () => {
    const currDate = new Date().toISOString();
    await Client.updateMany({expiresIn: {$lte: currDate}}, {isSubscriptionActive: false})
    const collection = await Client.find({isSubscriptionActive: false})
    const promises = collection.map(user => removeCertificate(user.telegramId))
    await Promise.all(promises)
    await conn.close()
}

expiresSubscriptionHandler()