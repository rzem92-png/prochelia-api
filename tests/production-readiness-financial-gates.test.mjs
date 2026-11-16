import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function productionConfigCheck");
const end = source.indexOf("\nasync function finalProductionAudit", start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);
const gate = source.slice(start, end);

test("production readiness requires the complete financial runtime tables", () => {
  for (const table of ["wallets", "payment_accounts", "payment_transactions", "payment_wallet_ledger", "payment_reconciliation", "payment_webhook_events", "payment_disputes", "payout_requests", "accounting_ledger"]) {
    assert.match(gate, new RegExp("\\b" + table + "\\b"), table);
  }
});

test("production readiness validates wallet and payout columns, not just table names", () => {
  for (const column of ["available_cents", "pending_cents", "reserved_cents", "paid_cents", "provider_account_id", "payouts_enabled", "wallet_id", "idempotency_key", "provider_payout_id", "available_delta_cents", "internal_transaction_id"]) {
    assert.ok(gate.includes(column), column);
  }
  assert.match(gate, /WALLET_COLUMNS/);
  assert.match(gate, /PAYOUT_COLUMNS/);
  assert.match(gate, /PAYMENT_ACCOUNT_COLUMNS/);
  assert.match(gate, /PAYMENT_WALLET_LEDGER_COLUMNS/);
  assert.match(gate, /PAYMENT_RECONCILIATION_COLUMNS/);
});

test("provider secrets cannot falsely certify a live PSP execution adapter", () => {
  assert.match(gate, /const pspAdapterImplemented=false/);
  assert.match(gate, /PSP_EXECUTION_ADAPTER/);
  assert.match(gate, /executionNotReady=checks\.filter\(x=>x\.status==='NOT_IMPLEMENTED'\)/);
  assert.match(gate, /executionNotReady\.length===0/);
});

test("persisted PSP integration status cannot claim CONFIGURED without an implemented adapter", () => {
  assert.ok(gate.includes("pspAdapterImplemented&&finalSecretConfigured(env,'PAYMENT_PROVIDER')&&finalSecretConfigured(env,'PAYMENT_WEBHOOK_SECRET')?'CONFIGURED':'NOT_IMPLEMENTED'"));
  assert.match(gate, /adapter_implemented:pspAdapterImplemented/);
});

test("bootstrap credential and PSP execution readiness both block production", () => {
  assert.match(gate, /'BOOTSTRAP_TOKEN'/);
  assert.match(gate, /externalNotConfigured\.length===0/);
  assert.match(gate, /executionNotReady\.length===0/);
});

test("persisted readiness audit never creates or migrates database schema", () => {
  for (const schemaWriter of ["ensureConsolidatedSchema", "ensurePaymentSchema", "ensureOperationalSchema", "ensureStrategicSchema", "ensureFinalHardeningSchema"]) {
    assert.doesNotMatch(gate, new RegExp(schemaWriter));
  }
  assert.match(gate, /if \(persist\) for\(const c of checks\) await env\.DB\.prepare/);
});

test("readiness GET remains read-only and persistence only records audit checks", () => {
  assert.match(gate, /persist = false/);
  assert.match(gate, /if \(persist\) for\(const c of checks\)/);
});
