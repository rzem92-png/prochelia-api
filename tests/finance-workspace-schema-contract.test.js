import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("finance workspace schema helper is read-only and verifies migration-owned objects", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start = source.indexOf("async function ensureFinanceWorkspaceSchema(env) {");
  const end = source.indexOf("\nfunction financeRoleAllowed(", start + 20);
  assert.ok(start >= 0 && end > start, "finance workspace schema helper must exist");
  const helper = source.slice(start, end);
  assert.match(helper, /SELECT name FROM sqlite_master/);
  assert.match(helper, /FINANCE_WORKSPACE_SCHEMA_NOT_READY/);
  const executable = helper.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+(?:TABLE|INDEX|INTO|OR|SET)\b/i);
  for (const objectName of [
    "finance_workspace_entries", "idx_finance_workspace_user",
    "idx_finance_workspace_ref", "finance_export_log",
    "idx_finance_export_user", "finance_resolution_cases",
    "idx_finance_resolution_user"
  ]) assert.ok(helper.includes(objectName), `missing finance workspace schema contract: ${objectName}`);
});
