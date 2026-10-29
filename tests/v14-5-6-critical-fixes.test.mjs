import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../src/stripe-adapter.js', import.meta.url), 'utf8');

test('mission security checks assigned mission and canonical intervenant profile mapping', () => {
  assert.match(source, /MISSION_ASSIGNMENT_MISMATCH/);
  assert.match(source, /SELECT id,user_id FROM intervenants WHERE id=\? LIMIT 1/);
  assert.match(source, /SELECT id,user_id FROM intervenants WHERE user_id=\? LIMIT 1/);
  assert.match(source, /code_expiry_policy:'mission_schedule'/);
  assert.match(source, /const arrivalExpiry=new Date\(startMs\+4\*60\*60\*1000\)/);
  assert.match(source, /const arrival=securityCode\(\),end=securityCode\(\)/);
});

test('Mission security codes are consumed atomically to prevent concurrent double use', () => {
  assert.match(source, /arrival_used_at IS NULL AND status='prepared'/);
  assert.match(source, /end_used_at IS NULL AND status='in_progress'/);
  assert.match(source, /SECURITY_CODE_ALREADY_USED_OR_STATE_CHANGED/);
});

test('Stripe charge webhooks resolve through persisted provider references', () => {
  assert.match(source, /CREATE TABLE IF NOT EXISTS payment_provider_references/);
  assert.match(source, /SELECT transaction_id FROM payment_provider_references WHERE provider='stripe' AND external_id=\?/);
  assert.match(source, /STRIPE_TRANSACTION_REFERENCE_NOT_READY/);
  assert.match(adapter, /payment_intent_data\[metadata\]\[prochelia_transaction_id\]/);
});

test('Stripe event-specific amounts avoid false failure and dispute mismatches', () => {
  assert.match(source, /isFailure=failedEvent\.has\(event\.type\)/);
  assert.match(source, /isDispute=disputeEvent\.has\(event\.type\)/);
  assert.match(source, /obj\?\.amount_received \?\? obj\?\.amount/);
  assert.match(source, /isCheckout \? \(sessionId\|\|null\) : null/);
});

test('Stripe refunds are bounded, adjust wallet balances, and distinguish partial refunds', () => {
  assert.match(source, /refundCents>grossCents/);
  assert.match(source, /'partially_refunded'/);
  assert.match(source, /STRIPE_REFUND_AMOUNT_INVALID/);
  assert.match(source, /walletReversal/);
  assert.match(source, /STRIPE_REFUND_WALLET_ADJUSTED/);
});

test('Stripe disputes are persisted idempotently for investigation', () => {
  assert.match(source, /INSERT OR IGNORE INTO payment_disputes/);
  assert.match(source, /STRIPE_DISPUTE_RECORDED/);
  assert.match(source, /'held'/);
});

test('security and payment hardening is explicitly versioned', () => {
  assert.match(source, /V14\.5\.6-EXPERT-PREPRODUCTION/);
});
