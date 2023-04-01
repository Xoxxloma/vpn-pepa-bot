const axios = require('axios');
const md5 = require('md5');
const qs = require('qs');

let secretKey = "its secret, lol, fuck you :))0))";

const createBill = async (amount) => {
    let url = "https://api.intellectmoney.ru/merchant/createInvoice";

    let eshopId = "464105";
    let orderId = "3";
    let recipientAmount = amount;
    let recipientCurrency = "TST";
    let email = "orenmagic@gmail.com";



    let serviceName = '';
    let userName = '';
    let successUrl = '';
    let failUrl = '';
    let backUrl = '';
    let resultUrl = '';
    let expireDate = '';
    let holdMode = '';
    let preference = '';

    let toHash = eshopId + "::" + orderId + "::" + serviceName + "::" + recipientAmount + "::" + recipientCurrency + "::" + userName + "::" + email + "::" + successUrl + "::" + failUrl + "::" + backUrl + "::" + resultUrl + "::" + expireDate + "::" + holdMode + "::" + preference + "::" + secretKey


    let hash = md5(toHash);

    let data = {
        eshopId,
        orderId,
        recipientAmount,
        recipientCurrency,
        email,
        hash
    };

    const options = {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: qs.stringify(data),
        url,
    };

    try {
        let respose = await axios(options);
        console.log(`Invoice ID: ${respose.data.Result.InvoiceId}`);
        return respose.data.Result.InvoiceId;
    } catch (e) {
        console.log(`error while create invoice is: ${e}`);
    }
};

const getBillState = async (billId) => {
    let eshopId = "464105";
    let invoiceId = billId;

    let toHash = eshopId+"::"+invoiceId+"::"+secretKey;
    let hash = md5(toHash);

    let data = {
        eshopId,
        invoiceId,
        hash
    };

    const url = "https://api.intellectmoney.ru/merchant/getBankCardPaymentState";

    const options = {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: qs.stringify(data),
        url,
    };

    try {
        let respose = await axios(options);
        console.log(`Invoice Status is: ${respose.data.Result.PaymentStep}`);
    } catch (e) {
        console.log(`error while check invoice is: ${e}`);
    }

};

createBill(10).then((billId) => {
    getBillState(billId)
});


