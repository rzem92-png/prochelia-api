import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function verifyStripeWebhookSignature');
const end = source.indexOf('\nasync function verifyWebhookSignature', start);
assert.notEqual(start, -1, 'Stripe signature verifier must exist');
assert.notEqual(end, -1, 'generic verifier must follow Stripe verifier');
const stripe = source.slice(start, end);
const genericStart = end;
const genericEnd = source.indexOf('\nasync function paymentWebhook', genericStart);
const dispatch = source.slice(genericStart, genericEnd);

test('Stripe webhook uses Stripe-Signature t/v1 format and timestamped raw-body HMAC', () => {
  assert.match(stripe, /stripe-signature/);
  assert.match(stripe, /key==='t'/);
  assert.match(stripe, /key==='v1'/);
  assert.match(stripe, /\$\{timestamp\}\.\$\{rawBody\}/);
});

test('Stripe signatures reject stale timestamps and use constant-time comparison', () => {
  assert.match(stripe, /Math\.abs\(Math\.floor\(Date\.now\(\)\/1000\)-timestamp\)>300/);
  assert.match(stripe, /constantTimeStringEqual/);
});

test('configured Stripe provider cannot fall back to generic webhook signature format', () => {
  assert.match(dispatch, /provider==='stripe'\) return verifyStripeWebhookSignature/);
});
