import { api } from './api.js';
import { toast } from './ui.js';

const loadCart = () => { try { return JSON.parse(localStorage.getItem('md_cart') || '[]'); } catch { return []; } };
export const state = {
  user: null, address: null, config: { deliveryFee: 5, googleClientId: '' },
  cart: loadCart(), favs: new Set(), dishes: new Map(), menu: null, socket: null
};

const L = {};
export const bus = {
  on(ev, fn) { (L[ev] ||= new Set()).add(fn); return () => L[ev].delete(fn); },
  emit(ev, d) { (L[ev] || []).forEach((f) => f(d)); }
};

// ---------- cart (a per-device convenience; prices are always re-validated by the server) ----------
const saveCart = () => { try { localStorage.setItem('md_cart', JSON.stringify(state.cart)); } catch { /* storage unavailable */ } bus.emit('cart'); };
export const cartCount = () => state.cart.reduce((s, i) => s + i.qty, 0);
export const subtotal = () => Math.round(state.cart.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
export function addToCart(d) {
  if (!d || !d.available) { toast('This dish is currently unavailable.', 'error'); return false; }
  const l = state.cart.find((i) => i.id === d.id);
  if (l) l.qty = Math.min(20, l.qty + 1);
  else state.cart.push({ id: d.id, name: d.name, price: d.price, image: d.image, qty: 1 });
  saveCart(); toast('Added to cart'); return true;
}
export function setQty(id, q) {
  if (q <= 0) state.cart = state.cart.filter((i) => i.id !== id);
  else { const l = state.cart.find((i) => i.id === id); if (l) l.qty = Math.min(20, q); }
  saveCart();
}
export const clearCart = () => { state.cart = []; saveCart(); };

// ---------- menu cache ----------
export async function fetchMenu() {
  const data = await api('/menu');
  state.menu = data;
  state.dishes = new Map(data.dishes.map((d) => [d.id, d]));
  return data;
}

// ---------- session ----------
export async function loadSession() {
  const [config, me] = await Promise.all([api('/config'), api('/auth/me')]);
  state.config = config;
  await setUser(me);
}
export async function setUser(me) {
  state.user = me.user; state.address = me.address || null;
  state.favs = new Set();
  if (me.user) { try { const { dishes } = await api('/favorites'); dishes.forEach((d) => state.dishes.set(d.id, d)); state.favs = new Set(dishes.map((d) => d.id)); } catch { /* ignore */ } }
  connectSocket();
  bus.emit('user');
}

// ---------- favorites ----------
export function paintFav(id, on, animate) {
  document.querySelectorAll(`.fav[data-id="${id}"]`).forEach((b) => {
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★' : '☆';
    if (animate) {
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      if (on) for (let i = 0; i < 8; i++) {
        const p = document.createElement('span'); p.className = 'particle';
        const a = (i / 8) * Math.PI * 2; p.style.setProperty('--x', `${Math.cos(a) * 28}px`); p.style.setProperty('--y', `${Math.sin(a) * 28}px`);
        b.appendChild(p); setTimeout(() => p.remove(), 750);
      }
    }
  });
}
export async function toggleFav(id) {
  if (!state.user) return 'auth';
  const on = !state.favs.has(id);
  on ? state.favs.add(id) : state.favs.delete(id);
  paintFav(id, on, true);
  try {
    await api(`/favorites/${id}`, { method: on ? 'POST' : 'DELETE' });
    toast(on ? 'Added to favorites' : 'Removed from favorites');
    bus.emit('fav', { id, on });
  } catch (e) {
    on ? state.favs.delete(id) : state.favs.add(id); paintFav(id, !on, false);
    toast(e.message, 'error');
  }
}

// ---------- real-time with polling fallback ----------
function connectSocket() {
  if (state.socket) { state.socket.close(); state.socket = null; }
  if (!state.user || typeof window.io === 'undefined') return;
  const s = window.io({ withCredentials: true });
  s.on('order:new', (o) => bus.emit('order:new', o));
  s.on('order:status', (o) => bus.emit('order:status', o));
  state.socket = s;
}
setInterval(() => {
  if (state.user && (!state.socket || !state.socket.connected)) bus.emit('poll');
}, 15000);

// subscribe to live order events; returns an unsubscribe function
export function live(fn) {
  const offs = [bus.on('order:new', (o) => fn('order:new', o)), bus.on('order:status', (o) => fn('order:status', o)), bus.on('poll', () => fn('poll'))];
  return () => offs.forEach((f) => f());
}
