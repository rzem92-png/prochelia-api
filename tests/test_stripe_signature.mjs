import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature } from '../stripe-adapter.js';

const secret = 'whsec_test_secret';
const body = JSON.stringify({ id: 'evt_test_123', type: 'payment_intent.succeeded' });
const now = 1_800_000_000;
const sign = (timestamp, payload = body) => createHmac('sha256', secret).update(String(timestamp) + '.' + payload).digest('hex');

const good = sign(now);
assert.equal(await verifyStripeSignature(body, 't=' + now + ',v1=' + good, secret, now), true, 'valid signature accepted');
assert.equal(await verifyStripeSignature(body + ' ', 't=' + now + ',v1=' + good, secret, now), false, 'modified raw body rejected');
assert.equal(await verifyStripeSignature(body, 't=' + (now - 301) + ',v1=' + sign(now - 301), secret, now), false, 'stale signature rejected');
assert.equal(await verifyStripeSignature(body, 't=' + (now + 301) + ',v1=' + sign(now + 301), secret, now), false, 'future signature outside tolerance rejected');
assert.equal(await verifyStripeSignature(body, 't=' + now + ',t=' + now + ',v1=' + good, secret, now), false, 'duplicate timestamp rejected');
assert.equal(await verifyStripeSignature(body, 't=' + now + ',v1=not-a-signature', secret, now), false, 'malformed signature rejected');
assert.equal(await verifyStripeSignature(body, 't=' + now + ',v1=' + '0'.repeat(64) + ',v1=' + good, secret, now), true, 'multiple v1 signatures allow a valid candidate');
assert.equal(await verifyStripeSignature(body, 't=' + now + ',v1=' + good, '', now), false, 'missing secret rejected');

console.log('Stripe webhook signature regression tests passed (8 assertions)');
