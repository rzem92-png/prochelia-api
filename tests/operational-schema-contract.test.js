import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("operational schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureOperationalSchema(env) {");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start, "operational schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /OPERATIONAL_SCHEMA_NOT_READY/);
  assert.match(helper, /PRAGMA table_info\(action_outbox\)/);
  assert.match(helper, /OPERATIONAL_SCHEMA_COLUMNS_NOT_READY/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "action_outbox", "idx_action_outbox_status", "copilot_briefings",
    "idx_copilot_briefings_open", "loyalty_events", "loyalty_balances",
    "quality_events", "b2b_leads", "capacity_snapshots", "idx_capacity_date",
    "finance_forecasts", "system_checks"
  ]) assert.ok(helper.includes(objectName), `missing operational schema contract: ${objectName}`);
});
