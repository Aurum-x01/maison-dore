const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db');
const { ah, parse, z, HttpError } = require('../http');
const { setAuthCookie, clearAuthCookie, toPublic, requireAuth } = require('../auth');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name.').max(80),
  lastName: z.string().trim().min(1, 'Please enter your last name.').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email.').max(190),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
  confirmPassword: z.string()
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
// NOTE: "role" is not in the schema, so zod strips it. New accounts are always "client".

router.post('/register', limiter, ah(async (req, res) => {
  const d = parse(registerSchema, req.body);
  const hash = await bcrypt.hash(d.password, 12);
  const [r] = await pool.query(
    "INSERT INTO users (first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,'client')",
    [d.firstName, d.lastName, d.email, hash]);
  setAuthCookie(res, r.insertId);
  const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [r.insertId]);
  res.status(201).json({ user: toPublic(rows[0]) });
}));

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) });
const DUMMY = bcrypt.hashSync('dummy-password', 12);

router.post('/login', limiter, ah(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(401, 'Invalid email or password.');
  const { email, password } = parsed.data;
  const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.password_hash || DUMMY); // constant-ish time
  if (!u || !u.password_hash || !ok) throw new HttpError(401, 'Invalid email or password.');
  if (u.blocked) throw new HttpError(403, 'This account has been blocked.');
  setAuthCookie(res, u.id);
  res.json({ user: toPublic(u) });
}));

const gclient = new OAuth2Client();
router.post('/google', limiter, ah(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google login is not configured on the server.');
  const { credential } = req.body || {};
  if (typeof credential !== 'string') throw new HttpError(400, 'Invalid request.');
  let p;
  try {
    const t = await gclient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    p = t.getPayload();
  } catch { throw new HttpError(401, 'Google sign-in failed. Please try again.'); }
  if (!p.email || !p.email_verified) throw new HttpError(401, 'Your Google email is not verified.');
  const email = p.email.toLowerCase();
  const [rows] = await pool.query('SELECT * FROM users WHERE google_id=? OR email=? LIMIT 1', [p.sub, email]);
  let u = rows[0];
  if (!u) {
    // Google can only ever create a "client". worker/admin are assigned by an admin or in the DB.
    const [r] = await pool.query(
      "INSERT INTO users (first_name,last_name,email,google_id,avatar,role) VALUES (?,?,?,?,?,'client')",
      [(p.given_name || 'Guest').slice(0, 80), (p.family_name || '-').slice(0, 80), email, p.sub, p.picture || null]);
    [u] = (await pool.query('SELECT * FROM users WHERE id=?', [r.insertId]))[0];
  } else if (!u.google_id) {
    await pool.query('UPDATE users SET google_id=?, avatar=COALESCE(avatar,?) WHERE id=?', [p.sub, p.picture || null, u.id]);
  }
  if (u.blocked) throw new HttpError(403, 'This account has been blocked.');
  setAuthCookie(res, u.id);
  res.json({ user: toPublic(u) });
}));

router.post('/logout', (req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

router.get('/me', ah(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const [a] = await pool.query('SELECT country,city,street,house,apartment,postal_code AS postalCode FROM addresses WHERE user_id=?', [req.user.id]);
  res.json({ user: toPublic(req.user), address: a[0] || null });
}));

module.exports = router;
