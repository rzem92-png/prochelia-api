import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('payout idempotency replay requires same user, amount, currency, mode and provider', () => {
  const start = source.indexOf('function payoutReplayMatches(');
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, 'payoutReplayMatches helper exists');
  const helper = source.slice(start, end + 3);
  for (const required of [
    'old.user_id', 'old.amount_cents', 'old.currency', 'old.mode', 'old.provider'
  ]) assert.ok(helper.includes(required), `missing replay equality guard: ${required}`);
  assert.match(helper, /String\(old\.currency\s*\|\|\s*''\)\.toUpperCase\(\)\s*===\s*'EUR'/);
});

test('all payout replay branches use the same strict matcher', () => {
  const start = source.indexOf('async function payoutRequest(');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  const payout = source.slice(start, end);
  assert.ok(payout.includes('payoutReplayMatches(old,'));
  assert.equal((payout.match(/payoutReplayMatches\(replay,/g) || []).length, 2);
  assert.ok(!payout.includes('String(replay.user_id)===String(auth.user.id)'));
});

test('webhook body is bounded before signature verification and JSON parsing', () => {
  const start = source.indexOf('async function paymentWebhook(');
  const end = source.indexOf('\n}', start);
  const webhook = source.slice(start, end);
  assert.match(webhook, /readBoundedRequestBody\(request,\s*64\s*\*\s*1024\)/);
  assert.match(webhook, /WEBHOOK_BODY_TOO_LARGE/);
  assert.ok(webhook.indexOf('readBoundedRequestBody') < webhook.indexOf('verifyWebhookSignature'));
  assert.ok(webhook.indexOf('readBoundedRequestBody') < webhook.indexOf('JSON.parse(raw)'));
  assert.ok(!webhook.includes('request.text()'));
});
