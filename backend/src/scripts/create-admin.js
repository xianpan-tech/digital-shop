// 创建/提升管理员账号（一次性脚本，不设默认密码）。
// 用法（在 backend 目录或项目根目录）：
//   node backend/src/scripts/create-admin.js admin@example.com '你的强密码'
// 已存在该邮箱则重置密码并设为管理员；不存在则新建管理员。
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 12) {
    console.error('用法: node backend/src/scripts/create-admin.js <邮箱> <至少12位强密码>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, is_admin)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, is_admin=TRUE
     RETURNING id, email, is_admin`,
    [email, hash]
  );
  console.log('管理员账号就绪:', rows[0]);
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
