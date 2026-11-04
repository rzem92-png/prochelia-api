import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('mission payment idempotency lookup binds exactly the one SQL placeholder', () => {
  const start = source.indexOf('async function createMissionPayment(request, env)');
  const end = source.indexOf('\nasync function finalizeMissionPayment', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  const query = handler.match(/SELECT \* FROM payment_transactions WHERE idempotency_key=\? LIMIT 1[\s\S]*?\.bind\(([^)]*)\)/);
  assert.ok(query, 'idempotency lookup SQL and bind must be present');
  assert.equal(query[1].trim(), 'idem',
    'global unique idempotency_key has one placeholder and must receive one binding');
});

test('mission payment idempotency key remains required and unique at storage layer', () => {
  const start = source.indexOf('async function createMissionPayment(request, env)');
  const end = source.indexOf('\nasync function finalizeMissionPayment', start);
  const handler = source.slice(start, end);
  assert.match(handler, /if\(!idem\) return json\(\{ok:false,error:'IDEMPOTENCY_KEY_REQUIRED'/);
  const schemaStart = source.indexOf('CREATE TABLE IF NOT EXISTS payment_transactions');
  const schema = source.slice(schemaStart, schemaStart + 700);
  assert.match(schema, /idempotency_key TEXT NOT NULL UNIQUE/);
});
