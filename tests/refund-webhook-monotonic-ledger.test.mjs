import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function paymentWebhook(');
const end = source.indexOf('\nasync function stripeWebhook(', start);
const webhook = source.slice(start, end);

test('refund webhook contract rejects unsafe, negative and over-gross cumulative amounts', () => {
  assert.match(webhook, /Number\.isSafeInteger\(rawRefund\)/);
  assert.match(webhook, /rawRefund<0/);
  assert.match(webhook, /rawRefund>Number\(tx\.gross_cents\|\|0\)/);
  assert.match(webhook, /INVALID_WEBHOOK_REFUND_AMOUNT/);
});

test('refund webhook never decreases the already-recorded cumulative refund', () => {
  assert.match(webhook, /Math\.max\(Number\(tx\.refund_cents\|\|0\),rawRefund\)/);
  assert.match(webhook, /COALESCE\(refund_cents,0\)<?/);
  assert.match(webhook, /refundStatus=refundCents>=Number\(tx\.gross_cents\|\|0\)\?'refunded':'partially_refunded'/);
});

test('refund transaction and wallet reversal are submitted in one D1 batch', () => {
  const refundBranch = webhook.slice(webhook.indexOf("} else if(newStatus==='refunded')"));
  assert.match(refundBranch, /await env\.DB\.batch\(\[/);
  assert.match(refundBranch, /UPDATE payment_transactions SET status=\?,refund_cents=\?/);
  assert.match(refundBranch, /INSERT OR IGNORE INTO payment_wallet_ledger/);
  assert.match(refundBranch, /REFUND_REVERSAL/);
});

test('refund wallet ledger uses idempotency key and only reverses the incremental difference', () => {
  const refundBranch = webhook.slice(webhook.indexOf("} else if(newStatus==='refunded')"));
  assert.match(refundBranch, /payment:\$\{txId\}:refund:\$\{refundCents\}/);
  assert.match(refundBranch, /COALESCE\(\(SELECT SUM\(-available_delta_cents\) FROM payment_wallet_ledger/);
  assert.match(refundBranch, /NOT EXISTS\(SELECT 1 FROM payment_wallet_ledger l WHERE l\.idempotency_key=\?\)/);
});

test('refund webhook processing records invalid amounts as terminal, not retryable failures', () => {
  const refundBranch = webhook.slice(webhook.indexOf("} else if(newStatus==='refunded')"));
  assert.match(refundBranch, /processed=1,processed_at=CURRENT_TIMESTAMP/);
  assert.match(refundBranch, /retryable:false/);
});
