// STORAGE_DRIVER validation in src/config/env.js. Each case loads the config in a fresh Node process.

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

function loadConfig(extraEnv) {
  const script = "const c = require('./src/config/env'); console.log(JSON.stringify([c.storageDriver, c.cloudinaryFolder]))";
  return spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { ...BASE_ENV, ...extraEnv },
    encoding: 'utf8',
  });
}

test('defaults to local storage', () => {
  const res = loadConfig({});

  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(JSON.parse(res.stdout), ['local', 'swms']);
});

test('accepts cloudinary with CLOUDINARY_URL and trims slashes from the folder', () => {
  const res = loadConfig({ STORAGE_DRIVER: 'cloudinary', CLOUDINARY_URL: 'cloudinary://k:s@c', CLOUDINARY_FOLDER: '/swms/prod/' });

  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(JSON.parse(res.stdout), ['cloudinary', 'swms/prod']);
});

test('refuses cloudinary without CLOUDINARY_URL', () => {
  const res = loadConfig({ STORAGE_DRIVER: 'cloudinary' });

  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /CLOUDINARY_URL must be set/);
});

test('refuses an unknown driver', () => {
  const res = loadConfig({ STORAGE_DRIVER: 's3' });

  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /STORAGE_DRIVER must be one of: local, cloudinary/);
});
