const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// GET /api/categories
router.get('/categories', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort ASC');
  res.json(rows);
});

// GET /api/products?category=ai&q=
router.get('/products', async (req, res) => {
  const { category, q } = req.query;
  let sql = `SELECT p.*, c.name AS category_name,
    (SELECT COUNT(*)::int FROM inventory_codes ic WHERE ic.product_id=p.id AND ic.status='available') AS available_stock
    FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=true`;
  const params = [];
  if (category) { params.push(category); sql += ` AND c.slug=$${params.length}`; }
  if (q) { params.push(`%${q}%`); sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`; }
  sql += ' ORDER BY p.sort ASC';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

// GET /api/products/:slug
router.get('/products/:slug', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name,
      (SELECT COUNT(*)::int FROM inventory_codes ic WHERE ic.product_id=p.id AND ic.status='available') AS available_stock
     FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.slug=$1 AND p.is_active=true`,
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'product not found' });
  res.json(rows[0]);
});

module.exports = router;
