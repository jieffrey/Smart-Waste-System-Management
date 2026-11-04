// Unit tests for the central error handler: every error response is { error: { message, details } }.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler } = require('../src/middlewares/error-handler');
const HttpError = require('../src/utils/http-error');

// A minimal stand-in for Express's `res` that records the status and JSON body.
function fakeResponse() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

test('an HttpError without details returns details: null', () => {
  const res = fakeResponse();
  errorHandler(new HttpError(409, 'Email is already registered'), {}, res, () => {});

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: { message: 'Email is already registered', details: null } });
});

test('an HttpError with details returns them unchanged', () => {
  const details = [{ field: 'email', message: 'Email is invalid' }];
  const res = fakeResponse();
  errorHandler(new HttpError(400, 'Validation failed', details), {}, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: { message: 'Validation failed', details } });
});

test('a JSON body over the size limit returns 413, not 500 (SEC-14)', (t) => {
  const errorLog = t.mock.method(console, 'error', () => {});
  const res = fakeResponse();
  const tooLarge = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 });

  errorHandler(tooLarge, {}, res, () => {});

  assert.equal(res.statusCode, 413);
  assert.deepEqual(res.body, { error: { message: 'Request body is too large', details: null } });
  assert.equal(errorLog.mock.callCount(), 0); // not logged as an unexpected server error
});

test('an unexpected error returns 500 with details: null and no internal information', (t) => {
  t.mock.method(console, 'error', () => {});
  const res = fakeResponse();
  errorHandler(new Error('connection string leaked here'), {}, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: { message: 'Internal server error', details: null } });
});
