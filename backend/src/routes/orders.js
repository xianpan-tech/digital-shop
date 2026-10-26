const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { createAlipayOrder } = require('../payments/alipay');
const { createWechatOrder } = require('../payments/wechat');
const router = express.Router();

function genOrderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `${ymd}${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

// POST /api/orders { items: [{slug, qty}], contact_email, contact_phone, pay_channel }
router.post('/orders', async (req, res) => {
  const { items, contact_email, contact_phone, pay_channel } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });
  if (!['alipay', 'wechat', 'mock'].includes(pay_channel)) return res.status(400).json({ error: 'pay_channel must be alipay|wechat|mock' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0;
    const lines = [];
    for (const it of items) {
      const { rows } = await client.query('SELECT * FROM products WHERE slug=$1 AND is_active=true', [it.slug]);
      if (!rows.length) throw new Error(`product not found: ${it.slug}`);
      const p = rows[0];
      const qty = Math.max(1, Number(it.qty || 1));
      total += p.price_cents * qty;
      lines.push({ product: p, qty });
    }
    const orderNo = genOrderNo();
    const orderRes = await client.query(
      `INSERT INTO orders (order_no, contact_email, contact_phone, total_cents, status, pay_channel)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`,
      [orderNo, contact_email || null, contact_phone || null, total, pay_channel]
    );
    const order = orderRes.rows[0];
    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, l.product.id, l.product.name, l.product.price_cents, l.qty]
      );
    }
    // 支付记录（去重键 out_trade_no = orderNo）
    await client.query(
      `INSERT INTO payments (order_id, channel, out_trade_no, amount_cents, status) VALUES ($1,$2,$3,$4,'pending')`,
      [order.id, pay_channel, orderNo, total]
    );
    await client.query('COMMIT');

    // 生成支付链接（mock 或真实）
    let payInfo;
    if (pay_channel === 'alipay') payInfo = createAlipayOrder({ orderNo, totalCents: total, subject: `订单 ${orderNo}` });
    else if (pay_channel === 'wechat') payInfo = createWechatOrder({ orderNo, totalCents: total, description: `订单 ${orderNo}` });
    else payInfo = { mock: true, payUrl: `/api/payments/mock/pay?order_no=${orderNo}&channel=mock` };

    res.json({ order, pay: payInfo });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/orders/:orderNo?phone=  订单查询（不返回卡密除非已支付且已发货，且需匹配联系方式）
router.get('/orders/:orderNo', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE order_no=$1', [req.params.orderNo]);
  if (!rows.length) return res.status(404).json({ error: 'order not found' });
  const order = rows[0];
  // 简单校验：若提供了 phone/email，需匹配（游客查询）
  if ((req.query.phone && order.contact_phone && req.query.phone !== order.contact_phone) ||
      (req.query.email && order.contact_email && req.query.email !== order.contact_email)) {
    return res.status(403).json({ error: 'contact mismatch' });
  }
  const items = await pool.query('SELECT id, product_name, unit_price_cents, quantity, delivery_payload FROM order_items WHERE order_id=$1', [order.id]);
  res.json({ order, items: items.rows });
});

module.exports = router;
