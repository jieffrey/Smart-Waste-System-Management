// Tests for scripts/seed.js against the real database.
// All six SEED_* variables are set here to temporary test accounts, so the real values in .env are never used.

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, query } = require('../src/db/pool');
const { loginUser } = require('../src/modules/auth/auth.service');
const { seed } = require('../scripts/seed');

const runId = Date.now();
const adminEmail = `test+seed-admin-${runId}@example.com`;
const userEmail = `test+seed-user-${runId}@example.com`;
const unusedEmail = `test+seed-unused-${runId}@example.com`;
const adminPassword = 'seed-admin-password';
const userPassword = 'seed-user-password';

function setSeedEnv(overrides = {}) {
  Object.assign(process.env, {
    SEED_ADMIN_NAME: 'Seed Admin',
    SEED_ADMIN_EMAIL: adminEmail,
    SEED_ADMIN_PASSWORD: adminPassword,
    SEED_USER_NAME: 'Seed User',
    SEED_USER_EMAIL: userEmail,
    SEED_USER_PASSWORD: userPassword,
    ...overrides,
  });
}

async function findUser(email) {
  const { rows } = await query('SELECT role, is_active FROM users WHERE LOWER(email) = $1', [email]);
  return rows;
}

beforeEach(() => setSeedEnv());

after(async () => {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[adminEmail, userEmail, unusedEmail]]);
  await pool.end();
});

test('the first run creates the admin and the user with hashed passwords', async () => {
  const results = await seed();

  assert.deepEqual(results, [
    { role: 'admin', email: adminEmail, result: 'created' },
    { role: 'user', email: userEmail, result: 'created' },
  ]);
  assert.deepEqual(await findUser(adminEmail), [{ role: 'admin', is_active: true }]);
  assert.deepEqual(await findUser(userEmail), [{ role: 'user', is_active: true }]);

  // The passwords work for login (so they were hashed the same way as registration).
  assert.equal((await loginUser({ email: adminEmail, password: adminPassword })).user.role, 'admin');
  assert.equal((await loginUser({ email: userEmail, password: userPassword })).user.role, 'user');
});

test('running again creates no duplicates and never changes an existing password', async () => {
  setSeedEnv({ SEED_USER_PASSWORD: 'a-different-password' });

  const results = await seed();

  assert.deepEqual(
    results.map(({ result }) => result),
    ['already exists (password unchanged)', 'already exists (password unchanged)']
  );
  assert.equal((await findUser(adminEmail)).length, 1);
  assert.equal((await findUser(userEmail)).length, 1);

  // The original password still works; the new value from the env was ignored.
  await loginUser({ email: userEmail, password: userPassword });
  await assert.rejects(loginUser({ email: userEmail, password: 'a-different-password' }), { status: 401 });
});

test('an existing account gets its role and active status corrected', async () => {
  await query("UPDATE users SET role = 'user', is_active = FALSE WHERE email = $1", [adminEmail]);

  await seed();

  assert.deepEqual(await findUser(adminEmail), [{ role: 'admin', is_active: true }]);
});

test('invalid or missing settings fail before anything is written, without showing secret values', async () => {
  setSeedEnv({ SEED_ADMIN_EMAIL: 'not-an-email', SEED_USER_EMAIL: unusedEmail, SEED_USER_PASSWORD: 'short7!' });
  delete process.env.SEED_ADMIN_NAME;

  await assert.rejects(seed(), (err) => {
    assert.match(err.message, /^Invalid seed settings:/);
    assert.match(err.message, /SEED_ADMIN_NAME: Full name is required/);
    assert.match(err.message, /SEED_ADMIN_EMAIL: Email is invalid/);
    assert.match(err.message, /SEED_USER_PASSWORD: Password must be at least 8 characters/);
    assert.doesNotMatch(err.message, /short7!/);
    return true;
  });

  // Nothing was written for the valid account either.
  assert.deepEqual(await findUser(unusedEmail), []);
});
