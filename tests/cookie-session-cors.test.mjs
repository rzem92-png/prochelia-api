import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const allowedOrigin = 'https://prochelia.pages.dev';
const env = { CORS_ORIGIN: allowedOrigin };

test('CORS preflight allows only the configured origin and credentials', async () => {
  const response = await worker.fetch(new Request('https://api.example.test/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  assert.notEqual(response.headers.get('access-control-allow-origin'), '*');
});

test('CORS rejects an untrusted origin before routing', async () => {
  const response = await worker.fetch(new Request('https://api.example.test/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker.example',
      'Access-Control-Request-Method': 'POST'
    }
  }), env);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal((await response.json()).error, 'ORIGIN_NOT_ALLOWED');
});

test('mutating requests from an untrusted origin are rejected', async () => {
  const response = await worker.fetch(new Request('https://api.example.test/api/auth/logout', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json'
    },
    body: '{}'
  }), env);

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'ORIGIN_NOT_ALLOWED');
});

test('allowed-origin responses expose credentialed CORS headers without wildcard', async () => {
  const response = await worker.fetch(new Request('https://api.example.test/unknown-route', {
    method: 'GET',
    headers: { Origin: allowedOrigin }
  }), env);

  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.notEqual(response.headers.get('access-control-allow-origin'), '*');
});
