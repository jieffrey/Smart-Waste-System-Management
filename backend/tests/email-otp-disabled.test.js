// With OTP_ENABLED off (the default), registration works exactly as before (token right away) and the
// verification endpoints answer 404.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const email = `test+otp-off-${Date.now()}@example.com`;
let app;
let query;
let pool;
let server;
let baseUrl;

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  delete process.env.OTP_ENABLED;
  app = require('../src/app');
  ({ query, pool } = require('../src/db/pool'));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await query('DELETE FROM users WHERE email = $1', [email]);
  server.close();
  await pool.end();
});

test('register returns a token right away and the account is verified', async () => {
  const res = await post('/api/auth/register', { full_name: 'No Otp', email, password: 'correct-horse-battery' });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.verification_required, undefined);
  const { rows } = await query('SELECT email_verified FROM users WHERE email = $1', [email]);
  assert.equal(rows[0].email_verified, true);
});

test('verify-email and resend-code are 404', async () => {
  const verify = await post('/api/auth/verify-email', { email, code: '123456' });
  assert.equal(verify.status, 404);
  const resend = await post('/api/auth/resend-code', { email });
  assert.equal(resend.status, 404);
});
