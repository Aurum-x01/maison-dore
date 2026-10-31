import { api } from '../api.js';
import { html, forms, actions, toast, money, fmtDate, fmtTime, confirmDialog, setFormError } from '../ui.js';
import { state, bus, live, fetchMenu, subtotal, setQty, clearCart } from '../state.js';
import { navigate } from '../router.js';
import { dishCard, pill, typeLabel, whereLine, orderDetail as orderBody } from '../components.js';

const emptyState = (title, text, btn, href) => html`<div class="empty"><h2>${title}</h2><p class="muted">${text}</p>${btn ? html`<a class="btn" href="${href}" data-link>${btn}</a>` : ''}</div>`;

// ---------------- cart ----------------
export async function cart() {
  try { // sync prices / availability with the server
    const m = await fetchMenu();
    state.cart = state.cart.filter((l) => m.dishes.some((d) => d.id === l.id)).map((l) => {
      const d = m.dishes.find((x) => x.id === l.id); return { ...l, price: d.price, image: d.image, name: d.name, available: d.available };
    });
    localStorage.setItem('md_cart', JSON.stringify(state.cart));
  } catch { /* offline: keep local cart */ }
  const paint = () => {
    if (!state.cart.length) return emptyState('Your cart is empty.', 'Your next great meal is waiting.', 'Explore Menu', '/menu');
    const bad = state.cart.some((l) => l.available === false);
    return html`<div class="cart-layout"><div>${state.cart.map((l, i) => html`<div class="line" style="animation-delay:${i * 50}ms">
      <img src="${l.image}" alt="${l.name}"><div><h3>${l.name}</h3><div class="muted">${money(l.price)}${l.available === false ? html` · <span style="color:var(--danger)">Currently unavailable</span>` : ''}</div></div>
      <div style="display:flex;align-items:center;gap:18px"><div class="qty"><button data-q="-1" data-id="${l.id}" aria-label="Decrease quantity of ${l.name}">−</button><b aria-live="polite">${l.qty}</b><button data-q="1" data-id="${l.id}" aria-label="Increase quantity of ${l.name}">+</button></div>
      <b style="min-width:70px;text-align:right">${money(l.price * l.qty)}</b><button class="muted" data-rm="${l.id}" aria-label="Remove ${l.name}">✕</button></div></div>`)}</div>
      <aside class="summary"><h3 style="font-size:28px;margin-bottom:14px">Summary</h3>
        <div class="r"><span>Subtotal</span><span>${money(subtotal())}</span></div>
        <div class="r"><span>Delivery fee</span><span class="muted">calculated at checkout (delivery only)</span></div>
        <div class="r t"><span>Total</span><b>${money(subtotal())}</b></div><br>
        ${bad ? html`<p class="form-error" role="alert">Remove unavailable dishes to continue.</p>` : ''}
        <button class="btn solid" style="width:100%" data-checkout ${bad ? 'disabled' : ''}>Proceed to checkout</button></aside></div>`;
  };
  return {
    title: 'Your cart — Maison Doré', noindex: true,
    html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">Order</p><h1>Your cart</h1></div><div id="cartbox">${paint()}</div></div>`,
    mount(root) {
      const box = root.querySelector('#cartbox');
      const off = bus.on('cart', () => { box.innerHTML = paint().s; });
      box.addEventListener('click', (e) => {
        const q = e.target.closest('[data-q]'), r = e.target.closest('[data-rm]');
        if (q) { const l = state.cart.find((x) => x.id === Number(q.dataset.id)); setQty(l.id, l.qty + Number(q.dataset.q)); }
        if (r) setQty(Number(r.dataset.rm), 0);
        if (e.target.closest('[data-checkout]')) navigate(state.user ? '/checkout' : '/login?next=/checkout');
      });
      return off;
    }
  };
}

// ---------------- checkout ----------------
export async function checkout() {
  if (!state.cart.length) return { redirect: '/cart', html: html`` };
  const a = state.address || {};
  const f = (id, label, extra = '') => html`<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" value="${a[id] || ''}" ${extra}></div>`;
  return {
    title: 'Checkout — Maison Doré', noindex: true,
    html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">Checkout</p><h1>How would you like it?</h1></div>
    <form data-form="checkout" class="cart-layout" novalidate><div>
      <div class="seg" role="radiogroup" aria-label="Order type">
        <label><input type="radio" name="orderType" value="delivery" checked><span><b>Delivery</b><span class="muted" style="border:0;padding:0">Delivery to home</span></span></label>
        <label><input type="radio" name="orderType" value="restaurant"><span><b>Restaurant</b><span class="muted" style="border:0;padding:0">Eat at restaurant</span></span></label></div>
      <div id="delivery" class="form"><div class="row2">${f('country', 'Country', 'autocomplete="country-name"')}${f('city', 'City', 'autocomplete="address-level2"')}</div>
        ${f('street', 'Street', 'autocomplete="address-line1"')}<div class="row2">${f('house', 'House number')}${f('apartment', 'Apartment (optional)')}</div>${f('postalCode', 'Postal code', 'autocomplete="postal-code"')}</div>
      <div id="restaurant" class="form" hidden><div class="field"><label>Choose your table</label>
        <div class="tables" role="radiogroup" aria-label="Table">${Array.from({ length: 20 }, (_, i) => html`<label><input type="radio" name="tableNumber" value="${i + 1}"><span>${i + 1}</span></label>`)}</div></div></div>
      <p class="form-error" role="alert" style="margin-top:14px"></p></div>
      <aside class="summary"><h3 style="font-size:28px;margin-bottom:14px">Your order</h3>
        <div class="r"><span>Order type</span><b id="typeVal">Delivery</b></div>
        <div class="r"><span id="whereLbl">Address</span><span id="whereVal" style="text-align:right;max-width:60%"></span></div>
        <div style="border-top:1px solid var(--line);margin:8px 0"></div>
        ${state.cart.map((l) => html`<div class="r"><span>${l.qty} × ${l.name}</span><span>${money(l.price * l.qty)}</span></div>`)}
        <div class="r" style="margin-top:8px"><span>Subtotal</span><span>${money(subtotal())}</span></div>
        <div class="r" id="feeRow"><span>Delivery fee</span><span>${money(state.config.deliveryFee)}</span></div>
        <div class="r t"><span>Total</span><b id="total">${money(subtotal() + state.config.deliveryFee)}</b></div><br>
        <button class="btn solid" type="submit" style="width:100%">Place Order</button></aside></form></div>`,
    mount(root) {
      const form = root.querySelector('form');
      const val = (n) => String(form.elements[n]?.value || '').trim();
      const upd = () => {
        const del = form.orderType.value === 'delivery';
        root.querySelector('#delivery').hidden = !del; root.querySelector('#restaurant').hidden = del; root.querySelector('#feeRow').hidden = !del;
        root.querySelector('#total').textContent = money(subtotal() + (del ? state.config.deliveryFee : 0));
        root.querySelector('#typeVal').textContent = del ? 'Delivery' : 'Dine-in (restaurant)';
        root.querySelector('#whereLbl').textContent = del ? 'Address' : 'Table';
        const addr = [[val('street'), val('house')].filter(Boolean).join(' '), val('city')].filter(Boolean).join(', ');
        const tbl = form.querySelector('input[name="tableNumber"]:checked');
        root.querySelector('#whereVal').textContent = del ? (addr || 'Not specified yet') : (tbl ? `Table ${tbl.value}` : 'Not selected yet');
      };
      form.addEventListener('change', upd); form.addEventListener('input', upd); upd();
    }
  };
}
forms.checkout = async (f, d) => {
  const body = { items: state.cart.map((l) => ({ dishId: l.id, quantity: l.qty })), orderType: d.orderType };
  if (d.orderType === 'delivery') {
    const need = ['country', 'city', 'street', 'house', 'postalCode'];
    if (need.some((k) => !String(d[k] || '').trim())) throw new Error('Please provide your delivery address.');
    const { address } = await api('/profile/address', { method: 'PUT', body: { country: d.country, city: d.city, street: d.street, house: d.house, apartment: d.apartment, postalCode: d.postalCode } });
    state.address = address;
  } else {
    if (!d.tableNumber) throw new Error('Please choose your table.');
    body.tableNumber = Number(d.tableNumber);
  }
  const { order } = await api('/orders', { method: 'POST', body });
  clearCart(); toast('Order successfully placed');
  await navigate(`/orders/${order.id}`);
};

// ---------------- orders ----------------
export async function orders() {
  const { orders: list } = await api('/orders');
  return {
    title: 'My orders — Maison Doré', noindex: true,
    html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">History</p><h1>My orders</h1></div>
    ${list.length ? list.map((o, i) => html`<a class="card ord" href="/orders/${o.id}" data-link style="--i:${i}">
      <div><div class="code">#${o.code}</div><div class="muted">${fmtDate(o.createdAt)} · ${fmtTime(o.createdAt)}</div><div style="margin-top:8px">${typeLabel(o)} · ${whereLine(o)}</div></div>
      <div style="text-align:right"><div class="price">${money(o.totalPrice)}</div><div style="margin-top:8px">${pill(o.status)}</div></div></a>`)
      : emptyState('No orders yet.', 'Your next great meal is waiting.', 'Explore Menu', '/menu')}</div>`
  };
}

export async function orderDetail({ params }) {
  const load = async () => (await api(`/orders/${params.id}`)).order;
  let o = await load();
  const body = () => html`<div class="page-head fade-up"><p class="eyebrow">${typeLabel(o)} order</p><h1>#${o.code}</h1></div>${orderBody(o)}
    ${o.status === 'pending' ? html`<br><button class="btn danger" data-cancel>Cancel order</button>` : ''}`;
  return {
    title: `Order #${o.code} — Maison Doré`, noindex: true,
    html: html`<div class="wrap page"><a class="muted" href="/orders" data-link>← All orders</a><br><br><div id="ob">${body()}</div></div>`,
    mount(root) {
      const box = root.querySelector('#ob');
      const paint = () => { box.innerHTML = body().s; };
      const off = live(async (type, data) => {
        if (type === 'poll') { try { o = await load(); paint(); } catch { /* ignore */ } }
        else if (data && data.id === o.id) { o = data; paint(); if (type === 'order:status') toast(`Order status: ${data.status.replace(/_/g, ' ')}`); }
      });
      box.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-cancel]')) return;
        if (!(await confirmDialog({ title: 'Cancel this order?', text: 'This cannot be undone.', confirmText: 'Cancel order', danger: true }))) return;
        try { o = (await api(`/orders/${o.id}/cancel`, { method: 'PATCH' })).order; paint(); toast('Order status updated'); } catch (err) { toast(err.message, 'error'); }
      });
      return off;
    }
  };
}

// ---------------- favorites ----------------
export async function favorites() {
  const { dishes } = await api('/favorites');
  dishes.forEach((d) => state.dishes.set(d.id, d));
  const empty = () => emptyState('Your favorites list is empty.', 'Tap the star on any dish to save it here.', 'Discover dishes', '/menu');
  return {
    title: 'Favorites — Maison Doré', noindex: true,
    html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">Saved</p><h1>Favorites</h1></div>
      <div id="fav-box">${dishes.length ? html`<div class="grid">${dishes.map((d, i) => dishCard(d, i))}</div>` : empty()}</div></div>`,
    mount(root) {
      return bus.on('fav', ({ id, on }) => {
        if (on) return;
        const c = root.querySelector(`.fav[data-id="${id}"]`)?.closest('.dish');
        if (!c) return;
        c.style.transition = 'opacity .4s, transform .4s'; c.style.opacity = '0'; c.style.transform = 'scale(.94)';
        setTimeout(() => { c.remove(); if (!root.querySelector('.dish')) root.querySelector('#fav-box').innerHTML = empty().s; }, 420);
      });
    }
  };
}

// ---------------- profile ----------------
export async function profile() {
  const u = state.user, a = state.address || {};
  const f = (id, label, v, extra = '') => html`<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" value="${v || ''}" ${extra}></div>`;
  return {
    title: 'Profile — Maison Doré', noindex: true,
    html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">Account</p><h1>Profile</h1></div>
    <div class="detail">
      <div style="display:grid;gap:20px">
      <section class="card panel"><h3>Personal details</h3><form class="form" data-form="profile" novalidate>
        <div class="row2">${f('firstName', 'First name', u.firstName, 'required')}${f('lastName', 'Last name', u.lastName, 'required')}</div>
        <div class="row2"><div class="field"><label>Email</label><input class="input" value="${u.email}" disabled></div>${f('phone', 'Phone', u.phone, 'type="tel" autocomplete="tel"')}</div>
        <p class="form-error" role="alert"></p><button class="btn solid" type="submit" style="justify-self:start">Save changes</button></form></section>
      ${u.role === 'client' ? html`<section class="card panel"><h3>Delivery address</h3><form class="form" data-form="address" novalidate>
        <div class="row2">${f('country', 'Country', a.country)}${f('city', 'City', a.city)}</div>${f('street', 'Street', a.street)}
        <div class="row2">${f('house', 'House number', a.house)}${f('apartment', 'Apartment', a.apartment)}</div>${f('postalCode', 'Postal code', a.postalCode)}
        <p class="form-error" role="alert"></p><button class="btn solid" type="submit" style="justify-self:start">Save address</button></form></section>` : ''}</div>
      <div style="display:grid;gap:20px;align-content:start">
      <section class="card panel"><div class="u">${u.avatar ? html`<img class="avatar" style="width:56px;height:56px" src="${u.avatar}" alt="" referrerpolicy="no-referrer">` : html`<span class="avatar" style="width:56px;height:56px;font-size:18px">${(u.firstName[0] + u.lastName[0]).toUpperCase()}</span>`}
        <div><b>${u.firstName} ${u.lastName}</b><div class="muted">${u.email}</div></div></div>
        <dl class="kv" style="margin-top:18px"><dt>Role</dt><dd><span class="pill accepted">${u.role}</span></dd></dl></section>
      <section class="card panel"><h3>${u.hasPassword ? 'Change password' : 'Set a password'}</h3><form class="form" data-form="password" novalidate>
        ${u.hasPassword ? f('currentPassword', 'Current password', '', 'type="password" autocomplete="current-password"') : ''}
        ${f('newPassword', 'New password', '', 'type="password" autocomplete="new-password" minlength="8"')}
        <p class="form-error" role="alert"></p><button class="btn" type="submit" style="justify-self:start">Update password</button></form></section>
      <button class="btn ghost" data-action="logout">Logout</button></div></div></div>`
  };
}
forms.profile = async (f, d) => { const r = await api('/profile', { method: 'PATCH', body: { firstName: d.firstName, lastName: d.lastName, phone: d.phone } }); state.user = r.user; bus.emit('user'); toast('Profile updated'); };
forms.address = async (f, d) => { const { address } = await api('/profile/address', { method: 'PUT', body: d }); state.address = address; toast('Profile updated'); };
forms.password = async (f, d) => {
  await api('/profile/password', { method: 'PATCH', body: { currentPassword: d.currentPassword, newPassword: d.newPassword } });
  f.reset(); state.user.hasPassword = true; toast('Profile updated');
};