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

test("rejects missing financial fields instead of treating them as zero", () => {
  const incomplete = {...settled};
  delete incomplete.pspFeeCents;
  assert.deepEqual(calculateProfitability({orders:[incomplete]}), {
    ok:false, error:"INVALID_OR_UNRECONCILED_LEDGER_RECORD"
  });
});

test("rejects sparse ledger arrays and unsafe aggregate overflow", () => {
  const sparse = [];
  sparse.length = 1;
  assert.equal(calculateProfitability({orders:sparse}).ok,false);
  assert.equal(calculateProfitability({orders:[
    {...settled, platformCommissionCents:Number.MAX_SAFE_INTEGER},
    {...settled, platformCommissionCents:1}
  ]}).ok,false);
});

test("normalizes activity labels before grouping", () => {
  const result=calculateProfitability({orders:[settled,{...settled,activity:" services "}]});
  assert.equal(Object.keys(result.byActivity).length,1);
  assert.equal(result.byActivity.services.orders,2);
});
