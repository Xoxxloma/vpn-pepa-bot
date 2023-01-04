const path = require('path');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());

app.set('etag', false);

app.use(bodyParser.json());
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
});

app.use('/*', (req, res, next) => {
    console.log('base url:', req.baseUrl)
    console.log('originalUrl:', req.originalUrl)
    next()
});


app.use(express.static(path.join(__dirname, "build")));

app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

const httpServer = http.createServer(app);
const httpsServer = https.createServer({
    key: fs.readFileSync("./pepavpn.ru.key"),
    cert: fs.readFileSync("./pepavpn.ru.crt"),
    ca: fs.readFileSync("./pepavpn.ru.ca-bundle"),
    passphrase: 'pp0zDNMA'
}, app);

httpServer.listen(80, () => {
    console.log('HTTP Server running on port 80');
});

httpsServer.listen(443, () => {
    console.log('HTTPS Server running on port 443');
});
