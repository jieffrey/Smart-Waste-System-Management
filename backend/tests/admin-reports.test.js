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

// ---- GET /api/admin/reports/:id ----

const NOT_FOUND = { error: { message: 'Report not found', details: null } };

test('detail: returns the report with the reporter and the full status history', async () => {
  await query(
    `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by, note, created_at)
     VALUES ($1, NULL, 'pending', $2, NULL, NOW() - interval '2 hours'),
            ($1, 'pending', 'in_progress', $3, 'Truck sent', NOW() - interval '1 hour')`,
    [ids.earlyJan11, bobId, adminId]
  );

  const res = await request('GET', `/api/admin/reports/${ids.earlyJan11}`);

  assert.equal(res.status, 200);
  const { report } = res.body;
  assert.equal(report.id, ids.earlyJan11);
  assert.equal(report.reporter_name, 'Test Bob');
  assert.equal(report.reporter_email, bobEmail);
  assert.deepEqual(
    report.status_history.map(({ old_status, new_status, note, changed_by, changed_by_name }) => ({
      old_status,
      new_status,
      note,
      changed_by,
      changed_by_name,
    })),
    [
      { old_status: null, new_status: 'pending', note: null, changed_by: bobId, changed_by_name: 'Test Bob' },
      { old_status: 'pending', new_status: 'in_progress', note: 'Truck sent', changed_by: adminId, changed_by_name: 'Test Admin' },
    ]
  );
});

test('detail: unknown and malformed ids return 404', async () => {
  const unknown = await request('GET', '/api/admin/reports/00000000-0000-4000-8000-000000000000');
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, NOT_FOUND);

  const malformed = await request('GET', '/api/admin/reports/not-a-uuid');
  assert.equal(malformed.status, 404);
  assert.deepEqual(malformed.body, NOT_FOUND);
});

test('detail: rejects a request without a token (401) and a non-admin (403)', async () => {
  assert.equal((await request('GET', `/api/admin/reports/${ids.percent}`, { token: null })).status, 401);
  assert.equal((await request('GET', `/api/admin/reports/${ids.percent}`, { token: userToken })).status, 403);
});

// ---- PATCH /api/admin/reports/:id ----

async function freshReport(status = 'pending') {
  return insertReport({ userId: aliceId, description: `patch test (${status})`, status, createdAt: '2026-01-01T09:00:00+07:00' });
}

async function historyRows(reportId) {
  const { rows } = await query(
    'SELECT old_status, new_status, changed_by, note FROM report_status_history WHERE report_id = $1 ORDER BY created_at, id',
    [reportId]
  );
  return rows;
}

async function storedReport(reportId) {
  const { rows } = await query(
    'SELECT status, category, ai_predicted_category, admin_note FROM waste_reports WHERE id = $1',
    [reportId]
  );
  return rows[0];
}

test('update: pending -> in_progress -> completed, each writing a history row with the admin and the note', async () => {
  const reportId = await freshReport();

  const started = await request('PATCH', `/api/admin/reports/${reportId}`, {
    body: { status: 'in_progress', admin_note: 'Cleanup team assigned' },
  });
  assert.equal(started.status, 200);
  assert.equal(started.body.report.status, 'in_progress');
  assert.equal(started.body.report.admin_note, 'Cleanup team assigned');

  const done = await request('PATCH', `/api/admin/reports/${reportId}`, { body: { status: 'completed' } });
  assert.equal(done.status, 200);
  assert.equal(done.body.report.status, 'completed');
  assert.equal(done.body.report.admin_note, 'Cleanup team assigned'); // kept when not sent

  assert.deepEqual(await historyRows(reportId), [
    { old_status: 'pending', new_status: 'in_progress', changed_by: adminId, note: 'Cleanup team assigned' },
    { old_status: 'in_progress', new_status: 'completed', changed_by: adminId, note: null },
  ]);
  assert.equal(done.body.report.status_history.length, 2);
});

test('update: correcting the category keeps ai_predicted_category and writes no history row', async () => {
  const reportId = await freshReport();

  const res = await request('PATCH', `/api/admin/reports/${reportId}`, { body: { category: 'paper' } });

  assert.equal(res.status, 200);
  assert.equal(res.body.report.category, 'paper');
  assert.equal(res.body.report.ai_predicted_category, 'plastic');
  assert.equal(res.body.report.status, 'pending');
  assert.deepEqual(await historyRows(reportId), []);
});

test('update: an admin_note edit without a status change is allowed on an in-progress report', async () => {
  const reportId = await freshReport('in_progress');

  const res = await request('PATCH', `/api/admin/reports/${reportId}`, { body: { admin_note: 'Waiting for truck' } });

  assert.equal(res.status, 200);
  assert.equal(res.body.report.admin_note, 'Waiting for truck');
  assert.deepEqual(await historyRows(reportId), []);
});

test('update: rejecting requires admin_note (400) and records it as the history note', async () => {
  const reportId = await freshReport();

  const withoutNote = await request('PATCH', `/api/admin/reports/${reportId}`, { body: { status: 'rejected' } });
  assert.equal(withoutNote.status, 400);
  assert.deepEqual(withoutNote.body.error.details, [
    { field: 'admin_note', message: 'A note is required when rejecting a report' },
  ]);
  assert.equal((await storedReport(reportId)).status, 'pending');

  const withNote = await request('PATCH', `/api/admin/reports/${reportId}`, {
    body: { status: 'rejected', admin_note: 'Photo does not show waste' },
  });
  assert.equal(withNote.status, 200);
  assert.equal(withNote.body.report.status, 'rejected');
  assert.deepEqual(await historyRows(reportId), [
    { old_status: 'pending', new_status: 'rejected', changed_by: adminId, note: 'Photo does not show waste' },
  ]);
});

test('update: invalid transitions return 409 and change nothing', async () => {
  const pendingId = await freshReport();

  const skip = await request('PATCH', `/api/admin/reports/${pendingId}`, { body: { status: 'completed' } });
  assert.equal(skip.status, 409);
  assert.deepEqual(skip.body, {
    error: {
      message: 'Cannot change status from pending to completed',
      details: [{ field: 'status', message: 'Allowed: in_progress, rejected' }],
    },
  });

  const same = await request('PATCH', `/api/admin/reports/${pendingId}`, { body: { status: 'pending' } });
  assert.equal(same.status, 409);
  assert.equal(same.body.error.message, 'Cannot change status from pending to pending');

  // When the transition is invalid, the other fields in the same request are not applied either.
  const mixed = await request('PATCH', `/api/admin/reports/${pendingId}`, {
    body: { status: 'completed', category: 'organic' },
  });
  assert.equal(mixed.status, 409);
  assert.deepEqual(await storedReport(pendingId), {
    status: 'pending',
    category: 'plastic',
    ai_predicted_category: 'plastic',
    admin_note: null,
  });
  assert.deepEqual(await historyRows(pendingId), []);
});

test('update: completed and rejected reports are final (409 for any change)', async () => {
  for (const finalStatus of ['completed', 'rejected']) {
    const reportId = await freshReport(finalStatus);

    const reopen = await request('PATCH', `/api/admin/reports/${reportId}`, { body: { status: 'in_progress' } });
    assert.equal(reopen.status, 409);
    assert.deepEqual(reopen.body, {
      error: { message: `Report is ${finalStatus} and can no longer be changed`, details: null },
    });

    const recategorize = await request('PATCH', `/api/admin/reports/${reportId}`, { body: { category: 'organic' } });
    assert.equal(recategorize.status, 409);

    assert.equal((await storedReport(reportId)).category, 'plastic');
    assert.deepEqual(await historyRows(reportId), []);
  }
});

test('update: an empty body or invalid values return 400', async () => {
  const reportId = await freshReport();

  const empty = await request('PATCH', `/api/admin/reports/${reportId}`, { body: {} });
  assert.equal(empty.status, 400);
  assert.deepEqual(empty.body.error.details, [
    { field: '', message: 'Provide at least one of: status, category, admin_note' },
  ]);

  const invalid = await request('PATCH', `/api/admin/reports/${reportId}`, {
    body: { status: 'done', category: 'metal', admin_note: '   ' },
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(invalid.body.error.details.map((detail) => detail.field).sort(), ['admin_note', 'category', 'status']);
});

test('update: unknown and malformed ids return 404', async () => {
  const unknown = await request('PATCH', '/api/admin/reports/00000000-0000-4000-8000-000000000000', {
    body: { status: 'in_progress' },
  });
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, NOT_FOUND);

  const malformed = await request('PATCH', '/api/admin/reports/not-a-uuid', { body: { status: 'in_progress' } });
  assert.equal(malformed.status, 404);
});

test('update: rejects a request without a token (401) and a non-admin (403)', async () => {
  const reportId = await freshReport();

  const anonymous = await request('PATCH', `/api/admin/reports/${reportId}`, {
    token: null,
    body: { status: 'in_progress' },
  });
  assert.equal(anonymous.status, 401);

  const user = await request('PATCH', `/api/admin/reports/${reportId}`, {
    token: userToken,
    body: { status: 'in_progress' },
  });
  assert.equal(user.status, 403);
  assert.equal((await storedReport(reportId)).status, 'pending');
});
