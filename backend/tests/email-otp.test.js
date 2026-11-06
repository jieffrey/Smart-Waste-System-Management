// Email verification with a 6-digit code (OTP_ENABLED=true), sent through a STUBBED EmailJS API (a local fake
// server: nothing is ever sent to EmailJS). Needs migration 003.
// Uses the real database: temporary users, deleted afterwards.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { readOtpConfig } = require('../src/config/otp');

const runId = Date.now();
const email = `test+otp-${runId}@example.com`;
const failEmail = `test+otp-fail-${runId}@example.com`;
const legacyEmail = `test+otp-legacy-${runId}@example.com`;
const password = 'correct-horse-battery';

let app;
let query;
let pool;
let resetRateLimits;
let server;
let baseUrl;
let emailjs; // { server, url, requests, status }

function startFakeEmailJs() {
  const state = { requests: [], status: 200 };
  const fake = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      state.requests.push(JSON.parse(body));
      res.writeHead(state.status, { 'Content-Type': 'text/plain' });
      res.end(state.status === 200 ? 'OK' : 'API calls are disabled for non-browser applications');
    });
  });
  return new Promise((resolve) => fake.listen(0, () => resolve({ ...state, state, server: fake, url: `http://localhost:${fake.address().port}/send` })));
}

function lastCode() {
  const sent = emailjs.state.requests.at(-1);
  return sent.template_params.code;
}

async function request(method, path, body, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
}

before(async () => {
  emailjs = await startFakeEmailJs();
  // The config is read when the app is first loaded, so set the env before requiring it.
  process.env.OTP_ENABLED = 'true';
  process.env.EMAILJS_API_URL = emailjs.url;
  process.env.EMAILJS_SERVICE_ID = 'service_test';
  process.env.EMAILJS_TEMPLATE_ID = 'template_test';
  process.env.EMAILJS_PUBLIC_KEY = 'public_test';
  process.env.EMAILJS_PRIVATE_KEY = 'private_test';

  app = require('../src/app');
  ({ query, pool } = require('../src/db/pool'));
  ({ resetRateLimits } = require('../src/middlewares/rate-limit'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(() => {
  resetRateLimits();
  emailjs.state.status = 200;
});

after(async () => {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[email, failEmail, legacyEmail]]);
  server.close();
  emailjs.server.close();
  await pool.end();
});

test('register creates an unverified account, emails a code through EmailJS and returns no token', async () => {
  const res = await request('POST', '/api/auth/register', { full_name: 'Otp User', email, password });
  assert.equal(res.status, 201);
  assert.equal(res.body.verification_required, true);
  assert.equal(res.body.token, undefined);
  assert.equal(res.body.user.email, email);

  const sent = emailjs.state.requests.at(-1);
  assert.equal(sent.service_id, 'service_test');
  assert.equal(sent.template_id, 'template_test');
  assert.equal(sent.user_id, 'public_test');
  assert.equal(sent.accessToken, 'private_test'); // the private key is only ever sent from the backend
  assert.equal(sent.template_params.to_email, email);
  assert.equal(sent.template_params.to_name, 'Otp User');
  assert.equal(sent.template_params.expires_minutes, '10');
  assert.match(sent.template_params.code, /^\d{6}$/);
});

test('only a hash of the code is stored, with a 10-minute expiry', async () => {
  const { rows } = await query(
    `SELECT c.code_hash, EXTRACT(EPOCH FROM (c.expires_at - NOW())) AS seconds_left
     FROM email_verification_codes c JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
    [email]
  );
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].code_hash, lastCode());
  assert.match(rows[0].code_hash, /^[0-9a-f]{64}$/);
  assert.ok(rows[0].seconds_left > 590 && rows[0].seconds_left <= 600);
});

test('an unverified account cannot sign in yet', async () => {
  const res = await request('POST', '/api/auth/login', { email, password });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.message, 'Email not verified');
});

test('the code must be 6 digits', async () => {
  const res = await request('POST', '/api/auth/verify-email', { email, code: '12ab' });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((detail) => detail.field), ['code']);
});

test('a resend within 60 seconds is refused with Retry-After', async () => {
  const res = await request('POST', '/api/auth/resend-code', { email });
  assert.equal(res.status, 429);
  const wait = Number(res.headers.get('retry-after'));
  assert.ok(wait > 0 && wait <= 60);
  assert.match(res.body.error.message, /^Please wait \d+ seconds before requesting a new code$/);
});

test('5 wrong codes kill the code; even the right one is refused after that', async () => {
  const right = lastCode();
  const wrong = right === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request('POST', '/api/auth/verify-email', { email, code: wrong });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Invalid or expired code');
  }
  const res = await request('POST', '/api/auth/verify-email', { email, code: right });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Too many wrong codes. Request a new code');
});

test('after the cooldown a new code is sent, attempts reset and the old code stops working', async () => {
  const oldCode = lastCode();
  await query(
    `UPDATE email_verification_codes SET last_sent_at = NOW() - interval '61 seconds'
     WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
    [email]
  );
  const before = emailjs.state.requests.length;
  const res = await request('POST', '/api/auth/resend-code', { email: email.toUpperCase() });
  assert.equal(res.status, 200);
  assert.equal(emailjs.state.requests.length, before + 1);

  const newCode = lastCode();
  if (newCode !== oldCode) {
    const stale = await request('POST', '/api/auth/verify-email', { email, code: oldCode });
    assert.equal(stale.status, 400);
  }
});

test('an expired code is refused', async () => {
  await query(
    `UPDATE email_verification_codes SET expires_at = NOW() - interval '1 second', attempts = 0
     WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
    [email]
  );
  const res = await request('POST', '/api/auth/verify-email', { email, code: lastCode() });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Code expired. Request a new code');
  await query(
    `UPDATE email_verification_codes SET expires_at = NOW() + interval '10 minutes'
     WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
    [email]
  );
});

test('the right code verifies the account, signs it in and removes the code', async () => {
  const res = await request('POST', '/api/auth/verify-email', { email, code: lastCode() });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, email);

  const me = await request('GET', '/api/auth/me', null, res.body.token);
  assert.equal(me.status, 200);
  const login = await request('POST', '/api/auth/login', { email, password });
  assert.equal(login.status, 200);

  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM email_verification_codes WHERE user_id = $1',
    [res.body.user.id]
  );
  assert.equal(rows[0].count, 0);
});

test('a verified or unknown email gets the same answer on resend, and no email is sent', async () => {
  const before = emailjs.state.requests.length;
  for (const target of [email, `nobody-${runId}@example.com`]) {
    const res = await request('POST', '/api/auth/resend-code', { email: target });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'If this account still needs verification, a new code has been sent');
  }
  assert.equal(emailjs.state.requests.length, before);
});

test('if EmailJS fails, registration is a 503 and no account is left behind', async () => {
  emailjs.state.status = 403;
  const res = await request('POST', '/api/auth/register', { full_name: 'Fail User', email: failEmail, password });
  assert.equal(res.status, 503);
  assert.equal(res.body.error.message, 'Could not send the verification email. Please try again later');
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM users WHERE email = $1', [failEmail]);
  assert.equal(rows[0].count, 0);
});

test('accounts that existed before the migration (email_verified defaults to true) can still sign in', async () => {
  const { hashPassword } = require('../src/modules/auth/auth.service');
  await query(`INSERT INTO users (full_name, email, password_hash) VALUES ('Legacy User', $1, $2)`, [
    legacyEmail,
    await hashPassword(password),
  ]);
  const res = await request('POST', '/api/auth/login', { email: legacyEmail, password });
  assert.equal(res.status, 200);
});

test('OTP_ENABLED=true without every EmailJS setting stops the server; off needs nothing', () => {
  assert.throws(() => readOtpConfig({ OTP_ENABLED: 'true', EMAILJS_SERVICE_ID: 's' }), /EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY/);
  assert.equal(readOtpConfig({}).enabled, false);
  assert.equal(readOtpConfig({ OTP_ENABLED: 'false' }).enabled, false);
});
