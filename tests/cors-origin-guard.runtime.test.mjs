import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const allowedOrigin = 'https://prochelia.pages.dev';
const deniedOrigin = 'https://evil.example';

test('runtime CORS preflight allows only configured origin and allowed headers/methods', async () => {
  const allowed = await worker.fetch(new Request('https://api.example/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      origin: allowedOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-csrf-token'
    }
  }), {});

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  assert.match(allowed.headers.get('vary') || '', /Origin/i);

  const denied = await worker.fetch(new Request('https://api.example/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      origin: deniedOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  }), {});

  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error, 'ORIGIN_NOT_ALLOWED');
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('runtime preflight rejects unapproved methods and headers', async () => {
  for (const [method, headers] of [
    ['TRACE', 'content-type'],
    ['POST', 'content-type,x-custom-dangerous']
  ]) {
    const response = await worker.fetch(new Request('https://api.example/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': method,
        'access-control-request-headers': headers
      }
    }), {});
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'CORS_PREFLIGHT_REJECTED');
  }
});

test('runtime rejects untrusted mutation Origin before DB access', async () => {
  const response = await worker.fetch(new Request('https://api.example/api/auth/login', {
    method: 'POST',
    headers: { origin: deniedOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'x@example.com', password: 'some-long-password' })
  }), {});

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'ORIGIN_NOT_ALLOWED');
});

test('runtime never reflects an arbitrary Origin on simple requests', async () => {
  const response = await worker.fetch(new Request('https://api.example/api/health', {
    method: 'GET',
    headers: { origin: deniedOrigin }
  }), {});

  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
