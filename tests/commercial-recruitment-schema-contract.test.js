import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("commercial recruitment schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureCommercialRecruitmentSchema(env)");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start, "commercial recruitment schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /COMMERCIAL_RECRUITMENT_SCHEMA_NOT_READY/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "commercial_prospects", "idx_commercial_prospects_priority",
    "commercial_playbooks", "recruitment_candidates",
    "idx_recruitment_candidates", "copilot_growth_actions", "sales_results"
  ]) assert.ok(helper.includes(objectName), `missing commercial recruitment schema contract: ${objectName}`);
});
