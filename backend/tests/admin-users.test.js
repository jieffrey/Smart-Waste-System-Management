// Integration tests for the admin user endpoints under /api/admin/users.
// Uses the real database: creates temporary users and deletes them afterwards.
// Every test user has MARKER in their name, and list queries search for it, so other users in the
// database cannot affect the results.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');

const runId = Date.now();
const MARKER = `usr${runId}`;
const anaEmail = `test+ana-${runId}@example.com`;
const budiEmail = `test+budi-${runId}@example.com`;
const adminEmail = `test+users-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

let server;
let baseUrl;
let anaId;
let budiId;
let adminId;
let anaToken;
let adminToken;

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
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

function listIds(res) {
  return res.body.users.map((user) => user.id);
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  // Registered in this order, so newest first is: admin, budi, ana
  const ana = await postJson('/api/auth/register', { full_name: `Ana ${MARKER}`, email: anaEmail, password });
  anaId = ana.user.id;
  anaToken = ana.token;
  budiId = (await postJson('/api/auth/register', { full_name: `Budi ${MARKER}`, email: budiEmail, password })).user.id;

  await postJson('/api/auth/register', { full_name: `Admin ${MARKER}`, email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  const admin = await postJson('/api/auth/login', { email: adminEmail, password });
  adminId = admin.user.id;
  adminToken = admin.token;

  // Ana has 2 reports, so report_count can be checked.
  await query(
    `INSERT INTO waste_reports (user_id, description, category, image_url, latitude, longitude)
     VALUES ($1, 'users test', 'plastic', '/uploads/test-image.jpg', -6.2, 106.8),
            ($1, 'users test', 'paper', '/uploads/test-image.jpg', -6.2, 106.8)`,
    [anaId]
  );
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE user_id = $1', [anaId]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[anaEmail, budiEmail, adminEmail]]);
  server.close();
  await pool.end();
});

// ---- GET /api/admin/users ----

test('lists users newest first with report_count and without password_hash', async () => {
  const res = await request('GET', `/api/admin/users?q=${MARKER}`);

  assert.equal(res.status, 200);
  assert.deepEqual(listIds(res), [adminId, budiId, anaId]);
  assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 3 });

  const ana = res.body.users.find((user) => user.id === anaId);
  assert.deepEqual(
    { email: ana.email, role: ana.role, is_active: ana.is_active, report_count: ana.report_count },
    { email: anaEmail, role: 'user', is_active: true, report_count: 2 }
  );
  for (const user of res.body.users) {
    assert.equal(user.password_hash, undefined);
  }
});

test('filters by role and searches by email', async () => {
  const admins = await request('GET', `/api/admin/users?q=${MARKER}&role=admin`);
  assert.deepEqual(listIds(admins), [adminId]);

  const byEmail = await request('GET', `/api/admin/users?q=${encodeURIComponent(budiEmail)}`);
  assert.deepEqual(listIds(byEmail), [budiId]);
});

test('paginates with page and limit', async () => {
  const res = await request('GET', `/api/admin/users?q=${MARKER}&page=2&limit=2`);

  assert.deepEqual(listIds(res), [anaId]);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 2, total: 3 });
});

test('rejects invalid filters with 400 and field details', async () => {
  const res = await request('GET', '/api/admin/users?role=root&is_active=yes&limit=0');

  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((detail) => detail.field).sort(), ['is_active', 'limit', 'role']);
});

// ---- PATCH /api/admin/users/:id ----

test('deactivating a user blocks their token immediately; reactivating restores it', async () => {
  const deactivated = await request('PATCH', `/api/admin/users/${budiId}`, { body: { is_active: false } });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.user.id, budiId);
  assert.equal(deactivated.body.user.is_active, false);
  assert.equal(deactivated.body.user.password_hash, undefined);

  const inactiveList = await request('GET', `/api/admin/users?q=${MARKER}&is_active=false`);
  assert.deepEqual(listIds(inactiveList), [budiId]);

  // Ana is deactivated too, and her existing token stops working right away.
  await request('PATCH', `/api/admin/users/${anaId}`, { body: { is_active: false } });
  const blocked = await request('GET', '/api/auth/me', { token: anaToken });
  assert.equal(blocked.status, 403);
  assert.deepEqual(blocked.body, { error: { message: 'Account is deactivated', details: null } });

  const reactivated = await request('PATCH', `/api/admin/users/${anaId}`, { body: { is_active: true } });
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.body.user.is_active, true);
  assert.equal((await request('GET', '/api/auth/me', { token: anaToken })).status, 200);

  await request('PATCH', `/api/admin/users/${budiId}`, { body: { is_active: true } });
});

test('an admin cannot deactivate their own account (400)', async () => {
  const res = await request('PATCH', `/api/admin/users/${adminId}`, { body: { is_active: false } });

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: { message: 'You cannot deactivate your own account', details: null } });

  const { rows } = await query('SELECT is_active FROM users WHERE id = $1', [adminId]);
  assert.equal(rows[0].is_active, true);
});

test('update: a missing or non-boolean is_active returns 400', async () => {
  const missing = await request('PATCH', `/api/admin/users/${budiId}`, { body: {} });
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body.error.details, [{ field: 'is_active', message: 'is_active must be true or false' }]);

  const text = await request('PATCH', `/api/admin/users/${budiId}`, { body: { is_active: 'false' } });
  assert.equal(text.status, 400);
});

test('update: unknown and malformed ids return 404', async () => {
  const unknown = await request('PATCH', '/api/admin/users/00000000-0000-4000-8000-000000000000', {
    body: { is_active: false },
  });
  assert.equal(unknown.status, 404);
  assert.deepEqual(unknown.body, { error: { message: 'User not found', details: null } });

  const malformed = await request('PATCH', '/api/admin/users/not-a-uuid', { body: { is_active: false } });
  assert.equal(malformed.status, 404);
});

test('rejects requests without a token (401) and from non-admins (403)', async () => {
  assert.equal((await request('GET', '/api/admin/users', { token: null })).status, 401);
  assert.equal((await request('GET', '/api/admin/users', { token: anaToken })).status, 403);

  const patch = await request('PATCH', `/api/admin/users/${budiId}`, { token: anaToken, body: { is_active: false } });
  assert.equal(patch.status, 403);
  const { rows } = await query('SELECT is_active FROM users WHERE id = $1', [budiId]);
  assert.equal(rows[0].is_active, true);
});
