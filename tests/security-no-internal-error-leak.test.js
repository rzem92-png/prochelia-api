import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('master complement errors do not disclose internal exception messages', async () => {
  const response = await worker.fetch(
    new Request('https://preprod.example.test/api/brand/identity'),
    {}
  );

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error, 'INTERNAL_ERROR');
  assert.equal(Object.hasOwn(body, 'message'), false);
  assert.equal(JSON.stringify(body).includes('DATABASE_REQUIRED'), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
