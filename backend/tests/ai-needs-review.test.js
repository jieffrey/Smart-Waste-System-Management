// "Needs review": reports the AI was unsure about (confidence < AI_REVIEW_THRESHOLD, default 0.70) that no admin
// has confirmed or corrected yet. Computed in SQL; exposed on report payloads, as a filter on
// GET /api/admin/reports and as a count in GET /api/admin/stats.
// Uses the real database: temporary users and reports, deleted afterwards.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');
const { readAiReviewThreshold } = require('../src/config/ai-review');

const runId = Date.now();
const userEmail = `test+review-user-${runId}@example.com`;
const adminEmail = `test+review-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

let server;
let baseUrl;
let userId;
let userToken;
let adminToken;
const ids = {};

async function request(method, path, token, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function insertReport({ status = 'pending', category = 'plastic', aiCategory = 'plastic', confidence }) {
  const { rows } = await query(
    `INSERT INTO waste_reports (user_id, description, category, status, image_url, latitude, longitude,
                                ai_predicted_category, ai_confidence, ai_model_version)
     VALUES ($1, 'Needs-review test', $2, $3, '/uploads/test-image.jpg', -6.2, 106.8, $4, $5, 'test')
     RETURNING id`,
    [userId, category, status, confidence === null ? null : aiCategory, confidence]
  );
  return rows[0].id;
}

async function needsReviewCount() {
  const res = await request('GET', '/api/admin/stats', adminToken);
  assert.equal(res.status, 200);
  return res.body.needs_review.count;
}

let countBefore;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  countBefore = undefined;
  const user = await request('POST', '/api/auth/register', null, { full_name: 'Review User', email: userEmail, password });
  userId = user.body.user.id;
  userToken = user.body.token;

  await request('POST', '/api/auth/register', null, { full_name: 'Review Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  adminToken = (await request('POST', '/api/auth/login', null, { email: adminEmail, password })).body.token;

  countBefore = await needsReviewCount();

  ids.lowPending = await insertReport({ confidence: 0.55 }); // needs review
  ids.edgePending = await insertReport({ confidence: 0.7 }); // exactly at the threshold: not below it
  ids.highPending = await insertReport({ confidence: 0.95 });
  ids.lowCorrected = await insertReport({ confidence: 0.4, category: 'paper', aiCategory: 'plastic' });
  ids.lowRouted = await insertReport({ confidence: 0.4, status: 'in_progress' });
  ids.noAi = await insertReport({ confidence: null });
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[userEmail, adminEmail]]);
  server.close();
  await pool.end();
});

test('needs_review is true only for low confidence, uncorrected, still pending reports', async () => {
  const expected = {
    lowPending: true,
    edgePending: false,
    highPending: false,
    lowCorrected: false,
    lowRouted: false,
    noAi: false,
  };
  for (const [name, needsReview] of Object.entries(expected)) {
    const res = await request('GET', `/api/admin/reports/${ids[name]}`, adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.report.needs_review, needsReview, name);
  }
});

test('the resident sees needs_review on their own reports too', async () => {
  const res = await request('GET', '/api/reports/me?limit=50', userToken);
  assert.equal(res.status, 200);
  const flagged = res.body.reports.filter((report) => report.needs_review).map((report) => report.id);
  assert.deepEqual(flagged, [ids.lowPending]);
});

test('GET /api/admin/reports?needs_review=true lists only reports that need review', async () => {
  const res = await request('GET', '/api/admin/reports?needs_review=true&limit=50', adminToken);
  assert.equal(res.status, 200);
  assert.ok(res.body.reports.every((report) => report.needs_review === true));
  const ours = res.body.reports.filter((report) => report.user_id === userId).map((report) => report.id);
  assert.deepEqual(ours, [ids.lowPending]);
  assert.equal(res.body.pagination.total, res.body.reports.length);
});

test('needs_review=false (or absent) does not filter', async () => {
  const res = await request('GET', `/api/admin/reports?needs_review=false&limit=50`, adminToken);
  assert.equal(res.status, 200);
  const ours = res.body.reports.filter((report) => report.user_id === userId);
  assert.equal(ours.length, 6);
});

test('an invalid needs_review value is a 400', async () => {
  const res = await request('GET', '/api/admin/reports?needs_review=maybe', adminToken);
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.error.details.map((detail) => detail.field), ['needs_review']);
});

test('stats count reports that need review, with the threshold', async () => {
  const res = await request('GET', '/api/admin/stats', adminToken);
  assert.equal(res.body.needs_review.count - countBefore, 1);
  assert.equal(res.body.needs_review.threshold, 0.7);
});

test('confirming (routing) or correcting the category clears needs_review', async () => {
  const routed = await request('PATCH', `/api/admin/reports/${ids.lowPending}`, adminToken, { status: 'in_progress' });
  assert.equal(routed.status, 200);
  assert.equal(routed.body.report.needs_review, false);

  const another = await insertReport({ confidence: 0.3 });
  const corrected = await request('PATCH', `/api/admin/reports/${another}`, adminToken, { category: 'organic' });
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.report.needs_review, false);
  assert.equal(await needsReviewCount(), countBefore);
});

test('AI_REVIEW_THRESHOLD: default 0.70, accepts (0, 1], rejects anything else', () => {
  assert.equal(readAiReviewThreshold(undefined), 0.7);
  assert.equal(readAiReviewThreshold(''), 0.7);
  assert.equal(readAiReviewThreshold('0.85'), 0.85);
  assert.equal(readAiReviewThreshold('1'), 1);
  for (const bad of ['0', '-0.1', '1.5', 'abc']) {
    assert.throws(() => readAiReviewThreshold(bad), /AI_REVIEW_THRESHOLD/);
  }
});
