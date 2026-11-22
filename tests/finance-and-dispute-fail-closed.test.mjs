import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function handler(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} handler must exist`);
  const end = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

test("opening a payment dispute refuses before schema setup or financial state changes without a PSP", () => {
  const body = handler("openPaymentDispute");
  const guard = body.indexOf("if (!paymentsConfigured(env))");
  assert.ok(guard >= 0);
  const schema = body.indexOf("ensurePaymentSchema(env)");
  assert.ok(schema > guard);
  assert.match(body.slice(guard, schema), /PAYMENT_PROVIDER_NOT_CONFIGURED/);
  assert.match(body.slice(guard, schema), /write_enabled:false/);
});

test("finance summary requires a server-derived tenant and fails closed until a tenant-scoped read model exists", () => {
  const body = handler("financeSummary");
  assert.match(body, /resolveTenantContext\(request, env, gate\.auth\)/);
  assert.match(body, /TENANT_SCOPED_FINANCE_READ_MODEL_REQUIRED/);
  assert.doesNotMatch(body, /FROM payment_transactions|FROM accounting_ledger|FROM business_expenses/);
});

test("finance summary GET does not run the legacy consolidated schema initializer", () => {
  const start = source.indexOf("async function handleConsolidated(");
  const end = source.indexOf("\n/* ============================================================", start);
  const body = source.slice(start, end);
  const consolidatedPathLine = body.split("\n").find(line => line.includes("const consolidatedPath"));
  assert.ok(consolidatedPathLine);
  assert.doesNotMatch(consolidatedPathLine, /\/api\/finance\/summary/);
});


test("finance workspace refuses legacy unscoped tables and derives every read from the active tenant", () => {
  const schemaStart = source.indexOf("async function ensureFinanceWorkspaceSchema(env) {");
  const schemaEnd = source.indexOf("function financeRoleAllowed", schemaStart);
  assert.ok(schemaStart >= 0 && schemaEnd > schemaStart);
  const schema = source.slice(schemaStart, schemaEnd);
  assert.ok(schema.includes("finance_workspace_entries: ['id','user_id','tenant_id'"));
  assert.ok(schema.includes("finance_export_log: ['id','user_id','tenant_id'"));
  assert.ok(schema.includes("finance_resolution_cases: ['id','user_id','tenant_id'"));
  assert.ok(schema.includes("tenant_id IS NULL"));
  assert.doesNotMatch(schema, /CREATE TABLE|CREATE INDEX/);

  const authStart = source.indexOf("async function financeAuth(request, env) {");
  const authEnd = source.indexOf("function financeMoney", authStart);
  const auth = source.slice(authStart, authEnd);
  assert.ok(auth.includes("resolveTenantContext(request,env,auth)"));
  assert.ok(auth.includes("FINANCE_WORKSPACE_TENANT_SCOPE_REQUIRED"));
  assert.ok(auth.includes("ACTIVE_TENANT_REQUIRED"));
  assert.ok(auth.includes("return { auth, tenantId:tenantContext.tenant.id }"));

  const rowsStart = source.indexOf("async function financeRowsForUser(env, user, tenantId) {");
  const rowsEnd = source.indexOf("function financeSummaryFromRows", rowsStart);
  const rows = source.slice(rowsStart, rowsEnd);
  assert.ok(rows.includes("let where = 'tenant_id=?'"));
  assert.ok(rows.includes("intervenants WHERE user_id=? AND tenant_id=?"));
  assert.ok(rows.includes("clients WHERE user_id=? AND tenant_id=?"));
  assert.ok(rows.includes("FROM finance_workspace_entries WHERE tenant_id=?"));
  assert.ok(rows.includes("FROM payout_requests WHERE tenant_id=?"));
  assert.ok(rows.includes("const manager = ['GERANTE','ADMIN','FINANCE','SUPPORT','SOCIETE','COMPANY'].includes(role)"));
});
