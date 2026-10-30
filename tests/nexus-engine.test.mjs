import test from "node:test";
import assert from "node:assert/strict";
import { rankNexusOpportunities, composeNexusScenarios } from "../src/nexus-engine.js";

const request = {
  requiredSkills: ["cleaning", "shopping"],
  budgetCents: 12000,
  maxDistanceKm: 10,
  slot: "2026-11-02T10:00"
};

const provider = (id, overrides = {}) => ({
  id, active: true, available: true, eligibilityVerified: true,
  skills: ["cleaning", "shopping"], priceCents: 9000, distanceKm: 2,
  ratingBps: 9000, reliabilityBps: 9500,
  availabilitySlots: [request.slot],
  ...overrides
});

test("ranking is deterministic and orders eligible candidates by score", () => {
  const candidates = [
    provider("b", { priceCents: 10000 }),
    provider("a", { priceCents: 8000, distanceKm: 1 })
  ];
  const first = rankNexusOpportunities({ request, candidates });
  const second = rankNexusOpportunities({ request, candidates });
  assert.deepEqual(first, second);
  assert.equal(first[0].candidateId, "a");
  assert.ok(first[0].scoreBps >= first[1].scoreBps);
});

test("hard eligibility excludes unverified, unavailable, inactive and out-of-range providers", () => {
  const candidates = [
    provider("ok"),
    provider("unverified", { eligibilityVerified: false }),
    provider("busy", { available: false }),
    provider("inactive", { active: false }),
    provider("far", { distanceKm: 11 })
  ];
  assert.deepEqual(
    rankNexusOpportunities({ request, candidates }).map(x => x.candidateId),
    ["ok"]
  );
});

test("ranking rejects duplicate ids and malformed money", () => {
  assert.throws(() => rankNexusOpportunities({
    request, candidates: [provider("x"), provider("x")]
  }), /unique/);
  assert.throws(() => rankNexusOpportunities({
    request, candidates: [provider("bad", { priceCents: 1.5 })]
  }), /priceCents/);
});

test("weights must total exactly 10000 basis points", () => {
  assert.throws(() => rankNexusOpportunities({
    request, candidates: [provider("x")],
    weights: { skills: 1, affordability: 1, proximity: 1, trust: 1 }
  }), /totaling 10000/);
});

test("two-provider composition combines complementary skills within budget", () => {
  const candidates = [
    provider("cleaner", { skills: ["cleaning"], priceCents: 5000 }),
    provider("shopper", { skills: ["shopping"], priceCents: 6000 })
  ];
  const result = composeNexusScenarios({ request, candidates });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].candidateIds, ["cleaner", "shopper"]);
  assert.equal(result[0].totalPriceCents, 11000);
});

test("composition rejects over-budget pairs and providers without the requested slot", () => {
  const overBudget = [
    provider("cleaner", { skills: ["cleaning"], priceCents: 7000 }),
    provider("shopper", { skills: ["shopping"], priceCents: 6000 })
  ];
  assert.equal(composeNexusScenarios({ request, candidates: overBudget }).length, 0);
  const noSlot = [
    provider("cleaner", { skills: ["cleaning"] }),
    provider("shopper", { skills: ["shopping"], availabilitySlots: [] })
  ];
  assert.equal(composeNexusScenarios({ request, candidates: noSlot }).length, 0);
});

test("composition requires each actor to contribute a distinct required skill", () => {
  const candidates = [
    provider("generalist", { skills: ["cleaning", "shopping"] }),
    provider("cleaner", { skills: ["cleaning"] })
  ];
  assert.equal(composeNexusScenarios({ request, candidates }).length, 0);
});

test("composition rejects invalid actor limits", () => {
  assert.throws(() => composeNexusScenarios({
    request, candidates: [], maxActors: 3
  }), /exactly two/);
});

test("solo ranking excludes candidates over budget, including zero-budget requests", () => {
  assert.deepEqual(rankNexusOpportunities({
    request, candidates: [provider("within", { priceCents: 12000 }), provider("over", { priceCents: 12001 })]
  }).map(x => x.candidateId), ["within"]);
  const zeroBudget = { ...request, budgetCents: 0 };
  assert.deepEqual(rankNexusOpportunities({
    request: zeroBudget, candidates: [provider("free", { priceCents: 0 }), provider("paid", { priceCents: 1 })]
  }).map(x => x.candidateId), ["free"]);
});

test("request and candidate skill lists reject duplicates and malformed entries", () => {
  assert.throws(() => rankNexusOpportunities({
    request: { ...request, requiredSkills: ["cleaning", "cleaning"] },
    candidates: [provider("x")]
  }), /unique non-empty strings/);
  assert.throws(() => rankNexusOpportunities({
    request, candidates: [provider("bad", { skills: ["cleaning", ""] })]
  }), /unique non-empty strings/);
});

test("zero-distance requests correctly prefer a provider at the exact location", () => {
  const zeroDistance = { ...request, maxDistanceKm: 0 };
  const result = rankNexusOpportunities({
    request: zeroDistance,
    candidates: [provider("exact", { distanceKm: 0 }), provider("away", { distanceKm: 0.1 })]
  });
  assert.deepEqual(result.map(x => x.candidateId), ["exact"]);
});

test("composition rejects duplicate candidate identities", () => {
  assert.throws(() => composeNexusScenarios({
    request,
    candidates: [provider("duplicate", { skills: ["cleaning"] }), provider("duplicate", { skills: ["shopping"] })]
  }), /unique/);
});

test("scoring rejects unknown dimensions instead of silently ignoring them", () => {
  assert.throws(() => rankNexusOpportunities({
    request, candidates: [provider("x")],
    weights: { skills: 4000, affordability: 2500, proximity: 1500, trust: 2000, popularity: 1 }
  }), /unsupported dimensions/);
});

test("candidate workload limits prevent unbounded quadratic composition", () => {
  assert.throws(() => composeNexusScenarios({
    request, candidates: Array.from({ length: 501 }, (_, i) => provider(String(i)))
  }), /candidate limit exceeded/);
  assert.throws(() => rankNexusOpportunities({
    request, candidates: Array.from({ length: 10001 }, (_, i) => provider(String(i)))
  }), /candidate limit exceeded/);
});
