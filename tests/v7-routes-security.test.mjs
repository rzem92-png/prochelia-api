import test from 'node:test';
import assert from 'node:assert/strict';
import { handleV7Route } from '../src/v7-routes.js';

const protectedPostRoutes = [
  '/api/v7/check/email',
  '/api/v7/check/account',
  '/api/v7/check/permissions',
  '/api/v7/check/intervenant',
  '/api/v7/check/document',
  '/api/v7/check/expiration',
  '/api/v7/check/transport',
  '/api/v7/check/mission',
  '/api/v7/check/mission-transition',
  '/api/v7/check/availability',
  '/api/v7/check/conflict',
  '/api/v7/check/pricing',
  '/api/v7/check/qr',
  '/api/v7/check/payment',
  '/api/v7/finance/calculate',
  '/api/v7/check/pre-mission',
  '/api/v7/security/idempotency',
  '/api/v7/security/audit',
  '/api/v7/strategy/indicators'
];

test('all V7 POST endpoints fail closed before parsing attacker-controlled bodies', async () => {
  for (const path of protectedPostRoutes) {
    const request = new Request('https://api.example.test' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json'
    });
    const response = await handleV7Route(request, {}, path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('cache-control'), 'no-store', path);
    const body = await response.json();
    assert.equal(body.ok, false, path);
    assert.equal(body.error, 'V7_HTTP_ENDPOINTS_DISABLED_PENDING_AUTHORIZATION', path);
  }
});

test('V7 status remains a read-only public endpoint', async () => {
  const response = await handleV7Route(
    new Request('https://api.example.test/api/v7/status', { method: 'GET' }),
    {},
    '/api/v7/status'
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.module, 'PROCHÉLIA V7');
});

test('unknown V7 GET route remains unhandled', async () => {
  const response = await handleV7Route(
    new Request('https://api.example.test/api/v7/not-a-route', { method: 'GET' }),
    {},
    '/api/v7/not-a-route'
  );
  assert.equal(response, null);
});
