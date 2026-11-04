// SEC-05: a login for an unknown email must do the same work (one bcrypt comparison) as a login for an
// existing email, so the response time doesn't reveal which emails are registered.
// Counting comparisons is deterministic; measuring milliseconds in a test would be flaky.

const { test, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../src/db/pool');
const { registerUser, loginUser } = require('../src/modules/auth/auth.service');

const email = `test+timing-${Date.now()}@example.com`;
const originalCompare = bcrypt.compare;

function countCompares() {
  const calls = { count: 0 };
  bcrypt.compare = (...args) => {
    calls.count += 1;
    return originalCompare(...args);
  };
  return calls;
}

afterEach(() => {
  bcrypt.compare = originalCompare;
});

after(async () => {
  await query('DELETE FROM users WHERE email = $1', [email]);
  await pool.end();
});

test('unknown email and wrong password both run exactly one bcrypt comparison and fail the same way', async () => {
  await registerUser({ full_name: 'Timing Test', email, password: 'correct-horse-battery' });

  const unknown = countCompares();
  const unknownError = await loginUser({ email: `test+nobody-${Date.now()}@example.com`, password: 'x' }).catch((e) => e);
  assert.equal(unknown.count, 1);

  const existing = countCompares();
  const existingError = await loginUser({ email, password: 'wrong-password' }).catch((e) => e);
  assert.equal(existing.count, 1);

  assert.equal(unknownError.status, 401);
  assert.equal(existingError.status, 401);
  assert.equal(unknownError.message, existingError.message);
});
