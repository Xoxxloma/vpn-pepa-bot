const express = require('express');

const app = express();
const port = 4003;

let savedPayments = {};

app.get('/savePayment', async (req, res) => {
    console.log('savedPayments',savedPayments);
    const telegramId = req.query.telegramId;

    if (!savedPayments[telegramId]) {
        savedPayments[telegramId] = 'INPROGRESS';
    } else {
        console.log('ОТЪЕБИСЬ')
        return res.sendStatus(200)
    }

    try {
        let result = await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(`${telegramId} оплатил мать`);
            }, 5000);
        });

        console.log('result', result);
        delete  savedPayments[telegramId];
        return res.send(result)

    } catch (e){
        delete  savedPayments[telegramId];

        return res.sendStatus(500);
    }
});


app.listen(port, () => {
    console.log(`User monitoring app listening on port ${port}`)
});

