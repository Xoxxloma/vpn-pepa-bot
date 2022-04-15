const { Client, conn } = require('./api')
const fs = require('fs')


const dumpHandler = async () => {
    const collection = await Client.find({});
    const content = JSON.stringify(collection);
    await fs.writeFile(`/root/monitoring/dbdump/${new Date().toISOString().split('T')[0]}.json`, '', function (err, file) {
        if (err) throw err;
        console.log('Created blank file.');
    });

    await fs.writeFile(`/root/monitoring/dbdump/${new Date().toISOString().split('T')[0]}.json`, content, err => {
        if (err) {
            console.error(err)
            console.log(`Error writing dump to file ${new Date().toISOString().split('T')[0]}.json`)
            return
        }
        console.log(`Dump saved to ${new Date().toISOString().split('T')[0]}.json`)
    })
    await conn.close()
    console.log('Connection closed.')
};

dumpHandler();

