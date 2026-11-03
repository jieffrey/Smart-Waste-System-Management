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

test('GET /api/health returns 200 { status: "ok" } without authentication', async () => {
  const res = await fetch(`${baseUrl}/api/health`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});
