import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("payment schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensurePaymentSchema(env) {");
  const end = source.indexOf("\nfunction moneyCents(", start);
  assert.ok(start >= 0 && end > start, "payment schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /PAYMENT_SCHEMA_NOT_READY/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "payment_accounts", "wallets", "payment_transactions",
    "idx_payment_tx_mission", "idx_payment_tx_intervenant",
    "payout_requests", "idx_payout_user", "payment_webhook_events",
    "payment_disputes", "payment_reconciliation", "payment_audit"
  ]) assert.ok(helper.includes(objectName), `missing payment schema contract: ${objectName}`);
});
