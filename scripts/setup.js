// Creates the database, tables and seed data (idempotent). Run: npm run db:setup
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB = process.env.DB_NAME || 'maison_dore';
const u = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

const categories = [
  ['Starters', 'starters'], ['Main Courses', 'main-courses'], ['Pasta', 'pasta'],
  ['Pizza', 'pizza'], ['Desserts', 'desserts'], ['Drinks', 'drinks']
];
// [category slug, name, description, price, image id, available]
const dishes = [
  ['starters', 'Burrata & Heirloom Tomato', 'Creamy burrata, sun-ripened heirloom tomatoes, basil oil and aged balsamic.', 16, '1546069901-ba9599a7e63c', 1],
  ['starters', 'Caesar Salad', 'Baby gem, shaved parmesan, sourdough croutons and a slow-cured anchovy dressing.', 14, '1550304943-4f24f54ddde9', 1],
  ['starters', 'Seared Scallops', 'Hand-dived scallops, cauliflower purée, brown butter and crispy capers.', 22, '1476224203421-9ac39bcb3327', 1],
  ['starters', 'Beef Carpaccio', 'Thinly sliced tenderloin, rocket, parmesan shavings and truffle mayonnaise.', 19, '1544025162-d76694265947', 1],
  ['main-courses', 'Wagyu Ribeye', '300 g wagyu ribeye, bone-marrow jus, charred shallot and pommes purée.', 58, '1544025162-d76694265947', 1],
  ['main-courses', 'Pan-Seared Salmon', 'Skin-crisp salmon, fennel, citrus beurre blanc and baby potatoes.', 32, '1519708227418-c8fd9a32b7a2', 1],
  ['main-courses', 'Herb-Roasted Chicken', 'Free-range chicken, thyme jus, roasted garlic and seasonal greens.', 27, '1598103442097-8b74394b95c6', 1],
  ['main-courses', 'Rack of Lamb', 'Rosemary-crusted lamb, pea purée, mint gremolata and red-wine reduction.', 44, '1555939594-58d7cb561ad1', 0],
  ['pasta', 'Truffle Pasta', 'Fresh tagliolini, black summer truffle, parmigiano cream and cracked pepper.', 24, '1621996346565-e3dbc646d9a9', 1],
  ['pasta', 'Lobster Linguine', 'Half lobster, cherry tomato, chilli, white wine and fresh parsley.', 36, '1473093295043-cdd812d0e601', 1],
  ['pasta', 'Pappardelle Ragù', 'Slow-braised beef and pork ragù, hand-cut pappardelle, aged pecorino.', 23, '1551183053-bf91a1d81141', 1],
  ['pasta', 'Cacio e Pepe', 'Tonnarelli, pecorino romano and Tellicherry pepper. Simple. Perfect.', 20, '1612874742237-6526221588e3', 1],
  ['pizza', 'Margherita', 'San Marzano tomato, fior di latte, basil and extra-virgin olive oil.', 17, '1574071318508-1cdbab80d002', 1],
  ['pizza', 'Tartufo Bianco', 'White base, mozzarella, wild mushrooms and shaved truffle.', 26, '1565299624946-b28f40a0ae38', 1],
  ['pizza', 'Diavola', 'Tomato, mozzarella, spicy salame and Calabrian chilli honey.', 19, '1513104890138-7c749659a591', 1],
  ['desserts', 'Tiramisu', 'Mascarpone cream, espresso-soaked savoiardi and Valrhona cocoa.', 12, '1571877227200-a0d98ea607e9', 1],
  ['desserts', 'Chocolate Fondant', 'Warm dark chocolate fondant, vanilla bean ice cream and sea salt.', 13, '1624353365286-3f8d62daad51', 1],
  ['desserts', 'Vanilla Panna Cotta', 'Madagascan vanilla, macerated berries and a crisp almond tuile.', 11, '1488477181946-6428a0291777', 1],
  ['drinks', 'Sparkling Water', 'Chilled mineral water, 750 ml.', 6, '1523362628745-0c100150b504', 1],
  ['drinks', 'Aperol Spritz', 'Aperol, prosecco, soda and a slice of blood orange.', 11, '1560512823-829485b8bf24', 1],
  ['drinks', 'Espresso', 'Double-origin espresso, roasted in small batches.', 4, '1510707577719-ae7c14805e3a', 1],
  ['drinks', 'Negroni', 'Gin, Campari and sweet vermouth over a single large cube.', 13, '1544145945-f90425340c7e', 1]
];
const demo = [
  ['Client', 'Demo', 'client@demo.test', 'Client123!', 'client'],
  ['Worker', 'Demo', 'worker@demo.test', 'Worker123!', 'worker'],
  ['Admin', 'Demo', 'admin@demo.test', 'Admin123!', 'admin']
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'maison_dore.sql'), 'utf8'));

  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM categories');
  if (!n) {
    for (const [i, [name, slug]] of categories.entries())
      await conn.query('INSERT INTO categories (name,slug,sort_order) VALUES (?,?,?)', [name, slug, i]);
    const [cats] = await conn.query('SELECT id,slug FROM categories');
    const cid = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
    for (const [slug, name, desc, price, img, avail] of dishes)
      await conn.query('INSERT INTO dishes (category_id,name,description,price,image,available) VALUES (?,?,?,?,?,?)', [cid[slug], name, desc, price, u(img), avail]);
    console.log(`Seeded ${categories.length} categories and ${dishes.length} dishes.`);
  }
  await conn.query("INSERT IGNORE INTO settings (setting_key,setting_value) VALUES ('deliveryFee','5')");
  for (const [fn, ln, email, pw, role] of demo) {
    const [r] = await conn.query('SELECT id FROM users WHERE email=?', [email]);
    if (!r[0]) {
      await conn.query('INSERT INTO users (first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,?)', [fn, ln, email, await bcrypt.hash(pw, 12), role]);
      console.log(`Created demo ${role}: ${email} / ${pw}`);
    }
  }
  console.log('Database ready. DEMO ACCOUNTS ARE FOR DEVELOPMENT ONLY — delete or change their passwords before going live.');
  await conn.end();
})().catch((e) => { console.error('Setup failed:', e.message); process.exit(1); });
