// Cloudinary storage driver with a stubbed uploader (no network, no Cloudinary account needed).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCloudinaryStorage, publicIdFromUrl } = require('../src/modules/uploads/storage.cloudinary');

const FOLDER = 'swms/test';
const UUID = '3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c';
const URL = `https://res.cloudinary.com/demo-cloud/image/upload/v1730800000/${FOLDER}/${UUID}.jpg`;

function stubUploader({ uploadError = null } = {}) {
  const calls = { uploads: [], destroys: [] };
  return {
    calls,
    upload_stream(options, callback) {
      return {
        end(buffer) {
          calls.uploads.push({ options, buffer });
          if (uploadError) {
            return callback(uploadError);
          }
          callback(null, { secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${options.public_id}.jpg` });
        },
      };
    },
    async destroy(publicId, options) {
      calls.destroys.push({ publicId, options });
      return { result: 'ok' };
    },
  };
}

test('saveImage uploads the buffer under <folder>/<uuid> and returns the https secure_url', async () => {
  const uploader = stubUploader();
  const storage = createCloudinaryStorage({ uploader, folder: FOLDER });
  const buffer = Buffer.from('image bytes');

  const url = await storage.saveImage(buffer, 'jpg');

  const [{ options, buffer: sent }] = uploader.calls.uploads;
  assert.equal(sent, buffer);
  assert.match(options.public_id, new RegExp(`^${FOLDER}/[0-9a-f-]{36}$`));
  assert.equal(options.asset_folder, FOLDER);
  assert.equal(options.overwrite, false);
  assert.equal(options.resource_type, 'image');
  assert.equal(options.type, 'upload');
  assert.equal(url, `https://res.cloudinary.com/demo-cloud/image/upload/v1/${options.public_id}.jpg`);
});

test('saveImage rejects when the upload fails', async () => {
  const storage = createCloudinaryStorage({ uploader: stubUploader({ uploadError: new Error('down') }), folder: FOLDER });

  await assert.rejects(storage.saveImage(Buffer.from('x'), 'jpg'), /down/);
});

test('deleteImage destroys the asset named in the stored URL', async () => {
  const uploader = stubUploader();
  const storage = createCloudinaryStorage({ uploader, folder: FOLDER });

  await storage.deleteImage(URL);

  assert.deepEqual(uploader.calls.destroys, [
    { publicId: `${FOLDER}/${UUID}`, options: { resource_type: 'image', invalidate: true } },
  ]);
});

test('deleteImage ignores URLs outside our folder or not from Cloudinary', async () => {
  const uploader = stubUploader();
  const storage = createCloudinaryStorage({ uploader, folder: FOLDER });

  for (const url of [
    `https://res.cloudinary.com/demo-cloud/image/upload/v1/other/${UUID}.jpg`,
    `https://res.cloudinary.com/demo-cloud/image/upload/v1/${FOLDER}/../secret.jpg`,
    `https://evil.example.com/demo-cloud/image/upload/v1/${FOLDER}/${UUID}.jpg`,
    `/uploads/${UUID}.jpg`,
    '',
    null,
  ]) {
    await storage.deleteImage(url);
  }

  assert.equal(uploader.calls.destroys.length, 0);
});

test('publicIdFromUrl works with and without a version segment', () => {
  assert.equal(publicIdFromUrl(URL, FOLDER), `${FOLDER}/${UUID}`);
  assert.equal(publicIdFromUrl(URL.replace('/v1730800000', ''), FOLDER), `${FOLDER}/${UUID}`);
  assert.equal(publicIdFromUrl(URL, 'swms'), null); // "test/<uuid>" is not a bare uuid
});
