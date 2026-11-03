const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool } = require('../src/db/pool');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

test('unknown routes return 404 in the standard error format', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);

  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: { message: 'Route not found', details: null } });
});

test('a known path with an unsupported method also returns 404 in the standard format', async () => {
  const res = await fetch(`${baseUrl}/api/health`, { method: 'DELETE' });

  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: { message: 'Route not found', details: null } });
});
