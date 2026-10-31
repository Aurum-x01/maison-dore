const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { ah, parse, z, HttpError } = require('../http');
const { requireRole, toPublic } = require('../auth');

router.use(requireRole()); // admin only (see requireRole)

const role = z.enum(['client', 'worker', 'admin']);
const base = {
  firstName: z.string().trim().min(1, 'Please enter a first name.').max(80),
  lastName: z.string().trim().min(1, 'Please enter a last name.').max(80),
  email: z.string().trim().toLowerCase().email('Please enter a valid email.').max(190),
  role
};
const createSchema = z.object({ ...base, password: z.string().min(8, 'Password must be at least 8 characters.').max(100) });
const patchSchema = z.object({
  ...base, blocked: z.coerce.boolean(), password: z.string().min(8, 'Password must be at least 8 characters.').max(100)
}).partial();

router.get('/', ah(async (req, res) => {
  const where = [], params = [];
  if (['client', 'worker', 'admin'].includes(req.query.role)) { where.push('role=?'); params.push(req.query.role); }
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    where.push('(email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
    const s = `%${req.query.q.trim()}%`; params.push(s, s, s);
  }
  const [rows] = await pool.query(`SELECT * FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`, params);
  res.json({ users: rows.map(toPublic) });
}));

router.post('/', ah(async (req, res) => {
  const d = parse(createSchema, req.body);
  const hash = await bcrypt.hash(d.password, 12);
  const [r] = await pool.query('INSERT INTO users (first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,?)',
    [d.firstName, d.lastName, d.email, hash, d.role]);
  const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [r.insertId]);
  res.status(201).json({ user: toPublic(rows[0]) });
}));

router.patch('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const d = parse(patchSchema, req.body);
  if (id === req.user.id && ((d.role && d.role !== 'admin') || d.blocked === true))
    throw new HttpError(400, 'You cannot demote or block your own account.');
  const sets = [], vals = [];
  if (d.firstName !== undefined) { sets.push('first_name=?'); vals.push(d.firstName); }
  if (d.lastName !== undefined) { sets.push('last_name=?'); vals.push(d.lastName); }
  if (d.email !== undefined) { sets.push('email=?'); vals.push(d.email); }
  if (d.role !== undefined) { sets.push('role=?'); vals.push(d.role); }
  if (d.blocked !== undefined) { sets.push('blocked=?'); vals.push(d.blocked ? 1 : 0); }
  if (d.password) { sets.push('password_hash=?'); vals.push(await bcrypt.hash(d.password, 12)); }
  if (!sets.length) throw new HttpError(400, 'Nothing to update.');
  const [r] = await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, [...vals, id]);
  if (!r.affectedRows) throw new HttpError(404, 'User not found.');
  const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [id]);
  res.json({ user: toPublic(rows[0]) });
}));

router.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'You cannot delete your own account.');
  const [r] = await pool.query('DELETE FROM users WHERE id=?', [id]);
  if (!r.affectedRows) throw new HttpError(404, 'User not found.');
  res.json({ ok: true });
}));

module.exports = router;
