// 管理员登录：POST /api/auth/login { email, password } → { token, email }
// 密码用 bcrypt 校验；token 为 JWT，有效期 8 小时；每次请求后台接口时
// 中间件会重新查库确认 is_admin，封号/降权即时生效。
// 简单防爆破：同一邮箱 5 次失败后锁定 5 分钟（内存级，单实例够用）。
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const attempts = new Map(); // email -> { fails, lockedUntil }

function isLocked(email) {
  const rec = attempts.get(email);
  return rec && rec.lockedUntil && Date.now() < rec.lockedUntil;
}
function recordFail(email) {
  const rec = attempts.get(email) || { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= 5) {
    rec.lockedUntil = Date.now() + 5 * 60 * 1000;
    rec.fails = 0;
  }
  attempts.set(email, rec);
}

router.post('/login', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'server JWT_SECRET not configured' });
    }
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email + password required' });
    if (isLocked(email)) return res.status(429).json({ error: 'too many failed attempts, try again in 5 minutes' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    const ok = user && user.password_hash
      && (await bcrypt.compare(password, user.password_hash));
    if (!ok || !user.is_admin) {
      recordFail(email);
      return res.status(401).json({ error: 'invalid credentials' });
    }
    attempts.delete(email);
    const token = jwt.sign(
      { sub: user.id, email: user.email, is_admin: true },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token, email: user.email });
  } catch (e) {
    console.error('[auth/login]', e.message);
    return res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
