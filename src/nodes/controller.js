const path = require('path');
const fs = require('fs');
const express = require('express');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const port = 1001;
const app = express();

app.use(express.json());

app.get('/revoke', async function (req, res) {
	var userid = req.query.user;
	var response = '';
	var status = 200;
	
	const { stdout, stderr, error } = await exec(`./openvpn-control.sh remove ${userid}`)
	//|| stderr.indexOf('is not a valid certificate') != -1
	if (error) {
		response = `- Remove on ${userid} FAILED -`;
		status = 500;
		console.log("WE ARE IN ERROR: ", error)
	} else {
		console.log(stdout)
		response = `+ Remove on ${userid} SUCCEED +`;
	}

	console.log(response);
	
	res.status(status).send(response)
});

app.get('/add', async function (req, res) {
	var userid = req.query.user;
	var response = '';
	var status = 200;
	
	const { stdout, stderr, error } = await exec(`./openvpn-control.sh add ${userid}`)
	if (error || stdout.indexOf('already found') !== -1) {
		response = `- Add on ${userid} FAILED -`;
		status = 500;
		console.log("WE ARE IN ERROR: ", error)
	} else {
		console.log(stdout)
		response = `+ Add on ${userid} SUCCEED +`;
	}


	console.log(response);
	
	res.status(status).send(response)
});

app.post('/syncIndex', async function (req, res) {
	const filePath = path.resolve('/etc/openvpn/easy-rsa/pki/index.txt')
		
	const newIndex = req.body;
	
	const indexData = newIndex.fileData;
	console.log('indexData ',indexData)
	
	fs.writeFileSync(filePath,indexData,{encoding:'utf8',flag:'w'})
	
	res.status(200).send('OK')
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});



