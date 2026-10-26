const express = require('express');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');
const router = express.Router();

// 全部后台接口要求管理员 JWT（见 routes/auth.js 登录取 token）。
router.use(requireAdmin);
// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  const { rows } = await pool.query(`SELECT o.*, (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id=o.id) AS item_count FROM orders o ORDER BY o.created_at DESC LIMIT 200`);
  res.json(rows);
});

// GET /api/admin/orders/:id
router.get('/orders/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
  res.json({ order: rows[0], items: items.rows });
});

// POST /api/admin/orders/:id/refund { reason, confirm_unused: true }
// 退款会回滚卡密：必须由管理员在确认卡密未被使用后，显式传 confirm_unused=true。
router.post('/orders/:id/refund', async (req, res) => {
  const { reason, confirm_unused } = req.body || {};
  if (confirm_unused !== true) {
    return res.status(400).json({ error: 'confirm_unused=true required: confirm the delivered code was not used before refunding' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const o = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!o.rows.length) throw new Error('order not found');
    if (o.rows[0].status === 'refunded') throw new Error('already refunded');
    // 回滚未使用的卡密：调用方已传 confirm_unused=true，即已人工确认卡密未被使用。
    const items = await client.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
    for (const it of items) {
      if (it.inventory_code_id) {
        await client.query(`UPDATE inventory_codes SET status='available', sold_order_id=NULL, sold_at=NULL WHERE id=$1`, [it.inventory_code_id]);
      }
    }
    await client.query(`UPDATE orders SET status='refunded' WHERE id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true, reason: reason || '' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// 商品管理
router.get('/products', async (req, res) => {
  const { rows } = await pool.query(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.sort ASC`);
  res.json(rows);
});
router.post('/products', async (req, res) => {
  const { category_id, slug, name, description, price_cents, stock_type } = req.body || {};
  if (!slug || !name) return res.status(400).json({ error: 'slug/name required' });
  const { rows } = await pool.query(
    `INSERT INTO products (category_id, slug, name, description, price_cents, stock_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [category_id || null, slug, name, description || '', Number(price_cents || 0), stock_type || 'code']
  );
  res.json(rows[0]);
});
router.put('/products/:id', async (req, res) => {
  const { name, description, price_cents, is_active } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE products SET name=COALESCE($1,name), description=COALESCE($2,description), price_cents=COALESCE($3,price_cents), is_active=COALESCE($4,is_active) WHERE id=$5 RETURNING *`,
    [name, description, price_cents, is_active, req.params.id]
  );
  res.json(rows[0] || {});
});

// 卡密库
router.get('/codes', async (req, res) => {
  const { product_id, status } = req.query;
  let sql = `SELECT ic.*, p.name AS product_name FROM inventory_codes ic LEFT JOIN products p ON p.id=ic.product_id WHERE 1=1`;
  const params = [];
  if (product_id) { params.push(product_id); sql += ` AND ic.product_id=$${params.length}`; }
  if (status) { params.push(status); sql += ` AND ic.status=$${params.length}`; }
  sql += ' ORDER BY ic.created_at DESC LIMIT 500';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});
router.post('/codes', async (req, res) => {
  const { product_id, codes } = req.body || {};
  if (!product_id || !Array.isArray(codes) || codes.length === 0) return res.status(400).json({ error: 'product_id + codes[] required' });
  for (const code of codes) {
    await pool.query(`INSERT INTO inventory_codes (product_id, code_text) VALUES ($1,$2)`, [product_id, String(code)]);
  }
  res.json({ ok: true, count: codes.length });
});

module.exports = router;
