import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMarketActivation, marketActivationRequirements } from "../src/market-expansion-policy.js";
function allChecks(category = "local_goods") {
  return Object.fromEntries([
    ...marketActivationRequirements.baseline,
    ...(marketActivationRequirements.categories[category] || [])
  ].map((key) => [key, true]));
}
test("market pair is denied before explicit pilot approval", () => {
  const result = evaluateMarketActivation({ countryCode: "FR", categoryCode: "local_goods", status: "REVIEW_REQUIRED", checks: allChecks() });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "MARKET_NOT_APPROVED");
});
test("market pair is approved only when every baseline and category gate is true", () => {
  const result = evaluateMarketActivation({ countryCode: "FR", categoryCode: "food", status: "APPROVED_FOR_PILOT", checks: allChecks("food") });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.missingChecks, []);
});
test("missing or non-boolean checks fail closed", () => {
  const checks = allChecks("home_support");
  checks.workerStatusReview = 1;
  delete checks.privacyReview;
  const result = evaluateMarketActivation({ countryCode: "BE", categoryCode: "home_support", status: "ACTIVE", checks });
  assert.equal(result.allowed, false);
  assert.ok(result.missingChecks.includes("workerStatusReview"));
  assert.ok(result.missingChecks.includes("privacyReview"));
});
test("suspended markets remain blocked even with complete evidence", () => {
  const result = evaluateMarketActivation({ countryCode: "CA", categoryCode: "trades", status: "SUSPENDED", checks: allChecks("trades") });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "MARKET_SUSPENDED");
});
test("invalid country, category, status and check shapes are rejected", () => {
  const base = { countryCode: "FR", categoryCode: "local_goods", status: "APPROVED_FOR_PILOT", checks: allChecks() };
  assert.throws(() => evaluateMarketActivation({ ...base, countryCode: "France" }), /countryCode/);
  assert.throws(() => evaluateMarketActivation({ ...base, categoryCode: "Local Goods" }), /categoryCode/);
  assert.throws(() => evaluateMarketActivation({ ...base, status: "AUTO_APPROVED" }), /status/);
  assert.throws(() => evaluateMarketActivation({ ...base, checks: [] }), /checks/);
});
