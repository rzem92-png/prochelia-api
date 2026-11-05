import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

test('payment dispute route dispatches to the implemented handler', () => {
  assert.match(source, /if\s*\(url\.pathname\s*===\s*['"]\/api\/payments\/dispute['"]\)[\s\S]*?return\s+openPaymentDispute\(request,\s*env\);/);
  assert.match(source, /async function openPaymentDispute\s*\(/);
  assert.doesNotMatch(source, /return\s+paymentDispute\(request,\s*env\);/);
});

test('client cannot open a payment dispute for another client account', () => {
  assert.match(source, /if\s*\(auth\.user\.role\s*===\s*['"]client['"]\s*&&\s*String\(tx\.client_id\)\s*!==\s*String\(auth\.user\.id\)\)\s*return\s+json\(\{ok:false,error:['"]FORBIDDEN['"]/);
});
