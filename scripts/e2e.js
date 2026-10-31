// Quick API smoke test against a running server: node scripts/e2e.js
const B = process.env.BASE || 'http://localhost:3000';
function client() {
  let cookie = '';
  return async (path, method = 'GET', body) => {
    const r = await fetch(B + '/api' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let j = null; try { j = await r.json(); } catch {}
    return { s: r.status, j };
  };
}
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(extra))); if (!cond) fails++; };
(async () => {
  const email = `t${Date.now()}@test.dev`;
  const c = client(), w = client(), a = client(), anon = client();
  let r = await c('/auth/register', 'POST', { firstName: 'T', lastName: 'U', email, password: 'Passw0rd!', confirmPassword: 'Passw0rd!', role: 'admin' });
  ok('register -> client even if role=admin sent', r.s === 201 && r.j.user.role === 'client', r);
  r = await c('/auth/register', 'POST', { firstName: 'T', lastName: 'U', email, password: 'Passw0rd!', confirmPassword: 'x' });
  ok('password mismatch rejected', r.s === 400, r);
  r = await c('/profile', 'PATCH', { firstName: 'T', lastName: 'U', role: 'admin' });
  ok('profile PATCH cannot change role', r.s === 200 && r.j.user.role === 'client', r);
  r = await c('/users'); ok('client blocked from /users', r.s === 403, r);
  r = await c('/admin/stats'); ok('client blocked from stats', r.s === 403, r);
  r = await anon('/orders'); ok('anon blocked from orders', r.s === 401, r);
  r = await anon('/auth/login', 'POST', { email: 'x@x.com', password: 'bad' }); ok('bad login msg', r.s === 401 && r.j.error === 'Invalid email or password.', r);
  r = await fetch(B + '/api/auth/logout', { method: 'POST' }); ok('CSRF header required', r.status === 403, r.status);

  const menu = (await c('/menu')).j; const avail = menu.dishes.filter((d) => d.available), off = menu.dishes.find((d) => !d.available);
  r = await c('/favorites/' + avail[0].id, 'POST'); ok('add favorite', r.s === 201, r);
  r = await c('/favorites'); ok('list favorites', r.j.dishes.length === 1, r);
  r = await c('/orders', 'POST', { items: [{ dishId: off.id, quantity: 1 }], orderType: 'restaurant', tableNumber: 3 }); ok('unavailable dish rejected', r.s === 400, r);
  r = await c('/orders', 'POST', { items: [{ dishId: avail[0].id, quantity: 1 }], orderType: 'delivery' }); ok('delivery needs address', r.s === 400 && /address/.test(r.j.error), r);
  r = await c('/profile/address', 'PUT', { country: 'Poland', city: 'Warsaw', street: 'Main Street', house: '25', apartment: '14', postalCode: '00-001' }); ok('save address', r.s === 200, r);
  r = await c('/orders', 'POST', { items: [{ dishId: avail[0].id, quantity: 2, price: 0.01 }, { dishId: avail[1].id, quantity: 1 }], orderType: 'delivery' });
  const exp = Math.round((avail[0].price * 2 + avail[1].price + 5) * 100) / 100;
  ok('delivery order, server-side price', r.s === 201 && r.j.order.totalPrice === exp && r.j.order.status === 'pending', { r, exp });
  const del = r.j.order;
  r = await c('/orders', 'POST', { items: [{ dishId: avail[2].id, quantity: 1 }], orderType: 'restaurant', tableNumber: 15 });
  ok('restaurant order', r.s === 201 && r.j.order.tableNumber === 15 && r.j.order.deliveryAddress === null, r);
  const rest = r.j.order;

  r = await w('/auth/login', 'POST', { email: 'worker@demo.test', password: 'Worker123!' }); ok('worker login', r.s === 200 && r.j.user.role === 'worker', r);
  r = await w('/users'); ok('worker blocked from users', r.s === 403, r);
  r = await w('/menu', 'POST', { name: 'x' }); ok('worker blocked from menu create', r.s === 403, r);
  r = await w('/orders?status=active'); ok('worker sees orders', r.s === 200 && r.j.orders.length >= 2, r);
  r = await w(`/orders/${rest.id}/status`, 'PATCH', { status: 'completed' }); ok('cannot skip statuses', r.s === 400, r);
  for (const s of ['accepted', 'preparing', 'ready', 'completed']) { r = await w(`/orders/${rest.id}/status`, 'PATCH', { status: s }); ok('restaurant -> ' + s, r.s === 200 && r.j.order.status === s, r); }
  r = await w(`/orders/${del.id}/status`, 'PATCH', { status: 'accepted' });
  r = await w(`/orders/${del.id}/status`, 'PATCH', { status: 'preparing' });
  r = await w(`/orders/${del.id}/status`, 'PATCH', { status: 'ready' }); ok('delivery cannot use ready', r.s === 400, r);
  for (const s of ['out_for_delivery', 'completed']) { r = await w(`/orders/${del.id}/status`, 'PATCH', { status: s }); ok('delivery -> ' + s, r.s === 200, r); }
  r = await c(`/orders/${del.id}`); ok('client sees own order status', r.j.order.status === 'completed', r);
  r = await c('/orders'); ok('client history', r.j.orders.length === 2, r);

  r = await a('/auth/login', 'POST', { email: 'admin@demo.test', password: 'Admin123!' }); ok('admin login', r.s === 200, r);
  r = await a('/admin/stats'); ok('admin stats', r.s === 200 && r.j.totals.totalOrders >= 2, r);
  r = await a('/users'); const me = r.j.users.find((u) => u.email === email); ok('admin list users', !!me, r);
  r = await a(`/users/${me.id}`, 'PATCH', { role: 'worker' }); ok('admin changes role', r.s === 200 && r.j.user.role === 'worker', r);
  r = await a(`/users/${me.id}`, 'PATCH', { blocked: true });
  r = await c('/auth/me'); ok('blocked user is signed out', r.j.user === null, r);
  r = await a(`/users/${me.id}`, 'DELETE'); ok('admin deletes user', r.s === 200, r);
  const self = (await a('/auth/me')).j.user; r = await a(`/users/${self.id}`, 'DELETE'); ok('admin cannot delete self', r.s === 400, r);
  r = await a('/menu', 'POST', { name: 'Test Dish', description: 'Just a test dish', price: 9.5, categoryId: 1, image: 'https://example.com/a.jpg', available: true }); ok('admin creates dish', r.s === 201, r);
  const id = r.j.dish.id; r = await a('/menu/' + id, 'PATCH', { available: false }); ok('admin disables dish', r.s === 200 && !r.j.dish.available, r);
  r = await a('/menu/' + id, 'DELETE'); ok('admin deletes dish', r.s === 200, r);
  r = await a('/orders?q=' + del.id + '&type=delivery'); ok('admin order filter', r.j.orders.length === 1, r);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
