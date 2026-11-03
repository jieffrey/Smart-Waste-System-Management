// Unit tests for the validate middleware (body and query).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const validate = require('../src/middlewares/validate');

const bodySchema = z.object({ name: z.string().trim().min(1, 'Name is required') });
const querySchema = z.object({ page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1) });

function run(middleware, req) {
  let nextCalled = false;
  middleware(req, {}, () => {
    nextCalled = true;
  });
  return nextCalled;
}

test('body: valid input replaces req.body with the parsed data', () => {
  const req = { body: { name: '  Ana  ', extra: 'dropped' } };

  assert.equal(run(validate(bodySchema), req), true);
  assert.deepEqual(req.body, { name: 'Ana' });
});

test('body: invalid input throws 400 with field details', () => {
  assert.throws(() => run(validate(bodySchema), { body: { name: ' ' } }), {
    status: 400,
    message: 'Validation failed',
    details: [{ field: 'name', message: 'Name is required' }],
  });
});

test('query: valid input is stored in req.validatedQuery and req.query is left untouched', () => {
  const query = { page: '3' };
  const req = { query };

  assert.equal(run(validate(querySchema, 'query'), req), true);
  assert.deepEqual(req.validatedQuery, { page: 3 });
  assert.equal(req.query, query);
});

test('query: defaults are applied when the parameter is missing', () => {
  const req = { query: {} };

  run(validate(querySchema, 'query'), req);
  assert.deepEqual(req.validatedQuery, { page: 1 });
});

test('query: invalid input throws 400 with field details', () => {
  assert.throws(() => run(validate(querySchema, 'query'), { query: { page: '0' } }), {
    status: 400,
    message: 'Validation failed',
    details: [{ field: 'page', message: 'Page must be at least 1' }],
  });
});
