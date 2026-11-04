// Tests for scripts/set-admin-password.js. Database tests use temporary accounts only.

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pool, query } = require('../src/db/pool');
const { hashPassword, loginUser } = require('../src/modules/auth/auth.service');
const { checkAdminPassword, setAdminPassword } = require('../scripts/set-admin-password');

const runId = Date.now();
const adminEmail = `test+set-admin-${runId}@example.com`;
const userEmail = `test+set-admin-user-${runId}@example.com`;
const oldPassword = 'old-demo-password';
const newPassword = 'Correct-Horse-Battery-42';

async function createAccount(email, role) {
  await query('INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
    'Set Password Test',
    email,
    await hashPassword(oldPassword),
    role,
  ]);
}

after(async () => {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[adminEmail, userEmail]]);
  await pool.end();
});

// ---- Password strength (no database) ----

test('weak admin passwords are rejected with every problem listed, never showing the value', () => {
  const cases = [
    ['Admin123!', /at least 12 characters/],
    ['aaaaaaaaaaaaaaaa', /at least 6 different characters/],
    ['MyPassword-2026!', /common words/],
    ['super-admin-2026!', /common words/],
    ['jeffrey-river-77!', /must not contain the email/],
  ];
  for (const [password, expected] of cases) {
    const problems = checkAdminPassword(password, 'jeffrey@example.com');
    assert.ok(problems.some((problem) => expected.test(problem)), `${expected} for a weak password`);
    assert.ok(problems.every((problem) => !problem.includes(password)), 'messages never include the password');
  }
  assert.ok(checkAdminPassword('x'.repeat(73) + 'abcdef').some((problem) => /at most 72/.test(problem)));
});

test('a long, varied password passes', () => {
  assert.deepEqual(checkAdminPassword(newPassword, 'jeffrey@example.com'), []);
});

// ---- Updating the database ----

test('sets a new password for an admin, hashed like registration (the old one stops working)', async () => {
  await createAccount(adminEmail, 'admin');

  const result = await setAdminPassword(`  ${adminEmail.toUpperCase()}  `, newPassword);

  assert.equal(result.email, adminEmail);
  assert.equal((await loginUser({ email: adminEmail, password: newPassword })).user.role, 'admin');
  await assert.rejects(loginUser({ email: adminEmail, password: oldPassword }), { status: 401 });
});

test('refuses non-admin accounts and unknown emails without changing anything', async () => {
  await createAccount(userEmail, 'user');

  await assert.rejects(setAdminPassword(userEmail, newPassword), /not an admin/);
  await loginUser({ email: userEmail, password: oldPassword }); // unchanged

  await assert.rejects(setAdminPassword(`test+nobody-${runId}@example.com`, newPassword), /No account/);
});

// ---- Running the script ----

test('the script refuses to run without an interactive terminal and ignores command-line arguments', () => {
  const script = path.join(__dirname, '..', 'scripts', 'set-admin-password.js');
  const run = spawnSync(process.execPath, [script, adminEmail, 'Some-Password-From-Args-1'], {
    input: '', // stdin is a pipe, not a TTY
    env: process.env,
    encoding: 'utf8',
  });

  assert.equal(run.status, 1);
  assert.match(run.stderr, /interactive terminal/);
  assert.doesNotMatch(run.stdout + run.stderr, /Some-Password-From-Args-1/);
});
