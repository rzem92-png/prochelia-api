import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function paymentWebhook');
const end = source.indexOf('async function openPaymentDispute', start);
const webhook = source.slice(start, end);

test('PSP webhook body is bounded before parsing', () => {
  assert.match(webhook, /declaredLength>65536/);
  assert.match(webhook, /total>65536/);
  assert.match(webhook, /WEBHOOK_PAYLOAD_TOO_LARGE/);
});

test('PSP webhook rejects provider mismatch and oversized event identifiers', () => {
  assert.match(webhook, /provider!==paymentProvider\(env\)/);
  assert.match(webhook, /eventId\.length>256/);
  assert.match(webhook, /type\.length>128/);
});

test('webhook event ID cannot be reused for a different signed payload', () => {
  assert.match(webhook, /prior\.payload_hash!==payloadHash/);
  assert.match(webhook, /WEBHOOK_EVENT_ID_CONFLICT/);
});


test('webhook HMAC comparison uses constant-time helper', () => {
  assert.match(source, /function constantTimeEqual\(a, b\)/);
  assert.match(source, /for\(let i=0;i<length;i\+\+\) diff\|=\(left\[i\]\|\|0\)\^\(right\[i\]\|\|0\)/);
  assert.match(source, /return constantTimeEqual\(supplied,expected\)/);
  assert.match(source, /signature\.length>256/);
});
