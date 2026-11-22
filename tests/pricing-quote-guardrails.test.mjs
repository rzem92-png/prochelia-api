import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function pricingQuote(request, env) {");
const end = source.indexOf("\nasync function financeSummary", start);
assert.ok(start >= 0 && end > start, "pricing quote handler must exist");
const handler = source.slice(start, end);

test("pricing simulations require POST, manager RBAC and a server-derived tenant", () => {
  assert.match(handler, /request\.method !== 'POST'/);
  assert.match(handler, /requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(handler, /resolveTenantContext\(request, env, gate\.auth\)/);
  assert.match(handler, /TENANT_CONTEXT_REQUIRED/);
});

test("legacy global pricing policy and client-supplied financial assumptions fail closed", () => {
  assert.match(handler, /TENANT_SCOPED_PRICING_POLICY_REQUIRED/);
  assert.match(handler, /write_enabled:false/);
  assert.doesNotMatch(handler, /readJson\(|base_price_cents|pricing_policies|pricing_quotes|financeStrategicQuote|INSERT INTO/);
});

test("pricing quote refuses before initializing the legacy consolidated schema", () => {
  const routeStart = source.indexOf("async function handleConsolidated(request, env) {");
  const routeEnd = source.indexOf("\n/* ============================================================", routeStart);
  const router = source.slice(routeStart, routeEnd);
  const consolidatedPath = router.split("\n").find(line => line.includes("const consolidatedPath"));
  assert.ok(consolidatedPath);
  assert.doesNotMatch(consolidatedPath, /\/api\/pricing\/quote/);
  assert.match(router, /url\.pathname==='\/api\/pricing\/quote'\s*&&\s*request\.method==='POST'\) return pricingQuote\(request,env\)/);
});

test("the pure strategic pricing calculator retains percentage and fixed commission arithmetic", () => {
  const quoteStart = source.indexOf("function financeStrategicQuote(");
  const quoteEnd = source.indexOf("\nasync function pricingQuote", quoteStart);
  const quoteEngine = source.slice(quoteStart, quoteEnd);
  assert.match(quoteEngine, /percentageCommission=Math\.round\(service\*rate\)/);
  assert.match(quoteEngine, /fixedCommission=Math\.max\(0,Math\.round\(Number\(commissionFixedCents\)\|\|0\)\)/);
  assert.match(quoteEngine, /commission_percent_cents:percentageCommission/);
  assert.match(quoteEngine, /commission_fixed_cents:fixedCommission/);
});

test("the pure strategic calculator can cap final customer price including travel", () => {
  const quoteStart = source.indexOf("function financeStrategicQuote(");
  const quoteEnd = source.indexOf("\nasync function pricingQuote", quoteStart);
  const quoteEngine = source.slice(quoteStart, quoteEnd);
  assert.match(quoteEngine, /let clientPrice=service\+travel\.total_cost_cents;[\s\S]*?clientPrice=Math\.min\(clientPrice,Math\.max\(0,Math\.round\(Number\(regulatedMaxCents\)\|\|0\)\)\)/);
});
