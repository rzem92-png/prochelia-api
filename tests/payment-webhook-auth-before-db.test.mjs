import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function paymentWebhook');
const end = source.indexOf('\nasync function ', start + 10);
assert.notEqual(start, -1, 'paymentWebhook must exist');
assert.notEqual(end, -1, 'paymentWebhook must have a following function');
const webhook = source.slice(start, end);

test('payment webhook verifies raw-body signature before any D1 schema initialization', () => {
  const signatureCheck = webhook.indexOf('verifyWebhookSignature(request,env,raw)');
  const schemaSetup = webhook.indexOf('ensurePaymentSchema(env)');
  assert.notEqual(signatureCheck, -1, 'signature verification must exist');
  assert.notEqual(schemaSetup, -1, 'payment schema setup must exist');
  assert.ok(signatureCheck < schemaSetup, 'signature verification must precede D1/schema side effects');
});

test('invalid webhook signature is rejected before JSON parsing and persistence', () => {
  const signatureCheck = webhook.indexOf('verifyWebhookSignature(request,env,raw)');
  const jsonParse = webhook.indexOf('JSON.parse(raw)');
  const schemaSetup = webhook.indexOf('ensurePaymentSchema(env)');
  assert.ok(signatureCheck < jsonParse);
  assert.ok(signatureCheck < schemaSetup);
});
