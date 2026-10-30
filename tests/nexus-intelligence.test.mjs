import test from "node:test";
import assert from "node:assert/strict";
import { simulateNexusUnitEconomics, aggregateNexusDemand } from "../src/nexus-intelligence.js";

test("unit economics reconciles gross, payout and platform revenue", () => {
  const result = simulateNexusUnitEconomics({
    grossCollectedCents: 12000,
    providerPayoutCents: 9000,
    platformRevenueCents: 3000,
    pspFeeCents: 450,
    variableOperatingCostCents: 250,
    platformRefundCostCents: 0
  });
  assert.equal(result.platformCostsCents, 700);
  assert.equal(result.contributionMarginCents, 2300);
  assert.equal(result.contributionMarginBps, 7666);
  assert.equal(result.isContributionPositive, true);
  assert.equal(result.isFullyAllocated, true);
});

test("unit economics permits negative contribution and exposes it", () => {
  const result = simulateNexusUnitEconomics({
    grossCollectedCents: 10000, providerPayoutCents: 8000,
    platformRevenueCents: 2000, pspFeeCents: 500,
    variableOperatingCostCents: 1000, platformRefundCostCents: 1000
  });
  assert.equal(result.contributionMarginCents, -500);
  assert.equal(result.isContributionPositive, false);
});

test("unit economics rejects hidden or impossible allocations", () => {
  assert.throws(() => simulateNexusUnitEconomics({
    grossCollectedCents: 1000, providerPayoutCents: 800,
    platformRevenueCents: 300, pspFeeCents: 0,
    variableOperatingCostCents: 0, platformRefundCostCents: 0
  }), /cannot exceed gross/);
  assert.throws(() => simulateNexusUnitEconomics({
    grossCollectedCents: -1, providerPayoutCents: 0,
    platformRevenueCents: 0, pspFeeCents: 0,
    variableOperatingCostCents: 0, platformRefundCostCents: 0
  }), /non-negative safe integer/);
});

test("unit economics uses exact integer arithmetic for very large safe amounts", () => {
  const result = simulateNexusUnitEconomics({
    grossCollectedCents: Number.MAX_SAFE_INTEGER,
    providerPayoutCents: 0,
    platformRevenueCents: Number.MAX_SAFE_INTEGER,
    pspFeeCents: 1,
    variableOperatingCostCents: 0,
    platformRefundCostCents: 0
  });
  assert.equal(result.contributionMarginCents, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(result.contributionMarginBps, 9999);
});

test("demand aggregation suppresses small cohorts", () => {
  const signals = Array.from({ length: 4 }, () => ({
    categoryKey: "errands", areaKey: "zone-a", outcome: "unmet"
  }));
  assert.deepEqual(aggregateNexusDemand({ signals }), []);
});

test("demand aggregation reports only coarse groups above the privacy threshold", () => {
  const signals = [
    ...Array.from({ length: 4 }, () => ({ categoryKey: "errands", areaKey: "zone-a", outcome: "unmet" })),
    { categoryKey: "errands", areaKey: "zone-a", outcome: "fulfilled" },
    ...Array.from({ length: 5 }, () => ({ categoryKey: "cleaning", areaKey: "zone-b", outcome: "unmet" }))
  ];
  const result = aggregateNexusDemand({ signals });
  assert.equal(result.length, 2);
  assert.equal(result[0].categoryKey, "cleaning");
  assert.equal(result[0].unmetRateBps, 10000);
  assert.equal(result[1].unmetRateBps, 8000);
  assert.equal("userId" in result[0], false);
});

test("demand aggregation rejects free text, invalid outcomes and too-small thresholds", () => {
  assert.throws(() => aggregateNexusDemand({
    signals: [{ categoryKey: "x", areaKey: "y", outcome: "unknown" }]
  }), /outcome/);
  assert.throws(() => aggregateNexusDemand({ signals: [], minCohortSize: 2 }), /at least 5/);
  assert.throws(() => aggregateNexusDemand({
    signals: [{ categoryKey: "", areaKey: "y", outcome: "unmet" }]
  }), /coarse categoryKey/);
});

test("demand aggregation is deterministic regardless of input order", () => {
  const signals = [
    ...Array.from({ length: 5 }, () => ({ categoryKey: "transport", areaKey: "sector-1", outcome: "unmet" })),
    ...Array.from({ length: 5 }, () => ({ categoryKey: "meals", areaKey: "sector-2", outcome: "fulfilled" }))
  ];
  const reverse = [...signals].reverse();
  assert.deepEqual(aggregateNexusDemand({ signals }), aggregateNexusDemand({ signals: reverse }));
});
