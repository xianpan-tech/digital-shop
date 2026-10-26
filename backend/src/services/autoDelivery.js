// 自动发货服务
// 流程：验签通过后 -> 锁订单 -> 取未售卡密 -> 标记已售 -> 绑定订单 -> 订单改为 delivered
const { pool, getRedis } = require('../db');

async function autoDeliver(orderId) {
  const client = await pool.connect();
  try {
    const redis = await getRedis();
    const lockKey = `lock:order:${orderId}`;
    const locked = await redis.set(lockKey, '1', { NX: true, EX: 30 });
    if (!locked) {
      console.log(`[autoDeliver] order ${orderId} already locked, skip`);
      return { skipped: true, reason: 'locked' };
    }
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
      if (orderRes.rows.length === 0) throw new Error('order not found');
      const order = orderRes.rows[0];
      if (order.status === 'delivered') {
        await client.query('COMMIT');
        return { skipped: true, reason: 'already delivered' };
      }

      const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id=$1', [orderId]);
      for (const item of itemsRes.rows) {
        // 取一条未售卡密，跳过已锁定的行
        const codeRes = await client.query(
          `SELECT * FROM inventory_codes
           WHERE product_id = (SELECT product_id FROM order_items WHERE id=$1)
             AND status='available'
           ORDER BY created_at ASC LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [item.id]
        );
        if (codeRes.rows.length === 0) {
          // 无卡密：保持 paid，等待补货（不标记 delivered）
          console.warn(`[autoDeliver] no code for product, order ${orderId}`);
          continue;
        }
        const code = codeRes.rows[0];
        await client.query(
          `UPDATE inventory_codes SET status='sold', sold_order_id=$1, sold_at=NOW() WHERE id=$2`,
          [orderId, code.id]
        );
        // 注意：delivery_payload 包含卡密，不要写到日志里
        await client.query(
          `UPDATE order_items SET delivery_payload=$1, inventory_code_id=$2 WHERE id=$3`,
          [code.code_text, code.id, item.id]
        );
      }

      const allDelivered = (await client.query(
        `SELECT COUNT(*)::int AS total, COUNT(delivery_payload)::int AS done FROM order_items WHERE order_id=$1`,
        [orderId]
      )).rows[0];
      const isFullyDelivered = allDelivered.total > 0 && allDelivered.total === allDelivered.done;

      await client.query(
        `UPDATE orders SET status=$1, delivered_at=CASE WHEN $1='delivered' THEN NOW() ELSE delivered_at END WHERE id=$2`,
        [isFullyDelivered ? 'delivered' : 'paid', orderId]
      );
      await client.query('COMMIT');
      return { delivered: isFullyDelivered, orderId };
    } finally {
      await redis.del(lockKey);
    }
  } finally {
    client.release();
  }
}

module.exports = { autoDeliver };
