// Integration tests for /api/auth against the configured database.
// Creates one temporary user per run and deletes it afterwards.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');

const email = `test+${Date.now()}@example.com`;
const password = 'correct-horse-battery';
let server;
let baseUrl;
let token;

async function request(method, path, { body, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}/api/auth`;
});

after(async () => {
  await query('DELETE FROM users WHERE email = $1', [email]);
  server.close();
  await pool.end();
});

test('register creates a user with role "user" and ignores a role in the body', async () => {
  const res = await request('POST', '/register', {
    body: { full_name: 'Test User', email: `  ${email.toUpperCase()} `, password, role: 'admin' },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, email);
  assert.equal(res.body.user.role, 'user');
  assert.equal(res.body.user.password_hash, undefined);
  assert.ok(res.body.token);
});

test('register rejects a duplicate email (case-insensitive) with 409', async () => {
  const res = await request('POST', '/register', {
    body: { full_name: 'Test User', email: email.toUpperCase(), password },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.message, 'Email is already registered');
});

test('register returns 400 with field details for invalid input', async () => {
  const res = await request('POST', '/register', {
    body: { full_name: 'A', email: 'not-an-email', password: 'short' },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Validation failed');
  const fields = res.body.error.details.map((d) => d.field).sort();
  assert.deepEqual(fields, ['email', 'full_name', 'password']);
});

test('malformed JSON returns 400 without internal details', async () => {
  const res = await request('POST', '/register', { body: '{"email":' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Request body must be valid JSON');
});

test('login succeeds with correct credentials', async () => {
  const res = await request('POST', '/login', { body: { email, password } });

  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email);
  assert.equal(res.body.user.password_hash, undefined);
  assert.ok(res.body.token);
  token = res.body.token;
});

test('login fails with a wrong password or unknown email using the same message', async () => {
  const wrongPassword = await request('POST', '/login', { body: { email, password: 'wrong-password' } });
  const unknownEmail = await request('POST', '/login', {
    body: { email: `nobody+${Date.now()}@example.com`, password },
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.error.message, 'Invalid email or password');
  assert.equal(unknownEmail.body.error.message, wrongPassword.body.error.message);
});

test('me returns the current user for a valid token', async () => {
  const res = await request('GET', '/me', { headers: { Authorization: `Bearer ${token}` } });

  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email);
  assert.equal(res.body.user.password_hash, undefined);
});

test('me rejects missing and invalid tokens with 401', async () => {
  const missing = await request('GET', '/me');
  const invalid = await request('GET', '/me', { headers: { Authorization: 'Bearer not.a.jwt' } });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
});

test('me rejects a deactivated account with 403', async () => {
  await query('UPDATE users SET is_active = FALSE WHERE email = $1', [email]);
  const res = await request('GET', '/me', { headers: { Authorization: `Bearer ${token}` } });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.message, 'Account is deactivated');
});
