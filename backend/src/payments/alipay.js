// 支付宝接入结构（占位 + mock）
// 生产：替换为 alipay-sdk，验签必须用真实公钥；不要硬编码密钥，全部从 .env 读取。
const isMock = () => process.env.PAYMENT_MOCK !== 'false';

function createAlipayOrder({ orderNo, totalCents, subject }) {
  if (isMock()) {
    return {
      mock: true,
      payUrl: `/api/payments/mock/pay?order_no=${orderNo}&channel=alipay`,
      message: 'mock 模式：本地联调用，不会跳转真实支付宝',
    };
  }
  // TODO 生产：用 alipay-sdk 生成支付链接
  // const { AlipaySdk } = require('alipay-sdk');
  // const sdk = new AlipaySdk({ appId: process.env.ALIPAY_APP_ID, privateKey: process.env.ALIPAY_PRIVATE_KEY, alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY, gateway: process.env.ALIPAY_GATEWAY });
  // return sdk.pageExecute('alipay.trade.page.pay', { method: 'GET', bizContent: { out_trade_no: orderNo, total_amount: (totalCents/100).toFixed(2), subject, product_code: 'FAST_INSTANT_TRADE_PAY' } });
  throw new Error('ALIPAY not configured: set PAYMENT_MOCK=true for local mock, or implement alipay-sdk with real keys');
}

function verifyAlipayNotify(body) {
  if (isMock()) return true;
  // TODO 生产：用 alipay-sdk 的 checkNotifySign 验签，失败返回 false
  // if (!process.env.ALIPAY_PUBLIC_KEY) return false;
  // return sdk.checkNotifySign(body);
  return false;
}

module.exports = { createAlipayOrder, verifyAlipayNotify, isMock };
