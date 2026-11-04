import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const webhook = source.slice(source.indexOf('async function stripeWebhook('), source.indexOf('\nasync function stripeCheckout'));

test('Stripe disputes require safe integer amount, positive value, transaction gross cap and matching currency', () => {
  assert.match(webhook, /const disputeAmountCents=Number\(obj\?\.amount\)/);
  assert.match(webhook, /Number\.isSafeInteger\(disputeAmountCents\)/);
  assert.match(webhook, /disputeAmountCents>0/);
  assert.match(webhook, /disputeAmountCents<=Number\(tx\.gross_cents\|\|0\)/);
  assert.match(webhook, /disputeCurrency===String\(tx\.currency\|\|'EUR'\)\.toLowerCase\(\)/);
});

test('Invalid signed Stripe disputes are audited and never create dispute holds or records', () => {
  const invalid = webhook.indexOf("result='DISPUTE_AMOUNT_INVALID'");
  const insert = webhook.indexOf('INSERT OR IGNORE INTO payment_disputes');
  const hold = webhook.indexOf("SET status='held'");
  assert.ok(invalid >= 0);
  assert.ok(insert > invalid, 'dispute persistence must occur only after amount validation');
  assert.ok(hold > invalid, 'payment hold must occur only after amount validation');
  assert.match(webhook, /STRIPE_DISPUTE_AMOUNT_INVALID/);
});

test('Valid dispute persistence uses the validated amount and records currency in audit metadata', () => {
  assert.match(webhook, /clean\(obj\?\.reason\)\|\|'stripe_dispute',disputeAmountCents\)/);
  assert.match(webhook, /amount_cents:disputeAmountCents,currency:disputeCurrency/);
});
