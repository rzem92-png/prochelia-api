import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEvidenceRecord, assessEvidenceSet, calculateUnitEconomics, evaluateValidationGates
} from "../src/supra-evidence-validation.js";

const now = "2026-11-05T12:00:00.000Z";
const evidence = (id, overrides = {}) => ({
  id, class: "customer_interview", source: "pilot interview",
  collectedAt: now, owner: "research-team", permission: "consented",
  consentReference: "consent-" + id, claim: "Customer needs convenient booking",
  evidenceKind: "observed", personalData: true, dataMinimized: true, ...overrides
});

test("validates evidence metadata and permission safeguards", () => {
  assert.equal(validateEvidenceRecord(evidence("ev-1"), now).valid, true);
  assert.equal(validateEvidenceRecord(evidence("ev-2", { consentReference: null }), now).reason, "CONSENT_REFERENCE_REQUIRED");
  assert.equal(validateEvidenceRecord(evidence("ev-3", { personalData: true, dataMinimized: false }), now).reason, "PERSONAL_DATA_MINIMIZATION_REQUIRED");
  assert.equal(validateEvidenceRecord(evidence("ev-4", { collectedAt: "2027-01-01T00:00:00.000Z" }), now).reason, "INVALID_EVIDENCE_TIMESTAMP");
});

test("evidence set is insufficient if empty, stale or invalid", () => {
  assert.equal(assessEvidenceSet([], { now }).status, "INSUFFICIENT");
  assert.equal(assessEvidenceSet([evidence("old", { collectedAt: "2025-01-01T00:00:00.000Z" })], { now }).status, "INSUFFICIENT");
  assert.equal(assessEvidenceSet([evidence("bad", { permission: "unknown" })], { now }).status, "INSUFFICIENT");
});

test("evidence set reports supported metadata only when minimum records are fresh", () => {
  const result = assessEvidenceSet([evidence("a"), evidence("b"), evidence("c")], { now, minimumEvidence: 3 });
  assert.equal(result.status, "SUPPORTED");
  assert.equal(result.verifiedCount, 3);
  assert.ok(result.caveat.includes("do not establish truth"));
});

test("unit economics computes contribution and break-even correctly", () => {
  const result = calculateUnitEconomics({
    grossPlatformRevenue: 12, paymentFees: 2, supportCost: 1, aiCost: 0.3,
    riskReserve: 0.7, acquisitionCost: 3, otherVariableCosts: 0,
    averageContributionPerTransaction: 5, monthlyFixedCosts: 1000
  });
  assert.equal(result.ok, true);
  assert.equal(result.contribution, 5);
  assert.equal(result.breakEvenTransactions, 200);
});

test("unit economics rejects negative costs and nonpositive break-even contribution", () => {
  assert.equal(calculateUnitEconomics({ grossPlatformRevenue: 3, paymentFees: -1 }).ok, false);
  assert.equal(calculateUnitEconomics({
    grossPlatformRevenue: 10, paymentFees: 1, supportCost: 0, aiCost: 0,
    riskReserve: 0, acquisitionCost: 0, otherVariableCosts: 0,
    averageContributionPerTransaction: 0
  }).reason, "POSITIVE_CONTRIBUTION_REQUIRED_FOR_BREAK_EVEN");
});

test("validation gates never self-authorize production", () => {
  assert.equal(evaluateValidationGates({}).status, "NO_GO");
  const complete = Object.fromEntries([
    "marketDemandEvidence", "unitEconomicsEvidence", "costEvidence", "complianceReview",
    "retentionEvidence", "securityPrivacyReview", "humanOwnerApproval"
  ].map(key => [key, true]));
  const result = evaluateValidationGates(complete);
  assert.equal(result.status, "READY_FOR_HUMAN_REVIEW");
  assert.equal(result.productionAuthorized, false);
});
