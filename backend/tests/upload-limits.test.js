// SEC-08: multipart text fields are limited in number and size (no database needed).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { uploadImage } = require('../src/middlewares/upload');
const { errorHandler } = require('../src/middlewares/error-handler');

const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // passes the magic-byte check
let server;
let url;

before(async () => {
  const app = express();
  app.post('/upload', uploadImage, (req, res) => res.json({ fields: Object.keys(req.body).length }));
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://localhost:${server.address().port}/upload`;
});

after(() => server.close());

async function upload(fields) {
  const form = new FormData();
  form.append('image', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'photo.jpg');
  for (const [name, value] of fields) {
    form.append(name, value);
  }
  const res = await fetch(url, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() };
}

test('a normal report form passes, even with a 1000-character multi-byte description', async () => {
  const res = await upload([
    ['description', '垃'.repeat(1000)], // 3 bytes per character in UTF-8
    ['latitude', '-6.2'],
    ['longitude', '106.8'],
    ['address', 'Jl. Contoh No. 1'],
  ]);

  assert.equal(res.status, 200);
  assert.equal(res.body.fields, 4);
});

test('more than 10 text fields is rejected with 400', async () => {
  const fields = Array.from({ length: 11 }, (_, i) => [`field${i}`, 'x']);
  const res = await upload(fields);

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: { message: 'Too many form fields', details: null } });
});

test('a text field over 8 KB is rejected with 400', async () => {
  const res = await upload([['description', 'x'.repeat(8 * 1024 + 1)]]);

  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: { message: 'A form field is too long', details: null } });
});
