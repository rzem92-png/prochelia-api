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
