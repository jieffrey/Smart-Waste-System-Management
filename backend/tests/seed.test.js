// Tests for scripts/seed.js against the real database.
// The real demo accounts are never written: every database test passes its own temporary accounts to seed().

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, query } = require('../src/db/pool');
const { loginUser } = require('../src/modules/auth/auth.service');
const { registerSchema } = require('../src/modules/auth/auth.schema');
const { seed, withEnvOverrides, DEMO_ACCOUNTS } = require('../scripts/seed');

const runId = Date.now();
const adminEmail = `test+seed-admin-${runId}@example.com`;
const userEmail = `test+seed-user-${runId}@example.com`;
const unusedEmail = `test+seed-unused-${runId}@example.com`;
const adminPassword = 'seed-admin-password';
const userPassword = 'seed-user-password';

function testAccounts({ userPasswordOverride } = {}) {
  return [
    { role: 'admin', full_name: 'Seed Admin', email: adminEmail, password: adminPassword },
    { role: 'user', full_name: 'Seed User', email: userEmail, password: userPasswordOverride ?? userPassword },
  ];
}

async function findUser(email) {
  const { rows } = await query('SELECT role, is_active FROM users WHERE LOWER(email) = $1', [email]);
  return rows;
}

after(async () => {
  await query('DELETE FROM users WHERE email = ANY($1::text[])', [[adminEmail, userEmail, unusedEmail]]);
  await pool.end();
});

// ---- Demo account definitions (no database) ----

test('the demo accounts pass the registration rules', () => {
  assert.deepEqual(
    DEMO_ACCOUNTS.map((account) => account.role),
    ['admin', 'user']
  );
  for (const { full_name, email, password } of DEMO_ACCOUNTS) {
    assert.equal(registerSchema.safeParse({ full_name, email, password }).success, true, email);
  }
});

test('non-empty SEED_* values override the matching demo value; empty or missing ones do not', (t) => {
  const saved = { ...process.env };
  t.after(() => {
    for (const key of ['SEED_USER_NAME', 'SEED_USER_EMAIL', 'SEED_USER_PASSWORD']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  process.env.SEED_USER_EMAIL = 'override@example.com';
  process.env.SEED_USER_PASSWORD = '';
  delete process.env.SEED_USER_NAME;

  const [, demoUser] = DEMO_ACCOUNTS;
  const account = withEnvOverrides(demoUser);

  assert.equal(account.email, 'override@example.com');
  assert.equal(account.password, demoUser.password); // empty value is ignored
  assert.equal(account.full_name, demoUser.full_name); // missing value is ignored
  assert.equal(account.role, 'user');
});

// ---- seed() with temporary accounts ----

test('the first run creates the admin and the user with hashed passwords', async () => {
  const results = await seed(testAccounts());

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
  const results = await seed(testAccounts({ userPasswordOverride: 'a-different-password' }));

  assert.deepEqual(
    results.map(({ result }) => result),
    ['already exists (password unchanged)', 'already exists (password unchanged)']
  );
  assert.equal((await findUser(adminEmail)).length, 1);
  assert.equal((await findUser(userEmail)).length, 1);

  // The original password still works; the new value was ignored.
  await loginUser({ email: userEmail, password: userPassword });
  await assert.rejects(loginUser({ email: userEmail, password: 'a-different-password' }), { status: 401 });
});

test('an existing account gets its role and active status corrected', async () => {
  await query("UPDATE users SET role = 'user', is_active = FALSE WHERE email = $1", [adminEmail]);

  await seed(testAccounts());

  assert.deepEqual(await findUser(adminEmail), [{ role: 'admin', is_active: true }]);
});

test('invalid accounts fail before anything is written, listing every problem without the values', async () => {
  const accounts = [
    { role: 'admin', full_name: '', email: 'not-an-email', password: adminPassword },
    { role: 'user', full_name: 'Seed Unused', email: unusedEmail, password: 'short7!' },
  ];

  await assert.rejects(seed(accounts), (err) => {
    assert.match(err.message, /^Invalid seed accounts:/);
    assert.match(err.message, /admin full_name: Full name must be at least 2 characters/);
    assert.match(err.message, /admin email: Email is invalid/);
    assert.match(err.message, /user password: Password must be at least 8 characters/);
    assert.doesNotMatch(err.message, /short7!/);
    return true;
  });

  // Nothing was written for the valid fields either.
  assert.deepEqual(await findUser(unusedEmail), []);
});
