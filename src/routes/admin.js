const router = require('express').Router();
const { pool } = require('../db');
const { ah, parse, z } = require('../http');
const { requireRole } = require('../auth');
const { getSetting } = require('../orders');

router.use(requireRole()); // admin only

router.get('/stats', ah(async (req, res) => {
  const one = async (sql) => (await pool.query(sql))[0][0];
  const totals = await one(`SELECT COUNT(*) AS totalOrders,
      COALESCE(SUM(DATE(created_at)=CURDATE()),0) AS todayOrders,
      COALESCE(SUM(CASE WHEN status='completed' THEN total_price END),0) AS revenue,
      COALESCE(SUM(status NOT IN ('completed','cancelled')),0) AS activeOrders FROM orders`);
  const users = await one('SELECT COUNT(*) AS users FROM users');
  const [days] = await pool.query(`SELECT DATE_FORMAT(created_at,'%Y-%m-%d') AS d, COUNT(*) AS orders,
      COALESCE(SUM(CASE WHEN status='completed' THEN total_price END),0) AS revenue
    FROM orders WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY d`);
  const map = new Map(days.map((r) => [r.d, r]));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const r = map.get(key);
    series.push({ date: key, orders: r ? Number(r.orders) : 0, revenue: r ? Number(r.revenue) : 0 });
  }
  const [popular] = await pool.query(`SELECT oi.name, CAST(SUM(oi.quantity) AS UNSIGNED) AS quantity FROM order_items oi
    JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled' GROUP BY oi.name ORDER BY quantity DESC LIMIT 6`);
  const [byType] = await pool.query("SELECT order_type AS type, COUNT(*) AS count FROM orders WHERE status<>'cancelled' GROUP BY order_type");
  res.json({
    totals: { ...totals, ...users, totalOrders: Number(totals.totalOrders), todayOrders: Number(totals.todayOrders), activeOrders: Number(totals.activeOrders), revenue: Number(totals.revenue) },
    series, popular: popular.map((p) => ({ ...p, quantity: Number(p.quantity) })), byType: byType.map((t) => ({ ...t, count: Number(t.count) }))
  });
}));

router.get('/settings', ah(async (req, res) => {
  res.json({ deliveryFee: Number(await getSetting('deliveryFee', '5')) });
}));
router.patch('/settings', ah(async (req, res) => {
  const d = parse(z.object({ deliveryFee: z.coerce.number().min(0, 'Fee cannot be negative.').max(100) }), req.body);
  await pool.query("INSERT INTO settings (setting_key,setting_value) VALUES ('deliveryFee',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [String(d.deliveryFee)]);
  res.json({ deliveryFee: d.deliveryFee });
}));

module.exports = router;
