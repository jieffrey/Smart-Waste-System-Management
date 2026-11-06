// Tests for the HTTP security headers (SEC-07). WEB_ORIGIN is set so CORS is checked alongside them.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const ALLOWED = 'http://localhost:3001';

let server;
let baseUrl;
let pool;

before(async () => {
  process.env.WEB_ORIGIN = ALLOWED;
  const app = require('../src/app');
  ({ pool } = require('../src/db/pool'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

function assertSecurityHeaders(res) {
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.match(res.headers.get('strict-transport-security') || '', /max-age=\d+/);
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('content-security-policy'), null);
}

test('a JSON response has the security headers and an unchanged body', async () => {
  const res = await fetch(`${baseUrl}/api/health`);

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assertSecurityHeaders(res);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('error responses (404) have the security headers and the usual error format', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);

  assert.equal(res.status, 404);
  assertSecurityHeaders(res);
  const body = await res.json();
  assert.equal(typeof body.error.message, 'string');
});

test('CORS still works with the security headers', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: ALLOWED } });
  assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
  assertSecurityHeaders(res);

  const preflight = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ALLOWED);
});
