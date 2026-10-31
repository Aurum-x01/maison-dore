import { html, money, fmtDate, fmtTime, STATUS, actions, toast, confirmDialog } from './ui.js';
import { state, addToCart, toggleFav } from './state.js';
import { navigate } from './router.js';
import { api } from './api.js';
import { FLOWS } from './flows.js';

export function dishCard(d, i = 0) {
  const fav = state.favs.has(d.id);
  const off = !d.available;
  return html`<article class="card dish${off ? ' off' : ''}" style="--i:${i}">
    <a class="dish-img" href="/menu/${d.id}" data-link aria-label="View ${d.name}"><img loading="lazy" src="${d.image}" alt="${d.name} — ${d.description}"></a>
    ${off ? html`<span class="off-tag">Currently unavailable</span>` : ''}
    <button class="fav${fav ? ' on' : ''}" data-action="fav" data-id="${d.id}" aria-pressed="${fav}" aria-label="Add ${d.name} to favorites">${fav ? '★' : '☆'}</button>
    <div class="dish-body">
      <h3><a href="/menu/${d.id}" data-link>${d.name}</a></h3>
      <p>${d.description}</p>
      <div class="dish-foot"><span class="price">${money(d.price)}</span>
        <button class="btn sm" data-action="add" data-id="${d.id}" ${off ? 'disabled' : ''} aria-label="Add ${d.name} to cart">${off ? 'Unavailable' : 'Add to cart'}</button></div>
    </div></article>`;
}

actions.add = (el) => {
  const d = state.dishes.get(Number(el.dataset.id));
  if (!addToCart(d)) return;
  const old = el.textContent; el.classList.add('done'); el.textContent = '✓ Added';
  setTimeout(() => { el.classList.remove('done'); el.textContent = old; }, 1400);
};
actions.fav = async (el) => {
  const r = await toggleFav(Number(el.dataset.id));
  if (r === 'auth') { toast('Please sign in to save favorites.', 'error'); navigate('/login?next=' + encodeURIComponent(location.pathname)); }
};

export const pill = (s) => html`<span class="pill ${s}">${STATUS[s] || s}</span>`;
export const typeLabel = (o) => (o.orderType === 'delivery' ? 'Delivery' : 'Restaurant');
export function whereLine(o) {
  if (o.orderType === 'restaurant') return `Table ${o.tableNumber}`;
  const a = o.deliveryAddress || {};
  return [a.city, [a.street, a.house].filter(Boolean).join(' ') + (a.apartment ? `/${a.apartment}` : '')].filter(Boolean).join(', ');
}

export function timeline(o) {
  if (o.status === 'cancelled') return html`<p class="pill cancelled">This order was cancelled</p>`;
  const flow = FLOWS[o.orderType];
  const idx = flow.indexOf(o.status);
  return html`<div class="timeline" aria-label="Order progress">${flow.map((s, i) => {
    const done = i < idx || o.status === 'completed';
    const now = i === idx && o.status !== 'completed';
    const label = s === 'pending' ? 'Order received' : STATUS[s];
    return html`<div class="step ${done ? 'done' : ''} ${now ? 'now' : ''}"><span class="dot">${done ? '✓' : now ? '●' : '○'}</span><div><b style="font-weight:500">${label}</b></div></div>`;
  })}</div>`;
}

// shared order detail body (client page, worker page, admin modal)
export function orderDetail(o, { staff = false } = {}) {
  return html`<div class="detail">
    <section class="card panel">
      <h3>Items</h3>
      ${o.items.map((it) => html`<div class="line" style="grid-template-columns:72px 1fr auto;padding:14px 0">
        <img src="${it.image}" alt="${it.name}" style="width:72px;height:60px"><div><b style="font-weight:500">${it.name}</b><div class="muted">${it.quantity} × ${money(it.unitPrice)}</div></div>
        <b>${money(it.unitPrice * it.quantity)}</b></div>`)}
      <dl class="kv" style="margin-top:18px">
        <dt>Subtotal</dt><dd>${money(o.subtotal)}</dd>
        ${o.orderType === 'delivery' ? html`<dt>Delivery</dt><dd>${money(o.deliveryFee)}</dd>` : ''}
        <dt>Total</dt><dd class="price" style="font-size:24px">${money(o.totalPrice)}</dd>
      </dl>
    </section>
    <div style="display:grid;gap:20px;align-content:start">
      <section class="card panel"><h3>Details</h3>
        <dl class="kv">
          <dt>Order</dt><dd>#${o.code}</dd>
          <dt>Date</dt><dd>${fmtDate(o.createdAt)}</dd>
          <dt>Time</dt><dd>${fmtTime(o.createdAt)}</dd>
          <dt>Type</dt><dd>${typeLabel(o)}</dd>
          <dt>${o.orderType === 'delivery' ? 'Address' : 'Table'}</dt>
          <dd>${o.orderType === 'delivery' ? html`${o.deliveryAddress.street} ${o.deliveryAddress.house}${o.deliveryAddress.apartment ? ', apt ' + o.deliveryAddress.apartment : ''}<br>${o.deliveryAddress.postalCode} ${o.deliveryAddress.city}, ${o.deliveryAddress.country}` : o.tableNumber}</dd>
          ${staff ? html`<dt>Customer</dt><dd>${o.customerName}</dd>` : ''}
          <dt>Status</dt><dd>${pill(o.status)}</dd>
        </dl></section>
      <section class="card panel"><h3>Progress</h3>${timeline(o)}</section>
    </div></div>`;
}

// ---------- staff status actions (worker board, worker detail, admin) ----------
const ACTION_LABEL = { accepted: 'Accept Order', preparing: 'Start Preparing', ready: 'Mark Ready', out_for_delivery: 'Out for Delivery', completed: 'Complete', cancelled: 'Cancel' };
export function nextStatuses(o) {
  const flow = FLOWS[o.orderType]; const i = flow.indexOf(o.status); const out = [];
  if (i >= 0 && i < flow.length - 1) out.push(flow[i + 1]);
  if (['pending', 'accepted', 'preparing'].includes(o.status)) out.push('cancelled');
  return out;
}
export const statusButtons = (o) => nextStatuses(o).map((s) =>
  html`<button class="btn sm ${s === 'cancelled' ? 'danger' : 'solid'}" data-action="set-status" data-id="${o.id}" data-s="${s}">${ACTION_LABEL[s]}</button>`);

actions['set-status'] = async (el) => {
  const status = el.dataset.s;
  if (status === 'cancelled' && !(await confirmDialog({ title: 'Cancel this order?', text: 'The customer will see it as cancelled.', confirmText: 'Cancel order', danger: true }))) return;
  el.classList.add('loading');
  try {
    const { order } = await api(`/orders/${el.dataset.id}/status`, { method: 'PATCH', body: { status } });
    toast('Order status updated');
    document.dispatchEvent(new CustomEvent('order-updated', { detail: order }));
  } catch (e) { toast(e.message, 'error'); } finally { el.classList.remove('loading'); }
};
