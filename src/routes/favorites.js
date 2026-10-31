const router = require('express').Router();
const { pool } = require('../db');
const { ah, HttpError } = require('../http');
const { requireAuth } = require('../auth');

router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT d.id, d.name, d.description, d.price, d.image, d.available, d.category_id AS categoryId, c.slug AS category
     FROM favorites f JOIN dishes d ON d.id=f.dish_id JOIN categories c ON c.id=d.category_id
     WHERE f.user_id=? ORDER BY f.created_at DESC`, [req.user.id]);
  res.json({ dishes: rows.map((d) => ({ ...d, available: !!d.available })) });
}));

router.post('/:dishId', ah(async (req, res) => {
  const id = Number(req.params.dishId);
  const [d] = await pool.query('SELECT id FROM dishes WHERE id=?', [id]);
  if (!d[0]) throw new HttpError(404, 'Dish not found.');
  await pool.query('INSERT IGNORE INTO favorites (user_id,dish_id) VALUES (?,?)', [req.user.id, id]);
  res.status(201).json({ ok: true });
}));

router.delete('/:dishId', ah(async (req, res) => {
  await pool.query('DELETE FROM favorites WHERE user_id=? AND dish_id=?', [req.user.id, Number(req.params.dishId)]);
  res.json({ ok: true });
}));

module.exports = router;
