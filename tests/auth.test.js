import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, setupDb, resetDb, closeDb, validUser, registerUser, loginAsAdmin } from './helpers.js';

before(setupDb);
beforeEach(resetDb);
after(closeDb);

describe('health', () => {
  it('reports the API and database as up', async () => {
    const res = await api().get('/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', db: 'up' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api().get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});

describe('POST /api/auth/register', () => {
  it('creates a customer and returns tokens without leaking the password hash', async () => {
    const res = await api().post('/api/auth/register').send(validUser());
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'customer');
    assert.equal(res.body.user.email, 'test@example.com');
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
    assert.equal(JSON.stringify(res.body).includes('password'), false);
  });

  it('rejects a duplicate email regardless of letter case', async () => {
    await registerUser();
    const res = await api().post('/api/auth/register').send(validUser({ email: 'TEST@Example.com' }));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  it('rejects a weak password with field-level details', async () => {
    const res = await api().post('/api/auth/register').send(validUser({ password: 'short' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.field === 'password'));
  });

  it('rejects malformed JSON with a 400', async () => {
    const res = await api().post('/api/auth/register').set('Content-Type', 'application/json').send('{bad json');
    assert.equal(res.status, 400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await registerUser();
    const res = await api().post('/api/auth/login').send({ email: 'test@example.com', password: 'Passw0rdOK' });
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await registerUser();
    const wrongPassword = await api().post('/api/auth/login').send({ email: 'test@example.com', password: 'WrongPass1' });
    const unknownEmail = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Passw0rdOK' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message);
  });
});

describe('GET /api/users/me', () => {
  it('returns the profile for a valid access token', async () => {
    const { accessToken } = await registerUser();
    const res = await api().get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'test@example.com');
  });

  it('rejects a missing token and a garbage token', async () => {
    assert.equal((await api().get('/api/users/me')).status, 401);
    const res = await api().get('/api/users/me').set('Authorization', 'Bearer not-a-real-token');
    assert.equal(res.status, 401);
  });
});

describe('role-based access', () => {
  it('blocks a customer from admin routes with 403', async () => {
    const { accessToken } = await registerUser();
    const res = await api().get('/api/admin/ping').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 403);
  });

  it('lets an admin through', async () => {
    const { accessToken } = await loginAsAdmin();
    const res = await api().get('/api/admin/ping').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
  });

  it('blocks anonymous requests with 401', async () => {
    assert.equal((await api().get('/api/admin/ping')).status, 401);
  });
});

describe('refresh token rotation', () => {
  it('issues a new pair and invalidates the old refresh token', async () => {
    const first = await registerUser();
    const res = await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
    assert.equal(res.status, 200);
    assert.notEqual(res.body.refreshToken, first.refreshToken);

    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.error.code, 'TOKEN_REUSED');
  });

  it('revokes the whole session family when an old token is replayed', async () => {
    const first = await registerUser();
    const second = (await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken })).body;

    await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken }); // replay attack
    const res = await api().post('/api/auth/refresh').send({ refreshToken: second.refreshToken });
    assert.equal(res.status, 401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await api().post('/api/auth/refresh').send({ refreshToken: 'made-up' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_REFRESH_TOKEN');
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token so it cannot be used again', async () => {
    const { refreshToken } = await registerUser();
    const out = await api().post('/api/auth/logout').send({ refreshToken });
    assert.equal(out.status, 204);

    const res = await api().post('/api/auth/refresh').send({ refreshToken });
    assert.equal(res.status, 401);
  });
});
