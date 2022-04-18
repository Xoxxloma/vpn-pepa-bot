const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 6666;

app.use(cors());

app.get('/metrics', (req, res) => {
    fs.readFile('./user-monitoring.log', 'utf8' , (err, data) => {
        if (err) {
            res.status(400);
            res.send(null);
        } else {
            res.setHeader('Content-type', 'text/plain');
            res.status(200);
            res.send(data)
        }
        return;
    })
});

app.listen(port, () => {
    console.log(`User monitoring app listening on port ${port}`)
});
