const { Client, conn } = require('../api');
const os = require("os");
const fs = require('fs');

const statusFile = './dbmonitor/user-monitoring.log';

const createFile = async () => {
    await fs.writeFile(statusFile, '', function (err, file) {
        if (err) throw err;
        console.log('Created blank file.');
    });
};

const writeToStatusLog = async (text) => {
    await fs.open(statusFile, 'a', 666, async (e, id) => {
        await fs.write( id, text, null, 'utf8', function(){
            fs.close(id, function(){
                console.log('Status file is updated');
            });
        });
    });
};

const dumpHandler = async () => {
    const collection = await Client.find({});
    const content = JSON.stringify(collection);

    await conn.close();
    return content;
};

const wrapStringWithEOL = (stringsArray) => {
    let resultString = '';
    stringsArray.forEach((str) => resultString = resultString + str + os.EOL);

    return resultString;
};

const pepe_totalUsersCount = (data) => {
    const names = data.map((user) => user.name);

    const totalUsersCountHelp = '# HELP pepe_totalUsersCount Total number of users.';
    const totalUSersCountType = '# TYPE pepe_totalUsersCount counter';
    const totalUsersCount = `pepe_totalUsersCount ${names.length}`;

    return wrapStringWithEOL([totalUsersCountHelp, totalUSersCountType, totalUsersCount]);
};

const pepe_totalUsersList = (data) => {
    const namesAndIds = data.map((user) => {
        return {
            name: user.name,
            telegramId: user.telegramId,
            isSubscriptionActive: user.isSubscriptionActive
        }
    });

    const metricPerUser = namesAndIds.map((userData) => {
        return `pepe_totalUsersList {common_name="${userData.name}", telegramId="${userData.telegramId}", status="${userData.isSubscriptionActive ? 1 : 0}" } 1`;
    });

    const totalUsersListHelp = '# HELP pepe_totalUsersList List of users.';
    const totalUsersListType = '# TYPE pepe_totalUsersList gauge';

    return wrapStringWithEOL([totalUsersListHelp, totalUsersListType, ...metricPerUser]);
};

const metricsConverter = async () => {
    const data = JSON.parse(await dumpHandler());

    await createFile();

    await writeToStatusLog(pepe_totalUsersCount(data));
    await writeToStatusLog(pepe_totalUsersList(data));
};

metricsConverter();


