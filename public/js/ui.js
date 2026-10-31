// ---------- safe HTML templating: interpolated values are escaped unless wrapped in raw() ----------
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : v == null || v === false ? '' : esc(v));
export const html = (strings, ...vals) => new Raw(strings.reduce((o, s, i) => o + s + (i < vals.length ? val(vals[i]) : ''), ''));

// ---------- registries used by event delegation in main.js ----------
export const actions = {};
export const forms = {};

// ---------- formatting ----------
export const money = (n) => `€${Number(n).toFixed(2)}`;
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const STATUS = {
  pending: 'Pending', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready',
  out_for_delivery: 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled'
};

export const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b1b"/><stop offset="1" stop-color="#0c0c0c"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><g fill="none" stroke="#d4b483" stroke-width="2" opacity=".6"><circle cx="200" cy="150" r="46"/><circle cx="200" cy="150" r="30"/></g></svg>`);

export const icons = {
  heart: raw('<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9.3-9.1C1.2 8.7 3 5 6.6 5c2 0 3.5 1.1 5.4 3 1.9-1.9 3.4-3 5.4-3C21 5 22.8 8.7 21.3 11.9 19 16.4 12 21 12 21z"/></svg>'),
  bag: raw('<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>'),
  user: raw('<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>'),
  menu: raw('<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>')
};

// ---------- toasts ----------
export function toast(message, type = 'ok') {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}

// ---------- modals ----------
export function modal(content, { wide = false, label = 'Dialog' } = {}) {
  const root = document.getElementById('modal-root');
  const prev = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${content.toString()}</div>`;
  root.appendChild(ov);
  const close = () => {
    ov.style.transition = 'opacity .25s'; ov.style.opacity = '0';
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { ov.remove(); prev?.focus?.(); }, 220);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // simple focus trap
      const f = [...ov.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  (ov.querySelector('[autofocus]') || ov.querySelector('input,select,textarea,button'))?.focus();
  return { el: ov.firstElementChild, close };
}

export function confirmDialog({ title, text, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const m = modal(html`<h2>${title}</h2><p class="muted">${text}</p>
      <div class="dialog-actions"><button class="btn ghost" data-close>Cancel</button>
      <button class="btn ${danger ? 'danger' : 'solid'}" data-ok autofocus>${confirmText}</button></div>`, { label: title });
    let done = false;
    m.el.querySelector('[data-ok]').addEventListener('click', () => { done = true; m.close(); resolve(true); });
    m.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { if (!done) resolve(false); }));
    m.el.parentElement.addEventListener('mousedown', (e) => { if (e.target === m.el.parentElement && !done) resolve(false); });
    document.addEventListener('keydown', function f(e) { if (e.key === 'Escape') { if (!done) resolve(false); document.removeEventListener('keydown', f); } });
  });
}

// ---------- scroll reveal ----------
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 }) : null;
export function observeInview(root = document) {
  root.querySelectorAll('.inview:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
}

export const skeletonGrid = (n = 6) => html`<div class="grid">${Array.from({ length: n }, () => html`<div class="skel skel-card"></div>`)}</div>`;
export const skeletonBlock = () => html`<div class="skel" style="height:34px;width:40%;margin-bottom:22px"></div><div class="skel skel-line"></div><div class="skel skel-line" style="width:80%"></div><div class="skel" style="height:260px;margin-top:24px"></div>`;

export function setFormError(form, msg) {
  const el = form.querySelector('.form-error');
  if (el) el.textContent = msg || '';
}
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };