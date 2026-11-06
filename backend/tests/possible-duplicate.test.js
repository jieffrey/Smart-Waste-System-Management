// "Possible duplicate": on POST /api/reports (after the AI category is known) the new report is linked to an
// open report (pending / in progress) with the same category, created in the last 24 h, within 50 m.
// Nothing is blocked. Admins see the link on both reports and can filter on it. Needs migration 002.
// Uses the real database and a fake ML API; everything is created at a spot no other test uses.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { startFakeMlApi } = require('./helpers/fake-ml-api');

const runId = Date.now();
const userEmail = `test+dup-user-${runId}@example.com`;
const adminEmail = `test+dup-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

// A quiet spot (Bali), away from the coordinates other tests use.
const BASE = { lat: -8.512345, lon: 115.123456 };
const METRES_PER_DEGREE_LAT = 111195; // matches the haversine's Earth radius (6,371 km)

let fakeMl;
let app;
let query;
let pool;
let uploads;
let findPossibleDuplicate;
let server;
let baseUrl;
let userId;
let userToken;
let adminToken;
let jpeg;

// A point `northM` metres north and `eastM` metres east of BASE.
function offset(northM, eastM = 0) {
  const lat = BASE.lat + northM / METRES_PER_DEGREE_LAT;
  const lon = BASE.lon + eastM / (METRES_PER_DEGREE_LAT * Math.cos((BASE.lat * Math.PI) / 180));
  return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
}

async function insertReport({ northM = 0, eastM = 0, category = 'plastic', status = 'pending', hoursAgo = 1 } = {}) {
  const { lat, lon } = offset(northM, eastM);
  const { rows } = await query(
    `INSERT INTO waste_reports (user_id, description, category, status, image_url, latitude, longitude, created_at)
     VALUES ($1, 'Duplicate test', $2, $3, '/uploads/test-image.jpg', $4, $5, NOW() - make_interval(hours => $6))
     RETURNING id`,
    [userId, category, status, lat, lon, hoursAgo]
  );
  return rows[0].id;
}

async function clearReports() {
  await query('DELETE FROM waste_reports WHERE user_id = $1 AND image_url = $2', [userId, '/uploads/test-image.jpg']);
}

function findAt(northM = 0, eastM = 0, category = 'plastic') {
  const { lat, lon } = offset(northM, eastM);
  return findPossibleDuplicate(pool, { category, latitude: lat, longitude: lon });
}

async function request(method, path, token, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function createViaApi(northM = 0) {
  const { lat, lon } = offset(northM);
  const form = new FormData();
  form.append('description', 'Bottles by the beach path');
  form.append('latitude', String(lat));
  form.append('longitude', String(lon));
  form.append('image', new Blob([jpeg], { type: 'image/jpeg' }), 'photo.jpg');
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: form,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  jpeg = await sharp({ create: { width: 24, height: 24, channels: 3, background: { r: 40, g: 90, b: 200 } } })
    .jpeg()
    .toBuffer();
  fakeMl = await startFakeMlApi(); // predicts plastic
  process.env.ML_API_URL = fakeMl.url;

  app = require('../src/app');
  ({ query, pool } = require('../src/db/pool'));
  uploads = require('../src/modules/uploads/uploads.service');
  ({ findPossibleDuplicate } = require('../src/modules/reports/duplicates'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const user = await request('POST', '/api/auth/register', null, { full_name: 'Dup User', email: userEmail, password });
  userId = user.body.user.id;
  userToken = user.body.token;
  await request('POST', '/api/auth/register', null, { full_name: 'Dup Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  adminToken = (await request('POST', '/api/auth/login', null, { email: adminEmail, password })).body.token;
});

after(async () => {
  const { rows } = await query('SELECT image_url FROM waste_reports WHERE user_id = $1', [userId]);
  for (const row of rows) {
    if (row.image_url !== '/uploads/test-image.jpg') await uploads.deleteImage(row.image_url);
  }
  await query('UPDATE waste_reports SET possible_duplicate_of = NULL WHERE user_id = $1', [userId]);
  await query('DELETE FROM waste_reports WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[userEmail, adminEmail]]);
  server.close();
  await fakeMl.close();
  await pool.end();
});

// ---- Distance and the other conditions (service level) ----

test('49 m away is a duplicate, 51 m away is not (north and east)', async () => {
  await clearReports();
  const existing = await insertReport();
  assert.equal(await findAt(49), existing);
  assert.equal(await findAt(0, 49), existing);
  assert.equal(await findAt(-35, 35), existing); // ~49.5 m diagonally
  assert.equal(await findAt(51), null);
  assert.equal(await findAt(0, -51), null);
  assert.equal(await findAt(37, 37), null); // ~52.3 m diagonally: outside, although each axis is < 50 m
});

test('the same spot counts (0 m)', async () => {
  await clearReports();
  const existing = await insertReport();
  assert.equal(await findAt(0), existing);
});

test('only the same category counts', async () => {
  await clearReports();
  await insertReport({ category: 'paper' });
  assert.equal(await findAt(0, 0, 'plastic'), null);
});

test('only open reports count (pending and in progress, not completed or rejected)', async () => {
  await clearReports();
  await insertReport({ status: 'completed' });
  await insertReport({ status: 'rejected' });
  assert.equal(await findAt(0), null);
  const inProgress = await insertReport({ status: 'in_progress' });
  assert.equal(await findAt(0), inProgress);
});

test('only reports from the last 24 hours count', async () => {
  await clearReports();
  await insertReport({ hoursAgo: 25 });
  assert.equal(await findAt(0), null);
  const recent = await insertReport({ hoursAgo: 23 });
  assert.equal(await findAt(0), recent);
});

test('the nearest open report wins', async () => {
  await clearReports();
  await insertReport({ northM: 40 });
  const nearest = await insertReport({ northM: 10 });
  assert.equal(await findAt(0), nearest);
});

// ---- Through the API ----

test('POST /api/reports links the second report to the first, and never blocks it', async () => {
  await clearReports();
  const first = await createViaApi(0);
  assert.equal(first.status, 201);
  assert.equal(first.body.report.possible_duplicate_of, null);

  const second = await createViaApi(20);
  assert.equal(second.status, 201);
  assert.equal(second.body.report.possible_duplicate_of, first.body.report.id);

  const far = await createViaApi(200);
  assert.equal(far.status, 201);
  assert.equal(far.body.report.possible_duplicate_of, null);

  // Admins: the original lists its possible duplicates, the new one points back.
  const original = await request('GET', `/api/admin/reports/${first.body.report.id}`, adminToken);
  assert.deepEqual(original.body.report.possible_duplicates.map((report) => report.id), [second.body.report.id]);
  const linked = await request('GET', `/api/admin/reports/${second.body.report.id}`, adminToken);
  assert.equal(linked.body.report.possible_duplicate_of, first.body.report.id);
  assert.deepEqual(linked.body.report.possible_duplicates, []);

  // The filter lists only linked reports.
  const filtered = await request('GET', '/api/admin/reports?duplicate=true&limit=50', adminToken);
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.reports.every((report) => report.possible_duplicate_of !== null));
  assert.ok(filtered.body.reports.some((report) => report.id === second.body.report.id));
  assert.ok(!filtered.body.reports.some((report) => report.id === first.body.report.id));
});

test('an invalid duplicate filter value is a 400', async () => {
  const res = await request('GET', '/api/admin/reports?duplicate=yes', adminToken);
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((detail) => detail.field), ['duplicate']);
});
