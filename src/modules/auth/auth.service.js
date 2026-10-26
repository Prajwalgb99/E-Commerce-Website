import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

// Compared against when the email is unknown, so login takes the same time either way
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_ROUNDS);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.created_at,
});

function signAccessToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

// Access token = short-lived JWT. Refresh token = random string; only its hash is stored.
async function issueTokens(user) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [user.id, hashToken(refreshToken), env.REFRESH_TOKEN_TTL_DAYS],
  );
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
}

export async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  let user;
  try {
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [name, email, passwordHash],
    );
    user = rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

export async function login({ email, password }) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

// Refresh-token rotation: every refresh revokes the old token and issues a new pair.
// If an already-revoked token shows up again it may have been stolen, so we revoke
// all of that user's tokens and force a fresh login.
export async function refresh(refreshToken) {
  const tokenHash = hashToken(refreshToken);

  // One atomic statement: only one concurrent request can win this
  const { rows } = await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [tokenHash],
  );

  if (rows.length === 0) {
    const { rows: existing } = await query(
      'SELECT user_id, revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    if (existing[0]?.revoked_at) {
      await query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [existing[0].user_id],
      );
      throw new AppError(401, 'TOKEN_REUSED', 'Refresh token was already used. Please log in again');
    }
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const { rows: users } = await query('SELECT * FROM users WHERE id = $1', [rows[0].user_id]);
  return { user: toPublicUser(users[0]), ...(await issueTokens(users[0])) };
}

export async function logout(refreshToken) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashToken(refreshToken)],
  );
}
