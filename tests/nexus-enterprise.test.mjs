import test from "node:test";
import assert from "node:assert/strict";
import { evaluateNexusEnterpriseOpportunity, rankNexusEnterpriseOpportunities } from "../src/nexus-enterprise.js";

const company = (overrides = {}) => ({
  id: "small-business-1",
  capabilities: ["catering", "delivery", "local-marketing"],
  objectives: ["new-customers", "repeat-revenue"],
  capacityUnits: 8,
  availableBudgetCents: 500000,
  ...overrides
});
const approvals = {
  legalReview: true, insuranceVerified: true, privacyReview: true,
  safetyReview: true, financialReview: true, providerConsent: true,
  customerConsent: true, companyApproval: true
};
const opportunity = (overrides = {}) => ({
  id: "local-event",
  requiredCapabilities: ["catering", "delivery"],
  targetOutcomes: ["new-customers"],
  requiredCapacityUnits: 4,
  estimatedInvestmentCents: 100000,
  estimatedRevenueCents: 180000,
  riskLevel: "medium",
  approvals,
  ...overrides
});

test("strong enterprise fit is eligible only when all responsibility gates pass", () => {
  const result = evaluateNexusEnterpriseOpportunity({ company: company(), opportunity: opportunity() });
  assert.equal(result.fitScoreBps, 10000);
  assert.equal(result.launchEligible, true);
  assert.equal(result.status, "eligible_for_human_decision");
  assert.equal(result.requiresHumanApproval, true);
});

test("missing legal, insurance, privacy, safety or consent gate blocks launch", () => {
  for (const gate of Object.keys(approvals)) {
    const incomplete = { ...approvals, [gate]: false };
    const result = evaluateNexusEnterpriseOpportunity({
      company: company(), opportunity: opportunity({ approvals: incomplete })
    });
    assert.equal(result.launchEligible, false, gate);
    assert.ok(result.gates.blocked.includes(gate));
    assert.equal(result.status, "proposal_only");
  }
});

test("excellent score cannot override insufficient budget or capacity", () => {
  const result = evaluateNexusEnterpriseOpportunity({
    company: company({ availableBudgetCents: 999, capacityUnits: 1 }),
    opportunity: opportunity()
  });
  assert.equal(result.fitScoreBps, 6500);
  assert.equal(result.budgetFits, false);
  assert.equal(result.capacityFits, false);
  assert.equal(result.launchEligible, false);
});

test("high and unknown risk remain proposal-only even when approvals pass", () => {
  for (const riskLevel of ["high", "unknown"]) {
    const result = evaluateNexusEnterpriseOpportunity({
      company: company(), opportunity: opportunity({ riskLevel })
    });
    assert.equal(result.launchEligible, false);
  }
});

test("enterprise ranking is stable and prioritizes eligible opportunities", () => {
  const list = [
    opportunity({ id: "z", approvals: { ...approvals, privacyReview: false } }),
    opportunity({ id: "a" })
  ];
  const result = rankNexusEnterpriseOpportunities({ company: company(), opportunities: list });
  assert.equal(result[0].opportunityId, "a");
  assert.deepEqual(result, rankNexusEnterpriseOpportunities({ company: company(), opportunities: list }));
});

test("duplicate opportunity ids are rejected", () => {
  assert.throws(() => rankNexusEnterpriseOpportunities({
    company: company(), opportunities: [opportunity({ id: "same" }), opportunity({ id: "same" })]
  }), /unique/);
});

test("malformed capabilities, budgets and risk labels are rejected", () => {
  assert.throws(() => evaluateNexusEnterpriseOpportunity({
    company: company({ capabilities: ["x", "x"] }), opportunity: opportunity()
  }), /unique/);
  assert.throws(() => evaluateNexusEnterpriseOpportunity({
    company: company({ availableBudgetCents: -1 }), opportunity: opportunity()
  }), /non-negative/);
  assert.throws(() => evaluateNexusEnterpriseOpportunity({
    company: company(), opportunity: opportunity({ riskLevel: "guaranteed" })
  }), /riskLevel/);
});

test("loss-making opportunities cannot be mislabelled low risk", () => {
  assert.throws(() => evaluateNexusEnterpriseOpportunity({
    company: company(), opportunity: opportunity({
      estimatedInvestmentCents: 200000, estimatedRevenueCents: 100000, riskLevel: "low"
    })
  }), /cannot be labelled low risk/);
});

test("empty approval object safely remains proposal-only", () => {
  const result = evaluateNexusEnterpriseOpportunity({
    company: company(), opportunity: opportunity({ approvals: {} })
  });
  assert.equal(result.launchEligible, false);
  assert.equal(result.gates.blocked.length, 8);
});
