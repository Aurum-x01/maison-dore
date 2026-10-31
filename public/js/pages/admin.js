import { api } from '../api.js';
import { html, forms, actions, toast, money, fmtDate, fmtTime, modal, confirmDialog, debounce, STATUS } from '../ui.js';
import { fetchMenu, state } from '../state.js';
import { navigate } from '../router.js';
import { pill, typeLabel, whereLine, statusButtons, orderDetail } from '../components.js';

// ---------------- charts (dependency-free) ----------------
const bars = (vals, labels, fmt = String) => {
  const max = Math.max(...vals, 1);
  return html`<div class="bars" role="img" aria-label="Bar chart">${vals.map((v, i) => html`<div class="bar" title="${labels[i]}: ${fmt(v)}"><i style="height:${(v / max) * 100}%;--i:${i}"></i></div>`)}</div>
    <div class="axis">${labels.map((l, i) => html`<span>${i % 2 === 0 ? l : ''}</span>`)}</div>`;
};
const hbars = (rows) => {
  const max = Math.max(...rows.map((r) => r.quantity), 1);
  return rows.length ? html`${rows.map((r) => html`<div class="hbar"><div><span>${r.name}</span><b>${r.quantity}</b></div><i style="width:${(r.quantity / max) * 100}%"></i></div>`)}` : html`<p class="muted">No data yet.</p>`;
};
const donut = (byType) => {
  const get = (t) => byType.find((x) => x.type === t)?.count || 0;
  const del = get('delivery'), rest = get('restaurant'), tot = del + rest;
  const pct = tot ? Math.round((del / tot) * 100) : 0;
  return html`<div class="donut" role="img" aria-label="Delivery ${del}, restaurant ${rest}" style="background:conic-gradient(var(--gold) 0 ${pct}%, #3a3a3a ${pct}% 100%)"></div>
    <div class="legend"><span><i style="background:var(--gold)"></i>Delivery ${del}</span><span><i style="background:#3a3a3a"></i>Restaurant ${rest}</span></div>`;
};
const stat = (label, value, i) => html`<div class="card stat" style="--i:${i}"><small>${label}</small><b>${value}</b></div>`;
const panel = (title, body) => html`<section class="card panel"><h3 style="font-size:22px;margin-bottom:0">${title}</h3>${body}</section>`;

async function statsPage(heading, extra) {
  const s = await api('/admin/stats');
  const t = s.totals, labels = s.series.map((d) => d.date.slice(8));
  return {
    title: `${heading} — Maison Doré`, heading, noindex: true,
    html: html`<div class="stats">${stat('Total Orders', t.totalOrders, 0)}${stat('Today Orders', t.todayOrders, 1)}${stat('Revenue', money(t.revenue), 2)}${stat('Users', t.users, 3)}${stat('Active Orders', t.activeOrders, 4)}</div>
      <div class="charts">${panel('Orders · last 14 days', bars(s.series.map((d) => d.orders), labels))}${panel('Revenue · last 14 days', bars(s.series.map((d) => d.revenue), labels, money))}
      ${panel('Most popular dishes', hbars(s.popular))}${panel('Delivery vs restaurant', donut(s.byType))}</div>${extra ? extra(s) : ''}`
  };
}
export const overview = () => statsPage('Overview');
export const statistics = () => statsPage('Statistics', (s) => html`<br><div class="tablewrap stack"><table><thead><tr><th>Date</th><th>Orders</th><th>Revenue (completed)</th></tr></thead>
  <tbody>${[...s.series].reverse().map((d) => html`<tr><td data-l="Date">${d.date}</td><td data-l="Orders">${d.orders}</td><td data-l="Revenue">${money(d.revenue)}</td></tr>`)}</tbody></table></div>`);

// ---------------- orders ----------------
export async function orders() {
  const [{ orders: first }, { users }] = await Promise.all([api('/orders'), api('/users')]);
  let list = first;
  const table = () => list.length ? html`<div class="tablewrap stack"><table><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Where</th><th>Total</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>
    ${list.map((o) => html`<tr><td data-l="Order"><b>#${o.code}</b></td><td data-l="Customer">${o.customerName}</td><td data-l="Type">${typeLabel(o)}</td><td data-l="Where">${whereLine(o)}</td>
      <td data-l="Total">${money(o.totalPrice)}</td><td data-l="Status">${pill(o.status)}</td><td data-l="Created">${fmtDate(o.createdAt)} ${fmtTime(o.createdAt)}</td>
      <td><button class="btn sm ghost" data-view="${o.id}">Details</button></td></tr>`)}</tbody></table></div>` : html`<p class="muted">No orders match these filters.</p>`;
  return {
    title: 'Orders — Maison Doré', heading: 'Orders', noindex: true,
    html: html`<form class="filters" id="f" role="search"><input class="input" type="search" name="q" placeholder="Search order…" aria-label="Search order" style="min-width:200px">
      <select class="input" name="status" aria-label="Status"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
      <select class="input" name="type" aria-label="Order type"><option value="">All types</option><option value="delivery">Delivery</option><option value="restaurant">Restaurant</option></select>
      <select class="input" name="userId" aria-label="User"><option value="">All users</option>${users.map((u) => html`<option value="${u.id}">${u.firstName} ${u.lastName}</option>`)}</select>
      <input class="input" type="date" name="from" aria-label="From date"><input class="input" type="date" name="to" aria-label="To date"></form><div id="tbl">${table()}</div>`,
    mount(root) {
      const f = root.querySelector('#f'), box = root.querySelector('#tbl'); let m = null;
      const run = async () => {
        const p = new URLSearchParams([...new FormData(f)].filter(([, v]) => v));
        try { list = (await api('/orders?' + p)).orders; box.innerHTML = table().s; } catch (e) { toast(e.message, 'error'); }
      };
      const d = debounce(run, 300);
      f.addEventListener('input', d); f.addEventListener('change', d); f.addEventListener('submit', (e) => e.preventDefault());
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-view]'); if (!b) return;
        const o = list.find((x) => x.id === Number(b.dataset.view));
        m = modal(html`<h2>#${o.code}</h2><div class="acts" style="display:flex;gap:8px;margin-bottom:18px">${statusButtons(o)}</div>${orderDetail(o, { staff: true })}<div class="dialog-actions"><button class="btn ghost" data-close>Close</button></div>`, { wide: true, label: 'Order details' });
      });
      const upd = () => { m?.close(); run(); };
      document.addEventListener('order-updated', upd);
      return () => document.removeEventListener('order-updated', upd);
    }
  };
}

// ---------------- users ----------------
let userCtx = { id: null, done: () => {} };
const userForm = (u) => html`<h2>${u ? 'Edit user' : 'Create user'}</h2><form class="form" data-form="user-form" novalidate>
  <div class="row2"><div class="field"><label for="uf1">First name</label><input class="input" id="uf1" name="firstName" value="${u?.firstName || ''}" required></div>
  <div class="field"><label for="uf2">Last name</label><input class="input" id="uf2" name="lastName" value="${u?.lastName || ''}" required></div></div>
  <div class="field"><label for="uf3">Email</label><input class="input" id="uf3" name="email" type="email" value="${u?.email || ''}" required></div>
  <div class="row2"><div class="field"><label for="uf4">Role</label><select class="input" id="uf4" name="role">${['client', 'worker', 'admin'].map((r) => html`<option value="${r}" ${u?.role === r ? 'selected' : ''}>${r}</option>`)}</select></div>
  <div class="field"><label for="uf5">${u ? 'New password (optional)' : 'Password'}</label><input class="input" id="uf5" name="password" type="password" autocomplete="new-password" ${u ? '' : 'required'}></div></div>
  <p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn solid" type="submit">${u ? 'Save' : 'Create'}</button></div></form>`;

forms['user-form'] = async (f, d) => {
  const body = { firstName: d.firstName, lastName: d.lastName, email: d.email, role: d.role };
  if (d.password) body.password = d.password;
  if (userCtx.id) await api(`/users/${userCtx.id}`, { method: 'PATCH', body }); else await api('/users', { method: 'POST', body: { ...body, password: d.password } });
  userCtx.close(); toast(userCtx.id ? 'Profile updated' : 'User created'); userCtx.done();
};

export async function users({ query }) {
  const role = ['client', 'worker', 'admin'].includes(query.get('role')) ? query.get('role') : '';
  let list = (await api('/users' + (role ? `?role=${role}` : ''))).users;
  const table = () => list.length ? html`<div class="tablewrap stack"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>
    ${list.map((u) => html`<tr><td data-l="User"><div class="u"><span class="avatar" aria-hidden="true">${(u.firstName[0] + u.lastName[0]).toUpperCase()}</span><b style="font-weight:500">${u.firstName} ${u.lastName}</b></div></td>
      <td data-l="Email">${u.email}</td><td data-l="Role"><span class="pill accepted">${u.role}</span></td>
      <td data-l="Status">${u.blocked ? html`<span class="pill cancelled">Blocked</span>` : html`<span class="pill completed">Active</span>`}</td><td data-l="Created">${fmtDate(u.createdAt)}</td>
      <td><div class="acts"><button class="btn sm ghost" data-edit="${u.id}">Edit</button><button class="btn sm ghost" data-block="${u.id}">${u.blocked ? 'Unblock' : 'Block'}</button>
        <button class="btn sm danger" data-del="${u.id}" ${u.id === state.user.id ? 'disabled' : ''}>Delete</button></div></td></tr>`)}</tbody></table></div>` : html`<p class="muted">No users found.</p>`;
  return {
    title: 'Users — Maison Doré', heading: role === 'worker' ? 'Workers' : 'Users', noindex: true,
    html: html`<div class="filters"><input class="input" type="search" id="uq" placeholder="Search users…" aria-label="Search users"><button class="btn solid" id="new" style="flex:0 0 auto">Create user</button></div><div id="tbl">${table()}</div>`,
    mount(root) {
      const box = root.querySelector('#tbl');
      const reload = async () => { try { const q = root.querySelector('#uq').value.trim(); const p = new URLSearchParams(); if (role) p.set('role', role); if (q) p.set('q', q); list = (await api('/users?' + p)).users; box.innerHTML = table().s; } catch (e) { toast(e.message, 'error'); } };
      root.querySelector('#uq').addEventListener('input', debounce(reload, 300));
      const open = (u) => { const m = modal(userForm(u), { label: 'User form' }); userCtx = { id: u?.id || null, done: reload, close: m.close }; };
      root.querySelector('#new').addEventListener('click', () => open(null));
      box.addEventListener('click', async (e) => {
        const ed = e.target.closest('[data-edit]'), bl = e.target.closest('[data-block]'), dl = e.target.closest('[data-del]');
        try {
          if (ed) open(list.find((u) => u.id === Number(ed.dataset.edit)));
          if (bl) {
            const u = list.find((x) => x.id === Number(bl.dataset.block));
            if (!u.blocked && !(await confirmDialog({ title: 'Block this user?', text: `${u.firstName} ${u.lastName} will be signed out and unable to log in.`, confirmText: 'Block', danger: true }))) return;
            await api(`/users/${u.id}`, { method: 'PATCH', body: { blocked: !u.blocked } }); toast(u.blocked ? 'User unblocked' : 'User blocked'); reload();
          }
          if (dl) {
            const u = list.find((x) => x.id === Number(dl.dataset.del));
            if (!(await confirmDialog({ title: 'Delete this user?', text: `${u.email} will be permanently removed. Their past orders stay in the records.`, confirmText: 'Delete', danger: true }))) return;
            await api(`/users/${u.id}`, { method: 'DELETE' }); toast('User deleted'); reload();
          }
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  };
}

// ---------------- menu management ----------------
export async function menu() {
  const { dishes, categories } = await fetchMenu();
  const cat = (id) => categories.find((c) => c.id === id)?.name || '';
  let list = dishes;
  const table = () => html`<div class="tablewrap stack"><table><thead><tr><th>Dish</th><th>Category</th><th>Price</th><th>Available</th><th>Actions</th></tr></thead><tbody>
    ${list.map((d) => html`<tr><td data-l="Dish"><div class="u"><img class="thumb" src="${d.image}" alt=""><b style="font-weight:500">${d.name}</b></div></td><td data-l="Category">${cat(d.categoryId)}</td><td data-l="Price">${money(d.price)}</td>
      <td data-l="Available"><button class="switch${d.available ? ' on' : ''}" role="switch" aria-checked="${d.available}" aria-label="Toggle availability of ${d.name}" data-toggle="${d.id}"></button></td>
      <td><div class="acts"><a class="btn sm ghost" href="/admin/menu/${d.id}/edit" data-link>Edit</a><button class="btn sm danger" data-del="${d.id}">Delete</button></div></td></tr>`)}</tbody></table></div>`;
  return {
    title: 'Menu — Maison Doré', heading: 'Menu', noindex: true,
    html: html`<div class="filters"><span class="muted" style="align-self:center;flex:1">${list.length} dishes</span><a class="btn solid" href="/admin/menu/create" data-link style="flex:0 0 auto">Add dish</a></div><div id="tbl">${table()}</div>`,
    mount(root) {
      const box = root.querySelector('#tbl');
      box.addEventListener('click', async (e) => {
        const tg = e.target.closest('[data-toggle]'), dl = e.target.closest('[data-del]');
        try {
          if (tg) {
            const d = list.find((x) => x.id === Number(tg.dataset.toggle));
            const { dish } = await api(`/menu/${d.id}`, { method: 'PATCH', body: { available: !d.available } });
            list = list.map((x) => (x.id === dish.id ? dish : x)); box.innerHTML = table().s; toast('Menu updated');
          }
          if (dl) {
            const d = list.find((x) => x.id === Number(dl.dataset.del));
            if (!(await confirmDialog({ title: 'Delete this dish?', text: `“${d.name}” will be removed from the menu. Consider marking it unavailable instead.`, confirmText: 'Delete', danger: true }))) return;
            await api(`/menu/${d.id}`, { method: 'DELETE' }); list = list.filter((x) => x.id !== d.id); box.innerHTML = table().s; toast('Dish deleted');
          }
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  };
}

export async function menuForm({ params }) {
  const { categories } = await fetchMenu();
  const d = params.id ? (await api(`/menu/${params.id}`)).dish : null;
  return {
    title: `${d ? 'Edit' : 'Add'} dish — Maison Doré`, heading: d ? 'Edit dish' : 'Add dish', noindex: true,
    html: html`<div class="detail"><form class="form card panel" data-form="dish-form" data-id="${d?.id || ''}" novalidate>
      <div class="field"><label for="d1">Name</label><input class="input" id="d1" name="name" value="${d?.name || ''}" required></div>
      <div class="field"><label for="d2">Description</label><textarea class="input" id="d2" name="description" rows="3" required>${d?.description || ''}</textarea></div>
      <div class="row2"><div class="field"><label for="d3">Price (€)</label><input class="input" id="d3" name="price" type="number" step="0.01" min="0" value="${d?.price ?? ''}" required></div>
      <div class="field"><label for="d4">Category</label><select class="input" id="d4" name="categoryId">${categories.map((c) => html`<option value="${c.id}" ${d?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`)}</select></div></div>
      <div class="field"><label for="d5">Image URL</label><input class="input" id="d5" name="image" value="${d?.image || ''}" placeholder="https://… or /images/dish.jpg" required></div>
      <label class="check"><input type="checkbox" name="available" ${!d || d.available ? 'checked' : ''}> Available to order</label>
      <p class="form-error" role="alert"></p><div style="display:flex;gap:12px"><button class="btn solid" type="submit">${d ? 'Save changes' : 'Create dish'}</button><a class="btn ghost" href="/admin/menu" data-link>Cancel</a></div></form>
      <div class="card panel" style="align-self:start"><h3>Preview</h3><img id="pv" src="${d?.image || ''}" alt="Dish preview" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px"></div></div>`,
    mount(root) {
      const inp = root.querySelector('#d5'), pv = root.querySelector('#pv');
      inp.addEventListener('input', debounce(() => { pv.dataset.fb = ''; pv.src = inp.value; }, 400));
    }
  };
}
forms['dish-form'] = async (f, d) => {
  const body = { name: d.name, description: d.description, price: d.price, categoryId: d.categoryId, image: d.image, available: f.available.checked };
  if (f.dataset.id) await api(`/menu/${f.dataset.id}`, { method: 'PATCH', body }); else await api('/menu', { method: 'POST', body });
  toast(f.dataset.id ? 'Menu updated' : 'Dish created'); await navigate('/admin/menu');
};

// ---------------- settings ----------------
export async function settings() {
  const s = await api('/admin/settings');
  return {
    title: 'Settings — Maison Doré', heading: 'Settings', noindex: true,
    html: html`<form class="form card panel" data-form="settings" style="max-width:480px" novalidate><h3>Delivery</h3>
      <div class="field"><label for="s1">Delivery fee (€)</label><input class="input" id="s1" name="deliveryFee" type="number" step="0.01" min="0" value="${s.deliveryFee}" required></div>
      <p class="form-error" role="alert"></p><button class="btn solid" type="submit" style="justify-self:start">Save</button></form>`
  };
}
forms.settings = async (f, d) => { const r = await api('/admin/settings', { method: 'PATCH', body: { deliveryFee: d.deliveryFee } }); state.config.deliveryFee = r.deliveryFee; toast('Settings saved'); };
