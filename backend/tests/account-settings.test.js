// Account settings: PATCH /api/auth/me (name, email) and POST /api/auth/change-password.
// Uses the real database: temporary users, deleted afterwards.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');
const { resetRateLimits } = require('../src/middlewares/rate-limit');

const runId = Date.now();
const email = `test+settings-${runId}@example.com`;
const otherEmail = `test+settings-other-${runId}@example.com`;
const newEmail = `test+settings-new-${runId}@example.com`;
const password = 'correct-horse-battery';

let server;
let baseUrl;
let token;
let userId;

async function request(method, path, body, auth = token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const registered = await request('POST', '/api/auth/register', { full_name: 'Settings User', email, password }, null);
  token = registered.body.token;
  userId = registered.body.user.id;
  await request('POST', '/api/auth/register', { full_name: 'Other User', email: otherEmail, password }, null);
});

beforeEach(() => resetRateLimits());

after(async () => {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[email, otherEmail, newEmail]]);
  server.close();
  await pool.end();
});

// ---- PATCH /api/auth/me ----

test('changes the full name (trimmed) and returns the user', async () => {
  const res = await request('PATCH', '/api/auth/me', { full_name: '  Budi Baru  ' });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.full_name, 'Budi Baru');
  assert.equal(res.body.user.id, userId);
  assert.equal(res.body.user.password_hash, undefined);
});

test('changes the email (normalized to lower case); the same token keeps working', async () => {
  const res = await request('PATCH', '/api/auth/me', { email: `  ${newEmail.toUpperCase()} ` });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, newEmail);

  const me = await request('GET', '/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, newEmail);

  const login = await request('POST', '/api/auth/login', { email: newEmail, password }, null);
  assert.equal(login.status, 200);
});

test('an email that belongs to another account is a 409', async () => {
  const res = await request('PATCH', '/api/auth/me', { email: otherEmail.toUpperCase() });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.message, 'Email is already registered');
});

test('invalid values and an empty body are 400 with details', async () => {
  const bad = await request('PATCH', '/api/auth/me', { full_name: 'A', email: 'not-an-email' });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.error.details.map((detail) => detail.field).sort(), ['email', 'full_name']);

  const empty = await request('PATCH', '/api/auth/me', {});
  assert.equal(empty.status, 400);
});

test('needs a valid token', async () => {
  const res = await request('PATCH', '/api/auth/me', { full_name: 'Nope' }, null);
  assert.equal(res.status, 401);
});

// ---- POST /api/auth/change-password ----

test('a wrong current password is a 400 on current_password (not 401), and nothing changes', async () => {
  const res = await request('POST', '/api/auth/change-password', {
    current_password: 'wrong-password-123',
    new_password: 'brand-new-secret-42',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((detail) => detail.field), ['current_password']);

  const login = await request('POST', '/api/auth/login', { email: newEmail, password }, null);
  assert.equal(login.status, 200);
});

test('the new password follows the registration rules and must differ from the current one', async () => {
  const short = await request('POST', '/api/auth/change-password', { current_password: password, new_password: 'short' });
  assert.equal(short.status, 400);
  assert.deepEqual(short.body.error.details.map((detail) => detail.field), ['new_password']);

  const common = await request('POST', '/api/auth/change-password', { current_password: password, new_password: 'password123' });
  assert.equal(common.status, 400);

  const same = await request('POST', '/api/auth/change-password', { current_password: password, new_password: password });
  assert.equal(same.status, 400);
  assert.match(same.body.error.details[0].message, /different/);
});

test('changes the password: the old one stops working, the new one works', async () => {
  const newPassword = 'brand-new-secret-42';
  const res = await request('POST', '/api/auth/change-password', { current_password: password, new_password: newPassword });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Password changed');

  const oldLogin = await request('POST', '/api/auth/login', { email: newEmail, password }, null);
  assert.equal(oldLogin.status, 401);
  const newLogin = await request('POST', '/api/auth/login', { email: newEmail, password: newPassword }, null);
  assert.equal(newLogin.status, 200);

  // Put it back for the rate-limit test.
  await request('POST', '/api/auth/change-password', { current_password: newPassword, new_password: password });
});

test('after 5 wrong current passwords in 15 minutes the next attempt is a 429', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request('POST', '/api/auth/change-password', {
      current_password: `wrong-${attempt}-password`,
      new_password: 'brand-new-secret-42',
    });
    assert.equal(res.status, 400);
  }
  const limited = await request('POST', '/api/auth/change-password', {
    current_password: password,
    new_password: 'brand-new-secret-42',
  });
  assert.equal(limited.status, 429);
  assert.match(limited.body.error.message, /^Too many password change attempts/);
});
