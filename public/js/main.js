import { api } from './api.js';
import { setRenderer, navigate, roleHome } from './router.js';
import { state, bus, loadSession, cartCount, setUser } from './state.js';
import { html, esc, actions, forms, toast, icons, setFormError, observeInview, skeletonGrid, skeletonBlock, FALLBACK_IMG, confirmDialog } from './ui.js';
import './components.js';
import * as pub from './pages/public.js';
import * as cli from './pages/client.js';
import * as staff from './pages/staff.js';
import * as admin from './pages/admin.js';

const SITE = { layout: 'site' };
const routes = [
  ['/', pub.home, SITE], ['/menu', pub.menu, { ...SITE, skel: 'grid' }], ['/menu/:id', pub.dish, SITE],
  ['/about', pub.about, SITE], ['/contact', pub.contact, SITE],
  ['/login', pub.login, { layout: 'bare', guest: true }], ['/register', pub.register, { layout: 'bare', guest: true }],
  ['/cart', cli.cart, SITE], ['/checkout', cli.checkout, { ...SITE, auth: true }],
  ['/orders', cli.orders, { ...SITE, auth: true }], ['/orders/:id', cli.orderDetail, { ...SITE, auth: true }],
  ['/profile', cli.profile, { ...SITE, auth: true }], ['/favorites', cli.favorites, { ...SITE, auth: true, skel: 'grid' }],
  ['/worker', staff.home, { layout: 'dash', section: 'worker', role: 'worker' }],
  ['/worker/orders', staff.orders, { layout: 'dash', section: 'worker', role: 'worker' }],
  ['/worker/orders/:id', staff.orderPage, { layout: 'dash', section: 'worker', role: 'worker' }],
  ['/admin', admin.overview, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/orders', admin.orders, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/users', admin.users, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/menu', admin.menu, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/menu/create', admin.menuForm, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/menu/:id/edit', admin.menuForm, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/statistics', admin.statistics, { layout: 'dash', section: 'admin', role: 'admin' }],
  ['/admin/settings', admin.settings, { layout: 'dash', section: 'admin', role: 'admin' }]
].map(([p, fn, o]) => ({ re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), fn, ...o }));

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
let shellKey = '', view = null, cleanup = null, token = 0, scrollCleanup = null;

// ---------- layouts ----------
const initials = (u) => (u.firstName[0] + (u.lastName[0] || '')).toUpperCase();
const avatar = (u) => (u.avatar ? html`<img class="avatar" src="${u.avatar}" alt="" referrerpolicy="no-referrer">` : html`<span class="avatar" aria-hidden="true">${initials(u)}</span>`);

function navHtml() {
  const u = state.user, n = cartCount();
  const lk = (href, t) => html`<a href="${href}" data-link class="${location.pathname === href ? 'active' : ''}">${t}</a>`;
  return html`<div class="wrap nav-in">
    <a class="logo" href="/" data-link aria-label="Maison Doré — home">Maison <span>Doré</span></a>
    <nav class="links" aria-label="Main">${lk('/', 'Home')}${lk('/menu', 'Menu')}${lk('/about', 'About')}${lk('/contact', 'Contact')}</nav>
    <div class="nav-r">
      <a class="iconbtn" href="/favorites" data-link aria-label="Favorites">${icons.heart}</a>
      <a class="iconbtn" href="/cart" data-link aria-label="Cart, ${n} items" id="cart-link">${icons.bag}${n ? html`<span class="badge" id="cart-badge">${n}</span>` : ''}</a>
      ${u ? html`<div class="accmenu"><button class="iconbtn" data-action="acc-toggle" aria-label="Account menu" aria-haspopup="true" aria-expanded="false">${avatar(u)}</button>
        <div class="dropdown" id="dropdown"><div class="who"><b>${u.firstName} ${u.lastName}</b><div class="muted" style="font-size:12px">${u.role}</div></div>
          ${u.role !== 'client' ? html`<a href="${roleHome(u.role)}" data-link>${u.role === 'admin' ? 'Admin panel' : 'Worker dashboard'}</a>` : ''}
          <a href="/orders" data-link>My orders</a><a href="/favorites" data-link>Favorites</a><a href="/profile" data-link>Profile</a>
          <button data-action="logout">Log out</button></div></div>`
      : html`<a class="btn sm" href="/login" data-link style="margin-left:8px">Login</a>`}
      <button class="iconbtn burger" data-action="nav-toggle" aria-label="Menu" aria-expanded="false"><span>${html`<i></i><i></i><i></i>`}</span></button>
    </div></div>
    <div class="mobile-menu"><a href="/" data-link>Home</a><a href="/menu" data-link>Menu</a><a href="/about" data-link>About</a><a href="/contact" data-link>Contact</a>
      ${u ? html`<a href="/orders" data-link>My orders</a><a href="/profile" data-link>Profile</a>` : html`<a href="/login" data-link>Login</a>`}</div>`;
}
function renderNav() {
  const nav = $('#nav'); if (!nav) return;
  const open = nav.classList.contains('open');
  nav.innerHTML = navHtml().s; if (open) nav.classList.add('open');
  $('.burger', nav)?.setAttribute('aria-expanded', String(open));
}
const footer = () => html`<footer class="footer"><div class="wrap foot-g">
  <div><a class="logo" href="/" data-link>Maison <span>Doré</span></a><p style="margin-top:14px;max-width:320px">Seasonal cooking, handmade pasta and an exceptional cellar.</p></div>
  <div><h4>Visit</h4><p>Warsaw, Poland</p><p>Daily 12:00 – 23:00</p><a href="/contact" data-link>Contact</a></div>
  <div><h4>Explore</h4><a href="/menu" data-link>Menu</a><a href="/about" data-link>Our story</a><a href="/login" data-link>Account</a></div>
  </div><div class="wrap copy">© ${new Date().getFullYear()} Maison Doré</div></footer>`;

function dashHtml(section) {
  const a = state.user;
  const items = section === 'admin'
    ? [['/admin', 'Overview'], ['/admin/orders', 'Orders'], ['/admin/users', 'Users'], ['/admin/users?role=worker', 'Workers'], ['/admin/menu', 'Menu'], ['/admin/statistics', 'Statistics'], ['/admin/settings', 'Settings']]
    : [['/worker', 'Dashboard'], ['/worker/orders', 'Orders'], ['/worker/orders?status=active', 'Active Orders'], ['/worker/orders?status=completed', 'Completed'], ['/profile', 'Profile']];
  return html`<div class="dash" id="dash"><aside class="side" aria-label="Sidebar">
    <a class="logo" href="/" data-link>Maison <span>Doré</span></a><div class="tag">${section === 'admin' ? 'Administration' : 'Kitchen & Service'}</div>
    ${items.map(([h, t]) => html`<a href="${h}" data-link data-nav="${h}">${t}</a>`)}
    <div class="grow"></div>
    ${section === 'admin' ? html`<a href="/menu" data-link>View site</a>` : ''}
    <button data-action="logout">Logout</button></aside>
    <div class="scrim" data-action="drawer"></div>
    <div class="dash-main"><header class="dash-top"><button class="iconbtn menu-toggle" data-action="drawer" aria-label="Open sidebar">${icons.menu}</button>
      <h1 id="dash-title"></h1><span class="muted">${a ? a.firstName : ''}</span></header><div id="view"></div></div></div>`;
}
function ensureShell(layout, section) {
  const key = layout + ':' + (section || '');
  if (shellKey !== key) {
    document.body.classList.toggle('is-dash', layout === 'dash');
    if (layout === 'dash') app.innerHTML = dashHtml(section).s;
    else app.innerHTML = `<header class="nav" id="nav"></header><main><div id="view"></div></main>${layout === 'site' ? footer().s : ''}`;
    shellKey = key;
    if (layout !== 'dash') renderNav();
    onScroll();
  }
  view = $('#view');
  if (layout === 'dash') {
    $('#dash').classList.remove('drawer');
    const cur = location.pathname + location.search;
    app.querySelectorAll('.side a[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === cur || (!location.search && a.dataset.nav === location.pathname)));
  } else app.querySelectorAll('.links a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === location.pathname));
}
function onScroll() {
  const nav = $('#nav'); if (!nav) return;
  nav.classList.toggle('solid', window.scrollY > 40);
}
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- render ----------
function setMeta(title, desc, noindex) {
  document.title = title;
  const d = document.querySelector('meta[name=description]'); if (d && desc) d.content = desc;
  const r = document.querySelector('meta[name=robots]'); if (r) r.content = noindex ? 'noindex,nofollow' : 'index,follow';
}
async function render() {
  const my = ++token;
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* noop */ } }
  cleanup = null;
  const path = location.pathname;
  let route = null, params = {};
  for (const r of routes) { const m = r.re.exec(path); if (m) { route = r; params = m.groups || {}; break; } }
  if (!route) route = { fn: async () => ({ title: 'Page not found — Maison Doré', noindex: true, html: html`<div class="wrap page errbox"><p class="eyebrow">404</p><h2>This page doesn’t exist.</h2><p class="muted">Let’s get you back to the table.</p><br><a class="btn" href="/" data-link>Home</a></div>` }), layout: 'site' };

  // client-side guard (UX only — the API enforces the real rules)
  if ((route.auth || route.role) && !state.user) return navigate('/login?next=' + encodeURIComponent(path + location.search), { replace: true });
  if (route.role && state.user.role !== 'admin' && state.user.role !== route.role) { toast('You do not have access to this page.', 'error'); return navigate(roleHome(state.user.role), { replace: true }); }
  if (route.guest && state.user) return navigate(roleHome(state.user.role), { replace: true });

  const sameShell = shellKey === (route.layout + ':' + (route.section || ''));
  if (view && sameShell) { view.classList.add('leave'); await new Promise((r) => setTimeout(r, 160)); if (my !== token) return; }
  ensureShell(route.layout, route.section);
  view.classList.add('leave');

  const skelTimer = setTimeout(() => { if (my === token) { view.innerHTML = (route.skel === 'grid' ? html`<div class="wrap page">${skeletonGrid(6)}</div>` : route.layout === 'dash' ? skeletonBlock() : html`<div class="wrap page">${skeletonBlock()}</div>`).s; view.classList.remove('leave'); } }, 140);
  let page;
  try { page = await route.fn({ params, query: new URLSearchParams(location.search) }); }
  catch (e) {
    page = { title: 'Error — Maison Doré', noindex: true, html: html`<div class="${route.layout === 'dash' ? '' : 'wrap page'} errbox"><h2>Something went wrong.</h2><p class="muted">${e.status === 404 ? 'We could not find what you were looking for.' : 'Please try again.'}</p><br><button class="btn" data-action="reload">Try again</button></div>` };
  }
  clearTimeout(skelTimer);
  if (my !== token) return;
  if (page.redirect) return navigate(page.redirect, { replace: true });
  view.innerHTML = page.html.s;
  window.scrollTo(0, 0);
  if (route.layout === 'dash') { const t = $('#dash-title'); if (t) t.textContent = page.heading || ''; }
  setMeta(page.title || 'Maison Doré', page.desc, route.auth || route.role || page.noindex);
  requestAnimationFrame(() => view.classList.remove('leave'));
  observeInview(view);
  if (page.mount) cleanup = page.mount(view) || null;
  if (route.layout !== 'dash') { renderNav(); onScroll(); }
}
setRenderer(render);
window.addEventListener('popstate', render);

// ---------- global events ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault(); $('#nav')?.classList.remove('open'); navigate(a.getAttribute('href')); return;
  }
  const dd = $('#dropdown'); if (dd && !e.target.closest('.accmenu')) dd.classList.remove('show');
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) {
    e.preventDefault();
    Promise.resolve(actions[el.dataset.action](el, e)).catch((err) => toast(err.message || 'Something went wrong. Please try again.', 'error'));
  }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const fn = forms[f.dataset.form]; if (!fn) return;
  const btn = f.querySelector('button[type=submit]');
  setFormError(f, ''); btn?.classList.add('loading');
  try { await fn(f, Object.fromEntries(new FormData(f))); }
  catch (err) { setFormError(f, err.message || 'Something went wrong. Please try again.'); }
  finally { btn?.classList.remove('loading'); }
});
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG' && !e.target.dataset.fb) { e.target.dataset.fb = '1'; e.target.src = FALLBACK_IMG; }
}, true);

actions.reload = () => render();
actions['nav-toggle'] = (el) => { const n = $('#nav'); const o = n.classList.toggle('open'); el.setAttribute('aria-expanded', String(o)); };
actions['acc-toggle'] = (el) => { const d = $('#dropdown'); const s = d.classList.toggle('show'); el.setAttribute('aria-expanded', String(s)); };
actions.drawer = () => $('#dash')?.classList.toggle('drawer');
actions.logout = async () => {
  await api('/auth/logout', { method: 'POST' });
  await setUser({ user: null });
  toast('You have been logged out');
  shellKey = ''; navigate('/');
};
bus.on('cart', () => { renderNav(); const b = $('#cart-badge'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } });
bus.on('user', () => { if (!document.body.classList.contains('is-dash')) renderNav(); });

(async () => {
  try { await loadSession(); } catch { /* API unreachable: render public site anyway */ }
  await render();
})();
