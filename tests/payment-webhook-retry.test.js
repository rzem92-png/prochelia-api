import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function paymentWebhook');
const end = source.indexOf('async function openPaymentDispute', start);
const webhook = source.slice(start, end);

test('webhook retries prior events only when they remain unprocessed', () => {
  assert.match(webhook, /SELECT payload_hash,event_type,processed FROM payment_webhook_events/);
  assert.match(webhook, /prior\?\.processed===1 \|\| prior\?\.processed===true/);
  assert.match(webhook, /WEBHOOK_EVENT_STATE_UNAVAILABLE/);
});

test('webhook event payload mismatch is rejected, not treated as retry', () => {
  assert.match(webhook, /prior\.payload_hash!==payloadHash \|\| prior\.event_type!==type/);
  assert.match(webhook, /WEBHOOK_EVENT_ID_CONFLICT/);
});
