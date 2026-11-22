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
  const schemaEnd = source.indexOf("\\nfunction financeRoleAllowed", schemaStart);
  assert.ok(schemaStart >= 0 && schemaEnd > schemaStart);
  const schema = source.slice(schemaStart, schemaEnd);
  assert.match(schema, /finance_workspace_entries:[^\\n]*tenant_id/);
  assert.match(schema, /finance_export_log:[^\\n]*tenant_id/);
  assert.match(schema, /finance_resolution_cases:[^\\n]*tenant_id/);
  assert.match(schema, /tenant_id IS NULL/);
  assert.doesNotMatch(schema, /CREATE TABLE|CREATE INDEX/);

  const authStart = source.indexOf("async function financeAuth(request, env) {");
  const authEnd = source.indexOf("\\nfunction financeMoney", authStart);
  const auth = source.slice(authStart, authEnd);
  assert.match(auth, /resolveTenantContext\\(request,env,auth\\)/);
  assert.match(auth, /FINANCE_WORKSPACE_TENANT_SCOPE_REQUIRED/);
  assert.match(auth, /ACTIVE_TENANT_REQUIRED/);
  assert.match(auth, /return \\{ auth, tenantId:tenantContext\\.tenant\\.id \\}/);

  const rowsStart = source.indexOf("async function financeRowsForUser(env, user, tenantId) {");
  const rowsEnd = source.indexOf("\\nfunction financeSummaryFromRows", rowsStart);
  const rows = source.slice(rowsStart, rowsEnd);
  assert.match(rows, /let where = 'tenant_id=\\?'/);
  assert.match(rows, /intervenants WHERE user_id=\\? AND tenant_id=\\?/);
  assert.match(rows, /clients WHERE user_id=\\? AND tenant_id=\\?/);
  assert.match(rows, /FROM finance_workspace_entries WHERE tenant_id=\\?/);
  assert.match(rows, /FROM payout_requests WHERE tenant_id=\\?/);
});
