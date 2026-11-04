import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = worker.indexOf('async function stripeWebhook(');
const end = worker.indexOf('\n}\n', start);
assert.notEqual(start, -1, 'Stripe webhook handler must exist');
assert.notEqual(end, -1, 'Stripe webhook handler must be closed');
const handler = worker.slice(start, end);

test('Stripe webhook is signature-verified before schema initialization', () => {
  const signature = handler.indexOf('if(!valid)');
  const payloadValidation = handler.indexOf("if(!event?.id || !event?.type || !event?.data?.object)");
  const schema = handler.indexOf('await ensurePaymentSchema(env)');
  assert.ok(signature >= 0 && payloadValidation > signature && schema > payloadValidation);
});

test('Stripe webhook replay protection checks payload hash and claims processing', () => {
  assert.match(handler, /priorEvent\.payload_hash&&priorEvent\.payload_hash!==payloadHash/);
  assert.match(handler, /Number\(priorEvent\.processed\)===1/);
  assert.match(handler, /processed=2/);
  assert.match(handler, /processed=0 OR \(processed=2 AND processed_at < datetime\('now','-5 minutes'\)\)/);
});

test('Stripe refund path validates cumulative amount, currency-independent gross bound and monotonicity', () => {
  const refund = handler.slice(handler.indexOf("} else if(refundEvent.has(event.type))"));
  assert.notEqual(refund.indexOf("} else if(refundEvent.has(event.type))"), -1);
  assert.match(refund, /Number\.isSafeInteger\(grossCents\)/);
  assert.match(refund, /Number\.isSafeInteger\(refundCents\)/);
  assert.match(refund, /refundCents<previousRefundCents/);
  assert.match(refund, /refundCents>grossCents/);
  assert.match(refund, /STRIPE_REFUND_AMOUNT_INVALID/);
});

test('Stripe refund writes transaction refund state and wallet reversal together in a D1 batch', () => {
  const refund = handler.slice(handler.indexOf("} else if(refundEvent.has(event.type))"));
  assert.match(refund, /await env\.DB\.batch\(\[/);
  assert.match(refund, /UPDATE payment_transactions SET status=\?,refund_cents=\?/);
  assert.match(refund, /INSERT OR IGNORE INTO payment_wallet_ledger/);
  assert.match(refund, /payment:\$\{tx\.id\}:refund:\$\{refundCents\}/);
  assert.match(refund, /REFUND_REVERSAL/);
});

test('Stripe refund ledger reversal is based on delta and requires an existing payment credit', () => {
  const refund = handler.slice(handler.indexOf("} else if(refundEvent.has(event.type))"));
  assert.match(refund, /previousReversal/);
  assert.match(refund, /totalReversal/);
  assert.match(refund, /walletReversal=Math\.max\(0,totalReversal-previousReversal\)/);
  assert.match(refund, /entry_type='PAYMENT_CREDIT'/);
});

test('unresolved Stripe financial references remain retryable, not silently acknowledged', () => {
  assert.match(handler, /STRIPE_TRANSACTION_REFERENCE_NOT_READY/);
  assert.match(handler, /processed=0,processed_at=NULL/);
  assert.match(handler, /retry:true/);
});
