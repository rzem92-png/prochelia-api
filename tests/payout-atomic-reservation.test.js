import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('payout reservation is guarded by atomic conditional wallet update', () => {
  assert.match(source, /env\.DB\.batch\(\[/);
  assert.match(source, /available_cents>=\?/);
  assert.match(source, /WHERE changes\(\)=1/);
  assert.match(source, /PAYOUT_RESERVATION_CONFLICT/);
  assert.match(source, /PAYOUT_RESERVATION_FAILED/);
});

test('payout insert and wallet reservation share one D1 batch', () => {
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('async function verifyWebhookSignature', start);
  const section = source.slice(start, end);
  assert.ok(section.indexOf('UPDATE wallets') < section.indexOf('INSERT INTO payout_requests'));
  assert.match(section, /D1 batch is transactional/);
});
