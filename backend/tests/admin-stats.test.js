// Integration tests for GET /api/admin/stats.
// The stats cover the whole database, so these tests never assume it is empty: they take a "before"
// snapshot, insert known reports, take an "after" snapshot, and check only the differences.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query } = require('../src/db/pool');

const runId = Date.now();
const userEmail = `test+stats-user-${runId}@example.com`;
const adminEmail = `test+stats-admin-${runId}@example.com`;
const password = 'correct-horse-battery';

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

async function getStats(token = adminToken) {
  const res = await fetch(`${baseUrl}/api/admin/stats`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

// aiCategory null means "no AI prediction" (confidence and model are then null too).
async function insertReport({ status, category, aiCategory, daysAgo = 0 }) {
  await query(
    `INSERT INTO waste_reports
       (user_id, description, category, status, image_url, latitude, longitude,
        ai_predicted_category, ai_confidence, ai_model_version, created_at)
     VALUES ($1, 'stats test', $2, $3, '/uploads/test-image.jpg', -6.2, 106.816666,
             $4::varchar, CASE WHEN $4::varchar IS NULL THEN NULL ELSE 0.9 END,
             CASE WHEN $4::varchar IS NULL THEN NULL ELSE 'test-model' END,
             NOW() - make_interval(days => $5))`,
    [userId, category, status, aiCategory, daysAgo]
  );
}

function todayInJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()); // YYYY-MM-DD
}

function countsByDate(reportsPerDay) {
  return Object.fromEntries(reportsPerDay.map(({ date, count }) => [date, count]));
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  const user = await postJson('/api/auth/register', { full_name: 'Stats User', email: userEmail, password });
  userId = user.user.id;
  userToken = user.token;

  await postJson('/api/auth/register', { full_name: 'Stats Admin', email: adminEmail, password });
  await query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
  adminToken = (await postJson('/api/auth/login', { email: adminEmail, password })).token;
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE user_id = $1', [userId]);
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[userEmail, adminEmail]]);
  server.close();
  await pool.end();
});

test('returns 30 consecutive days ending today (Asia/Jakarta)', async () => {
  const { status, body } = await getStats();

  assert.equal(status, 200);
  assert.equal(body.reports_per_day.length, 30);
  assert.equal(body.reports_per_day.at(-1).date, todayInJakarta());

  for (let i = 1; i < body.reports_per_day.length; i += 1) {
    const previous = new Date(`${body.reports_per_day[i - 1].date}T00:00:00Z`);
    const current = new Date(`${body.reports_per_day[i].date}T00:00:00Z`);
    assert.equal(current - previous, 24 * 60 * 60 * 1000);
  }
});

test('counts new reports in the totals, per day and in AI accuracy (before/after difference)', async () => {
  const beforeStats = (await getStats()).body;

  await insertReport({ status: 'pending', category: 'plastic', aiCategory: 'plastic' });
  await insertReport({ status: 'pending', category: 'paper', aiCategory: 'paper', daysAgo: 2 });
  await insertReport({ status: 'in_progress', category: 'paper', aiCategory: 'paper' }); // reviewed, AI correct
  await insertReport({ status: 'completed', category: 'organic', aiCategory: 'plastic' }); // reviewed, AI corrected
  await insertReport({ status: 'rejected', category: 'plastic', aiCategory: 'plastic' }); // not counted for accuracy
  await insertReport({ status: 'completed', category: 'paper', aiCategory: null }); // no AI result: not counted

  const afterStats = (await getStats()).body;

  // Totals
  assert.equal(afterStats.totals.reports - beforeStats.totals.reports, 6);
  const statusDiff = Object.fromEntries(
    Object.keys(afterStats.totals.by_status).map((key) => [key, afterStats.totals.by_status[key] - beforeStats.totals.by_status[key]])
  );
  assert.deepEqual(statusDiff, { pending: 2, in_progress: 1, completed: 2, rejected: 1 });
  const categoryDiff = Object.fromEntries(
    Object.keys(afterStats.totals.by_category).map((key) => [key, afterStats.totals.by_category[key] - beforeStats.totals.by_category[key]])
  );
  assert.deepEqual(categoryDiff, { organic: 1, paper: 3, plastic: 2 });

  // Reports per day: +5 today, +1 two days ago, no change on other days
  const beforeDays = countsByDate(beforeStats.reports_per_day);
  const afterDays = countsByDate(afterStats.reports_per_day);
  const dates = afterStats.reports_per_day.map((day) => day.date);
  const today = dates.at(-1);
  const twoDaysAgo = dates.at(-3);
  for (const date of dates) {
    const expected = date === today ? 5 : date === twoDaysAgo ? 1 : 0;
    assert.equal(afterDays[date] - (beforeDays[date] ?? 0), expected, `reports on ${date}`);
  }

  // AI accuracy: only in_progress/completed reports with an AI prediction
  assert.equal(afterStats.ai_accuracy.reviewed - beforeStats.ai_accuracy.reviewed, 2);
  assert.equal(afterStats.ai_accuracy.matching - beforeStats.ai_accuracy.matching, 1);
  assert.equal(
    afterStats.ai_accuracy.accuracy,
    Number((afterStats.ai_accuracy.matching / afterStats.ai_accuracy.reviewed).toFixed(4))
  );
});

test('rejects a request without a token (401) and a non-admin (403)', async () => {
  assert.equal((await getStats(null)).status, 401);
  assert.equal((await getStats(userToken)).status, 403);
});
