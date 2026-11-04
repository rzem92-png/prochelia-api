import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('payment dispute route checks client ownership and caps dispute amount at transaction gross', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function openPaymentDispute');
  const end = source.indexOf('\nasync function paymentAdminResolve', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = source.slice(start, end);
  assert.match(fn, /String\(tx\.client_id\)!==String\(auth\.user\.id\)/);
  assert.match(fn, /FORBIDDEN_MISSION_PAYMENT_OWNERSHIP/);
  assert.match(fn, /amount>Number\(tx\.gross_cents\)/);
  assert.match(fn, /DISPUTE_AMOUNT_EXCEEDS_PAYMENT/);
});
