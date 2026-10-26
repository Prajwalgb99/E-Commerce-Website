import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { runMigrations } from '../src/db/migrate.js';

export const api = () => request(app);

export const setupDb = () => runMigrations(pool);
export const closeDb = () => pool.end();

export const resetDb = () =>
  pool.query(
    `TRUNCATE users, categories, outbox_events, processed_events, email_log, analytics_events
     RESTART IDENTITY CASCADE`,
  );

export const validUser = (overrides = {}) => ({
  name: 'Test User',
  email: 'test@example.com',
  password: 'Passw0rdOK',
  ...overrides,
});

export async function registerUser(overrides) {
  const res = await api().post('/api/auth/register').send(validUser(overrides));
  return res.body;
}

export async function loginAsAdmin() {
  const hash = await bcrypt.hash('AdminPass1', 4);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@example.com', $1, 'admin')`,
    [hash],
  );
  const res = await api().post('/api/auth/login').send({ email: 'admin@example.com', password: 'AdminPass1' });
  return res.body;
}
