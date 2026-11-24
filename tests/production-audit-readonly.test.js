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
  const start = source.indexOf("async function strictProductionAudit");
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

test("security endpoints require pre-migrated security tables and never execute runtime DDL", () => {
  assert.doesNotMatch(source, /await ensureSecuritySchema\(env\)/);
  for (const name of ["securityIdentityStart","securityIdentityApprove","securityPrepareMission","securityPresence","securityVerifyCode","securityResendCodes","securityStatus"]) {
    const start = source.indexOf("async function " + name + "(");
    assert.notEqual(start, -1, "missing " + name);
    const next = source.indexOf("\nasync function ", start + 20);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.match(body, /schemaReadinessResponse\(env, \['identity_verifications','trusted_devices','mission_security','mission_security_attempts','security_audit'\]/);
    assert.doesNotMatch(body, /ensureSecuritySchema\(env\)/);
  }
});

test("finance workspace routes require migration-owned tables instead of runtime schema creation", () => {
  const start = source.indexOf("async function financeAuth");
  const end = source.indexOf("\nfunction financeMoney", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /ensureFinanceWorkspaceSchema\(env\)/);
  assert.match(body, /schemaReadinessResponse\(env, \['finance_workspace_entries','finance_export_log','finance_resolution_cases'\]/);
});

test("national scale and backup routes do not create tables at request time", () => {
  const scaleStart = source.indexOf("async function nationalScaleStatus");
  const scaleEnd = source.indexOf("\nasync function backupStatus", scaleStart);
  assert.notEqual(scaleStart, -1);
  assert.notEqual(scaleEnd, -1);
  assert.doesNotMatch(source.slice(scaleStart, scaleEnd), /ensureNationalContinuitySchema\(env\)/);
  const statusStart = source.indexOf("async function backupStatus");
  const statusEnd = source.indexOf("\nconst __procheliaNationalHandle", statusStart);
  assert.notEqual(statusStart, -1);
  assert.notEqual(statusEnd, -1);
  assert.doesNotMatch(source.slice(statusStart, statusEnd), /ensureNationalContinuitySchema\(env\)/);
  const runStart = source.indexOf("async function runNationalBackup");
  const runEnd = source.indexOf("\nasync function nationalScaleStatus", runStart);
  assert.notEqual(runStart, -1);
  assert.notEqual(runEnd, -1);
  const runBody = source.slice(runStart, runEnd);
  assert.doesNotMatch(runBody, /ensureNationalContinuitySchema\(env\)/);
  assert.match(runBody, /missingRequiredTables\(env, \['backup_runs','backup_objects'\]\)/);
});

test("brand and support routes fail closed when schema is not migrated and never auto-create it", () => {
  assert.doesNotMatch(source, /await ensureProcheliaMasterComplementSchema\(env\)/);
  for (const name of ["brandIdentityEndpoint","brandClearanceRecord","supportCreate","supportList","supportResolve","supportDashboard"]) {
    const start = source.indexOf("async function " + name + "(");
    assert.notEqual(start, -1, "missing " + name);
    const next = source.indexOf("\nasync function ", start + 20);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.ok(body.includes("schemaReadinessResponse"), name + " must check migration readiness");
    assert.ok(!body.includes("ensureProcheliaMasterComplementSchema(env)"));
  }
  const uiStart = source.indexOf("async function interfaceConfigEndpoint");
  const uiEnd = source.indexOf("\nasync function supportCreate", uiStart);
  assert.doesNotMatch(source.slice(uiStart, uiEnd), /ensureProcheliaMasterComplementSchema\(env\)/);
});

test("rate limiting requires pre-migrated rate and audit tables instead of runtime DDL", () => {
  const start = source.indexOf("async function productionRateLimit");
  const end = source.indexOf("\nasync function strictProductionAudit", start);
  const body = source.slice(start, end);
  assert.doesNotMatch(body, /ensureFinalHardeningSchema\(env\)|productionSafetySchema\(env\)/);
  assert.match(body, /schemaReadinessResponse\(env, \['security_rate_limits'\]/);
  assert.match(body, /schemaReadinessResponse\(env, \['production_security_events'\]/);
});

test("consolidated routes require migration-owned tables and never create the schema at request time", () => {
  assert.doesNotMatch(source, /await ensureConsolidatedSchema\(env\)/);
  const start = source.indexOf("async function handleConsolidated");
  const end = source.indexOf("\n/* ============================================================", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /schemaReadinessResponse\(env, \['platform_settings','business_profiles','métier_catalog'/);
});

test("strategic routes require pre-migrated tables and never call the schema creator", () => {
  assert.doesNotMatch(source, /await ensureStrategicSchema\(env\)/);
  for (const name of ["recommendPromotions","createPromotion","promotionList","activatePromotion","strategicDashboard"]) {
    const start = source.indexOf("async function " + name + "(");
    const next = source.indexOf("\nasync function ", start + 20);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.ok(body.includes("schemaReadinessResponse"), name + " must check migration readiness");
  }
});

test("operational routes require pre-migrated tables and never call the schema creator", () => {
  assert.doesNotMatch(source, /await ensureOperationalSchema\(env\)/);
  for (const name of ["processActionOutbox","operationalExecute","scoreClients","loyaltyUpdate","qualityCreate","capacityDashboard","financeForecast","copilotBriefing","systemAudit"]) {
    const start = source.indexOf("async function " + name + "(");
    const next = source.indexOf("\nasync function ", start + 20);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.ok(body.includes("schemaReadinessResponse"), name + " must check migration readiness");
  }
});

test("commercial and recruitment routes require pre-migrated tables without runtime DDL", () => {
  assert.doesNotMatch(source, /await ensureCommercialRecruitmentSchema\(env\)/);
  for (const name of ["commercialProspectCreate","commercialProspectSheet","commercialPlaybook","recruitmentCandidateCreate","recruitmentSheet","growthDashboard"]) {
    const start = source.indexOf("async function " + name + "(");
    const next = source.indexOf("\nasync function ", start + 20);
    const body = source.slice(start, next < 0 ? undefined : next);
    assert.ok(body.includes("schemaReadinessResponse"), name + " must check migration readiness");
  }
});
