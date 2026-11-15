import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("national continuity schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureNationalContinuitySchema(env)");
  const end = source.indexOf("\nfunction b64(", start + 20);
  assert.ok(start >= 0 && end > start, "national continuity schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /NATIONAL_CONTINUITY_SCHEMA_NOT_READY/);
  assert.match(helper, /NATIONAL_SCALE_DEFAULTS_NOT_READY/);
  assert.match(helper, /SELECT key FROM platform_scale_config/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "platform_scale_config", "idx_scale_key", "backup_runs",
    "idx_backup_runs_date", "backup_objects", "idx_backup_objects_run"
  ]) assert.ok(helper.includes(objectName), `missing national continuity schema contract: ${objectName}`);
});
