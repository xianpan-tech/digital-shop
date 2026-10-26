const express = require('express');
const { pool } = require('../db');
const { verifyAlipayNotify } = require('../payments/alipay');
const { verifyWechatNotify } = require('../payments/wechat');
const { autoDeliver } = require('../services/autoDelivery');
const router = express.Router();

// 支付宝回调
router.post('/alipay/notify', express.urlencoded({ extended: true }), async (req, res) => {
  if (!verifyAlipayNotify(req.body)) return res.status(400).send('fail');
  const outTradeNo = req.body.out_trade_no;
  const tradeNo = req.body.trade_no;
  // 幂等：同一 trade_no 只处理一次
  const payRes = await pool.query('SELECT * FROM payments WHERE out_trade_no=$1', [outTradeNo]);
  if (!payRes.rows.length) return res.status(404).send('fail');
  const pay = payRes.rows[0];
  if (pay.status === 'success') return res.send('success');
  await pool.query(`UPDATE payments SET status='success', trade_no=$1, raw_notify=$2 WHERE id=$3`, [tradeNo || null, JSON.stringify(req.body), pay.id]);
  await pool.query(`UPDATE orders SET status='paid', paid_at=NOW() WHERE id=$1`, [pay.order_id]);
  await autoDeliver(pay.order_id);
  res.send('success');
});

// 微信回调（JSON）
router.post('/wechat/notify', async (req, res) => {
  if (!verifyWechatNotify(req.headers, req.body)) return res.status(400).json({ code: 'FAIL' });
  const outTradeNo = req.body?.resource?.out_trade_no || req.body?.out_trade_no;
  if (!outTradeNo) return res.status(400).json({ code: 'FAIL' });
  const payRes = await pool.query('SELECT * FROM payments WHERE out_trade_no=$1', [outTradeNo]);
  if (!payRes.rows.length) return res.status(404).json({ code: 'FAIL' });
  const pay = payRes.rows[0];
  if (pay.status === 'success') return res.json({ code: 'SUCCESS' });
  await pool.query(`UPDATE payments SET status='success', raw_notify=$1 WHERE id=$2`, [JSON.stringify(req.body), pay.id]);
  await pool.query(`UPDATE orders SET status='paid', paid_at=NOW() WHERE id=$1`, [pay.order_id]);
  await autoDeliver(pay.order_id);
  res.json({ code: 'SUCCESS', message: '成功' });
});

// Mock 支付成功后跳回前台：用相对路径 /pay/success，走同一域名下的 Nginx，不要拼 localhost。
// 旧写法用 FRONTEND_URL 默认 http://localhost:3000，会让访客浏览器跳到访客自己的本机，已删除。
router.get('/mock/pay', async (req, res) => {
  if (process.env.PAYMENT_MOCK === 'false') return res.status(403).json({ error: 'mock disabled in production' });
  const { order_no } = req.query;
  const payRes = await pool.query('SELECT * FROM payments WHERE out_trade_no=$1', [order_no]);
  if (!payRes.rows.length) return res.status(404).json({ error: 'order not found' });
  const pay = payRes.rows[0];
  if (pay.status !== 'success') {
    await pool.query(`UPDATE payments SET status='success', trade_no=$1 WHERE id=$2`, [`MOCK${Date.now()}`, pay.id]);
    await pool.query(`UPDATE orders SET status='paid', paid_at=NOW() WHERE id=$1`, [pay.order_id]);
    await autoDeliver(pay.order_id);
  }
  res.redirect(`/pay/success?order_no=${order_no}`);
});

module.exports = router;
