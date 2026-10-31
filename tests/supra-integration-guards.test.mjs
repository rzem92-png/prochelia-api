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

test("payment finalization cannot alter financial state without PSP reconciliation", () => {
  const route=source.slice(source.indexOf("async function finalizeMissionPayment"),source.indexOf("async function payoutRequest"));
  assert.match(route,/PSP_RECONCILIATION_REQUIRED/);
  assert.match(route,/idempotent_replay:true/);
  assert.match(route,/tx\.status===outcome/);
  assert.match(route,/MISSION_PAYMENT_FINALIZATION_BLOCKED/);
  assert.doesNotMatch(route,/UPDATE wallets SET/);
  assert.doesNotMatch(route,/UPDATE payment_transactions SET/);
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
  assert.ok(route.includes('env.DB.batch([txUpdate,walletCredit])'));
  assert.ok(route.includes('changes()=1'));
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


test("payout reservation and payout request creation are atomic and balance-guarded", () => {
  const route=source.slice(source.indexOf("async function payoutRequest"),source.indexOf("async function verifyWebhookSignature"));
  assert.match(route,/env\.DB\.batch\(\[reservation,createPayout\]\)/);
  assert.match(route,/available_cents>=\?/);
  assert.match(route,/WHERE changes\(\)=1/);
  assert.match(route,/meta\?\.changes\)!==1/);
  assert.match(route,/idempotent_replay:true/);
  assert.match(route,/currency='EUR'/);
  assert.doesNotMatch(route,/UPDATE wallets SET available_cents=available_cents-\?,reserved_cents=reserved_cents\+\?,updated_at=CURRENT_TIMESTAMP WHERE id=\?/);
});


test("disputes enforce client ownership and valid payment amount without false wallet holds", () => {
  const route=source.slice(source.indexOf("async function openPaymentDispute"),source.indexOf("async function paymentAdminResolve"));
  assert.match(route,/MISSION_PAYMENT_FORBIDDEN/);
  assert.match(route,/DISPUTE_AMOUNT_EXCEEDS_PAYMENT/);
  assert.match(route,/ACTIVE_DISPUTE_ALREADY_EXISTS/);
  assert.match(route,/wallet_frozen:false/);
  assert.doesNotMatch(route,/SET status='held'/);
});

test("active disputes block intervenant payouts", () => {
  const route=source.slice(source.indexOf("async function payoutRequest"),source.indexOf("async function verifyWebhookSignature"));
  assert.match(route,/PAYOUT_BLOCKED_BY_ACTIVE_DISPUTE/);
  assert.match(route,/status IN \('open','awaiting_psp_action'\)/);
});

test("manager dispute decisions never fake PSP refunds, releases or final resolution", () => {
  const route=source.slice(source.indexOf("async function paymentAdminResolve"),source.indexOf("async function handleBase"));
  assert.match(route,/status='awaiting_psp_action'/);
  assert.match(route,/psp_action_required:true/);
  assert.match(route,/financial_state_changed:false/);
  assert.doesNotMatch(route,/status='resolved'/);
  assert.doesNotMatch(route,/SET status=\?,updated_at=CURRENT_TIMESTAMP WHERE id=\?/);
});


test("PSP webhooks reject provider spoofing and unsupported refund events before persistence", () => {
  const route=source.slice(source.indexOf("async function paymentWebhook"),source.indexOf("async function openPaymentDispute"));
  assert.match(route,/provider!==paymentProvider\(env\)/);
  assert.match(route,/REFUND_RECONCILIATION_NOT_IMPLEMENTED/);
  assert.match(route,/UNSUPPORTED_WEBHOOK_EVENT/);
  assert.ok(route.indexOf("supportedEvents.includes(type)") < route.indexOf("INSERT OR IGNORE INTO payment_webhook_events"));
});

test("successful payout webhook requires the external PSP payout reference", () => {
  const route=source.slice(source.indexOf("async function paymentWebhook"),source.indexOf("async function openPaymentDispute"));
  assert.match(route,/PSP_PAYOUT_REFERENCE_REQUIRED/);
  assert.ok(route.indexOf("PSP_PAYOUT_REFERENCE_REQUIRED") < route.indexOf("payoutUpdate"));
});


test("payout idempotency keys cannot disclose another user's payout", () => {
  const route=source.slice(source.indexOf("async function payoutRequest"),source.indexOf("\nasync function ",source.indexOf("async function payoutRequest")+30));
  assert.match(route,/IDEMPOTENCY_KEY_TOO_LONG/);
  assert.match(route,/String\(old\.user_id\)!==String\(auth\.user\.id\)/);
  assert.match(route,/String\(replay\.user_id\)===String\(auth\.user\.id\)/);
  assert.match(route,/IDEMPOTENCY_KEY_CONFLICT/);
});


test("dispute creation is guarded atomically against concurrent active duplicates", () => {
  const route=source.slice(source.indexOf("async function openPaymentDispute"),source.indexOf("\nasync function ",source.indexOf("async function openPaymentDispute")+30));
  assert.match(route,/INSERT INTO payment_disputes[\s\S]*SELECT \?,\?,\?,\?,\?,\?,\?,\? FROM payment_transactions/);
  assert.match(route,/NOT EXISTS \(SELECT 1 FROM payment_disputes WHERE transaction_id=\? AND status IN \('open','awaiting_psp_action'\)\)/);
  assert.match(route,/PAYMENT_STATE_CHANGED_RETRY/);
});


test("manual payment finalization cannot alter financial state or wallet balances", () => {
  const route=source.slice(source.indexOf("async function finalizeMissionPayment"),source.indexOf("\nasync function ",source.indexOf("async function finalizeMissionPayment")+30));
  assert.match(route,/PSP_RECONCILIATION_REQUIRED/);
  assert.match(route,/financial_state_changed:false/);
  assert.match(route,/MISSION_PAYMENT_FINALIZATION_BLOCKED/);
  assert.doesNotMatch(route,/UPDATE wallets SET/);
  assert.doesNotMatch(route,/UPDATE payment_transactions SET/);
});


test("accounting ledger rejects invalid entries and is append-only", () => {
  assert.match(source,/trg_ledger_validate_insert BEFORE INSERT ON accounting_ledger/);
  assert.match(source,/NEW\.amount_cents<=0/);
  assert.match(source,/NEW\.direction NOT IN \('DEBIT','CREDIT'\)/);
  assert.match(source,/NEW\.currency NOT GLOB '\[A-Z\]\[A-Z\]\[A-Z\]'/);
  assert.match(source,/trg_ledger_immutable_update BEFORE UPDATE ON accounting_ledger/);
  assert.match(source,/trg_ledger_immutable_delete BEFORE DELETE ON accounting_ledger/);
  assert.match(source,/ACCOUNTING_LEDGER_IMMUTABLE/);
});


test("SUPRA accounting actions cannot write an unbalanced single ledger line", () => {
  const start=source.indexOf("async function executeQueuedAction");
  const end=source.indexOf("async function operationalExecute",start);
  const route=source.slice(start,end);
  assert.match(route,/requires_accounting_batch:true/);
  assert.match(route,/BALANCED_DOUBLE_ENTRY_REQUIRED/);
  assert.match(route,/WAITING_ACCOUNTING_BATCH/);
  assert.doesNotMatch(route,/INSERT INTO accounting_ledger/);
});


test("accounting operations require balanced debit/credit lines before posting", () => {
  assert.match(source,/CREATE TABLE IF NOT EXISTS accounting_operations/);
  assert.match(source,/idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS accounting_operation_lines/);
  assert.match(source,/trg_accounting_operation_post BEFORE UPDATE OF status ON accounting_operations/);
  assert.match(source,/COUNT\(\*\).*accounting_operation_lines[\s\S]*<2/);
  assert.match(source,/ACCOUNTING_OPERATION_NOT_BALANCED/);
  assert.match(source,/COUNT\(DISTINCT account_code\)/);
});

test("posted accounting operations and their lines cannot be modified or deleted", () => {
  assert.match(source,/trg_accounting_operation_immutable BEFORE UPDATE ON accounting_operations/);
  assert.match(source,/trg_accounting_operation_no_delete BEFORE DELETE ON accounting_operations/);
  assert.match(source,/trg_accounting_lines_immutable_update BEFORE UPDATE ON accounting_operation_lines/);
  assert.match(source,/trg_accounting_lines_immutable_delete BEFORE DELETE ON accounting_operation_lines/);
  assert.match(source,/trg_accounting_lines_no_late_insert BEFORE INSERT ON accounting_operation_lines/);
});


test("mission payment idempotency keys are bound to the exact original request", () => {
  const start = source.indexOf("async function createMissionPayment");
  const end = source.indexOf("async function finalizeMissionPayment", start);
  const handler = source.slice(start, end);
  assert.match(handler,/IDEMPOTENCY_KEY_TOO_LONG/);
  assert.match(handler,/old\.mission_id===missionId/);
  assert.match(handler,/old\.client_id===clientId/);
  assert.match(handler,/old\.intervenant_id===intervenantId/);
  assert.match(handler,/Number\(old\.gross_cents\)===gross/);
  assert.match(handler,/Number\(old\.commission_cents\)===commission/);
  assert.match(handler,/IDEMPOTENCY_KEY_CONFLICT/);
});
