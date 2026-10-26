# Order Platform (backend)

E-commerce backend built step by step: API + PostgreSQL + JWT auth first, then Redis, RabbitMQ, Docker, Nginx, CI/CD.

## Run it

```bash
cp .env.example .env          # then set JWT_ACCESS_SECRET to a long random string
docker compose up -d          # PostgreSQL (creates `orders` and `orders_test` databases)
npm install
npm run migrate               # creates all tables
npm run seed:admin            # optional: creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # http://localhost:3000/health
npm test                      # integration tests against the orders_test database
```

Requires Node 22+.

## Endpoints so far

| Method | Path | Auth |
|---|---|---|
| GET | /health | none |
| POST | /api/auth/register | none |
| POST | /api/auth/login | none |
| POST | /api/auth/refresh | refresh token in body |
| POST | /api/auth/logout | refresh token in body |
| GET | /api/users/me | Bearer access token |
| GET | /api/admin/ping | Bearer, admin only |

## Structure

```
src/
  config/       env validation, db pool, logger
  middleware/   auth (authenticate, authorize), validate, errorHandler
  modules/      auth, users, admin  (catalog, cart, orders come next)
  db/migrate.js tiny migration runner
migrations/     plain SQL, applied in filename order
tests/          node:test + supertest
```
