import { api } from '../api.js';
import { html, forms, toast, money } from '../ui.js';
import { state, fetchMenu, setUser, addToCart, toggleFav } from '../state.js';
import { navigate, roleHome } from '../router.js';
import { dishCard } from '../components.js';

const HERO = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=80';
const ABOUT = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1000&q=80';
const AUTH = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80';

export async function home() {
  let featured = [];
  try {
    const m = await fetchMenu();
    const pick = ['pasta', 'main-courses', 'desserts'].map((s) => m.dishes.find((d) => d.category === s && d.available)).filter(Boolean);
    featured = pick.length ? pick : m.dishes.slice(0, 3);
  } catch { /* featured section simply hidden */ }
  return {
    title: 'Maison Doré — The Art of Fine Dining',
    desc: 'Seasonal fine dining, handmade pasta and an exceptional cellar.',
    html: html`
    <section class="hero"><div class="hero-bg" style="background-image:url('${HERO}')" role="img" aria-label="Candle-lit dining room at Maison Doré"></div>
      <div class="wrap hero-c">
        <p class="eyebrow fade-up" style="--d:0">Maison Doré · Warsaw</p>
        <h1><span class="reveal-line"><span style="--d:1">Experience</span></span><span class="reveal-line"><span style="--d:2">The Art of <em>Fine Dining</em></span></span></h1>
        <p class="fade-up" style="--d:5">Seasonal produce, handmade pasta and slow-cooked classics, served at our table or delivered to yours.</p>
        <div class="hero-btns fade-up" style="--d:6"><a class="btn solid" href="/menu" data-link>Explore Menu</a><a class="btn" href="/menu" data-link>Order Now</a></div>
      </div></section>
    ${featured.length ? html`<section class="section"><div class="wrap">
      <div class="page-head inview"><p class="eyebrow">Signature</p><h1 style="font-size:clamp(36px,5vw,64px)">Tonight’s favourites</h1></div>
      <div class="grid">${featured.map((d, i) => dishCard(d, i))}</div></div></section>` : ''}
    <section class="section"><div class="wrap split">
      <img class="inview" src="${ABOUT}" alt="Chef plating a dish in the open kitchen" loading="lazy">
      <div class="inview" style="--i:2"><p class="eyebrow">Our philosophy</p><h2>Patience, produce and precision</h2>
        <p>Every plate begins with a producer we know by name. We cook with restraint, so the ingredient is always the loudest voice in the room.</p>
        <p>Dine with us, or order from home — the same kitchen, the same care.</p><br><a class="btn" href="/about" data-link>Our story</a></div></div></section>`,
    mount(root) {
      const bg = root.querySelector('.hero-bg'); let raf = 0;
      const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { bg.style.transform = `translateY(${Math.min(window.scrollY, 900) * 0.22}px) scale(1.04)`; }); };
      window.addEventListener('scroll', fn, { passive: true });
      return () => { window.removeEventListener('scroll', fn); cancelAnimationFrame(raf); };
    }
  };
}

export async function menu({ query }) {
  const { categories, dishes } = await fetchMenu();
  let active = categories.some((c) => c.slug === query.get('c')) ? query.get('c') : 'all';
  const grid = (slug) => {
    const list = slug === 'all' ? dishes : dishes.filter((d) => d.category === slug);
    return list.length ? html`<div class="grid">${list.map((d, i) => dishCard(d, i))}</div>` : html`<div class="empty"><p class="muted">Nothing here yet.</p></div>`;
  };
  const tabs = (slug) => html`${[{ slug: 'all', name: 'All' }, ...categories].map((c) => html`<button class="tab${c.slug === slug ? ' active' : ''}" role="tab" aria-selected="${c.slug === slug}" data-slug="${c.slug}">${c.name}</button>`)}`;
  return {
    title: 'Menu — Maison Doré', desc: 'Starters, main courses, handmade pasta, wood-fired pizza, desserts and drinks.',
    html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">Carte</p><h1>Our Menu</h1></div>
      <div class="tabs" role="tablist" id="tabs">${tabs(active)}</div><div id="grid">${grid(active)}</div></div>`,
    mount(root) {
      const t = root.querySelector('#tabs'), g = root.querySelector('#grid');
      t.addEventListener('click', (e) => {
        const b = e.target.closest('.tab'); if (!b) return;
        active = b.dataset.slug; t.innerHTML = tabs(active).s; g.innerHTML = grid(active).s;
        history.replaceState({}, '', active === 'all' ? '/menu' : `/menu?c=${active}`);
      });
    }
  };
}

export async function dish({ params }) {
  const { dish: d } = await api(`/menu/${params.id}`);
  state.dishes.set(d.id, d);
  const fav = state.favs.has(d.id);
  return {
    title: `${d.name} — Maison Doré`, desc: d.description,
    html: html`<div class="wrap page"><a class="muted" href="/menu" data-link>← Back to menu</a><br><br>
      <div class="split"><div class="card dish ${d.available ? '' : 'off'}" style="overflow:hidden"><div class="dish-img" style="aspect-ratio:4/4.4"><img src="${d.image}" alt="${d.name}"></div>
        <button class="fav${fav ? ' on' : ''}" data-action="fav" data-id="${d.id}" aria-pressed="${fav}" aria-label="Add ${d.name} to favorites">${fav ? '★' : '☆'}</button></div>
      <div class="fade-up"><p class="eyebrow">${(state.menu?.categories.find((c) => c.id === d.categoryId) || {}).name || ''}</p><h2 style="font-size:clamp(40px,5vw,70px);margin:14px 0 20px">${d.name}</h2>
        <p>${d.description}</p><p class="price" style="font-size:38px;margin:24px 0">${money(d.price)}</p>
        ${d.available ? html`<button class="btn solid" data-action="add" data-id="${d.id}">Add to cart</button>` : html`<p class="pill cancelled">Currently unavailable</p>`}</div></div></div>`
  };
}

export const about = async () => ({
  title: 'Our Story — Maison Doré', desc: 'A kitchen built on patience, produce and precision.',
  html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">About</p><h1>Our story</h1></div>
    <div class="split"><img class="inview" src="${ABOUT}" alt="Maison Doré dining room" loading="lazy">
    <div class="inview" style="--i:2"><h2 style="font-size:42px">A kitchen with a point of view</h2>
    <p>Maison Doré was founded on a simple idea: cook fewer things, and cook them properly. Our menu changes with the seasons and our pasta is rolled by hand every morning.</p>
    <p>Whether you join us at the table or order at home, you receive the same plate, from the same pass.</p></div></div></div>`
});

export const contact = async () => ({
  title: 'Contact — Maison Doré', desc: 'Find us, call us, or plan your visit.',
  html: html`<div class="wrap page"><div class="page-head fade-up"><p class="eyebrow">Contact</p><h1>Visit us</h1></div>
    <div class="grid"><div class="card panel inview"><h3>Address</h3><p class="muted">Warsaw, Poland<br>Replace with your real address</p></div>
    <div class="card panel inview" style="--i:1"><h3>Hours</h3><p class="muted">Every day<br>12:00 – 23:00</p></div>
    <div class="card panel inview" style="--i:2"><h3>Order online</h3><p class="muted">Delivery or dine-in ordering from our menu.</p><br><a class="btn sm" href="/menu" data-link>Explore menu</a></div></div></div>`
});

// ---------------- auth ----------------
export async function startSession(user) {
  const me = await api('/auth/me');
  await setUser(me);
  const next = new URLSearchParams(location.search).get('next');
  toast(`Welcome, ${user.firstName}`);
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  await navigate(safe || roleHome(user.role));
}

let gsiPromise = null;
const loadGsi = () => gsiPromise ||= new Promise((res, rej) => {
  if (window.google?.accounts) return res();
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s);
});
async function mountGoogle(el) {
  if (!state.config.googleClientId) { el.innerHTML = '<p class="notice">Google sign-in is not configured.</p>'; return; }
  try {
    await loadGsi();
    window.google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      callback: async ({ credential }) => {
        try { const r = await api('/auth/google', { method: 'POST', body: { credential } }); await startSession(r.user); }
        catch (e) { toast(e.message, 'error'); }
      }
    });
    window.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left', width: Math.min(400, el.clientWidth || 340) });
  } catch { el.innerHTML = '<p class="notice">Google sign-in is unavailable right now.</p>'; }
}

forms.login = async (f, d) => { const r = await api('/auth/login', { method: 'POST', body: d }); await startSession(r.user); };
forms.register = async (f, d) => { const r = await api('/auth/register', { method: 'POST', body: d }); await startSession(r.user); };

const authShell = (title, body, alt) => html`<div class="auth"><div class="auth-img" style="background-image:url('${AUTH}')" role="img" aria-label="Restaurant table setting"></div>
  <div class="auth-box fade-up"><p class="eyebrow">Maison Doré</p><h1>${title}</h1>${body}<p class="muted" style="margin-top:26px">${alt}</p></div></div>`;
const field = (id, label, type = 'text', extra = '') => html`<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="${type}" required ${extra}></div>`;

export const login = async () => ({
  title: 'Sign in — Maison Doré', noindex: true,
  html: authShell('Welcome back', html`<div class="gbtn" id="g"></div><div class="divider">or</div>
    <form class="form" data-form="login" novalidate>${field('email', 'Email', 'email', 'autocomplete="email"')}${field('password', 'Password', 'password', 'autocomplete="current-password"')}
    <p class="form-error" role="alert"></p><button class="btn solid" type="submit">Sign in</button></form>`,
  html`New here? <a style="color:var(--gold)" href="/register" data-link>Create an account</a>`),
  mount: (root) => { mountGoogle(root.querySelector('#g')); }
});

export const register = async () => ({
  title: 'Create account — Maison Doré', noindex: true,
  html: authShell('Create account', html`<div class="gbtn" id="g"></div><div class="divider">or</div>
    <form class="form" data-form="register" novalidate><div class="row2">${field('firstName', 'First name', 'text', 'autocomplete="given-name"')}${field('lastName', 'Last name', 'text', 'autocomplete="family-name"')}</div>
    ${field('email', 'Email', 'email', 'autocomplete="email"')}${field('password', 'Password', 'password', 'autocomplete="new-password" minlength="8"')}${field('confirmPassword', 'Confirm password', 'password', 'autocomplete="new-password"')}
    <p class="form-error" role="alert"></p><button class="btn solid" type="submit">Create account</button></form>`,
  html`Already have an account? <a style="color:var(--gold)" href="/login" data-link>Sign in</a>`),
  mount: (root) => { mountGoogle(root.querySelector('#g')); }
});
