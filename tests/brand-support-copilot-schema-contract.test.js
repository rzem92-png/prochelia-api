import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("brand support Copilot schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureProcheliaMasterComplementSchema(env)");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start, "brand support Copilot schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /PROCHELIA_MASTER_SCHEMA_NOT_READY/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "brand_identity", "brand_assets", "brand_clearance_log",
    "interface_profiles", "support_cases", "support_case_events",
    "copilot_resolution_rules", "idx_support_cases_status",
    "idx_support_case_events_case", "idx_brand_assets_type", "idx_clearance_term"
  ]) assert.ok(helper.includes(objectName), `missing brand support Copilot schema contract: ${objectName}`);
});
