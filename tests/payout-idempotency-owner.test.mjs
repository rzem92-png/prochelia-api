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
  assert.match(fn, /\.bind\(idem,auth\.user\.id\)\.first\(\)/g);
});
