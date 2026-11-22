import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("pricing quote requires a server-derived tenant and refuses unscoped legacy policy", () => {
  const start = source.indexOf("async function pricingQuote(request, env) {");
  const end = source.indexOf("\nasync function financeSummary(", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  const executableBody = body.replace(/^\s*\/\/.*$/gm, "");
  assert.match(body, /request\.method !== 'POST'/);
  assert.match(body, /requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(body, /resolveTenantContext\(request, env, gate\.auth\)/);
  assert.match(body, /TENANT_SCOPED_PRICING_POLICY_REQUIRED/);
  assert.match(body, /write_enabled:false/);
  assert.doesNotMatch(executableBody, /readJson\(|base_price_cents|pricing_policies|pricing_quotes|financeStrategicQuote|INSERT INTO/);
});

test("pricing quote does not initialize the legacy consolidated schema before refusing", () => {
  const start = source.indexOf("async function handleConsolidated(request, env) {");
  const end = source.indexOf("\n/* ============================================================", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  const line = body.split("\n").find(item => item.includes("const consolidatedPath"));
  assert.ok(line);
  assert.doesNotMatch(line, /\/api\/pricing\/quote/);
  assert.match(body, /url\.pathname==='\/api\/pricing\/quote'\s*&&\s*request\.method==='POST'\) return pricingQuote\(request,env\)/);
});
