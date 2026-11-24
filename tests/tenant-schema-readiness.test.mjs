import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function bodyOf(name, nextName) {
  const start = source.indexOf("async function " + name + "(");
  assert.notEqual(start, -1, "missing function " + name);
  const end = nextName
    ? source.indexOf("\nasync function " + nextName, start + 20)
    : source.indexOf("\nasync function ", start + 20);
  return source.slice(start, end < 0 ? undefined : end);
}

test("schema readiness helpers are read-only and never issue DDL", () => {
  const start = source.indexOf("async function missingRequiredTables");
  const end = source.indexOf("\nasync function dynamicUpdate", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /tableExists\(env, name\)/);
  assert.match(body, /tableColumns\(env, table\)/);
  assert.doesNotMatch(body, /CREATE TABLE|ALTER TABLE|CREATE INDEX|\.run\(/);
});

test("production readiness persistence checks existing tables before writing and never creates schema", () => {
  const body = bodyOf("productionConfigCheck", "finalProductionAudit");
  assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(body, /missingRequiredTables\(env, \['integration_registry','system_config_checks'\]\)/);
  assert.ok(body.indexOf("missingPersistenceTables") < body.indexOf("registerIntegration"));
  assert.ok(body.indexOf("missingPersistenceTables") < body.indexOf("INSERT INTO system_config_checks"));
});

test("copilot and background job routes require pre-migrated tables without DDL", () => {
  const copilot = bodyOf("copilotNextActions", "enqueueBackgroundJob");
  assert.doesNotMatch(copilot, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(copilot, /schemaReadinessResponse\(env,/);
  const enqueue = bodyOf("enqueueBackgroundJob", "processBackgroundJobs");
  assert.doesNotMatch(enqueue, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(enqueue, /tableExists\(env, 'background_jobs'\)/);
  const process = bodyOf("processBackgroundJobs");
  assert.doesNotMatch(process, /ensure[A-Za-z]+Schema\(env\)/);
  assert.match(process, /background_jobs_dead_letter/);
  assert.match(process, /BACKGROUND_JOB_SCHEMA_NOT_MIGRATED/);
});

test("consolidated, strategic and operational routers never create schema at request time", () => {
  for (const name of ["handleConsolidated","handleStrategic","handleV139"]) {
    const body = bodyOf(name);
    assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
  }
  assert.match(bodyOf("handleConsolidated"), /schemaReadinessResponse\(env,/);
  assert.match(bodyOf("handleStrategic"), /strategicPaths/);
  assert.match(bodyOf("handleV139"), /operationalPaths/);
  for (const name of ["processActionOutbox","operationalExecute","recommendPromotions","createPromotion","promotionList","activatePromotion","strategicDashboard","copilotBriefing","systemAudit"]) {
    assert.doesNotMatch(bodyOf(name), /ensure[A-Za-z]+Schema\(env\)/);
  }
});

test("commercial and recruitment routes require existing tables without runtime DDL", () => {
  for (const name of ["commercialProspectCreate","commercialProspectSheet","commercialPlaybook","recruitmentCandidateCreate","recruitmentSheet","growthDashboard"]) {
    const body = bodyOf(name);
    assert.doesNotMatch(body, /ensure[A-Za-z]+Schema\(env\)/);
    assert.match(body, /schemaReadinessResponse\(env,/);
  }
});

test("finance workspace remains tenant-resolved and its schema checker is read-only", () => {
  const auth = bodyOf("financeAuth", "financeMoney");
  assert.match(auth, /resolveTenantContext\(request,env,auth\)/);
  assert.match(auth, /tenantContext\.tenant\.id/);
  const schemaStart = source.indexOf("async function assertFinanceWorkspaceTenantSchema");
  const schemaEnd = source.indexOf("\nfunction financeRoleAllowed", schemaStart);
  assert.ok(schemaStart >= 0 && schemaEnd > schemaStart);
  const schema = source.slice(schemaStart, schemaEnd);
  assert.match(schema, /tenant_id/);
  assert.doesNotMatch(schema, /CREATE TABLE|ALTER TABLE|CREATE INDEX|\.run\(/);
  const rows = bodyOf("financeRowsForUser", "financeSummaryFromRows");
  assert.match(rows, /WHERE tenant_id=\?/);
});

test("security readiness checks tenant columns and support routes preserve tenant filters without DDL", () => {
  const security = bodyOf("securitySchemaReady", "securityCode");
  assert.match(security, /identity_verifications: \['id','user_id','tenant_id'/);
  assert.match(security, /mission_security: \['id','mission_id','client_id','intervenant_id','tenant_id'/);
  const supportAuth = bodyOf("supportAuth", "supportEvent");
  assert.match(supportAuth, /resolveTenantContext\(request,env,auth\)/);
  assert.match(supportAuth, /session_active_tenant_id/);
  for (const name of ["brandIdentityEndpoint","brandClearanceRecord","interfaceConfigEndpoint","supportCreate","supportList","supportResolve","supportDashboard"]) {
    assert.doesNotMatch(bodyOf(name), /ensureProcheliaMasterComplementSchema\(env\)/);
  }
  for (const name of ["supportCreate","supportList","supportResolve","supportDashboard"]) {
    assert.match(bodyOf(name), /schemaColumnsReadinessResponse\(env,/);
  }
});

test("rate limiter and payment routes no longer create D1 schema at request time", () => {
  const rate = bodyOf("productionRateLimit", "strictProductionAudit");
  assert.doesNotMatch(rate, /ensureFinalHardeningSchema\(env\)|productionSafetySchema\(env\)/);
  assert.match(rate, /schemaReadinessResponse\(env, \['security_rate_limits'\]/);
  assert.match(rate, /schemaReadinessResponse\(env, \['production_security_events'\]/);
  for (const name of ["paymentOnboard","createMissionPayment","payoutRequest","openPaymentDispute"]) {
    const body = bodyOf(name);
    assert.doesNotMatch(body, /ensurePaymentSchema\(env\)/);
    assert.match(body, /schemaColumnsReadinessResponse\(env,/);
  }
});

test("legacy cross-tenant operational writes stay fail-closed until tenant-aware implementations land", () => {
  for (const name of ["createOperationalCase","approveOperationalCase","complaintCreate","financeSummary","scoreClients","loyaltyUpdate","qualityCreate","capacityDashboard","financeForecast"]) {
    assert.match(bodyOf(name), /legacyTenantScopeBlocked\(\)/);
  }
});

test("global project phase changes remain blocked until platform-owner approval and audit scope exist", () => {
  const body = bodyOf("setPhase");
  assert.match(body, /legacyTenantScopeBlocked\\(\\)/);
  assert.doesNotMatch(body, /INSERT INTO platform_settings|\.run\\(/);
});
