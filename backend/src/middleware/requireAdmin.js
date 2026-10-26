// 后台鉴权中间件：验证 JWT + 查库确认 is_admin。
// 未登录 → 401；已登录但不是管理员 → 403。
// JWT_SECRET 未配置时直接 500 拒绝，避免用默认密钥签发 token。
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function requireAdmin(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'server JWT_SECRET not configured' });
    }
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'login required' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, email, is_admin FROM users WHERE id=$1',
      [payload.sub]
    );
    if (!rows.length || !rows[0].is_admin) {
      return res.status(403).json({ error: 'admin required' });
    }
    req.admin = rows[0];
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

module.exports = { requireAdmin };
