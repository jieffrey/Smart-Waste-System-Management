// ML_API_TIMEOUT_MS validation in src/config/env.js. Each case loads the config in a fresh Node process.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const BASE_ENV = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot, // needed by Node on Windows
  DATABASE_URL: 'postgresql://user:pass@localhost/db',
  JWT_SECRET: 'x'.repeat(40),
};

function loadTimeout(value) {
  const env = { ...BASE_ENV };
  if (value !== undefined) {
    env.ML_API_TIMEOUT_MS = value;
  }
  return spawnSync(process.execPath, ['-e', "console.log(require('./src/config/env').mlApiTimeoutMs)"], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
}

for (const [value, expected] of [
  [undefined, 30000],
  ['', 30000],
  ['200', 200],
  ['40000', 40000],
]) {
  test(`ML_API_TIMEOUT_MS=${JSON.stringify(value)} gives ${expected} ms`, () => {
    const res = loadTimeout(value);

    assert.equal(res.status, 0, res.stderr);
    assert.equal(Number(res.stdout.trim()), expected);
  });
}

for (const value of ['40001', '90000', '50', '0', '-1', '1.5', 'abc']) {
  test(`ML_API_TIMEOUT_MS=${value} is refused (must stay below the mobile app's 45 s)`, () => {
    const res = loadTimeout(value);

    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /ML_API_TIMEOUT_MS must be a whole number from 100 to 40000/);
  });
}
