// Creates a demo admin and a demo user from the SEED_* environment variables (see .env.example).
// Safe to run many times: an existing account is never duplicated and its password is never changed;
// only its role and active status are made correct.
//
// Run from backend/:  npm run seed

const { pool, query } = require('../src/db/pool');
const { hashPassword } = require('../src/modules/auth/auth.service');
const { registerSchema } = require('../src/modules/auth/auth.schema');

const FIELD_TO_ENV_SUFFIX = { full_name: 'NAME', email: 'EMAIL', password: 'PASSWORD' };

// Reads and validates one account, e.g. SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
// Uses the same rules as registration. Problems name the variable but never show its value.
function readAccount(prefix, role) {
  const result = registerSchema.safeParse({
    full_name: process.env[`${prefix}_NAME`],
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${prefix}_${FIELD_TO_ENV_SUFFIX[issue.path[0]]}: ${issue.message}`
    );
    return { account: null, problems };
  }

  return { account: { ...result.data, role }, problems: [] };
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

async function seed() {
  // Validate both accounts before writing anything, and report every problem at once.
  const admin = readAccount('SEED_ADMIN', 'admin');
  const user = readAccount('SEED_USER', 'user');
  const problems = [...admin.problems, ...user.problems];
  if (problems.length > 0) {
    throw new Error(`Invalid seed settings:\n  ${problems.join('\n  ')}`);
  }

  const results = [];
  for (const account of [admin.account, user.account]) {
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

module.exports = { seed };
