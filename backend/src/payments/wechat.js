// 微信支付接入结构（占位 + mock）
// 生产：替换为 wechatpay-node-v3，验签必须用 APIv3 密钥/证书；不要硬编码密钥。
const isMock = () => process.env.PAYMENT_MOCK !== 'false';

function createWechatOrder({ orderNo, totalCents, description }) {
  if (isMock()) {
    return {
      mock: true,
      payUrl: `/api/payments/mock/pay?order_no=${orderNo}&channel=wechat`,
      codeUrl: `mock-wechat-qrcode://${orderNo}`,
      message: 'mock 模式：本地联调用，不会生成真实微信二维码',
    };
  }
  // TODO 生产：用 wechatpay-node-v3 生成 Native 下单
  // const { Wechatpay } = require('wechatpay-node-v3');
  // const pay = new Wechatpay({ appid, mchid, publicKey, privateKey, key: process.env.WECHAT_API_KEY });
  // return pay.transactions_native({ out_trade_no: orderNo, amount: { total: totalCents, currency: 'CNY' }, description, notify_url: process.env.WECHAT_NOTIFY_URL });
  throw new Error('WECHAT not configured: set PAYMENT_MOCK=true for local mock, or implement wechatpay-node-v3 with real keys');
}

function verifyWechatNotify(headers, body) {
  if (isMock()) return true;
  // TODO 生产：用 wechatpay 的验签（Wechatpay 证书 + APIv3 密钥解密 resource），失败返回 false
  return false;
}

module.exports = { createWechatOrder, verifyWechatNotify, isMock };
