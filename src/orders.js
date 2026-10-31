const { pool } = require('./db');

const FLOWS = {
  delivery: ['pending', 'accepted', 'preparing', 'out_for_delivery', 'completed'],
  restaurant: ['pending', 'accepted', 'preparing', 'ready', 'completed']
};
const CANCELLABLE = ['pending', 'accepted', 'preparing'];

function nextStatuses(type, status) {
  const flow = FLOWS[type];
  const i = flow.indexOf(status);
  const out = [];
  if (i >= 0 && i < flow.length - 1) out.push(flow[i + 1]);
  if (CANCELLABLE.includes(status)) out.push('cancelled');
  return out;
}

function mapOrder(o, items) {
  return {
    id: o.id, code: `ORD-${o.id}`, userId: o.user_id, customerName: o.customer_name,
    orderType: o.order_type, status: o.status,
    subtotal: o.subtotal, deliveryFee: o.delivery_fee, totalPrice: o.total_price,
    tableNumber: o.table_number,
    deliveryAddress: o.order_type === 'delivery'
      ? { country: o.ship_country, city: o.ship_city, street: o.ship_street, house: o.ship_house, apartment: o.ship_apartment, postalCode: o.ship_postal }
      : null,
    createdAt: o.created_at, updatedAt: o.updated_at,
    items: (items || []).map((i) => ({ dishId: i.dish_id, name: i.name, image: i.image, unitPrice: i.unit_price, quantity: i.quantity }))
  };
}

async function loadOrders(whereSql, params, limit = 200) {
  const [orders] = await pool.query(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ${Number(limit)}`, params);
  if (!orders.length) return [];
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?) ORDER BY id', [orders.map((o) => o.id)]);
  const by = new Map();
  for (const it of items) { if (!by.has(it.order_id)) by.set(it.order_id, []); by.get(it.order_id).push(it); }
  return orders.map((o) => mapOrder(o, by.get(o.id)));
}

async function getSetting(key, fallback) {
  const [r] = await pool.query('SELECT setting_value FROM settings WHERE setting_key=?', [key]);
  return r[0] ? r[0].setting_value : fallback;
}

module.exports = { FLOWS, nextStatuses, loadOrders, getSetting, mapOrder };
