import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature, stripeCheckoutPayload } from '../src/stripe-adapter.js';

function signature(rawBody, secret, timestamp) {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

test('Stripe signature accepts the exact raw body within the tolerance window', async () => {
  const now = 1_800_000_000;
  const secret = 'whsec_test_secret';
  const body = '{"id":"evt_test","type":"checkout.session.completed"}';
  assert.equal(await verifyStripeSignature(body, signature(body, secret, now), secret, now), true);
});

test('Stripe signature rejects a modified body, invalid signature, and stale timestamp', async () => {
  const now = 1_800_000_000;
  const secret = 'whsec_test_secret';
  const body = '{"id":"evt_test","amount":100}';
  const valid = signature(body, secret, now);
  assert.equal(await verifyStripeSignature(body + ' ', valid, secret, now), false);
  assert.equal(await verifyStripeSignature(body, 't=' + now + ',v1=' + '0'.repeat(64), secret, now), false);
  assert.equal(await verifyStripeSignature(body, signature(body, secret, now - 301), secret, now), false);
});

test('Stripe signature rejects missing, duplicate, and malformed timestamp fields', async () => {
  const now = 1_800_000_000;
  const secret = 'whsec_test_secret';
  const body = '{}';
  const valid = signature(body, secret, now).split(',')[1];
  assert.equal(await verifyStripeSignature(body, valid, secret, now), false);
  assert.equal(await verifyStripeSignature(body, `t=${now},t=${now},${valid}`, secret, now), false);
  assert.equal(await verifyStripeSignature(body, `t=not-a-time,${valid}`, secret, now), false);
  assert.equal(await verifyStripeSignature(body, signature(body, secret, now), '', now), false);
});

test('Stripe checkout payload binds the internal transaction reference and exact amount', () => {
  const payload = stripeCheckoutPayload({
    transactionId: 'txn_internal_123',
    amountCents: 2599,
    currency: 'eur',
    successUrl: 'https://example.test/success',
    cancelUrl: 'https://example.test/cancel',
    productName: 'Mission PROCHÉLIA',
    clientReferenceId: 'client_order_456'
  });
  assert.equal(payload.get('mode'), 'payment');
  assert.equal(payload.get('client_reference_id'), 'client_order_456');
  assert.equal(payload.get('metadata[prochelia_transaction_id]'), 'txn_internal_123');
  assert.equal(payload.get('payment_intent_data[metadata][prochelia_transaction_id]'), 'txn_internal_123');
  assert.equal(payload.get('line_items[0][price_data][unit_amount]'), '2599');
  assert.equal(payload.get('line_items[0][price_data][currency]'), 'eur');
  assert.equal(payload.get('line_items[0][quantity]'), '1');
});

test('Stripe checkout payload rejects unsafe URLs, invalid amounts, and missing transaction IDs', () => {
  assert.throws(() => stripeCheckoutPayload({
    transactionId: 'txn_1', amountCents: 100,
    successUrl: 'javascript:alert(1)', cancelUrl: 'https://example.test/cancel'
  }), /INVALID_CHECKOUT_INPUT/);
  assert.throws(() => stripeCheckoutPayload({
    transactionId: 'txn_1', amountCents: 49,
    successUrl: 'https://example.test/success', cancelUrl: 'https://example.test/cancel'
  }), /INVALID_CHECKOUT_INPUT/);
  assert.throws(() => stripeCheckoutPayload({
    transactionId: '', amountCents: 100,
    successUrl: 'https://example.test/success', cancelUrl: 'https://example.test/cancel'
  }), /INVALID_CHECKOUT_INPUT/);
});
