// Tests for the rate limiter (unit) and the limits on login, registration and report creation
// (integration, against the configured database). Counters are reset before every test.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');
const { registerUser } = require('../src/modules/auth/auth.service');
const { createRateLimiter, resetRateLimits } = require('../src/middlewares/rate-limit');
const { errorHandler } = require('../src/middlewares/error-handler');

const runId = Date.now();
const userEmail = `test+ratelimit-${runId}@example.com`;
const userPassword = 'correct-horse-battery';
let server;
let baseUrl;
let userToken;

async function post(path, { body, token, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (!form) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: form ?? JSON.stringify(body) });
  return { status: res.status, retryAfter: res.headers.get('retry-after'), body: await res.json() };
}

function login(email, password) {
  return post('/api/auth/login', { body: { email, password } });
}

before(async () => {
  ({ token: userToken } = await registerUser({ full_name: 'Rate Limit Test', email: userEmail, password: userPassword }));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(() => resetRateLimits());

after(async () => {
  await query('DELETE FROM users WHERE email = $1', [userEmail]);
  server.close();
  await pool.end();
});

// ---- createRateLimiter (no database) ----

async function withTestApp(limiterOptions, statusFor, run) {
  const testApp = express();
  testApp.get('/', createRateLimiter({ key: () => 'same-key', action: 'test requests', ...limiterOptions }), (req, res) => {
    res.status(statusFor(req)).json({ ok: true });
  });
  testApp.use(errorHandler);
  const testServer = testApp.listen(0);
  await new Promise((resolve) => testServer.once('listening', resolve));
  try {
    await run(async (query = '') => {
      const res = await fetch(`http://localhost:${testServer.address().port}/${query}`);
      return { status: res.status, retryAfter: res.headers.get('retry-after'), body: await res.json() };
    });
  } finally {
    testServer.close();
  }
}

test('allows `limit` requests, then answers 429 with Retry-After in the standard error format', async () => {
  await withTestApp({ windowMs: 60_000, limit: 2 }, () => 200, async (get) => {
    assert.equal((await get()).status, 200);
    assert.equal((await get()).status, 200);

    const limited = await get();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.retryAfter) > 0 && Number(limited.retryAfter) <= 60);
    assert.deepEqual(limited.body, {
      error: { message: 'Too many test requests. Please try again in 1 minute.', details: null },
    });
  });
});

test('starts counting again after the window ends', async () => {
  await withTestApp({ windowMs: 150, limit: 1 }, () => 200, async (get) => {
    assert.equal((await get()).status, 200);
    assert.equal((await get()).status, 429);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal((await get()).status, 200);
  });
});

test('onlyFailures: successful requests are not counted', async () => {
  const statusFor = (req) => (req.query.fail ? 401 : 200);
  await withTestApp({ windowMs: 60_000, limit: 2, onlyFailures: true }, statusFor, async (get) => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await get()).status, 200); // successes never use up the limit
    }
    assert.equal((await get('?fail=1')).status, 401);
    assert.equal((await get('?fail=1')).status, 401);
    assert.equal((await get('?fail=1')).status, 429);
  });
});

// ---- Login ----

test('login: 5 failed attempts for one email, then 429, even with the right password', async () => {
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await login(userEmail, `wrong-${i}`)).status, 401);
  }
  const limited = await login(userEmail, userPassword);
  assert.equal(limited.status, 429);
  assert.match(limited.body.error.message, /^Too many login attempts\. Please try again in 15 minutes\.$/);
  assert.ok(Number(limited.retryAfter) > 0);

  // Another email from the same IP is not affected by this email's limit.
  assert.equal((await login(`test+other-${runId}@example.com`, 'whatever-password')).status, 401);
});

test('login: a limited email that does not exist looks exactly like one that does', async () => {
  const unknownEmail = `test+nobody-${runId}@example.com`;
  for (let i = 0; i < 5; i += 1) {
    await login(userEmail, `wrong-${i}`);
    await login(unknownEmail, `wrong-${i}`);
  }
  const existing = await login(userEmail, 'wrong-again');
  const unknown = await login(unknownEmail, 'wrong-again');

  assert.equal(existing.status, 429);
  assert.equal(unknown.status, 429);
  assert.deepEqual(unknown.body, existing.body);
});

test('login: the email limit counts the normalized email (case and spaces do not get around it)', async () => {
  for (let i = 0; i < 5; i += 1) {
    await login(i % 2 ? `  ${userEmail.toUpperCase()} ` : userEmail, `wrong-${i}`);
  }
  assert.equal((await login(userEmail, 'wrong-again')).status, 429);
});

test('login: successful logins do not count toward the email limit', async () => {
  for (let i = 0; i < 8; i += 1) {
    assert.equal((await login(userEmail, userPassword)).status, 200);
  }
});

test('login: 20 attempts per IP across different emails, then 429', async () => {
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await login(`test+ip-${runId}-${i}@example.com`, 'whatever-password')).status, 401);
  }
  assert.equal((await login(`test+ip-${runId}-last@example.com`, 'whatever-password')).status, 429);
});

// ---- Registration and report creation ----

test('register: 10 attempts per IP, then 429 (counted before validation)', async () => {
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await post('/api/auth/register', { body: {} })).status, 400);
  }
  const limited = await post('/api/auth/register', { body: {} });
  assert.equal(limited.status, 429);
  assert.match(limited.body.error.message, /^Too many sign-up attempts\./);
});

test('reports: 20 new-report requests per user, then 429 (before the upload is read)', async () => {
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await post('/api/reports', { token: userToken, form: new FormData() })).status, 400);
  }
  const limited = await post('/api/reports', { token: userToken, form: new FormData() });
  assert.equal(limited.status, 429);
  assert.match(limited.body.error.message, /^Too many new reports\. Please try again in 60 minutes\.$/);
});
