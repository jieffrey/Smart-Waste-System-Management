// Unit tests for the ML API client, using a fake ML API (no real ML server needed).

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startFakeMlApi, DEFAULT_PREDICTION, RAW_ML_ERROR_TEXT } = require('./helpers/fake-ml-api');

const UNAVAILABLE = {
  status: 503,
  message: 'AI service unavailable, please try again later',
  details: null,
};
const IMAGE_REJECTED_MESSAGE = "The photo couldn't be processed. Try another photo.";
const IMAGE_REJECTED = {
  status: 422,
  message: IMAGE_REJECTED_MESSAGE,
  details: [{ field: 'image', message: IMAGE_REJECTED_MESSAGE }],
};
const image = Buffer.from('fake image bytes');

let fakeMl;
let classifyImage;

before(async () => {
  fakeMl = await startFakeMlApi();

  // The config is read when the module is first loaded, so set the env before requiring it.
  process.env.ML_API_URL = fakeMl.url;
  process.env.ML_API_KEY = 'test-api-key';
  process.env.ML_API_TIMEOUT_MS = '200';
  ({ classifyImage } = require('../src/modules/ml/ml.service'));
});

beforeEach(() => {
  fakeMl.state.mode = 'success';
  fakeMl.state.requests = [];
});

test('returns the prediction and sends the image as multipart field "file" with the API key', async () => {
  const result = await classifyImage(image, 'image/jpeg');

  assert.deepEqual(result, {
    category: DEFAULT_PREDICTION.category,
    confidence: DEFAULT_PREDICTION.confidence,
    modelVersion: DEFAULT_PREDICTION.model_version,
  });

  const [request] = fakeMl.state.requests;
  assert.equal(request.method, 'POST');
  assert.equal(request.url, '/predict');
  assert.match(request.headers['content-type'], /^multipart\/form-data/);
  assert.match(request.body.toString(), /name="file"/);
  assert.equal(request.headers['x-api-key'], 'test-api-key');
});

test('throws 503 when the ML API returns an error status', async (t) => {
  t.mock.method(console, 'error', () => {});
  fakeMl.state.mode = 'error';

  await assert.rejects(classifyImage(image, 'image/jpeg'), UNAVAILABLE);
});

for (const status of [400, 413, 415]) {
  test(`throws 422 on the image field when the ML API rejects the image with ${status}`, async (t) => {
    t.mock.method(console, 'warn', () => {});
    fakeMl.state.mode = 'status';
    fakeMl.state.status = status;

    await assert.rejects(classifyImage(image, 'image/jpeg'), (err) => {
      assert.equal(err.status, IMAGE_REJECTED.status);
      assert.equal(err.message, IMAGE_REJECTED.message);
      assert.deepEqual(err.details, IMAGE_REJECTED.details);
      assert.doesNotMatch(JSON.stringify(err.details) + err.message, new RegExp(RAW_ML_ERROR_TEXT.slice(0, 20)));
      return true;
    });
  });
}

for (const status of [401, 404, 500, 502, 503]) {
  test(`throws 503 (not an image error) when the ML API answers ${status}`, async (t) => {
    t.mock.method(console, 'error', () => {});
    fakeMl.state.mode = 'status';
    fakeMl.state.status = status;

    await assert.rejects(classifyImage(image, 'image/jpeg'), UNAVAILABLE);
  });
}

test('throws 503 when the ML API returns an invalid prediction', async (t) => {
  t.mock.method(console, 'error', () => {});
  fakeMl.state.mode = 'invalid';

  await assert.rejects(classifyImage(image, 'image/jpeg'), UNAVAILABLE);
});

test('throws 503 when the ML API times out', async (t) => {
  t.mock.method(console, 'error', () => {});
  fakeMl.state.mode = 'slow'; // answers after 1000 ms; the client gives up after 200 ms

  await assert.rejects(classifyImage(image, 'image/jpeg'), UNAVAILABLE);
});

// Keep this test last: it shuts the fake ML API down.
test('throws 503 when the ML API is down', async (t) => {
  const errorLog = t.mock.method(console, 'error', () => {});
  await fakeMl.close();

  await assert.rejects(classifyImage(image, 'image/jpeg'), UNAVAILABLE);
  assert.equal(errorLog.mock.callCount(), 1);
});
