import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function pricingQuote(request, env) {");
const end = source.indexOf("\nasync function financeSummary", start);
assert.ok(start >= 0 && end > start, "pricing quote handler must exist");
const handler = source.slice(start, end);

test("pricing simulations are restricted to the authorized manager role", () => {
  assert.match(handler, /requireAuthRole\(request,env,\['gerante'\]\)/);
});

test("pricing assumptions are loaded from the active server policy", () => {
  assert.match(handler, /getSetting\(env,'project_phase','TEST'\)/);
  assert.match(handler, /SELECT \* FROM pricing_policies WHERE active=1/);
  assert.match(handler, /Number\(policy\.psp_percent\|\|0\)/);
  assert.match(handler, /Number\(policy\.psp_fixed_cents\|\|0\)/);
  assert.match(handler, /Number\(policy\.target_margin_percent\|\|0\)/);
  assert.match(handler, /Number\(policy\.platform_fee_percent\|\|0\)/);
  assert.match(handler, /discountCents:0/);
});

test("missing or incomplete pricing policy fails closed", () => {
  assert.match(handler, /PRICING_POLICY_NOT_CONFIGURED/);
  assert.match(handler, /PRICING_POLICY_INCOMPLETE/);
  assert.match(handler, /targetMargin<=0/);
  assert.match(handler, /intervenantFloor<=0/);
});

test("pricing inputs are bounded and the quote is marked as estimate-only without PSP", () => {
  assert.match(handler, /distance>500/);
  assert.match(handler, /duration>1440/);
  assert.match(handler, /base>100000000/);
  assert.match(handler, /ESTIMATE_ONLY_PSP_NOT_CONFIGURED/);
  assert.doesNotMatch(handler, /b\.psp_percent|b\.psp_fixed_cents|b\.target_margin_percent|b\.platform_fee_percent|b\.discount_cents/);
});

test("fixed platform commission is loaded from the server policy and included in the quote", () => {
  assert.match(handler, /Number\(policy\.platform_fee_fixed_cents\|\|0\)/);
  assert.match(handler, /commissionFixedCents:platformFeeFixed/);
  assert.match(handler, /commission_fixed_cents:platformFeeFixed/);
  const quoteStart = source.indexOf("function financeStrategicQuote(");
  const quoteEnd = source.indexOf("\nasync function pricingQuote", quoteStart);
  const quoteEngine = source.slice(quoteStart, quoteEnd);
  assert.match(quoteEngine, /percentageCommission=Math\.round\(service\*rate\)/);
  assert.match(quoteEngine, /fixedCommission=Math\.max\(0,Math\.round\(Number\(commissionFixedCents\)\|\|0\)\)/);
  assert.match(quoteEngine, /commission_percent_cents:percentageCommission/);
  assert.match(quoteEngine, /commission_fixed_cents:fixedCommission/);
});

test("regulated customer ceiling caps the final price including travel", () => {
  const quoteStart = source.indexOf("function financeStrategicQuote(");
  const quoteEnd = source.indexOf("\nasync function pricingQuote", quoteStart);
  const quoteEngine = source.slice(quoteStart, quoteEnd);
  assert.match(quoteEngine, /let clientPrice=service\+travel\.total_cost_cents;[\s\S]*?clientPrice=Math\.min\(clientPrice,Math\.max\(0,Math\.round\(Number\(regulatedMaxCents\)\|\|0\)\)\)/);
});
