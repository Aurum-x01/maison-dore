const router = require('express').Router();
const { pool } = require('../db');
const { ah, parse, z, HttpError } = require('../http');
const { requireAuth, requireRole } = require('../auth');
const { FLOWS, nextStatuses, loadOrders, getSetting } = require('../orders');

router.use(requireAuth);

const orderSchema = z.object({
  items: z.array(z.object({
    dishId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20)
  })).min(1, 'Your cart is empty.').max(50),
  orderType: z.enum(['delivery', 'restaurant']),
  tableNumber: z.coerce.number().int().min(1, 'Please enter a valid table number.').max(99, 'Please enter a valid table number.').optional()
});
const round2 = (n) => Math.round(n * 100) / 100;

router.post('/', ah(async (req, res) => {
  const d = parse(orderSchema, req.body);
  const conn = await pool.getConnection();
  let orderId;
  try {
    await conn.beginTransaction();
    // merge duplicate lines; prices ALWAYS come from the database
    const qty = new Map();
    for (const i of d.items) qty.set(i.dishId, Math.min(20, (qty.get(i.dishId) || 0) + i.quantity));
    const [dishes] = await conn.query('SELECT id,name,price,image,available FROM dishes WHERE id IN (?) FOR UPDATE', [[...qty.keys()]]);
    if (dishes.length !== qty.size) throw new HttpError(400, 'Some dishes no longer exist.');
    for (const dish of dishes) if (!dish.available) throw new HttpError(400, `This dish is currently unavailable: ${dish.name}.`);

    let address = null, table = null, fee = 0;
    if (d.orderType === 'delivery') {
      const [a] = await conn.query('SELECT * FROM addresses WHERE user_id=?', [req.user.id]);
      if (!a[0]) throw new HttpError(400, 'Please provide your delivery address.');
      address = a[0];
      fee = Number(await getSetting('deliveryFee', '5'));
    } else {
      if (!d.tableNumber) throw new HttpError(400, 'Please enter your table number.');
      table = d.tableNumber;
    }
    const subtotal = round2(dishes.reduce((s, x) => s + x.price * qty.get(x.id), 0));
    const total = round2(subtotal + fee);
    const [r] = await conn.query(
      `INSERT INTO orders (user_id,customer_name,order_type,status,subtotal,delivery_fee,total_price,table_number,
        ship_country,ship_city,ship_street,ship_house,ship_apartment,ship_postal)
       VALUES (?,?,?,'pending',?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, `${req.user.first_name} ${req.user.last_name}`, d.orderType, subtotal, fee, total, table,
        address?.country ?? null, address?.city ?? null, address?.street ?? null, address?.house ?? null,
        address?.apartment ?? null, address?.postal_code ?? null]);
    orderId = r.insertId;
    for (const x of dishes) {
      await conn.query('INSERT INTO order_items (order_id,dish_id,name,image,unit_price,quantity) VALUES (?,?,?,?,?,?)',
        [orderId, x.id, x.name, x.image, x.price, qty.get(x.id)]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

  const [order] = await loadOrders('WHERE id=?', [orderId]);
  req.app.get('io').to('staff').emit('order:new', order);
  res.status(201).json({ order });
}));

router.get('/', ah(async (req, res) => {
  const where = [], params = [];
  if (req.user.role === 'client') { where.push('user_id=?'); params.push(req.user.id); }
  else {
    const q = req.query;
    if (q.status === 'active') where.push("status NOT IN ('completed','cancelled')");
    else if (q.status === 'completedToday') where.push("status='completed' AND DATE(updated_at)=CURDATE()");
    else if (typeof q.status === 'string' && q.status) { where.push('status=?'); params.push(q.status); }
    if (q.type === 'delivery' || q.type === 'restaurant') { where.push('order_type=?'); params.push(q.type); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || '')) { where.push('created_at>=?'); params.push(q.from); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.to || '')) { where.push('created_at<DATE_ADD(?, INTERVAL 1 DAY)'); params.push(q.to); }
    if (q.userId) { where.push('user_id=?'); params.push(Number(q.userId) || 0); }
    if (typeof q.q === 'string' && q.q.trim()) {
      const s = q.q.trim().replace(/^#?(ord-)?/i, '');
      where.push('(id=? OR customer_name LIKE ?)');
      params.push(Number(s) || 0, `%${q.q.trim()}%`);
    }
  }
  const orders = await loadOrders(where.length ? `WHERE ${where.join(' AND ')}` : '', params);
  res.json({ orders });
}));

router.get('/:id', ah(async (req, res) => {
  const [o] = await loadOrders('WHERE id=?', [Number(req.params.id)]);
  if (!o || (req.user.role === 'client' && o.userId !== req.user.id)) throw new HttpError(404, 'Order not found.');
  res.json({ order: o });
}));

async function setStatus(req, res, status, order) {
  await pool.query('UPDATE orders SET status=? WHERE id=?', [status, order.id]);
  const [updated] = await loadOrders('WHERE id=?', [order.id]);
  const io = req.app.get('io');
  io.to('staff').emit('order:status', updated);
  if (updated.userId) io.to(`user:${updated.userId}`).emit('order:status', updated);
  res.json({ order: updated });
}

router.patch('/:id/status', requireRole('worker'), ah(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']) }), req.body);
  const [order] = await loadOrders('WHERE id=?', [Number(req.params.id)]);
  if (!order) throw new HttpError(404, 'Order not found.');
  if (!nextStatuses(order.orderType, order.status).includes(status)) throw new HttpError(400, 'This status change is not allowed.');
  await setStatus(req, res, status, order);
}));

// a client may cancel their own order while it is still pending
router.patch('/:id/cancel', ah(async (req, res) => {
  const [order] = await loadOrders('WHERE id=?', [Number(req.params.id)]);
  if (!order || order.userId !== req.user.id) throw new HttpError(404, 'Order not found.');
  if (order.status !== 'pending') throw new HttpError(400, 'This order can no longer be cancelled.');
  await setStatus(req, res, 'cancelled', order);
}));

module.exports = router;
