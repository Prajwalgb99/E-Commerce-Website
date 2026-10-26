import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first');
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const { rowCount } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Admin', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [email, hash],
  );
  console.log(rowCount ? `Admin created: ${email}` : `User ${email} already exists, nothing changed`);
} finally {
  await pool.end();
}
