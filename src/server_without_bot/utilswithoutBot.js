const {qiwiApi, Client} = require("./api");
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const { helpRequest, feedbackRequest } = require('./consts');
const dayjs = require('dayjs');

dayjs.extend(isSameOrBefore);
require('dotenv').config();

const { PATH_TO_OPENVPN_CONTROL, PATH_TO_OPENVPN_PROFILES } = process.env;

const createBasicBillfields = (amount, telegramId) => ({
  amount,
  currency: 'RUB',
  comment: `Pepa VPN. Оплата подписки на ${amount} рублей, по аккаунту ${telegramId}`,
  expirationDateTime: qiwiApi.getLifetimeByDay(0.01),
});

const prolongateSubscription = (currentExpiresIn, term, termUnit) => {
  return dayjs(currentExpiresIn).isSameOrBefore(dayjs(), "day") ? dayjs().add(term, termUnit) : dayjs(currentExpiresIn).add(term, termUnit)
};

const getTelegramId = (ctx) => ctx.update.message.from.id;

const getUserByTelegramId = async (telegramId) => await Client.findOne({telegramId});

const createCertificate = async (telegramId) => {
  let constructedPath = '';
  try {
    const { stdout, stderr, error } = await exec(`${PATH_TO_OPENVPN_CONTROL} add ${telegramId}`);
    if (stderr) {
      console.log("WE ARE IN STDERR: ", stderr)
    }
    if (error) {
      console.log("WE ARE IN ERROR: ", error)
    }
    if (stdout) {
      constructedPath = path.join(PATH_TO_OPENVPN_PROFILES, `${telegramId}.ovpn`)
    }
  } catch (e) {
    console.log(`create certificate error: ${e}`)
  }

  return constructedPath;
};

const removeCertificate = async (telegramId) => {
  try {
    const { stdout, stderr, error } = await exec(`${PATH_TO_OPENVPN_CONTROL} remove ${telegramId}`);
    if (stderr) {
      console.log("WE ARE IN STDERR: ", stderr)
    }
    if (error) {
      console.log("WE ARE IN ERROR: ", error)
    }
    if (stdout) {
      console.log("SUCCESSFULLY DELETED USER", telegramId, stdout)
    }
  } catch (e) {
    console.log(`remove certificate error: ${e}`)
  }
};

const createMessagesToSupport = (ctx) => {
  const { message } = ctx;
  const {from : {id, username, first_name, last_name }} = message;
  const name = username ? `@${username}` : `${first_name} ${last_name ?? ''}`;
  const isHelpRequestMessage = helpRequest.test(message.text);
  const messageToClient = isHelpRequestMessage ? 'Ваш запрос принят, ожидайте ответ от бота, среднее время ожидания ответа - 2 часа' : 'Спасибо за ваш отзыв. Благодаря им мы становимся лучше!';
  const messageToSupport = `${isHelpRequestMessage ? `#Поддержка` : `#Фидбэк`}\nСообщение от пользователя ${name} с id <b>${id}</b>\n${message.text.replace(isHelpRequestMessage ? helpRequest : feedbackRequest, '').trimLeft()}`;
  return [messageToClient, messageToSupport]
};

const isThatSameBill = (bill, term) => dayjs().isSameOrBefore(dayjs(bill.expirationDateTime)) && bill.term === term;

const isBotBlocked = (e) => e?.response?.error_code === 403 && e?.response?.description === 'Forbidden: bot was blocked by the user';

module.exports = {
  createBasicBillfields,
  prolongateSubscription,
  getTelegramId,
  getUserByTelegramId,
  createCertificate,
  removeCertificate,
  isThatSameBill,
  createMessagesToSupport,
  isBotBlocked
};
