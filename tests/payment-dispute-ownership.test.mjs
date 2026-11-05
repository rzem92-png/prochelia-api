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

test('payout webhook rejects conflicting terminal outcomes for reconciliation', () => {
  assert.match(source, /const terminalPayoutStatuses=\['completed','failed','canceled'\]/);
  assert.match(source, /terminalPayoutStatuses\.includes\(String\(payout\.status\)\)\s*&&\s*String\(payout\.status\)!==String\(newStatus\)/);
  assert.match(source, /error:'PAYOUT_TERMINAL_STATE_CONFLICT'/);
});

test('payment webhook rejects contradictory terminal payment outcomes', () => {
  assert.match(source, /const terminalPaymentStatuses=\['paid','failed','refunded'\]/);
  assert.match(source, /terminalPaymentStatuses\.includes\(String\(tx\.status\)\)\s*&&\s*String\(tx\.status\)!==String\(newStatus\)/);
  assert.match(source, /error:'PAYMENT_TERMINAL_STATE_CONFLICT'/);
});

test('payment webhook validates provider event amount and currency against stored charge', () => {
  assert.match(source, /WEBHOOK_TRANSACTION_AMOUNT_MISMATCH/);
  assert.match(source, /Number\(event\.data\.amount_cents\)!==Number\(tx\.gross_cents\)/);
  assert.match(source, /WEBHOOK_TRANSACTION_CURRENCY_MISMATCH/);
  assert.match(source, /String\(event\.data\.currency\)\.toUpperCase\(\)!==String\(tx\.currency\|\|'EUR'\)\.toUpperCase\(\)/);
});

test('payout webhook validates provider event amount and currency against reserved payout', () => {
  assert.match(source, /WEBHOOK_PAYOUT_AMOUNT_MISMATCH/);
  assert.match(source, /Number\(event\.data\.amount_cents\)!==Number\(payout\.amount_cents\)/);
  assert.match(source, /WEBHOOK_PAYOUT_CURRENCY_MISMATCH/);
  assert.match(source, /String\(event\.data\.currency\)\.toUpperCase\(\)!==String\(payout\.currency\|\|'EUR'\)\.toUpperCase\(\)/);
});

test('payment disputes prevent duplicate active cases and insert conditionally', () => {
  assert.match(source, /PAYMENT_DISPUTE_ALREADY_OPEN/);
  assert.match(source, /status IN \('open','pending'\) LIMIT 1/);
  assert.ok(source.includes('INSERT INTO payment_disputes (id,mission_id,transaction_id,client_id,intervenant_id,status,reason,amount_cents)'));
  assert.ok(source.includes('SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM payment_disputes WHERE transaction_id=? AND status IN (\'open\',\'pending\'))'));
  assert.match(source, /const inserted=Number\(results\?\.\[1\]\?\.meta\?\.changes\|\|0\)/);
});

test('admin dispute resolution uses conditional state transition and reports conflicts', () => {
  assert.match(source, /DISPUTE_ALREADY_RESOLVED/);
  assert.match(source, /UPDATE payment_disputes SET status='resolved'[\s\S]*?WHERE id=\? AND status NOT IN \('resolved','cancelled','canceled'\)/);
  assert.match(source, /DISPUTE_RESOLUTION_CONFLICT/);
  assert.match(source, /Number\(result\?\.meta\?\.changes\|\|0\)!==1/);
});

test('payout creation is blocked while intervenant has an active payment dispute', () => {
  assert.match(source, /PAYOUT_BLOCKED_BY_ACTIVE_DISPUTE/);
  assert.match(source, /SELECT id,transaction_id,status FROM payment_disputes WHERE intervenant_id=\? AND status IN \('open','pending'\) LIMIT 1/);
});

test('payout creation is blocked pending refund ledger reconciliation', () => {
  assert.match(source, /PAYOUT_BLOCKED_PENDING_REFUND_RECONCILIATION/);
  assert.match(source, /SELECT id,mission_id,status,refund_cents FROM payment_transactions WHERE intervenant_id=\? AND status IN \('refunded','partially_refunded'\) LIMIT 1/);
});

test('Stripe dispute closure with missing local dispute record releases webhook claim for retry', () => {
  const start=source.indexOf("const closedDisputeUpdate=await env.DB.prepare(`UPDATE payment_disputes SET status=?,resolution=?");
  assert.notEqual(start,-1);
  const end=source.indexOf("result=won?'DISPUTE_WON_RESOLVED'",start);
  const handler=source.slice(start,end);
  assert.match(handler,/Number\(closedDisputeUpdate\?\.meta\?\.changes\|\|0\)!==1/);
  assert.match(handler,/processed=0,processed_at=NULL WHERE provider='stripe' AND event_id=\?/);
  assert.match(handler,/error:'STRIPE_DISPUTE_RECORD_NOT_FOUND'/);
  assert.match(handler,/},503\)/);
});

test('Stripe dispute closure cannot downgrade an already terminal dispute', () => {
  const start=source.indexOf("const closedDisputeUpdate=await env.DB.prepare(`UPDATE payment_disputes SET status=?,resolution=?");
  assert.notEqual(start,-1);
  const end=source.indexOf("await paymentAudit(env,'STRIPE_WEBHOOK_PROCESSED'",start);
  const handler=source.slice(start,end);
  assert.match(handler,/status NOT IN \('resolved','cancelled','canceled'\)/);
  assert.match(handler,/SELECT status FROM payment_disputes WHERE id=\? AND transaction_id=\? LIMIT 1/);
  assert.match(handler,/result='DISPUTE_ALREADY_TERMINAL'/);
  assert.match(handler,/error:'STRIPE_DISPUTE_STATE_CONFLICT'/);
});

test('Stripe refunds create idempotent cumulative reconciliation records without auto-debiting wallets', () => {
  const start=source.indexOf("} else if(refundEvent.has(event.type))");
  assert.notEqual(start,-1);
  const end=source.indexOf("} else if(disputeEvent.has(event.type))",start);
  const handler=source.slice(start,end);
  assert.match(handler,/SELECT refund_cents,status FROM payment_transactions WHERE id=\?/);
  assert.match(handler,/INSERT OR IGNORE INTO payment_reconciliation/);
  assert.ok(handler.includes(':refund:'));
  assert.ok(handler.includes('persistedRefundCents'));
  assert.match(handler,/status\)\s*VALUES\(\?,\?,\?,\?,\?,\?, 'pending'\)/);
  assert.doesNotMatch(handler,/UPDATE wallets SET|UPDATE payment_wallet_credit_ledger SET/);
});

test('manual reconciliation review is gerante-only, audited, and cannot alter financial balances', () => {
  const start=source.indexOf('async function paymentReconciliationReview');
  assert.notEqual(start,-1);
  const end=source.indexOf('async function handleBase',start);
  const handler=source.slice(start,end);
  assert.match(handler,/requireRole\(auth,\['gerante'\]\)/);
  assert.match(handler,/action!=='confirm_reviewed'/);
  assert.match(handler,/note\.length<10/);
  assert.match(handler,/UPDATE payment_reconciliation SET status='reviewed'/);
  assert.match(handler,/PAYMENT_RECONCILIATION_REVIEWED/);
  assert.match(handler,/financial_action:false/);
  assert.doesNotMatch(handler,/UPDATE payment_transactions|UPDATE wallets|INSERT INTO payment_wallet_credit_ledger|payoutRequest\(/);
});
test('manual reconciliation review endpoint is POST-only and dispatched', () => {
  assert.match(source,/url\.pathname === '\/api\/payments\/reconciliation\/review'/);
  assert.match(source,/paymentReconciliationReview\(request,env\)/);
});

test('reconciliation queue is gerante-only and has bounded pagination', () => {
  const start=source.indexOf('async function paymentReconciliationList');
  assert.notEqual(start,-1);
  const end=source.indexOf('async function paymentReconciliationReview',start);
  const handler=source.slice(start,end);
  assert.match(handler,/requireRole\(auth,\['gerante'\]\)/);
  assert.match(handler,/limitRaw<1\|\|limitRaw>100/);
  assert.match(handler,/offsetRaw<0\|\|offsetRaw>100000/);
  assert.match(handler,/SELECT id,provider,external_id,internal_transaction_id/);
  assert.doesNotMatch(handler,/SELECT \* FROM payment_reconciliation/);
  assert.match(source,/url\.pathname === '\/api\/payments\/reconciliation'/);
});

test('reconciliation review writes audit before mutating review status', () => {
  const start=source.indexOf('async function paymentReconciliationReview');
  const end=source.indexOf('async function handleBase',start);
  const handler=source.slice(start,end);
  const auditAt=handler.indexOf("paymentAudit(env,'PAYMENT_RECONCILIATION_REVIEWED'");
  const updateAt=handler.indexOf("UPDATE payment_reconciliation SET status='reviewed'");
  assert.ok(auditAt>=0 && updateAt>auditAt,'audit should be persisted before status transition');
  assert.match(handler,/PAYMENT_RECONCILIATION_REVIEW_CONFLICT/);
});
