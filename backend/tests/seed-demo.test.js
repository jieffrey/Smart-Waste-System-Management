// Production demo seed (scripts/seed-demo.js). The manifest checks need no database; the seeding tests use the
// real (dev) database with the ML API and photo storage stubbed, and delete what they create.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  seedDemo,
  validateManifest,
  reportTimes,
  uuidV5,
  parseArgs,
  checkConfirmHost,
  MANIFEST_PATH,
  DEFAULT_PHOTOS_DIR,
  STATUS_TRANSITIONS,
} = require('../scripts/seed-demo');

const runId = Date.now();
const adminEmail = `test+demo-admin-${runId}@example.com`;
const NOW = new Date('2026-11-05T09:00:00Z');
let manifest;

before(async () => {
  manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
});

// ---- The committed manifest and photos (no database) ----

test('the committed manifest is valid and every photo exists', async () => {
  assert.deepEqual(await validateManifest(manifest, DEFAULT_PHOTOS_DIR), []);
});

test('the manifest has 48 reports, 16 per category, every status, and 5 residents', () => {
  const count = (values) => values.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
  const statuses = manifest.reports.map((r) => (r.history.length ? r.history.at(-1).status : 'pending'));

  assert.equal(manifest.reports.length, 48);
  assert.deepEqual(count(manifest.reports.map((r) => r.true_category)), { organic: 16, paper: 16, plastic: 16 });
  assert.deepEqual(count(statuses), { pending: 14, in_progress: 12, completed: 15, rejected: 7 });
  assert.equal(manifest.residents.length, 5);
  for (const resident of manifest.residents) {
    assert.match(resident.email, /@demo\.swms\.invalid$/); // reserved domain: never a real mailbox
  }
});

test('the photo folder has exactly the manifest photos plus ATTRIBUTION.md', async () => {
  const files = (await fs.readdir(DEFAULT_PHOTOS_DIR)).sort();
  const expected = [...manifest.reports.map((r) => r.photo), 'ATTRIBUTION.md'].sort();
  assert.deepEqual(files, expected);
});

test('report times fall inside the last 30 days, end at least an hour ago, and increase', () => {
  for (const report of manifest.reports) {
    const { createdAt, steps } = reportTimes(report, NOW);
    const times = [createdAt, ...steps.map((s) => s.at)].map((d) => d.getTime());
    assert.ok(times[0] > NOW.getTime() - 31 * 86_400_000, report.key);
    assert.ok(times.at(-1) <= NOW.getTime() - 3_600_000, report.key);
    assert.deepEqual(times, [...times].sort((a, b) => a - b), report.key);
  }
});

test('validateManifest reports illegal transitions, unknown residents and missing photos', async () => {
  const bad = {
    residents: [{ key: 'a', full_name: 'A', email: 'a@demo.swms.invalid' }],
    reports: [
      { key: 'x', photo: 'missing.jpg', true_category: 'paper', resident: 'nobody', days_ago: 1, time: '08:00',
        history: [{ status: 'completed', hours_after_report: 2, note: null }] },
    ],
  };
  const problems = await validateManifest(bad, DEFAULT_PHOTOS_DIR);

  assert.ok(problems.some((p) => p.includes('unknown resident')));
  assert.ok(problems.some((p) => p.includes('pending -> completed is not an allowed transition')));
  assert.ok(problems.some((p) => p.includes('photo missing.jpg not found')));
});

test('uuidV5 matches the RFC 4122 example', () => {
  assert.equal(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('a real run must confirm the database host; a dry run needs no confirmation', () => {
  const url = 'postgresql://u:p@ep-prod-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

  assert.throws(() => checkConfirmHost(parseArgs([]), url), /pass --confirm ep-prod-123-pooler/);
  assert.throws(() => checkConfirmHost(parseArgs(['--confirm', 'ep-dev-999.aws.neon.tech']), url), /Refusing to write/);
  assert.equal(checkConfirmHost(parseArgs(['--confirm', 'ep-prod-123-pooler.ap-southeast-1.aws.neon.tech']), url),
    'ep-prod-123-pooler.ap-southeast-1.aws.neon.tech');
  assert.doesNotThrow(() => checkConfirmHost(parseArgs(['--dry-run']), url));
  assert.throws(() => parseArgs(['--force']), /Unknown argument/);
});

// ---- Seeding against the dev database (ML API and storage stubbed) ----

let query;
let pool;
let hashPassword;
const createdReportIds = new Set();

function testManifest(prefix, reportKeys) {
  const residents = manifest.residents.slice(0, 2).map((r) => ({
    ...r,
    email: `test+demo-${prefix}-${r.key}-${runId}@example.com`,
  }));
  const residentKeys = residents.map((r) => r.key);
  const reports = reportKeys.map((key) => {
    const source = manifest.reports.find((r) => r.key === key);
    return { ...source, key: `${prefix}-${runId}-${key}`, resident: residentKeys[0] };
  });
  return { residents, reports };
}

const sha1 = (buffer) => crypto.createHash('sha1').update(buffer).digest('hex');

// A stub ML API: the true category for each photo, unless overridden for that report key.
async function classifierFor(testData, overrides) {
  const byPhoto = new Map();
  for (const report of testData.reports) {
    const buffer = await fs.readFile(path.join(DEFAULT_PHOTOS_DIR, report.photo));
    const category = overrides[report.key] ?? report.true_category;
    byPhoto.set(sha1(buffer), { category, confidence: 0.91, modelVersion: 'swms_test_model' });
  }
  return async (buffer) => byPhoto.get(sha1(buffer));
}

function depsWith(classify, extra = {}) {
  const saved = [];
  const deleted = [];
  return {
    saved,
    deleted,
    deps: {
      query,
      pool,
      hashPassword,
      classify,
      saveImage: async () => {
        const url = `/uploads/stub-${runId}-${saved.length}.jpg`;
        saved.push(url);
        return url;
      },
      deleteImage: async (url) => {
        deleted.push(url);
      },
      ...extra,
    },
  };
}

const quiet = () => {};

before(async () => {
  ({ query, pool } = require('../src/db/pool'));
  ({ hashPassword } = require('../src/modules/auth/auth.service'));
  await query("INSERT INTO users (full_name, email, password_hash, role) VALUES ('Demo Test Admin', $1, $2, 'admin')", [
    adminEmail,
    await hashPassword('demo-admin-test-password'),
  ]);
});

after(async () => {
  await query('DELETE FROM waste_reports WHERE id = ANY($1::uuid[])', [[...createdReportIds]]);
  await query("DELETE FROM users WHERE email LIKE $1", [`test+demo-%-${runId}@example.com`]);
  await query('DELETE FROM users WHERE email = $1', [adminEmail]);
  await pool.end();
});

// A completed and an in_progress report (reviewed) and a pending one: the AI is wrong on the completed one
// (corrected by the admin) and on the pending one (not reviewed yet, so not corrected).
const COMPLETED = 'pap-01';
const IN_PROGRESS = 'org-01';
const firstPendingKey = () => manifest.reports.find((r) => r.history.length === 0).key;
const otherCategory = (category) => (category === 'organic' ? 'paper' : 'organic');

test('seeds residents and reports, corrects reviewed AI mistakes, and is safe to re-run', async () => {
  const pendingKey = firstPendingKey();
  const data = testManifest('run', [COMPLETED, IN_PROGRESS, pendingKey]);
  const [completed, inProgress, pending] = data.reports;
  for (const report of data.reports) {
    createdReportIds.add(uuidV5(report.key));
  }
  const classify = await classifierFor(data, { [completed.key]: 'plastic', [pending.key]: otherCategory(pending.true_category) });
  const adminBefore = (await query('SELECT * FROM users WHERE email = $1', [adminEmail])).rows[0];
  const options = { manifest: data, photosDir: DEFAULT_PHOTOS_DIR, adminEmail, residentPassword: 'kebun-sampah-2026', now: NOW, log: quiet };

  const first = depsWith(classify);
  const summary = await seedDemo(first.deps, options);

  assert.equal(summary.residentsCreated, 2);
  assert.equal(summary.reportsCreated, 3);
  assert.equal(summary.corrections, 1);
  assert.equal(first.saved.length, 3);
  assert.equal(first.deleted.length, 0);

  const rows = (await query(
    'SELECT id, category, status, ai_predicted_category, ai_confidence::float8 AS c, ai_model_version, admin_note, user_id FROM waste_reports WHERE id = ANY($1::uuid[])',
    [[...data.reports.map((r) => uuidV5(r.key))]]
  )).rows;
  const byId = new Map(rows.map((row) => [row.id, row]));

  const completedRow = byId.get(uuidV5(completed.key));
  assert.equal(completedRow.status, 'completed');
  assert.equal(completedRow.ai_predicted_category, 'plastic');
  assert.equal(completedRow.category, completed.true_category); // corrected by the admin
  assert.match(completedRow.admin_note, /^Kategori dikoreksi dari plastik ke kertas\./);
  assert.equal(completedRow.ai_model_version, 'swms_test_model');

  const pendingRow = byId.get(uuidV5(pending.key));
  assert.equal(pendingRow.status, 'pending');
  assert.equal(pendingRow.category, pendingRow.ai_predicted_category); // not reviewed, so not corrected
  assert.notEqual(pendingRow.category, pending.true_category);
  assert.equal(pendingRow.admin_note, null);

  assert.equal(byId.get(uuidV5(inProgress.key)).category, inProgress.true_category);

  // Every history path is a legal transition; the first row is by the resident, later ones by the admin
  const admin = (await query('SELECT id FROM users WHERE email = $1', [adminEmail])).rows[0];
  for (const report of data.reports) {
    const history = (await query(
      'SELECT old_status, new_status, changed_by FROM report_status_history WHERE report_id = $1 ORDER BY created_at, id',
      [uuidV5(report.key)]
    )).rows;
    assert.equal(history[0].old_status, null);
    assert.equal(history[0].new_status, 'pending');
    assert.equal(history[0].changed_by, byId.get(uuidV5(report.key)).user_id);
    for (const step of history.slice(1)) {
      assert.ok(STATUS_TRANSITIONS[step.old_status].includes(step.new_status), `${step.old_status} -> ${step.new_status}`);
      assert.equal(step.changed_by, admin.id);
    }
    assert.equal(history.length, report.history.length + 1);
  }

  // Second run: nothing new, no uploads, residents keep their password
  const residentBefore = (await query('SELECT password_hash FROM users WHERE email = $1', [data.residents[0].email])).rows[0];
  const second = depsWith(classify);
  const again = await seedDemo(second.deps, { ...options, residentPassword: 'a-different-password-2026' });

  assert.equal(again.residentsCreated, 0);
  assert.equal(again.reportsCreated, 0);
  assert.equal(again.reportsExisting, 3);
  assert.equal(second.saved.length, 0);
  const residentAfter = (await query('SELECT password_hash FROM users WHERE email = $1', [data.residents[0].email])).rows[0];
  assert.equal(residentAfter.password_hash, residentBefore.password_hash);

  // The admin row was never written
  const adminAfter = (await query('SELECT * FROM users WHERE email = $1', [adminEmail])).rows[0];
  assert.deepEqual(adminAfter, adminBefore);
});

test('a dry run writes nothing and uploads nothing', async () => {
  const data = testManifest('dry', [COMPLETED]);
  const run = depsWith(await classifierFor(data, {}));

  const summary = await seedDemo(run.deps, {
    manifest: data, photosDir: DEFAULT_PHOTOS_DIR, adminEmail, dryRun: true, now: NOW, log: quiet,
  });

  assert.equal(summary.wouldCreateReports, 1);
  assert.equal(run.saved.length, 0);
  const { rows } = await query('SELECT 1 FROM waste_reports WHERE id = $1', [uuidV5(data.reports[0].key)]);
  assert.equal(rows.length, 0);
  const users = await query('SELECT 1 FROM users WHERE email = $1', [data.residents[0].email]);
  assert.equal(users.rows.length, 0);
});

test('refuses to run without an existing admin, and never touches an admin listed as a resident', async () => {
  const data = testManifest('guard', [COMPLETED]);
  const run = depsWith(await classifierFor(data, {}));
  const options = { manifest: data, photosDir: DEFAULT_PHOTOS_DIR, residentPassword: 'kebun-sampah-2026', now: NOW, log: quiet };

  await assert.rejects(seedDemo(run.deps, { ...options, adminEmail: `nobody-${runId}@example.com` }), /not an existing admin/);

  const adminAsResident = { ...data, residents: [{ ...data.residents[0], email: adminEmail }, data.residents[1]] };
  const adminBefore = (await query('SELECT * FROM users WHERE email = $1', [adminEmail])).rows[0];
  await assert.rejects(seedDemo(run.deps, { ...options, manifest: adminAsResident, adminEmail }), /role "admin": refusing/);

  assert.equal(run.saved.length, 0);
  assert.deepEqual((await query('SELECT * FROM users WHERE email = $1', [adminEmail])).rows[0], adminBefore);
  assert.equal((await query('SELECT 1 FROM waste_reports WHERE id = $1', [uuidV5(data.reports[0].key)])).rows.length, 0);
});

test('deletes the uploaded photo again when the report insert fails', async () => {
  const data = testManifest('fail', [COMPLETED]);
  createdReportIds.add(uuidV5(data.reports[0].key));
  // An invalid category breaks the insert (CHECK constraint) after the photo was stored
  const run = depsWith(async () => ({ category: 'metal', confidence: 0.5, modelVersion: 'swms_test_model' }));

  await assert.rejects(
    seedDemo(run.deps, { manifest: data, photosDir: DEFAULT_PHOTOS_DIR, adminEmail, residentPassword: 'kebun-sampah-2026', now: NOW, log: quiet }),
    /Report fail-.* failed/
  );

  assert.equal(run.saved.length, 1);
  assert.deepEqual(run.deleted, run.saved);
  assert.equal((await query('SELECT 1 FROM waste_reports WHERE id = $1', [uuidV5(data.reports[0].key)])).rows.length, 0);
});
