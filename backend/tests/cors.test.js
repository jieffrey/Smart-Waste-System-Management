// Tests for CORS. WEB_ORIGIN is set before the app is loaded (the config is read at load time).
// The trailing slash and spaces check that configured origins are cleaned up.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const ALLOWED = 'http://localhost:3001';
const ALLOWED_WITH_SLASH = 'https://admin.example.com';
const NOT_ALLOWED = 'https://evil.example.com';

let server;
let baseUrl;
let pool;

before(async () => {
  process.env.WEB_ORIGIN = ` ${ALLOWED} , ${ALLOWED_WITH_SLASH}/ `;
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

test('an allowed origin gets Access-Control-Allow-Origin', async () => {
  for (const origin of [ALLOWED, ALLOWED_WITH_SLASH]) {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
    assert.match(res.headers.get('vary') || '', /Origin/);
  }
});

test('a different origin gets no CORS header (the browser will block it)', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: NOT_ALLOWED } });

  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('a preflight request from an allowed origin is answered with 204 and the allowed methods and headers', async () => {
  const res = await fetch(`${baseUrl}/api/admin/reports/00000000-0000-4000-8000-000000000000`, {
    method: 'OPTIONS',
    headers: {
      Origin: ALLOWED,
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
  assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
  assert.match(res.headers.get('access-control-allow-headers'), /authorization/i);
});

test('CORS does not bypass authentication', async () => {
  const res = await fetch(`${baseUrl}/api/admin/stats`, { headers: { Origin: ALLOWED } });

  assert.equal(res.status, 401);
  assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
});
