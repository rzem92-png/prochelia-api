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
  const end = source.indexOf("const __procheliaProductionSafetyHandle", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /await journal\(/);
  assert.doesNotMatch(body, /INSERT INTO system_config_checks/);
  assert.match(body, /GET production-check is read-only/);
});


test("production readiness cannot open from PSP environment strings without an executable adapter", () => {
  const start = source.indexOf("async function productionConfigCheck");
  const end = source.indexOf("\nasync function finalProductionAudit", start);
  const body = source.slice(start, end);
  assert.match(body, /code:'PSP_ADAPTER',status:paymentsConfigured\(env\)\?'OK':'NOT_CONFIGURED'/);
  assert.match(body, /'SECRET:PAYMENT_PROVIDER','SECRET:PAYMENT_WEBHOOK_SECRET','PSP_ADAPTER'/);
});


test("configuration audit can never authorize real production traffic by itself", () => {
  const start = source.indexOf("async function finalProductionAudit");
  const end = source.indexOf("\\nasync function copilotNextActions", start);
  const body = source.slice(start, end);
  assert.match(body, /production_gate:'CLOSED'/);
  assert.match(body, /ready_for_real_traffic:false/);
  for (const blocker of ['ISOLATED_RESTORE_DRILL','PSP_SANDBOX_E2E','INDEPENDENT_SECURITY_REVIEW','GDPR_LEGAL_APPROVAL','LOAD_AND_RECOVERY_TESTS','HUMAN_RELEASE_APPROVAL']) {
    assert.ok(body.includes(blocker), `Missing release blocker: ${blocker}`);
  }
});
