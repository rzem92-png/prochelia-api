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
  assert.match(body, /GET audit endpoint is intentionally read-only/);
});

test("production traffic gate requires independent release evidence and a real PSP adapter", () => {
  const start = source.indexOf("async function strictProductionAudit");
  const end = source.indexOf("\nconst __procheliaProductionSafetyHandle", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  for (const code of [
    "PSP_ADAPTER",
    "PSP_SANDBOX_E2E",
    "BACKUP_RESTORE_E2E",
    "TENANT_ISOLATION",
    "SECURITY_LEGAL_REVIEW",
    "LOAD_RECOVERY",
    "HUMAN_RELEASE_APPROVAL"
  ]) assert.ok(body.includes(code), `missing production blocker: ${code}`);
  assert.match(body, /paymentsConfigured\(env\)/);
  assert.match(body, /releaseEvidence\.every\(x=>x\.status==='OK'\)/);
  assert.match(body, /ready_for_real_traffic:overall/);
});
