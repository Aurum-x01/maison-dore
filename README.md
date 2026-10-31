# 🍽️ Maison Doré

**A premium restaurant ordering platform** — menu, delivery or dine-in orders, cart, customer accounts, and real-time dashboards for staff and administrators.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-InnoDB-4479A1?logo=mysql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- **Public pages:** home, categorized menu, dish page, about, contact.
- **Three roles:** `client`, `worker`, `admin` — each with its own interface and permissions.
- **Orders:** delivery to an address or dine-in (by table number); statuses `pending → accepted → preparing → ready → out_for_delivery → completed / cancelled`.
- **Real-time updates:** order status changes pushed via Socket.IO (customers see updates instantly, staff receive new orders in the `staff` room).
- **Authentication:** email + password and **Google OAuth** sign-in (Google only ever creates a `client`).
- **Favorites**, saved delivery address, user profile.
- **Admin panel:** manage dishes, categories, users (blocking), and settings (e.g. delivery fee).
- **SEO:** server-rendered meta tags and Open Graph data for every page and dish; private sections are automatically `noindex`.
- **No frontend build step:** vanilla JS (ES modules, SPA).

## 🧱 Tech Stack

| Layer | Technologies |
|---|---|
| Server | Node.js, Express 4 |
| Database | MySQL (`mysql2`), InnoDB, utf8mb4 |
| Real-time | Socket.IO |
| Auth | JWT (httpOnly cookie), bcryptjs, `google-auth-library` |
| Validation | zod |
| Security | helmet (CSP), express-rate-limit |
| Frontend | Vanilla JS (ES modules), no bundler |

## 🚀 Getting Started

### Requirements
- [Node.js](https://nodejs.org/) **18+**
- MySQL (e.g. via [XAMPP](https://www.apachefriends.org/) on Windows)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Aurum-x01/maison-dore.git
cd maison-dore

# 2. Install dependencies
npm install

# 3. Create your config file
cp .env.example .env        # Windows (cmd): copy .env.example .env

# 4. Start MySQL, then create the database, tables and seed data
npm run db:setup

# 5. Start the server
npm start
```

The app will be available at **http://localhost:3000**.

For development with auto-restart:

```bash
npm run dev
```

## ⚙️ Configuration (`.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Runtime mode | `development` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | _(empty, as in XAMPP)_ |
| `DB_NAME` | Database name | `maison_dore` |
| `JWT_SECRET` | Secret used to sign JWTs (**must be changed**) | `change-me` |
| `GOOGLE_CLIENT_ID` | Google sign-in Client ID (optional) | _(empty)_ |

Generate a strong `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Google OAuth

1. Open **Google Cloud Console → APIs & Services → Credentials**.
2. Create an **OAuth client ID** of type *Web application*.
3. Under *Authorized JavaScript origins*, add `http://localhost:3000` (and your production domain).
4. Copy the Client ID into `.env` → `GOOGLE_CLIENT_ID`.

The token is verified on the server. If `GOOGLE_CLIENT_ID` is empty, Google sign-in is unavailable but everything else works.

## 👤 Demo Accounts

Created by `npm run db:setup`:

| Role | Email | Password |
|---|---|---|
| Client | `client@demo.test` | `Client123!` |
| Worker | `worker@demo.test` | `Worker123!` |
| Admin | `admin@demo.test` | `Admin123!` |

> ⚠️ **For development only.** Delete these accounts or change their passwords before deploying to production.

## 🔒 Security

- Passwords hashed with **bcrypt** (cost 12).
- **JWT in an httpOnly cookie** (`SameSite=Lax`).
- The user's role is **always read from the database**, never trusted from the token; role middleware guards every endpoint.
- Input validated with **zod**; all SQL queries are **parameterized**.
- All user-provided HTML is escaped on the frontend.
- **CSP** via helmet.
- **CSRF protection:** `SameSite` cookie plus a required `X-Requested-With: fetch` header on every state-changing `/api` request.
- **Rate limiting** on login / register / google endpoints.
- **Order prices are calculated server-side only** — clients cannot tamper with them.
- The `role` field is ignored on registration and profile updates.
- Blocked users cannot connect to Socket.IO.

## 🧪 API Tests

With the server running:

```bash
node scripts/e2e.js
```

The script runs 40 checks covering roles, pricing, order statuses, blocking, and CRUD.

## 📁 Project Structure

```
maison-dore/
├── server.js              # Express + Socket.IO + server-side SEO meta
├── schema.sql             # Database schema
├── scripts/
│   ├── setup.js           # DB creation + seed (22 dishes, 3 demo accounts)
│   └── e2e.js             # API tests
├── src/
│   ├── db.js              # MySQL connection pool
│   ├── auth.js            # JWT, cookies, user loading
│   ├── http.js            # HttpError, errorHandler
│   ├── orders.js          # Order and settings logic
│   └── routes/            # auth, menu, favorites, orders, users, profile, admin
└── public/
    ├── index.html
    └── js/pages/          # public, client, staff (worker), admin
```

## 🗄️ Database

Tables: `users`, `addresses`, `categories`, `dishes`, `favorites`, `orders`, `order_items`, `settings`.

Schema notes:
- `order_items` stores a **snapshot** of the dish name, image and price at order time, so menu changes never rewrite order history.
- Deleting a user does not delete their orders (`ON DELETE SET NULL`).
- Order numbering starts at `1001`.

## 🌐 API Overview

All routes live under the `/api` prefix. State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-Requested-With: fetch` header.

| Prefix | Purpose |
|---|---|
| `GET /api/config` | Public config (Google Client ID, delivery fee) |
| `/api/auth` | Register, login, logout, Google sign-in |
| `/api/menu` | Categories and dishes |
| `/api/favorites` | Favorite dishes |
| `/api/orders` | Create and manage orders |
| `/api/users` | Users (staff/admin) |
| `/api/profile` | Profile and address |
| `/api/admin` | Administration |

## 🚢 Deployment

1. Set `NODE_ENV=production`.
2. Use a strong, unique `JWT_SECRET`.
3. Remove or change the demo accounts.
4. Use a dedicated, password-protected MySQL user with limited privileges.
5. Serve over HTTPS (e.g. an Nginx reverse proxy) and add your domain to the Google OAuth origins.

## 📄 License

Released under the MIT License. Add a `LICENSE` file to the repository, or replace this section with the license of your choice.
