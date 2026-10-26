const { Pool } = require('pg');
const { createClient } = require('redis');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'db',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'shop_db',
  user: process.env.POSTGRES_USER || 'shop_user',
  password: process.env.POSTGRES_PASSWORD || 'change-me-strong-password',
  max: 10,
});

let redisClient = null;
async function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || 'redis://:change-me-redis-password@redis:6379';
  redisClient = createClient({ url });
  redisClient.on('error', (e) => console.error('[redis]', e.message));
  await redisClient.connect();
  return redisClient;
}

module.exports = { pool, getRedis };
