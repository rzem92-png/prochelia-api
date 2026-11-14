import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("productionConfigCheck is non-mutating unless persist=true is explicitly requested", () => {
  const start = source.indexOf("async function productionConfigCheck");
  const end = source.indexOf("\nasync function finalProductionAudit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /persist = false/);
  assert.match(body, /if \(persist\) \{/);
  assert.match(body, /if \(persist\) for\(const c of checks\)/);
  assert.match(body, /if \(persist\) \{/);
});

test("GET production audit handlers do not journal or insert check records", () => {
  const start = source.indexOf("async function finalProductionAudit");
  const end = source.indexOf("\nasync function copilotNextActions", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /await journal\(/);
  assert.doesNotMatch(body, /INSERT INTO system_config_checks/);
  assert.match(body, /GET production-check is read-only/);
});


test("production readiness remains closed until every independent release evidence item is validated", () => {
  const start = source.indexOf("async function productionConfigCheck");
  const end = source.indexOf("\nasync function finalProductionAudit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  for (const evidence of [
    "EXECUTABLE_PSP_ADAPTER_AND_SANDBOX_E2E",
    "ATOMIC_FINANCIAL_SETTLEMENT_AND_RECONCILIATION",
    "PREVIEW_R2_BACKUP_AND_ISOLATED_RESTORE_DRILL",
    "PRODUCTION_D1_SCHEMA_RECONCILIATION",
    "TENANT_SECURITY_AND_GDPR_ACCEPTANCE",
    "PRODUCTION_ROLLBACK_AND_HUMAN_RELEASE_APPROVAL"
  ]) {
    assert.ok(body.includes(`'${evidence}'`), `Missing release evidence gate: ${evidence}`);
  }
  assert.match(body, /NOT_VALIDATED/);
  assert.match(body, /NOT_VALIDATED.*includes|includes.*NOT_VALIDATED/s);
});
