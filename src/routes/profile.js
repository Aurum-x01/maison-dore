const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { ah, parse, z, HttpError } = require('../http');
const { requireAuth, toPublic } = require('../auth');

router.use(requireAuth);

// "role" is intentionally not accepted anywhere in this file.
const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name.').max(80),
  lastName: z.string().trim().min(1, 'Please enter your last name.').max(80),
  phone: z.string().trim().max(40).regex(/^[0-9+()\-\s]*$/, 'Please enter a valid phone number.').optional()
});
router.patch('/', ah(async (req, res) => {
  const d = parse(profileSchema, req.body);
  await pool.query('UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?', [d.firstName, d.lastName, d.phone || null, req.user.id]);
  const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [req.user.id]);
  res.json({ user: toPublic(rows[0]) });
}));

const addrSchema = z.object({
  country: z.string().trim().min(2, 'Please enter your country.').max(80),
  city: z.string().trim().min(1, 'Please enter your city.').max(80),
  street: z.string().trim().min(1, 'Please enter your street.').max(120),
  house: z.string().trim().min(1, 'Please enter your house number.').max(20),
  apartment: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().min(2, 'Please enter your postal code.').max(20)
});
router.put('/address', ah(async (req, res) => {
  const a = parse(addrSchema, req.body);
  await pool.query(
    `INSERT INTO addresses (user_id,country,city,street,house,apartment,postal_code) VALUES (?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE country=VALUES(country),city=VALUES(city),street=VALUES(street),house=VALUES(house),apartment=VALUES(apartment),postal_code=VALUES(postal_code)`,
    [req.user.id, a.country, a.city, a.street, a.house, a.apartment || null, a.postalCode]);
  res.json({ address: { ...a, apartment: a.apartment || null } });
}));

const pwSchema = z.object({
  currentPassword: z.string().max(100).optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.').max(100)
});
router.patch('/password', ah(async (req, res) => {
  const d = parse(pwSchema, req.body);
  if (req.user.password_hash) {
    if (!d.currentPassword || !(await bcrypt.compare(d.currentPassword, req.user.password_hash)))
      throw new HttpError(400, 'Your current password is incorrect.');
  }
  await pool.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(d.newPassword, 12), req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
