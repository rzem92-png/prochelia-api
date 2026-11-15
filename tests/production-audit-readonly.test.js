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


test("configuration audit can never authorize real production traffic by itself", () => {
  const start = source.indexOf("async function finalProductionAudit");
  const end = source.indexOf("\nasync function copilotNextActions", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /production_gate:'CLOSED'/);
  assert.match(body, /ready_for_real_traffic:false/);
  for (const blocker of [
    "ISOLATED_RESTORE_DRILL",
    "PSP_SANDBOX_E2E",
    "INDEPENDENT_SECURITY_REVIEW",
    "GDPR_LEGAL_APPROVAL",
    "LOAD_AND_RECOVERY_TESTS",
    "HUMAN_RELEASE_APPROVAL"
  ]) assert.ok(body.includes(blocker), `Missing release blocker: ${blocker}`);
});

test("strict production audit treats a missing executable PSP adapter as a blocker even when secrets are configured", () => {
  const start = source.indexOf("async function strictProductionAudit");
  const end = source.indexOf("\nconst __procheliaProductionSafetyHandle", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /'PSP_ADAPTER'/);
  assert.match(body, /result\.externalNotConfigured/);
  assert.match(body, /paymentsConfigured\(env\)===true/);
});

test("actual exported request wrapper routes both production audit endpoints through the strict gate", () => {
  const start = source.indexOf("const __procheliaProductionSafetyHandle = handle");
  assert.notEqual(start, -1);
  const body = source.slice(start);
  assert.match(body, /u\.pathname==='\/api\/system\/final-audit'.*strictProductionAudit/s);
  assert.match(body, /u\.pathname==='\/api\/system\/production-check'.*strictProductionAudit/s);
});
