import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("consolidated business schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureConsolidatedSchema(env) {");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start, "consolidated schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /CONSOLIDATED_SCHEMA_NOT_READY/);
  assert.match(helper, /CONSOLIDATED_SETTINGS_NOT_READY/);
  assert.match(helper, /SELECT key FROM platform_settings/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "platform_settings", "business_profiles", "métier_catalog",
    "metier_suggestions", "pricing_policies", "pricing_quotes",
    "operational_cases", "idx_cases_status", "case_actions", "copilot_log",
    "activity_journal", "commercial_tasks", "recruitment_tasks", "complaints",
    "accounting_ledger", "idx_ledger_ref", "business_expenses",
    "notification_outbox", "compliance_events"
  ]) assert.ok(helper.includes(objectName), `missing consolidated schema contract: ${objectName}`);
});
