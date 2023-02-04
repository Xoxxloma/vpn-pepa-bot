const fs = require('fs');
const path = require('path')
const axios = require('axios')
const { Client, conn } = require('./api')
const { removeCertificate } = require('./utils')

const expiresSubscriptionHandler = async () => {
    const today = new Date();
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1)

    console.log('today: ', today)
    console.log('yesterday: ', yesterday)

    await Client.updateMany({expiresIn: {$lt: today, $gt: yesterday}}, {isSubscriptionActive: false})
    const collection = await Client.find({isSubscriptionActive: false, expiresIn: {$lt: today, $gt: yesterday}})
    const promises = collection.map(user => removeCertificate(user.telegramId))
    await Promise.all(promises)
    await conn.close()

    await shitHunter(collection);

    await syncIndex();

    console.log("Cron job was done")
}


const syncIndex = async () => {
    try {
        const filePath = path.resolve('/etc/openvpn/easy-rsa/pki/index.txt')
        const fileData = fs.readFileSync(filePath, 'utf-8');

        // TODO: Убрать хардкод айпишников
        await axios.post('http://185.105.108.8:1001/syncIndex', { fileData });
        await axios.post('http://178.208.66.201:1001/syncIndex', { fileData });

    } catch (e) {
        console.log(`error in sync`, e)
    }
}


const shitHunter = async (clients) => {
    const filePath = path.resolve('/etc/openvpn/easy-rsa/pki/index.txt')
    console.log('--- Looking for bad lines in ', filePath)
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
    console.log('Found bad lines: ', result)

    revokeFromBase(result)
}

const revokeFromBase = (terminalList) => {
    console.log('Removal list is: ', terminalList)
    const filePath = path.resolve('/etc/openvpn/easy-rsa/pki/index.txt')

    if (fs.existsSync(filePath)) {
        const array = fs.readFileSync(filePath, 'utf-8').split("\n")

        for (let idx in array) {
            const line = array[idx].split("\t")
            const num = line[line.length -1].substring(4).trim()
            if (line[0] === 'V' && terminalList.includes(num) || line[0] === 'R') {
                array[idx] = ''.trim()
            }
        }
        const filtered = array.filter(s => s !== "")
        fs.writeFileSync(filePath, filtered.join("\n"), 'utf-8')
    }
}

expiresSubscriptionHandler()
