// Integration tests for the admin report endpoints under /api/admin/reports.
// Uses the real database: creates temporary users and reports (inserted directly, no ML) and deletes them afterwards.
// Every test report contains MARKER in its description, and list queries search for it, so other data in the
// database (or other test files running at the same time) cannot affect the results.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');

const runId = Date.now();
const MARKER = `adm-${runId}`;
const aliceEmail = `test+alice-${runId}@example.com`;
const bobEmail = `test+bob-${runId}@example.com`;
const adminEmail = `test+reports-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

let server;
let baseUrl;
let aliceId;
let bobId;
let adminId;
let userToken;
let adminToken;
const ids = {};

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function request(method, path, { token = adminToken, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function insertReport({ userId, description, status = 'pending', category = 'plastic', address = null, createdAt }) {
  const { rows } = await query(
    `INSERT INTO waste_reports
       (user_id, description, category, status, image_url, latitude, longitude, address,
        ai_predicted_category, ai_confidence, ai_model_version, created_at)
     VALUES ($1, $2, $3, $4, '/uploads/test-image.jpg', -6.2, 106.816666, $5, $3, 0.95, 'test-model', $6)
     RETURNING id`,
    [userId, `${MARKER} ${description}`, category, status, address, createdAt]
  );
  return rows[0].id;
}

function listIds(res) {
  return res.body.reports.map((report) => report.id);
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const alice = await postJson('/api/auth/register', { full_name: 'Test Alice', email: aliceEmail, password });
  aliceId = alice.user.id;
  userToken = alice.token;
  bobId = (await postJson('/api/auth/register', { full_name: 'Test Bob', email: bobEmail, password })).user.id;

  await postJson('/api/auth/register', { full_name: 'Test Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  const admin = await postJson('/api/auth/login', { email: adminEmail, password });
  adminId = admin.user.id;
  adminToken = admin.token;

  // Fixed timestamps. 2026-01-10 23:30 and 2026-01-11 00:30 in Jakarta are both 2026-01-10 in UTC.
  ids.lateJan10 = await insertReport({ userId: aliceId, description: 'bottles near the park', createdAt: '2026-01-10T23:30:00+07:00' });
  ids.earlyJan11 = await insertReport({
    userId: bobId,
    description: 'paper boxes',
    category: 'paper',
    status: 'in_progress',
    createdAt: '2026-01-11T00:30:00+07:00',
  });
  ids.percent = await insertReport({
    userId: aliceId,
    description: 'bags 50% full',
    category: 'organic',
    status: 'completed',
    address: 'Jl. Merdeka 5',
    createdAt: '2026-01-12T09:00:00+07:00',
  });
  ids.fiveHundred = await insertReport({
    userId: bobId,
    description: 'bags 500 kg',
    status: 'rejected',
    createdAt: '2026-01-13T09:00:00+07:00',
  });
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE user_id = ANY($1::uuid[])', [[aliceId, bobId]]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[aliceEmail, bobEmail, adminEmail]]);
  server.close();
  await pool.end();
});

// ---- GET /api/admin/reports ----

test('lists reports from all users, newest first, with the reporter name and email', async () => {
  const res = await request('GET', `/api/admin/reports?q=${MARKER}`);

  assert.equal(res.status, 200);
  assert.deepEqual(listIds(res), [ids.fiveHundred, ids.percent, ids.earlyJan11, ids.lateJan10]);
  assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 4 });

  const bobReport = res.body.reports.find((report) => report.id === ids.earlyJan11);
  assert.equal(bobReport.reporter_name, 'Test Bob');
  assert.equal(bobReport.reporter_email, bobEmail);
  assert.equal(bobReport.user_id, bobId);
  assert.equal(bobReport.ai_confidence, 0.95);
});

test('filters by status and category', async () => {
  const byStatus = await request('GET', `/api/admin/reports?q=${MARKER}&status=in_progress`);
  assert.deepEqual(listIds(byStatus), [ids.earlyJan11]);

  const byCategory = await request('GET', `/api/admin/reports?q=${MARKER}&category=plastic`);
  assert.deepEqual(listIds(byCategory), [ids.fiveHundred, ids.lateJan10]);

  const both = await request('GET', `/api/admin/reports?q=${MARKER}&status=pending&category=plastic`);
  assert.deepEqual(listIds(both), [ids.lateJan10]);
});

test('filters by date range using Asia/Jakarta calendar dates (to is inclusive)', async () => {
  const jan11 = await request('GET', `/api/admin/reports?q=${MARKER}&from=2026-01-11&to=2026-01-11`);
  assert.deepEqual(listIds(jan11), [ids.earlyJan11]);

  const jan10to12 = await request('GET', `/api/admin/reports?q=${MARKER}&from=2026-01-10&to=2026-01-12`);
  assert.deepEqual(listIds(jan10to12), [ids.percent, ids.earlyJan11, ids.lateJan10]);

  const from12 = await request('GET', `/api/admin/reports?q=${MARKER}&from=2026-01-12`);
  assert.deepEqual(listIds(from12), [ids.fiveHundred, ids.percent]);
});

test('searches in the address as well as the description', async () => {
  const res = await request('GET', `/api/admin/reports?q=${encodeURIComponent('jl. merdeka')}`);

  assert.equal(res.status, 200);
  assert.ok(listIds(res).includes(ids.percent));
});

test('treats % and _ in the search text literally', async () => {
  const res = await request('GET', `/api/admin/reports?q=${encodeURIComponent('bags 50%')}`);

  assert.ok(listIds(res).includes(ids.percent));
  assert.ok(!listIds(res).includes(ids.fiveHundred)); // "500" would match if % were a wildcard
});

test('paginates with page and limit', async () => {
  const res = await request('GET', `/api/admin/reports?q=${MARKER}&page=2&limit=3`);

  assert.deepEqual(listIds(res), [ids.lateJan10]);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 3, total: 4 });
});

test('rejects invalid filters with 400 and field details', async () => {
  const res = await request('GET', '/api/admin/reports?limit=51&from=2026-02-30x&category=metal');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((detail) => detail.field).sort(), ['category', 'from', 'limit']);

  const reversed = await request('GET', '/api/admin/reports?from=2026-01-12&to=2026-01-10');
  assert.equal(reversed.status, 400);
  assert.deepEqual(reversed.body.error.details, [{ field: 'to', message: 'To must be on or after From' }]);
});

test('list: rejects a request without a token (401) and a non-admin (403)', async () => {
  assert.equal((await request('GET', '/api/admin/reports', { token: null })).status, 401);
  assert.equal((await request('GET', '/api/admin/reports', { token: userToken })).status, 403);
});
