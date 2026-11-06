// Integration tests for reading reports: GET /api/reports/me and GET /api/reports/:id
// Uses the real database: creates temporary users and reports (inserted directly, no ML) and deletes them afterwards.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');

const runId = Date.now();
const ownerEmail = `test+owner-${runId}@example.com`;
const otherEmail = `test+other-${runId}@example.com`;
const adminEmail = `test+read-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

let server;
let baseUrl;
let ownerId;
let otherId;
let ownerToken;
let otherToken;
let adminId;
let adminToken;
const ownerReports = {}; // status -> report id

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

async function insertReport(userId, status, hoursAgo) {
  const { rows } = await query(
    `INSERT INTO waste_reports (user_id, description, category, status, image_url, latitude, longitude, created_at)
     VALUES ($1, $2, 'plastic', $3, '/uploads/test-image.jpg', -6.2, 106.816666, NOW() - make_interval(hours => $4))
     RETURNING id`,
    [userId, `Test report (${status})`, status, hoursAgo]
  );
  return rows[0].id;
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const owner = await postJson('/api/auth/register', { full_name: 'Test Owner', email: ownerEmail, password });
  ownerId = owner.user.id;
  ownerToken = owner.token;

  const other = await postJson('/api/auth/register', { full_name: 'Test Other', email: otherEmail, password });
  otherId = other.user.id;
  otherToken = other.token;

  await postJson('/api/auth/register', { full_name: 'Test Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  const admin = await postJson('/api/auth/login', { email: adminEmail, password });
  adminId = admin.user.id;
  adminToken = admin.token;

  // Owner: 3 reports, oldest first. Other user: 1 report that must never appear in the owner's list.
  ownerReports.pending = await insertReport(ownerId, 'pending', 3);
  ownerReports.in_progress = await insertReport(ownerId, 'in_progress', 2);
  ownerReports.completed = await insertReport(ownerId, 'completed', 1);
  await insertReport(otherId, 'pending', 0);

  // Status history for the in-progress report: created by the owner, then moved on by an admin.
  await query(
    `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by, note, created_at)
     VALUES ($1, NULL, 'pending', $2, NULL, NOW() - interval '2 hours'),
            ($1, 'pending', 'in_progress', $3, 'Cleanup team assigned', NOW() - interval '1 hour')`,
    [ownerReports.in_progress, ownerId, adminId]
  );
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE user_id = ANY($1::uuid[])', [[ownerId, otherId]]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[ownerEmail, otherEmail, adminEmail]]);
  server.close();
  await pool.end();
});

// ---- GET /api/reports/me ----

test('lists only the user\'s own reports, newest first, with default pagination', async () => {
  const res = await get('/api/reports/me', ownerToken);

  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.reports.map((report) => report.id),
    [ownerReports.completed, ownerReports.in_progress, ownerReports.pending]
  );
  assert.ok(res.body.reports.every((report) => report.user_id === ownerId));
  assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 3 });

  const [newest] = res.body.reports;
  assert.equal(newest.latitude, -6.2);
  assert.equal(newest.image_url, '/uploads/test-image.jpg'); // stays relative
});

test('paginates with page and limit', async () => {
  const res = await get('/api/reports/me?page=2&limit=2', ownerToken);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.reports.map((report) => report.id), [ownerReports.pending]);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 2, total: 3 });
});

test('filters by status', async () => {
  const res = await get('/api/reports/me?status=in_progress', ownerToken);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.reports.map((report) => report.id), [ownerReports.in_progress]);
  assert.equal(res.body.pagination.total, 1);
});

test('rejects an invalid page, limit or status with 400 and field details', async () => {
  const res = await get('/api/reports/me?page=0&limit=51&status=done', ownerToken);

  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Validation failed');
  assert.deepEqual(res.body.error.details.map((detail) => detail.field).sort(), ['limit', 'page', 'status']);
});

test('returns an empty list for a user without reports in that status', async () => {
  const res = await get('/api/reports/me?status=rejected', otherToken);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { reports: [], pagination: { page: 1, limit: 20, total: 0 }, unseen_updates: 0 });
});

test('rejects a request without a token with 401', async () => {
  const res = await get('/api/reports/me');

  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: { message: 'Authentication required', details: null } });
});

test('rejects an admin with 403', async () => {
  const res = await get('/api/reports/me', adminToken);

  assert.equal(res.status, 403);
});

// ---- GET /api/reports/:id ----

const NOT_FOUND = { error: { message: 'Report not found', details: null } };

test('the owner gets the report with its status history (oldest first, without changed_by)', async () => {
  const res = await get(`/api/reports/${ownerReports.in_progress}`, ownerToken);

  assert.equal(res.status, 200);
  const { report } = res.body;
  assert.equal(report.id, ownerReports.in_progress);
  assert.equal(report.user_id, ownerId);
  assert.equal(report.status, 'in_progress');
  assert.equal(report.longitude, 106.816666);

  assert.deepEqual(
    report.status_history.map(({ old_status, new_status, note }) => ({ old_status, new_status, note })),
    [
      { old_status: null, new_status: 'pending', note: null },
      { old_status: 'pending', new_status: 'in_progress', note: 'Cleanup team assigned' },
    ]
  );
  for (const entry of report.status_history) {
    assert.deepEqual(Object.keys(entry).sort(), ['created_at', 'new_status', 'note', 'old_status']);
  }
});

test('a report without history returns an empty status_history', async () => {
  const res = await get(`/api/reports/${ownerReports.completed}`, ownerToken);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.report.status_history, []);
});

test('an admin can view any report', async () => {
  const res = await get(`/api/reports/${ownerReports.in_progress}`, adminToken);

  assert.equal(res.status, 200);
  assert.equal(res.body.report.id, ownerReports.in_progress);
  assert.equal(res.body.report.status_history.length, 2);
});

test('another user gets 404 (not 403), so report ids cannot be probed', async () => {
  const res = await get(`/api/reports/${ownerReports.in_progress}`, otherToken);

  assert.equal(res.status, 404);
  assert.deepEqual(res.body, NOT_FOUND);
});

test('an unknown report id returns 404', async () => {
  const res = await get('/api/reports/00000000-0000-4000-8000-000000000000', ownerToken);

  assert.equal(res.status, 404);
  assert.deepEqual(res.body, NOT_FOUND);
});

test('a malformed report id returns 404', async () => {
  const res = await get('/api/reports/not-a-uuid', ownerToken);

  assert.equal(res.status, 404);
  assert.deepEqual(res.body, NOT_FOUND);
});

test('viewing a report without a token returns 401', async () => {
  const res = await get(`/api/reports/${ownerReports.in_progress}`);

  assert.equal(res.status, 401);
});
