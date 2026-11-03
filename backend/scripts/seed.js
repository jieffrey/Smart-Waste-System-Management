// Creates the demo admin and demo user below. Safe to run many times: an existing account is never
// duplicated and its password is never changed; only its role and active status are made correct.
//
// Run from backend/:  npm run seed
//
// WARNING: these are public demo credentials. Change the admin password (or override it with
// SEED_ADMIN_PASSWORD) before any public deployment.

const { pool, query } = require('../src/db/pool');
const { hashPassword } = require('../src/modules/auth/auth.service');
const { registerSchema } = require('../src/modules/auth/auth.schema');

const DEMO_ACCOUNTS = [
  {
    role: 'admin',
    envPrefix: 'SEED_ADMIN',
    full_name: 'Admin SWMS',
    email: 'dimoya4077@macsnipe.com',
    password: 'Admin123!',
  },
  {
    role: 'user',
    envPrefix: 'SEED_USER',
    full_name: 'Demo User',
    email: 'kaseg88634@macsnipe.com',
    password: 'Password123!',
  },
];

// Optional override for a deployed environment: a non-empty SEED_ADMIN_* / SEED_USER_* value
// (NAME, EMAIL, PASSWORD) replaces the matching default above.
function withEnvOverrides(account) {
  const prefix = account.envPrefix;
  return {
    ...account,
    full_name: process.env[`${prefix}_NAME`] || account.full_name,
    email: process.env[`${prefix}_EMAIL`] || account.email,
    password: process.env[`${prefix}_PASSWORD`] || account.password,
  };
}

// Checks one account with the same rules as registration. Problems never include the values.
function validateAccount(account) {
  const result = registerSchema.safeParse({
    full_name: account.full_name,
    email: account.email,
    password: account.password,
  });

  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${account.role} ${issue.path[0]}: ${issue.message}`);
    return { account: null, problems };
  }

  return { account: { ...result.data, role: account.role }, problems: [] };
}

async function seedAccount({ full_name, email, password, role }) {
  const { rows } = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);

  if (rows[0]) {
    await query('UPDATE users SET role = $2, is_active = TRUE WHERE id = $1', [rows[0].id, role]);
    return 'already exists (password unchanged)';
  }

  const passwordHash = await hashPassword(password);
  await query('INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
    full_name,
    email,
    passwordHash,
    role,
  ]);
  return 'created';
}

// `accounts` defaults to the demo accounts (with any SEED_* overrides). Tests pass their own accounts.
async function seed(accounts = DEMO_ACCOUNTS.map(withEnvOverrides)) {
  // Validate every account before writing anything, and report every problem at once.
  const checked = accounts.map(validateAccount);
  const problems = checked.flatMap((check) => check.problems);
  if (problems.length > 0) {
    throw new Error(`Invalid seed accounts:\n  ${problems.join('\n  ')}`);
  }

  const results = [];
  for (const { account } of checked) {
    results.push({ role: account.role, email: account.email, result: await seedAccount(account) });
  }
  return results;
}

if (require.main === module) {
  seed()
    .then((results) => {
      for (const { role, email, result } of results) {
        console.log(`${role.padEnd(5)} ${email}: ${result}`);
      }
    })
    .catch((err) => {
      console.error(`Seed failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { seed, withEnvOverrides, DEMO_ACCOUNTS };
