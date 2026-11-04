import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('payout idempotency replay is scoped to authenticated user in both initial and race paths', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = source.slice(start, end);
  const scoped = /SELECT \* FROM payout_requests WHERE idempotency_key=\? AND user_id=\? LIMIT 1/g;
  assert.equal([...fn.matchAll(scoped)].length, 2);
  assert.equal([...fn.matchAll(/SELECT \* FROM payout_requests WHERE idempotency_key=\? LIMIT 1/g)].length, 0);
  assert.match(fn, /\.bind\(idem,auth\.user\.id\)\.first\(\)/g);
});

test('payout idempotency collision without same-owner replay fails closed', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = source.slice(start, end);
  assert.match(fn, /PAYOUT_RESERVATION_RACE_OR_INSUFFICIENT_BALANCE/);
  assert.match(fn, /if\(replay\)return json\(\{ok:true,version:VERSION,idempotent_replay:true,payout:replay\},200\);/);
  assert.match(fn, /return json\(\{ok:false,error:'PAYOUT_RESERVATION_RACE_OR_INSUFFICIENT_BALANCE',version:VERSION\},409\);/);
});
