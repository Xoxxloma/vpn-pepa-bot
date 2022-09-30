const fs = require('fs');
const path = require('path')
const { Client, conn } = require('./api')

const shitHunter = async () => {
    const filePath = path.resolve(__dirname, 'index.txt')
    const clients = await Client.find({ isSubscriptionActive: false })
    const clientsIds = clients.map(u => u.telegramId.toString())

    const result = [];

    if (fs.existsSync(filePath)) {
        const lines = fs.readFileSync(filePath, 'utf-8').split("\n")

        lines.forEach(line => {
            const parsedLine = line.split("\t")
            const num = parsedLine[parsedLine.length -1].substring(4).trim()
            if (parsedLine.includes("V") && clientsIds.includes(num)) {
                result.push(num)
            }
        })
    }
    await conn.close()
    console.log(result)
    return result;
}

shitHunter()
