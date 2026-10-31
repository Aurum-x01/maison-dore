const router = require('express').Router();
const { pool } = require('../db');
const { ah, parse, z, HttpError } = require('../http');
const { requireRole } = require('../auth');
const requireAdmin = requireRole(); // no extra roles => admin only

const SELECT = `SELECT d.id, d.name, d.description, d.price, d.image, d.available, d.category_id AS categoryId,
  c.slug AS category, d.created_at AS createdAt, d.updated_at AS updatedAt
  FROM dishes d JOIN categories c ON c.id=d.category_id`;
const fix = (d) => ({ ...d, available: !!d.available });

const dishSchema = z.object({
  name: z.string().trim().min(2, 'Please enter a dish name.').max(120),
  description: z.string().trim().min(5, 'Please enter a short description.').max(500),
  price: z.coerce.number({ invalid_type_error: 'Please enter a valid price.' }).positive('Price must be greater than 0.').max(9999),
  categoryId: z.coerce.number().int().positive('Please choose a category.'),
  image: z.string().trim().max(500).refine((v) => /^(https?:\/\/|\/)/.test(v), 'Image must be an http(s) URL or a /path.'),
  available: z.coerce.boolean().default(true)
});

router.get('/', ah(async (req, res) => {
  const [categories] = await pool.query('SELECT id,name,slug FROM categories ORDER BY sort_order,id');
  const [dishes] = await pool.query(`${SELECT} ORDER BY c.sort_order, d.id`);
  res.json({ categories, dishes: dishes.map(fix) });
}));

router.get('/:id', ah(async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE d.id=?`, [Number(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Dish not found.');
  res.json({ dish: fix(rows[0]) });
}));

router.post('/', requireAdmin, ah(async (req, res) => {
  const d = parse(dishSchema, req.body);
  const [r] = await pool.query('INSERT INTO dishes (category_id,name,description,price,image,available) VALUES (?,?,?,?,?,?)',
    [d.categoryId, d.name, d.description, d.price, d.image, d.available ? 1 : 0]);
  const [rows] = await pool.query(`${SELECT} WHERE d.id=?`, [r.insertId]);
  res.status(201).json({ dish: fix(rows[0]) });
}));

router.patch('/:id', requireAdmin, ah(async (req, res) => {
  const d = parse(dishSchema.partial(), req.body);
  const map = { name: 'name', description: 'description', price: 'price', categoryId: 'category_id', image: 'image', available: 'available' };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col}=?`); vals.push(k === 'available' ? (d[k] ? 1 : 0) : d[k]); }
  if (!sets.length) throw new HttpError(400, 'Nothing to update.');
  const [r] = await pool.query(`UPDATE dishes SET ${sets.join(',')} WHERE id=?`, [...vals, Number(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Dish not found.');
  const [rows] = await pool.query(`${SELECT} WHERE d.id=?`, [Number(req.params.id)]);
  res.json({ dish: fix(rows[0]) });
}));

router.delete('/:id', requireAdmin, ah(async (req, res) => {
  const [r] = await pool.query('DELETE FROM dishes WHERE id=?', [Number(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Dish not found.');
  res.json({ ok: true });
}));

module.exports = router;
