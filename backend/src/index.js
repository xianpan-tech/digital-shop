require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, time: new Date().toISOString(), mock: process.env.PAYMENT_MOCK !== 'false' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use('/api', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`[backend] listening on ${PORT}, mock=${process.env.PAYMENT_MOCK !== 'false'}`));
