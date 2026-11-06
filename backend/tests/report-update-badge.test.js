// "Baru" marker: a resident sees which of their reports changed since they last opened them.
// GET /api/reports/me returns has_update per report and unseen_updates (all statuses); opening the report as
// its owner (GET /api/reports/:id) marks it as seen. Needs migration 001 (report_seen).
// Uses the real database: temporary users and reports, deleted afterwards.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');

const runId = Date.now();
const ownerEmail = `test+badge-owner-${runId}@example.com`;
const adminEmail = `test+badge-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

let server;
let baseUrl;
let ownerId;
let ownerToken;
let adminToken;
let reportA;
let reportB;

async function request(method, path, token, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function insertReport() {
  const { rows } = await query(
    `INSERT INTO waste_reports (user_id, description, category, image_url, latitude, longitude)
     VALUES ($1, 'Badge test', 'paper', '/uploads/test-image.jpg', -6.2, 106.8)
     RETURNING id`,
    [ownerId]
  );
  return rows[0].id;
}

async function myList(query_ = '') {
  const res = await request('GET', `/api/reports/me${query_}`, ownerToken);
  assert.equal(res.status, 200);
  return res.body;
}

function flag(list, id) {
  return list.reports.find((report) => report.id === id).has_update;
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const owner = await request('POST', '/api/auth/register', null, { full_name: 'Badge Owner', email: ownerEmail, password });
  ownerId = owner.body.user.id;
  ownerToken = owner.body.token;
  await request('POST', '/api/auth/register', null, { full_name: 'Badge Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  adminToken = (await request('POST', '/api/auth/login', null, { email: adminEmail, password })).body.token;

  reportA = await insertReport();
  reportB = await insertReport();
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE user_id = $1', [ownerId]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[ownerEmail, adminEmail]]);
  server.close();
  await pool.end();
});

test('a new report has no update', async () => {
  const list = await myList();
  assert.equal(flag(list, reportA), false);
  assert.equal(flag(list, reportB), false);
  assert.equal(list.unseen_updates, 0);
});

test('an admin change marks the report as updated for its owner, and counts it', async () => {
  const res = await request('PATCH', `/api/admin/reports/${reportA}`, adminToken, { status: 'in_progress', admin_note: 'On it' });
  assert.equal(res.status, 200);

  const list = await myList();
  assert.equal(flag(list, reportA), true);
  assert.equal(flag(list, reportB), false);
  assert.equal(list.unseen_updates, 1);
});

test('unseen_updates counts across all statuses, even when the list is filtered', async () => {
  const list = await myList('?status=pending');
  assert.deepEqual(list.reports.map((report) => report.id), [reportB]);
  assert.equal(list.unseen_updates, 1);
});

test('an admin opening the report does not mark it as seen', async () => {
  const res = await request('GET', `/api/reports/${reportA}`, adminToken);
  assert.equal(res.status, 200);
  assert.equal((await myList()).unseen_updates, 1);
});

test('the owner opening the report marks it as seen', async () => {
  const res = await request('GET', `/api/reports/${reportA}`, ownerToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.report.has_update, false);

  const list = await myList();
  assert.equal(flag(list, reportA), false);
  assert.equal(list.unseen_updates, 0);
});

test('a later change shows up again', async () => {
  await request('PATCH', `/api/admin/reports/${reportA}`, adminToken, { status: 'completed', admin_note: 'Done' });
  const list = await myList();
  assert.equal(flag(list, reportA), true);
  assert.equal(list.unseen_updates, 1);
});
