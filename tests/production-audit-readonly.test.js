import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("productionConfigCheck never creates schema and checks persistence tables before writing", () => {
  const start = source.indexOf("async function productionConfigCheck");
  const end = source.indexOf("\nasync function finalProductionAudit", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /persist = false/);
  assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(body, /missingRequiredTables\(env, \['integration_registry','system_config_checks'\]\)/);
  assert.ok(body.indexOf("missingRequiredTables") < body.indexOf("registerIntegration"));
  assert.ok(body.indexOf("missingRequiredTables") < body.indexOf("INSERT INTO system_config_checks"));
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

test("production traffic gate requires independent release evidence and a real PSP adapter", () => {
  const start = source.indexOf("async function strictProductionAudit");
  const end = source.indexOf("\\nconst __procheliaProductionSafetyHandle", start);
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
  assert.match(body, /paymentsConfigured\\(env\\)/);
  assert.match(body, /releaseEvidence\\.every\\(x=>x\\.status==='OK'\\)/);
  assert.match(body, /ready_for_real_traffic:overall/);
});

test("GET copilot next-actions checks schema readiness without runtime DDL", () => {
  const start = source.indexOf("async function copilotNextActions");
  const end = source.indexOf("\nasync function enqueueBackgroundJob", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(body, /missingRequiredTables\(env, \['platform_settings','operational_cases','promotion_recommendations','action_outbox'\]\)/);
});

test("background job processing requires pre-migrated tables and never creates schema on POST", () => {
  const start = source.indexOf("async function processBackgroundJobs");
  const end = source.indexOf("\nfunction isMutatingMethod", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(body, /missingRequiredTables\(env, \['background_jobs','activity_journal'\]\)/);
});

test("background job enqueue fails closed when its table is not migrated", () => {
  const start = source.indexOf("async function enqueueBackgroundJob");
  const end = source.indexOf("\nasync function processBackgroundJobs", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /tableExists\(env, 'background_jobs'\)/);
  assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
});
