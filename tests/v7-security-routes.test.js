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


test('all V7 responses receive baseline security headers', async () => {
  const response = await handleV7Route(new Request('https://preprod.example.test/api/v7/status'), env, '/api/v7/status');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
});


test('V7 security headers are also present on rejected/error responses', async () => {
  const cases = [
    ['/api/v7/security/audit', 403],
    ['/api/v7/security/idempotency', 501],
    ['/api/v7/check/permissions', 403]
  ];
  for (const [path, expectedStatus] of cases) {
    const response = await handleV7Route(req(path), env, path);
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('permissions-policy'), 'geolocation=(self),camera=(),microphone=()');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  }
});

test('V7 non-HTTPS responses do not emit HSTS', async () => {
  const response = await handleV7Route(new Request('http://preprod.example.test/api/v7/status'), env, '/api/v7/status');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('strict-transport-security'), null);
});


test('V7 finance calculator rejects negative amounts and out-of-range commission', async () => {
  const cases = [
    [{ clientAmount: -1 }, 'FINANCE_NEGATIVE_AMOUNT'],
    [{ paymentFees: -0.01 }, 'FINANCE_NEGATIVE_AMOUNT'],
    [{ commissionRate: 100.01 }, 'COMMISSION_RATE_OUT_OF_RANGE'],
    [{ commissionRate: -0.01 }, 'COMMISSION_RATE_OUT_OF_RANGE'],
    [{ clientAmount: 'NaN' }, 'FINANCE_INPUT_INVALID_TYPE']
  ];
  for (const [payload, error] of cases) {
    const response = await handleV7Route(req('/api/v7/finance/calculate', payload), env, '/api/v7/finance/calculate');
    assert.equal(response.status, 400, 'invalid financial input returns a client error');
    const data = await response.json();
    assert.equal(data.ok, false);
    assert.equal(data.error, error);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('V7 finance calculator rounds valid monetary outputs to cents', async () => {
  const response = await handleV7Route(req('/api/v7/finance/calculate', {
    clientAmount: 100.01, commissionRate: 10, paymentFees: 1.01, otherFees: 0.50
  }), env, '/api/v7/finance/calculate');
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.commissionAmount, 10);
  assert.equal(data.intervenantAmount, 90.01);
  assert.equal(data.grossMargin, 8.49);
});


test('V7 finance calculator rejects arithmetic overflow from finite inputs', async () => {
  const response = await handleV7Route(req('/api/v7/finance/calculate', {
    clientAmount: 1, commissionRate: 1, paymentFees: Number.MAX_VALUE, otherFees: Number.MAX_VALUE
  }), env, '/api/v7/finance/calculate');
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'FINANCE_RESULT_OVERFLOW');
});


test('V7 finance calculator requires client amount and rejects coercible string inputs', async () => {
  const cases = [
    [{}, 'FINANCE_CLIENT_AMOUNT_REQUIRED'],
    [{ clientAmount: '25.00' }, 'FINANCE_INPUT_INVALID_TYPE'],
    [{ clientAmount: 25, paymentFees: '1.2' }, 'FINANCE_INPUT_INVALID_TYPE']
  ];
  for (const [payload, error] of cases) {
    const response = await handleV7Route(req('/api/v7/finance/calculate', payload), env, '/api/v7/finance/calculate');
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.ok, false);
    assert.equal(data.error, error);
  }
});
