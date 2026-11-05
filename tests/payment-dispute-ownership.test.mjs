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

test('intervenant cannot choose a PSP provider account id during onboarding', () => {
  assert.match(source, /if\s*\(clean\(body\?\.provider_account_id\)\)\s*return json\(\{ok:false,error:'PROVIDER_ACCOUNT_ID_SERVER_ASSIGNED'/);
  assert.match(source, /const accountId\s*=\s*null/);
});

test('payout idempotency key cannot replay a different amount or payout mode', () => {
  assert.match(source, /Number\(old\.amount_cents\)!==amount\s*\|\|\s*String\(old\.mode\)!==mode/);
  assert.match(source, /error:'IDEMPOTENCY_KEY_CONFLICT'/);
});

test('payment webhook cannot mutate a transaction from another provider', () => {
  assert.match(source, /WEBHOOK_PROVIDER_TRANSACTION_MISMATCH/);
  assert.match(source, /String\(tx\.provider\|\|''\)\.toLowerCase\(\)!==String\(provider\|\|''\)\.toLowerCase\(\)/);
});

test('payout webhook cannot mutate a payout from another provider', () => {
  assert.match(source, /WEBHOOK_PROVIDER_PAYOUT_MISMATCH/);
  assert.match(source, /String\(payout\.provider\|\|''\)\.toLowerCase\(\)!==String\(provider\|\|''\)\.toLowerCase\(\)/);
});


test('mission payment creation rejects zero gross amount while allowing zero commission', () => {
  assert.match(source, /gross===null\|\|gross<=0\|\|commission===null\|\|commission<0\|\|commission>gross/);
});


test('mission payment write route remains disabled unless explicitly enabled', () => {
  assert.ok(source.includes("if (String(env.MISSION_API_ENABLED).toLowerCase() !== 'true') return json({ok:false,error:'MISSION_API_DISABLED',version:VERSION,write_enabled:false},423);"));
  assert.ok(source.includes("async function createMissionPayment(request, env) {"));
  assert.ok(source.includes("requireRole(auth,['gerante'])"));
});
test('manual finalization cannot assert PSP paid or refunded outcomes', () => {
  assert.match(source, /if\(outcome==='paid'\|\|outcome==='refunded'\)\s*return\s+json\(\{ok:false,error:'PSP_WEBHOOK_CONFIRMATION_REQUIRED'/);
});


test('mission payment amount and parties are derived from the persisted mission, not request body', () => {
  assert.ok(source.includes("'SELECT id, client_id, intervenant_id, price_client, commission FROM missions WHERE id=? LIMIT 1'"));
  assert.ok(source.includes("const clientId=clean(mission.client_id), intervenantId=clean(mission.intervenant_id);"));
  assert.ok(source.includes("const gross=moneyCents(mission.price_client), commission=moneyCents(mission.commission);"));
  assert.ok(!source.includes("moneyCents(body?.gross_eur), commission=moneyCents(body?.commission_eur)"));
});

test('payout request verifies idempotency payload after concurrent insert collision', () => {
  const start=source.indexOf('async function payoutRequest(request, env)');
  const end=source.indexOf('async function verifyWebhookSignature',start);
  const handler=source.slice(start,end);
  assert.ok(handler.includes("String(created.user_id)!==String(auth.user.id) || Number(created.amount_cents)!==amount || String(created.mode)!==mode"));
  assert.ok(handler.includes("error:'IDEMPOTENCY_KEY_CONFLICT'"));
  assert.ok(handler.includes("if(String(created.id)!==payoutId) return json({ok:true,version:VERSION,idempotent_replay:true,payout:created},200);"));
});
