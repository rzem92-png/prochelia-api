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

test('disputes require paid or held status and bounded positive amount', () => {
  assert.match(source, /if\s*\(!\['paid','held'\]\.includes\(tx\.status\)\)\s*return\s+json\(\{ok:false,error:'PAYMENT_NOT_DISPUTABLE'/);
  assert.match(source, /if\s*\(amount<=0\s*\|\|\s*amount>Number\(tx\.gross_cents\)\)\s*return\s+json\(\{ok:false,error:'DISPUTE_AMOUNT_OUT_OF_RANGE'/);
});

test('mission payment idempotency key cannot be replayed with different parameters', () => {
  assert.match(source, /const sameIntent=String\(old\.mission_id\)===missionId[\s\S]*?Number\(old\.commission_cents\)===commission[\s\S]*?old\.type==='MISSION_CHARGE'/);
  assert.match(source, /if\(!sameIntent\) return json\(\{ok:false,error:'IDEMPOTENCY_KEY_CONFLICT'/);
});

test('Stripe webhook remains fail-closed until native Stripe signature verification exists', () => {
  assert.match(source, /async function verifyWebhookSignature\s*\(/);
  assert.match(source, /if\(!\(await verifyWebhookSignature\(request,env,raw\)\)\)\s*return json\(\{ok:false,error:'INVALID_WEBHOOK_SIGNATURE'/);
  assert.match(source, /if\(String\(provider\)\.toLowerCase\(\)==='stripe'\)\s*return json\(\{ok:false,error:'STRIPE_WEBHOOK_ADAPTER_NOT_IMPLEMENTED'/);
});
