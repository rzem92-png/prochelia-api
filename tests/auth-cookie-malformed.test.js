import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

function fakeD1() {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { success: true }; }
      };
    }
  };
}

test('malformed percent-encoded session cookie is treated as unauthenticated, not a server error', async () => {
  const request = new Request('https://preprod.example.test/api/auth/me', {
    headers: { cookie: 'prochelia_session=%ZZ' }
  });
  const response = await worker.fetch(request, { DB: fakeD1() });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.authenticated, false);
  assert.equal(body.error, 'UNAUTHENTICATED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('malformed percent-encoded unrelated cookie does not crash authentication', async () => {
  const request = new Request('https://preprod.example.test/api/auth/me', {
    headers: { cookie: 'other=%E0%A4%A; prochelia_session=valid-but-unknown-token' }
  });
  const response = await worker.fetch(request, { DB: fakeD1() });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'UNAUTHENTICATED');
});
