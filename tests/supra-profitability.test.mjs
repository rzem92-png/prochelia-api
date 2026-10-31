import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfitability } from "../src/supra-profitability.js";

const settled = {
  status: "SETTLED", activity: "services",
  clientPaidCents: 10000, providerPaidCents: 7000,
  platformCommissionCents: 2000, pspFeeCents: 300,
  taxCents: 0, refundCents: 0, variableOperatingCostCents: 200
};

test("calculates platform contribution margin from reconciled facts only", () => {
  const result = calculateProfitability({orders:[settled]});
  assert.equal(result.ok, true);
  assert.equal(result.totals.platformCommissionCents, 2000);
  assert.equal(result.totals.contributionMarginCents, 1500);
  assert.equal(result.byActivity.services.contributionMarginCents, 1500);
  assert.equal(result.metrics.netProfitAvailable, false);
  assert.equal(result.executionAllowed, false);
});

test("refunds reduce contribution margin and are counted separately", () => {
  const result = calculateProfitability({orders:[{
    ...settled, status:"REFUNDED", refundCents:500
  }]});
  assert.equal(result.totals.refundedOrders, 1);
  assert.equal(result.totals.contributionMarginCents, 1000);
});

test("rejects estimates, malformed amounts and unrecognized states", () => {
  assert.equal(calculateProfitability({orders:[{...settled,status:"QUOTE"}]}).ok,false);
  assert.equal(calculateProfitability({orders:[{...settled,pspFeeCents:-1}]}).ok,false);
  assert.equal(calculateProfitability({orders:[{...settled,clientPaidCents:1.5}]}).ok,false);
});

test("does not claim net profit without fixed overhead allocation", () => {
  const result=calculateProfitability({orders:[settled]});
  assert.equal(result.metrics.netProfitAvailable,false);
  assert.match(result.metrics.reasonNetProfitUnavailable,/FIXED_OVERHEAD/);
});

test("rejects non-array or excessive ledger input", () => {
  assert.equal(calculateProfitability({orders:"bad"}).ok,false);
});
