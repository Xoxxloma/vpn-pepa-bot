const { Client, conn } = require('./api')
const { removeCertificate } = require('./utils')

const expiresSubscriptionHandler = async () => {
    const today = new Date();
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1)
    const collection = await Client.find({isSubscriptionActive: true, expiresIn: {$lt: today, $gt: yesterday}})
    await Client.updateMany({expiresIn: {$lt: today, $gt: yesterday}}, {isSubscriptionActive: false})
    const promises = collection.map(user => removeCertificate(user.telegramId))
    await Promise.all(promises)
    await conn.close()
    console.log("Cron job was done")
}

expiresSubscriptionHandler()
