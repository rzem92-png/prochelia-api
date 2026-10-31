import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("les dossiers Copilote ne se résolvent plus automatiquement à la création", () => {
  assert.match(source, /const requiresManager=1;/);
  assert.match(source, /const status='OPEN';/);
  assert.match(source, /status:'WAITING_MANAGER'/);
  assert.doesNotMatch(source, /if\(rec\.action==='AUTO_RESOLVE'\) await executeOperationalCase/);
});

test("l'exécution automatique est neutralisée par défaut", () => {
  assert.match(source, /AUTOMATION_DISABLED_PENDING_SUPRA_GOVERNANCE/);
});

test("les réaffectations et reports sont placés en file d'attente, sans UPDATE direct", () => {
  assert.match(source, /SUPRA_VALIDATION_REQUIRED/);
  assert.doesNotMatch(source, /UPDATE missions SET intervenant_id=\?/);
  assert.doesNotMatch(source, /UPDATE missions SET \\?=.*WHERE id=\?/);
});

test("une action en attente ne ferme pas prématurément le dossier", () => {
  assert.match(source, /finalCaseStatus=hasPendingActions\?'ACTION_PENDING':'RESOLVED'/);
});

test("la file d'attente ne déclare jamais une action terminée sans exécuteur vérifié", () => {
  assert.match(source, /WAITING_EXECUTOR/);
  assert.match(source, /execution_verified:false/);
  assert.doesNotMatch(source, /status='COMPLETED',processed_at=CURRENT_TIMESTAMP/);
});

test("les routes SUPRA sont authentifiées et le plan stratégique est réservé à la Gérante", () => {
  assert.match(source, /async function supraDomains\(request, env\)/);
  assert.match(source, /requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(source, /async function supraPlan\(request, env\)/);
  assert.match(source, /requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(source, /\/api\/supra\/domains/);
  assert.match(source, /\/api\/supra\/plan/);
});

test("les routes SUPRA ne déclenchent aucune préparation automatique du schéma D1", () => {
  const match = source.match(/const consolidatedPath = \[([^\]]+)\]/);
  assert.ok(match, "consolidated schema path list must be present");
  assert.doesNotMatch(match[1], /\/api\/supra\/(domains|plan)/);
});


test("SUPRA plan route validates input and forwards evidence to governance", () => {
  const route = source.slice(source.indexOf("async function supraPlan"), source.indexOf("async function handleConsolidated"));
  assert.match(route, /REQUEST_TOO_LARGE/);
  assert.match(route, /INVALID_JSON_OBJECT/);
  assert.match(route, /INVALID_SUPRA_PLAN_INPUT/);
  assert.match(route, /actorRole:gate\.auth\.user\.role,context,evidence/);
  assert.match(route, /executionAllowed:false/);
  assert.match(route, /\['LOW','MEDIUM','HIGH','CRITICAL'\]/);
});

test("SUPRA planning rejects browser-supplied evidence and validates context shape", () => {
  const route = source.slice(source.indexOf("async function supraPlan"), source.indexOf("async function handleConsolidated"));
  assert.match(route, /!isPlainRecord\(body\.context\)/);
  assert.match(route, /CLIENT_SUPPLIED_EVIDENCE_NOT_TRUSTED/);
  assert.match(route, /const evidence=\{\};/);
});


test("pricing route uses an active server catalog tariff and ignores client financial overrides", () => {
  const route = source.slice(source.indexOf("async function pricingQuote"), source.indexOf("async function financeSummary"));
  assert.match(route, /FROM métier_catalog WHERE code=\? AND active=1/);
  assert.match(route, /serviceRules\?\.base_price_cents/);
  assert.match(route, /FROM pricing_policies WHERE active=1/);
  for (const field of ["base_price_cents","platform_fee_percent","psp_percent","psp_fixed_cents","target_margin_percent","intervenant_floor_cents","regulated_max_cents","discount_cents","fuel_price_cents_per_litre","software_cost_cents"]) {
    assert.doesNotMatch(route, new RegExp("b\\." + field));
  }
  assert.match(route, /promotion_discount_cents:0/);
  assert.match(route, /final_price_recalculated_at_mission_confirmation:true/);
});

test("calendar surcharges are derived in Europe/Paris from the scheduled timestamp", () => {
  const route = source.slice(source.indexOf("function deriveMissionCalendarFlags"), source.indexOf("async function financeSummary"));
  assert.match(route, /timeZone:'Europe\/Paris'/);
  assert.match(route, /calendar\.evening/);
  assert.match(route, /calendar\.night/);
  assert.match(route, /calendar\.saturday/);
  assert.match(route, /calendar\.sunday/);
  assert.match(route, /calendar\.holiday/);
  assert.match(route, /SCHEDULED_AT_MUST_INCLUDE_TIMEZONE/);
});


test("SUPRA market selector accepts the explicit other-market option", () => {
  const route = source.slice(source.indexOf("async function supraPlan"), source.indexOf("async function handleConsolidated"));
  assert.match(route, /market === "other"/);
  assert.match(route, /\^\[a-z\]\{2\}\$/);
});


test("pricing policy rejects invalid server financial values and protects provider floor", () => {
  const route = source.slice(source.indexOf("async function pricingQuote"), source.indexOf("async function financeSummary"));
  assert.match(route, /SERVER_PRICING_POLICY_INVALID/);
  assert.match(route, /PRICING_POLICY_INFEASIBLE/);
  assert.match(route, /configuredCommission>0\?configuredCommission:FINANCE_STRATEGIC\.commissionDefaultPercent/);
  assert.match(route, /configuredProviderFloor>0\?configuredProviderFloor:base\*0\.70/);
  assert.match(route, /targetMargin>100/);
  assert.match(route, /commissionRate>1/);
});


test("non-test pricing phases require a complete approved server policy", () => {
  const route = source.slice(source.indexOf("async function pricingQuote"), source.indexOf("async function financeSummary"));
  assert.match(route, /INVALID_PROJECT_PHASE/);
  assert.match(route, /NON_TEST_PRICING_POLICY_INCOMPLETE/);
  assert.match(route, /phase!==\x27TEST\x27/);
});

test("finance dashboard never labels ledger balance minus expenses as net profit", () => {
  const route=source.slice(source.indexOf("async function financeSummary"),source.indexOf("async function complaintCreate"));
  assert.match(route,/FROM payment_transactions WHERE status='paid'/);
  assert.match(route,/net_estimate_cents:null/);
  assert.match(route,/net_profit_available:false/);
  assert.match(route,/paid_status_is_reconciled:false/);
  assert.match(route,/PSP_AND_ACCOUNTING_RECONCILIATION_AND_FULL_COST_ALLOCATION_REQUIRED/);
  assert.match(route,/requireAuthRole\(request,env,\['gerante'\]\)/);
});

test("payment finalization cannot create PSP success and repeated calls cannot credit twice", () => {
  const route=source.slice(source.indexOf("async function finalizeMissionPayment"),source.indexOf("async function payoutRequest"));
  assert.match(route,/PSP_CONFIRMATION_REQUIRED/);
  assert.match(route,/idempotent_replay:true/);
  assert.match(route,/tx\.status===outcome/);
  assert.match(route,/UPDATE wallets SET pending_cents=pending_cents\+\?,available_cents=available_cents\+\?/);
});

test("successful PSP webhooks require a provider payment reference before processing", () => {
  const route=source.slice(source.indexOf("async function paymentWebhook"),source.indexOf("async function openPaymentDispute"));
  assert.match(route,/PSP_PAYMENT_REFERENCE_REQUIRED/);
  assert.match(route,/\['payment_succeeded','charge_succeeded'\]/);
  assert.match(route,/providerPaymentId\|\|null/);
  assert.match(route,/INSERT OR IGNORE INTO payment_webhook_events/);
  assert.ok(route.indexOf("PSP_PAYMENT_REFERENCE_REQUIRED") < route.indexOf("INSERT OR IGNORE INTO payment_webhook_events"));
});

test("PSP webhook delivery is retryable, collision-checked and atomically claimed", () => {
  const route=source.slice(source.indexOf("async function paymentWebhook"),source.indexOf("async function openPaymentDispute"));
  assert.match(route,/WEBHOOK_EVENT_ID_PAYLOAD_CONFLICT/);
  assert.match(route,/existing\.payload_hash/);
  assert.match(route,/processed=1/);
  assert.match(route,/processed=2/);
  assert.match(route,/received_at < datetime\('now','-5 minutes'\)/);
  assert.match(route,/retry_after_seconds:30/);
  assert.match(route,/SET processed=0 WHERE provider=\? AND event_id=\? AND processed=2/);
  assert.match(route,/WEBHOOK_PROCESSING_FAILED/);
  assert.match(route,/PAYMENT_TRANSACTION_NOT_FOUND/);
  assert.match(route,/PAYOUT_REQUEST_NOT_FOUND/);
  assert.match(route,/UPDATE payment_transactions SET status=\?,provider_payment_id=.*AND status NOT IN/);
  assert.match(route,/if\(changed\.meta\?\.changes && newStatus==='paid'\)/);
  assert.ok(route.indexOf("INTERVENANT_WALLET_NOT_FOUND") < route.indexOf("UPDATE payment_transactions SET status="));
});

test("PSP webhook requires object references for all known payment and payout events", () => {
  const route=source.slice(source.indexOf("async function paymentWebhook"),source.indexOf("async function openPaymentDispute"));
  assert.match(route,/paymentEvents\.includes\(type\)&&!txId/);
  assert.match(route,/payoutEvents\.includes\(type\)&&!payoutId/);
});

test("PSP settlement validates provider, exact amount and currency before wallet credit", () => {
  const route=source.slice(source.indexOf("async function paymentWebhook"),source.indexOf("async function openPaymentDispute"));
  assert.match(route,/PAYMENT_PROVIDER_MISMATCH/);
  assert.match(route,/PSP_PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH/);
  assert.match(route,/amount!==Number\(tx\.gross_cents\)/);
  assert.match(route,/currency!==String\(tx\.currency\|\|'EUR'\)\.toUpperCase\(\)/);
  assert.match(route,/PAYOUT_PROVIDER_MISMATCH/);
  assert.match(route,/PSP_PAYOUT_AMOUNT_OR_CURRENCY_MISMATCH/);
  assert.match(route,/amount!==Number\(payout\.amount_cents\)/);
});


test('payment wallet settlement uses a transactional D1 batch', () => {
  const route=source.slice(source.indexOf('async function paymentWebhook'),source.indexOf('async function openPaymentDispute'));
  assert.ok(route.includes('env.DB.batch([txUpdate,walletCredit])'));
  assert.ok(route.includes('changes()=1'));
});

test('payout wallet settlement and release use transactional D1 batches', () => {
  const route=source.slice(source.indexOf('async function paymentWebhook'),source.indexOf('async function openPaymentDispute'));
  assert.ok(route.includes('env.DB.batch([payoutUpdate,settle])'));
  assert.ok(route.includes('env.DB.batch([payoutUpdate,release])'));
});
