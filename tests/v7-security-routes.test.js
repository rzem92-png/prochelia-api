import test from 'node:test';
import assert from 'node:assert/strict';
import { handleV7Route } from '../src/v7-routes.js';

const env = {};
const req = (path, body = {}) => new Request('https://preprod.example.test' + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body)
});

test('V7 audit endpoint rejects client-supplied audit records', async () => {
  const response = await handleV7Route(req('/api/v7/security/audit', {
    actorId: 'admin', actorRole: 'gerante', action: 'PAYMENT_REFUNDED',
    detail: { amount: 999999 }
  }), env, '/api/v7/security/audit');
  assert.equal(response.status, 403);
  const data = await response.json();
  assert.equal(data.error, 'AUDIT_ENDPOINT_DISABLED');
});

test('V7 idempotency endpoint does not falsely claim replay protection', async () => {
  const response = await handleV7Route(req('/api/v7/security/idempotency', {
    idempotencyKey: 'client-controlled-key'
  }), env, '/api/v7/security/idempotency');
  assert.equal(response.status, 501);
  const data = await response.json();
  assert.equal(data.error, 'IDEMPOTENCY_NOT_ENFORCED');
});

test('V7 audit and idempotency disabled responses are non-cacheable', async () => {
  for (const path of ['/api/v7/security/audit', '/api/v7/security/idempotency']) {
    const response = await handleV7Route(req(path), env, path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});


test('V7 permissions endpoint never trusts caller-supplied admin role', async () => {
  const response = await handleV7Route(req('/api/v7/check/permissions', {
    role: 'GERANTE', permission: 'payments.refund', permissions: { 'payments.refund': true }
  }), env, '/api/v7/check/permissions');
  assert.equal(response.status, 403);
  const data = await response.json();
  assert.equal(data.error, 'AUTHORIZATION_CONTEXT_REQUIRED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});


test('V7 malformed JSON returns a safe 400 without parser details', async () => {
  const response = await handleV7Route(new Request('https://preprod.example.test/api/v7/check/email', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{'
  }), env, '/api/v7/check/email');
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error, 'INVALID_JSON');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(Object.hasOwn(data, 'message'), false);
});


test('V7 rejects oversized payloads before JSON parsing', async () => {
  const body = JSON.stringify({ email: 'a'.repeat(40 * 1024) });
  const response = await handleV7Route(new Request('https://preprod.example.test/api/v7/check/email', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body
  }), env, '/api/v7/check/email');
  assert.equal(response.status, 413);
  const data = await response.json();
  assert.equal(data.error, 'PAYLOAD_TOO_LARGE');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});


test('V7 rejects POST requests with non-JSON content type', async () => {
  const response = await handleV7Route(new Request('https://preprod.example.test/api/v7/check/email', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'not json'
  }), env, '/api/v7/check/email');
  assert.equal(response.status, 415);
  const data = await response.json();
  assert.equal(data.error, 'JSON_CONTENT_TYPE_REQUIRED');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
