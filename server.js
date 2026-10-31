require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const { Server } = require('socket.io');
const { pool } = require('./src/db');
const { COOKIE, loadUser, userFromToken } = require('./src/auth');
const { errorHandler, HttpError } = require('./src/http');
const { getSetting } = require('./src/orders');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://accounts.google.com/gsi/'],
      frameSrc: ['https://accounts.google.com/gsi/'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// ---- API ----
// CSRF defence for cookie auth: SameSite=Lax cookie + every state-changing request
// must carry a custom header, which cross-site forms/requests cannot set.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'fetch')
    return next(new HttpError(403, 'Invalid request.'));
  next();
});
app.use('/api', loadUser);

app.get('/api/config', async (req, res, next) => {
  try {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '', deliveryFee: Number(await getSetting('deliveryFee', '5')) });
  } catch (e) { next(e); }
});
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/menu', require('./src/routes/menu'));
app.use('/api/favorites', require('./src/routes/favorites'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/profile', require('./src/routes/profile'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found.')));

// ---- Static + SPA with server-side meta for SEO ----
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: '1h' }));

const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PRIVATE = /^\/(admin|worker|profile|favorites|cart|checkout|orders|login|register)(\/|$)/;
const META = {
  '/': ['Maison Doré — The Art of Fine Dining', 'Seasonal fine dining, handmade pasta and an exceptional cellar. Order for delivery or reserve your table at Maison Doré.'],
  '/menu': ['Menu — Maison Doré', 'Starters, main courses, handmade pasta, wood-fired pizza, desserts and drinks.'],
  '/about': ['Our Story — Maison Doré', 'A kitchen built on patience, produce and precision.'],
  '/contact': ['Contact — Maison Doré', 'Find us, call us, or plan your visit.']
};
app.get('*', async (req, res, next) => {
  try {
    let [title, desc] = META[req.path] || META['/'];
    let image = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80';
    const m = req.path.match(/^\/menu\/(\d+)$/);
    if (m) {
      const [r] = await pool.query('SELECT name,description,image FROM dishes WHERE id=?', [Number(m[1])]);
      if (r[0]) { title = `${r[0].name} — Maison Doré`; desc = r[0].description; image = r[0].image; }
    }
    const priv = PRIVATE.test(req.path);
    const meta = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:image" content="${esc(image)}">
<meta name="robots" content="${priv ? 'noindex,nofollow' : 'index,follow'}">`;
    if (priv) res.set('X-Robots-Tag', 'noindex, nofollow');
    res.type('html').send(indexHtml.replace('<!--META-->', meta));
  } catch (e) { next(e); }
});
app.use(errorHandler);

// ---- Real-time (Socket.IO) ----
io.use(async (socket, next) => {
  const token = cookie.parse(socket.handshake.headers.cookie || '')[COOKIE];
  const u = await userFromToken(token);
  if (!u || u.blocked) return next(new Error('unauthorized'));
  socket.data.user = { id: u.id, role: u.role };
  next();
});
io.on('connection', (socket) => {
  const { id, role } = socket.data.user;
  socket.join(`user:${id}`);
  if (role === 'worker' || role === 'admin') socket.join('staff');
});

const PORT = Number(process.env.PORT) || 3000;
pool.query('SELECT 1').then(() => {
  server.listen(PORT, () => console.log(`Maison Doré running on http://localhost:${PORT}`));
}).catch((e) => {
  console.error('Cannot connect to MySQL. Is XAMPP/MySQL running and did you run "npm run db:setup"?\n', e.message);
  process.exit(1);
});
