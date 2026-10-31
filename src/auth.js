const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { HttpError, ah } = require('./http');

const COOKIE = 'md_token';
const secret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
    return 'dev-only-secret';
  }
  return process.env.JWT_SECRET;
};

const signToken = (userId) => jwt.sign({ id: userId }, secret(), { expiresIn: '7d' });
const verifyToken = (t) => jwt.verify(t, secret());

function setAuthCookie(res, userId) {
  res.cookie(COOKIE, signToken(userId), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 864e5
  });
}
const clearAuthCookie = (res) => res.clearCookie(COOKIE);

const toPublic = (u) => ({
  id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, phone: u.phone,
  avatar: u.avatar, role: u.role, blocked: !!u.blocked, hasPassword: !!u.password_hash, createdAt: u.created_at
});

// The role is ALWAYS read from the database, never from the token or the request body.
async function userFromToken(token) {
  if (!token) return null;
  try {
    const { id } = verifyToken(token);
    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [id]);
    return rows[0] || null;
  } catch { return null; }
}

const loadUser = ah(async (req, res, next) => {
  const u = await userFromToken(req.cookies[COOKIE]);
  if (u && u.blocked) { clearAuthCookie(res); req.user = null; }
  else req.user = u;
  next();
});

const requireAuth = (req, res, next) =>
  req.user ? next() : next(new HttpError(401, 'Please sign in to continue.'));

// admin is allowed everywhere a worker is
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'));
  if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
  next(new HttpError(403, 'You do not have access to this resource.'));
};

module.exports = { COOKIE, setAuthCookie, clearAuthCookie, toPublic, userFromToken, loadUser, requireAuth, requireRole };
