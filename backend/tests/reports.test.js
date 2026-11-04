// Integration tests for POST /api/reports with a fake ML API (no real ML server needed).
// Uses the real database: creates temporary users and deletes them (and their reports/images) afterwards.

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { startFakeMlApi, DEFAULT_PREDICTION } = require('./helpers/fake-ml-api');

const runId = Date.now();
const userEmail = `test+reporter-${runId}@example.com`;
const adminEmail = `test+report-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

const UNAVAILABLE_BODY = {
  error: { message: 'AI service unavailable, please try again later', details: null },
};

// Only the first bytes matter for type detection; the fake ML API does not decode images.
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const VALID_FIELDS = { description: '  Plastic bottles next to the bus stop  ', latitude: '-6.200000', longitude: '106.816666' };

let fakeMl;
let app;
let query;
let pool;
let uploads;
let server;
let baseUrl;
let userId;
let userToken;
let adminToken;

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function createReport({ token = userToken, fields = VALID_FIELDS, image = JPEG_BYTES, imageField = 'image' } = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  if (image) {
    form.append(imageField, new Blob([image], { type: 'image/jpeg' }), 'photo.jpg');
  }

  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return { status: res.status, body: await res.json() };
}

async function countReports() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM waste_reports WHERE user_id = $1', [userId]);
  return rows[0].count;
}

async function countImageFiles() {
  const files = await fs.readdir(uploads.UPLOAD_DIR).catch(() => []);
  return files.length;
}

before(async () => {
  fakeMl = await startFakeMlApi();

  // The config is read when the app is first loaded, so set the env before requiring it.
  process.env.ML_API_URL = fakeMl.url;
  process.env.ML_API_TIMEOUT_MS = '200';
  delete process.env.ML_API_KEY; // the X-API-Key header must not be sent when no key is set

  app = require('../src/app');
  ({ query, pool } = require('../src/db/pool'));
  uploads = require('../src/modules/uploads/uploads.service');

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const user = await postJson('/api/auth/register', { full_name: 'Test Reporter', email: userEmail, password });
  userId = user.user.id;
  userToken = user.token;

  await postJson('/api/auth/register', { full_name: 'Test Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  adminToken = (await postJson('/api/auth/login', { email: adminEmail, password })).token;
});

beforeEach(() => {
  fakeMl.state.mode = 'success';
  fakeMl.state.requests = [];
});

after(async () => {
  const { rows } = await query('SELECT image_url FROM waste_reports WHERE user_id = $1', [userId]);
  for (const row of rows) {
    await uploads.deleteImage(row.image_url);
  }
  await query('DELETE FROM waste_reports WHERE user_id = $1', [userId]); // status history is deleted by CASCADE
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[userEmail, adminEmail]]);

  server.close();
  await fakeMl.close();
  await pool.end();
});

test('creates a report with the category taken from the ML prediction', async () => {
  const res = await createReport({ fields: { ...VALID_FIELDS, category: 'organic', address: 'Jl. Sudirman' } });

  assert.equal(res.status, 201);
  const { report } = res.body;
  assert.equal(report.category, DEFAULT_PREDICTION.category); // client-sent "organic" is ignored
  assert.equal(report.ai_predicted_category, DEFAULT_PREDICTION.category);
  assert.equal(report.ai_confidence, DEFAULT_PREDICTION.confidence);
  assert.equal(report.ai_model_version, DEFAULT_PREDICTION.model_version);
  assert.equal(report.status, 'pending');
  assert.equal(report.user_id, userId);
  assert.equal(report.description, 'Plastic bottles next to the bus stop');
  assert.equal(report.latitude, -6.2);
  assert.equal(report.longitude, 106.816666);
  assert.equal(report.address, 'Jl. Sudirman');
  assert.match(report.image_url, /^\/uploads\/[0-9a-f-]{36}\.jpg$/);

  // The ML API received the image, without an API key (none configured)
  assert.equal(fakeMl.state.requests.length, 1);
  assert.equal(fakeMl.state.requests[0].headers['x-api-key'], undefined);

  // The first status-history row was written in the same transaction
  const history = await query(
    'SELECT old_status, new_status, changed_by FROM report_status_history WHERE report_id = $1',
    [report.id]
  );
  assert.deepEqual(history.rows, [{ old_status: null, new_status: 'pending', changed_by: userId }]);

  // The saved image is served at its URL
  const image = await fetch(`${baseUrl}${report.image_url}`);
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), JPEG_BYTES);
});

test('returns 503 and saves nothing when the ML API returns an error', async (t) => {
  t.mock.method(console, 'error', () => {});
  fakeMl.state.mode = 'error';
  const [reportsBefore, filesBefore] = [await countReports(), await countImageFiles()];

  const res = await createReport();

  assert.equal(res.status, 503);
  assert.deepEqual(res.body, UNAVAILABLE_BODY);
  assert.equal(await countReports(), reportsBefore);
  assert.equal(await countImageFiles(), filesBefore);
});

test('returns 422 on the image field and saves nothing when the ML API rejects the image (SEC-14)', async (t) => {
  t.mock.method(console, 'warn', () => {});
  fakeMl.state.mode = 'status';
  fakeMl.state.status = 415;
  const [reportsBefore, filesBefore] = [await countReports(), await countImageFiles()];

  const res = await createReport();

  const message = "The photo couldn't be processed. Try another photo.";
  assert.equal(res.status, 422);
  assert.deepEqual(res.body, { error: { message, details: [{ field: 'image', message }] } });
  assert.doesNotMatch(JSON.stringify(res.body), /raw ML detail/); // the ML API's own text is never passed on
  assert.equal(await countReports(), reportsBefore);
  assert.equal(await countImageFiles(), filesBefore);
});

test('returns 503 and saves nothing when the ML API returns an invalid prediction', async (t) => {
  t.mock.method(console, 'error', () => {});
  fakeMl.state.mode = 'invalid';
  const [reportsBefore, filesBefore] = [await countReports(), await countImageFiles()];

  const res = await createReport();

  assert.equal(res.status, 503);
  assert.deepEqual(res.body, UNAVAILABLE_BODY);
  assert.equal(await countReports(), reportsBefore);
  assert.equal(await countImageFiles(), filesBefore);
});

test('returns 503 and saves nothing when the ML API times out', async (t) => {
  t.mock.method(console, 'error', () => {});
  fakeMl.state.mode = 'slow'; // answers after 1000 ms; the backend gives up after 200 ms
  const [reportsBefore, filesBefore] = [await countReports(), await countImageFiles()];

  const res = await createReport();

  assert.equal(res.status, 503);
  assert.deepEqual(res.body, UNAVAILABLE_BODY);
  assert.equal(await countReports(), reportsBefore);
  assert.equal(await countImageFiles(), filesBefore);
});

test('rejects a request without an image with 400', async () => {
  const res = await createReport({ image: null });

  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details, [{ field: 'image', message: 'Image is required' }]);
  assert.equal(fakeMl.state.requests.length, 0);
});

test('rejects a file that is not a JPEG, PNG or WebP with 415', async () => {
  const res = await createReport({ image: Buffer.from('this is not an image') });

  assert.equal(res.status, 415);
  assert.deepEqual(res.body, {
    error: { message: 'Unsupported file type. Upload a JPEG, PNG or WebP image', details: null },
  });
  assert.equal(fakeMl.state.requests.length, 0);
});

test('rejects an image larger than 5 MB with 413', async () => {
  const tooBig = Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)]);
  const res = await createReport({ image: tooBig });

  assert.equal(res.status, 413);
  assert.deepEqual(res.body, { error: { message: 'Image must be 5 MB or smaller', details: null } });
  assert.equal(fakeMl.state.requests.length, 0);
});

test('rejects missing or invalid fields with 400 and field details', async () => {
  const res = await createReport({ fields: { description: '   ', latitude: '200' } });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Validation failed');
  const fields = res.body.error.details.map((detail) => detail.field).sort();
  assert.deepEqual(fields, ['description', 'latitude', 'longitude']);
  assert.equal(fakeMl.state.requests.length, 0);
});

test('rejects a request without a token with 401', async () => {
  const res = await createReport({ token: null });

  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: { message: 'Authentication required', details: null } });
});

test('rejects an admin with 403 (only role "user" can create reports)', async () => {
  const res = await createReport({ token: adminToken });

  assert.equal(res.status, 403);
  assert.equal(fakeMl.state.requests.length, 0);
});

// Keep this test last: it shuts the fake ML API down.
test('returns 503 and saves nothing when the ML API is down', async (t) => {
  t.mock.method(console, 'error', () => {});
  await fakeMl.close();
  const [reportsBefore, filesBefore] = [await countReports(), await countImageFiles()];

  const res = await createReport();

  assert.equal(res.status, 503);
  assert.deepEqual(res.body, UNAVAILABLE_BODY);
  assert.equal(await countReports(), reportsBefore);
  assert.equal(await countImageFiles(), filesBefore);
});
