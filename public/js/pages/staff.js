import { api } from '../api.js';
import { html, toast, money, fmtTime } from '../ui.js';
import { live } from '../state.js';
import { pill, typeLabel, whereLine, statusButtons, orderDetail } from '../components.js';

export const orderCard = (o, flash = false) => html`<article class="card ocard${flash ? ' flash' : ''}">
  <div class="top"><div><div class="code"><a href="/worker/orders/${o.id}" data-link>#${o.code}</a></div><div class="muted">${fmtTime(o.createdAt)} · ${typeLabel(o)}</div></div>${pill(o.status)}</div>
  <div style="font-weight:500">${whereLine(o)}</div>
  <ul>${o.items.map((i) => html`<li><span>${i.quantity}× ${i.name}</span><span class="muted">${money(i.unitPrice * i.quantity)}</span></li>`)}</ul>
  <div style="display:flex;justify-content:space-between;align-items:center"><b class="price" style="font-size:22px">${money(o.totalPrice)}</b></div>
  <div class="acts">${statusButtons(o)}</div></article>`;

// subscribe to live events and the explicit "order-updated" event; returns cleanup
function watch(reload) {
  const off = live(async (type, data) => {
    if (type === 'order:new') toast(`New order #${data.code}`);
    await reload(type === 'order:new' ? data.id : null);
  });
  const h = () => reload(null);
  document.addEventListener('order-updated', h);
  return () => { off(); document.removeEventListener('order-updated', h); };
}

export async function home() {
  const load = async () => {
    const [a, c] = await Promise.all([api('/orders?status=active'), api('/orders?status=completedToday')]);
    return { active: a.orders, done: c.orders };
  };
  let d = await load();
  const col = (title, list, flashId, empty) => html`<section class="col"><h3>${title}<small>${list.length}</small></h3>
    ${list.length ? list.map((o) => orderCard(o, o.id === flashId)) : html`<p class="muted card panel" style="padding:20px">${empty}</p>`}</section>`;
  const board = (flashId) => html`${col('New Orders', d.active.filter((o) => o.status === 'pending'), flashId, 'No new orders.')}
    ${col('Active Orders', d.active.filter((o) => o.status !== 'pending'), flashId, 'Nothing in progress.')}${col('Completed Today', d.done, flashId, 'Nothing completed yet.')}`;
  return {
    title: 'Worker dashboard — Maison Doré', heading: 'Dashboard', noindex: true,
    html: html`<div class="board" id="board">${board()}</div>`,
    mount(root) {
      const box = root.querySelector('#board');
      return watch(async (flashId) => { try { d = await load(); box.innerHTML = board(flashId).s; } catch { /* keep current view */ } });
    }
  };
}

export async function orders({ query }) {
  const status = ['pending', 'active', 'completed'].includes(query.get('status')) ? query.get('status') : '';
  const load = async () => (await api('/orders' + (status ? `?status=${status}` : ''))).orders;
  let list = await load();
  const tab = (s, t) => html`<a class="tab${s === status ? ' active' : ''}" href="/worker/orders${s ? '?status=' + s : ''}" data-link>${t}</a>`;
  const body = () => list.length ? html`<div class="grid">${list.map((o) => orderCard(o))}</div>` : html`<p class="muted">No orders found.</p>`;
  return {
    title: 'Orders — Maison Doré', heading: 'Orders', noindex: true,
    html: html`<div class="tabs">${tab('', 'All')}${tab('pending', 'Pending')}${tab('active', 'Active')}${tab('completed', 'Completed')}</div><div id="list">${body()}</div>`,
    mount(root) {
      const box = root.querySelector('#list');
      return watch(async () => { try { list = await load(); box.innerHTML = body().s; } catch { /* ignore */ } });
    }
  };
}

export async function orderPage({ params }) {
  const load = async () => (await api(`/orders/${params.id}`)).order;
  let o = await load();
  const body = () => html`<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:24px">
    <div><span class="code serif" style="font-size:34px">#${o.code}</span> ${pill(o.status)}</div><div class="acts" style="display:flex;gap:8px">${statusButtons(o)}</div></div>${orderDetail(o, { staff: true })}`;
  return {
    title: `Order #${o.code} — Maison Doré`, heading: 'Order', noindex: true,
    html: html`<a class="muted" href="/worker/orders" data-link>← All orders</a><br><br><div id="ob">${body()}</div>`,
    mount(root) {
      const box = root.querySelector('#ob');
      return watch(async () => { try { o = await load(); box.innerHTML = body().s; } catch { /* ignore */ } });
    }
  };
}
