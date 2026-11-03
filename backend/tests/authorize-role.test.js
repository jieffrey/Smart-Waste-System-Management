// Tests for authorizeRole: unit tests on the middleware, plus an integration check
// on a test-only route (authenticate → authorizeRole) using temporary users.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const app = require('../src/app');
const { authenticate, authorizeRole } = require('../src/middlewares/auth');
const { errorHandler } = require('../src/middlewares/error-handler');
const { pool, query } = require('../src/db/pool');

const runId = Date.now();
const userEmail = `test+user-${runId}@example.com`;
const adminEmail = `test+admin-${runId}@example.com`;
const password = 'correct-horse-battery';
let authServer;
let testServer;
let authUrl;
let testUrl;
let userToken;
let adminToken;

function runMiddleware(middleware, req) {
  let nextCalled = false;
  middleware(req, {}, () => {
    nextCalled = true;
  });
  return nextCalled;
}

function listen(expressApp) {
  return new Promise((resolve) => {
    const server = expressApp.listen(0, () => resolve(server));
  });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function postAdminArea(token, extra = {}) {
  const res = await fetch(`${testUrl}/admin-area`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...extra.headers,
    },
    body: JSON.stringify(extra.body || {}),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  authServer = await listen(app);
  authUrl = `http://localhost:${authServer.address().port}/api/auth`;

  const testApp = express();
  testApp.use(express.json());
  testApp.post('/admin-area', authenticate, authorizeRole('admin'), (req, res) => {
    res.json({ ok: true, role: req.user.role });
  });
  testApp.use(errorHandler);
  testServer = await listen(testApp);
  testUrl = `http://localhost:${testServer.address().port}`;

  const user = await postJson(`${authUrl}/register`, { full_name: 'Test User', email: userEmail, password });
  userToken = user.body.token;

  // Public registration can only create "user"; promote the second account directly for the test.
  await postJson(`${authUrl}/register`, { full_name: 'Test Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  const admin = await postJson(`${authUrl}/login`, { email: adminEmail, password });
  adminToken = admin.body.token;
});

after(async () => {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[userEmail, adminEmail]]);
  authServer.close();
  testServer.close();
  await pool.end();
});

// ---- Unit tests ----

test('authorizeRole calls next for an allowed role', () => {
  const nextCalled = runMiddleware(authorizeRole('admin', 'user'), { user: { role: 'user' } });
  assert.equal(nextCalled, true);
});

test('authorizeRole throws 403 for a role that is not allowed', () => {
  assert.throws(
    () => runMiddleware(authorizeRole('admin'), { user: { role: 'user' } }),
    { status: 403, message: 'You do not have permission to perform this action' }
  );
});

test('authorizeRole throws 401 when req.user is missing', () => {
  assert.throws(() => runMiddleware(authorizeRole('admin'), {}), {
    status: 401,
    message: 'Authentication required',
  });
});

// ---- Integration: authenticate → authorizeRole ----

test('admin token is allowed on an admin-only route', async () => {
  const res = await postAdminArea(adminToken);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, role: 'admin' });
});

test('user token is rejected with 403, even when the body or headers claim admin', async () => {
  const res = await postAdminArea(userToken, {
    body: { role: 'admin' },
    headers: { 'X-User-Role': 'admin', 'X-Role': 'admin' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.message, 'You do not have permission to perform this action');
});

test('request without a token is rejected with 401', async () => {
  const res = await postAdminArea(null, { body: { role: 'admin' } });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, 'Authentication required');
});
