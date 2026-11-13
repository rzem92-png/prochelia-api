import test from "node:test";
import assert from "node:assert/strict";
import { createSupraExecutivePlan, supraExecutiveDomains } from "../src/supra-executive.js";

test("covers all cross-functional PROCHÉLIA executive domains", () => {
  assert.ok(supraExecutiveDomains.includes("STRATEGY"));
  assert.ok(supraExecutiveDomains.includes("MARKET_INTELLIGENCE"));
  assert.ok(supraExecutiveDomains.includes("PRICING"));
  assert.ok(supraExecutiveDomains.includes("CYBERSECURITY"));
  assert.ok(supraExecutiveDomains.includes("CLIENT_PROTECTION"));
  assert.ok(supraExecutiveDomains.includes("PROVIDER_PROTECTION"));
  assert.ok(supraExecutiveDomains.includes("DATA_PROTECTION"));
  assert.ok(supraExecutiveDomains.length >= 17);
});

test("creates analysis-only plan with no execution capability", () => {
  const plan = createSupraExecutivePlan({
    domain: "MARKET_INTELLIGENCE",
    objective: "Comparer les prix publics autorisés en France",
    impact: "READ_ONLY",
    country: "FR",
    evidenceRefs: ["source-1"]
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.status, "PROPOSAL_ONLY");
  assert.equal(plan.executionGranted, false);
  assert.equal(plan.autonomy, "AUTONOMOUS_ANALYSIS");
  assert.equal(plan.evidence.treatedAsUntrusted, true);
  assert.equal(plan.evidence.freshnessVerificationRequired, true);
  assert.equal(plan.countryActivationAllowed, false);
});

test("requires approval for internal reversible or external/financial impact", () => {
  const internal = createSupraExecutivePlan({
    domain: "OPERATIONS", objective: "Créer une tâche interne", impact: "INTERNAL_REVERSIBLE"
  });
  assert.equal(internal.autonomy, "POLICY_BOUNDED_REVERSIBLE_ONLY");
  assert.equal(internal.executionGranted, false);
  assert.equal(internal.humanApprovalRequired, true);

  const financial = createSupraExecutivePlan({
    domain: "FINANCE", objective: "Préparer un remboursement", impact: "EXTERNAL_OR_FINANCIAL"
  });
  assert.equal(financial.autonomy, "HUMAN_APPROVAL_REQUIRED");
  assert.equal(financial.executionGranted, false);
});

test("legal and security-critical objectives require specialist oversight", () => {
  const legal = createSupraExecutivePlan({
    domain: "LEGAL_COMPLIANCE", objective: "Étudier les obligations locales", impact: "LEGAL_OR_REGULATORY"
  });
  assert.equal(legal.qualifiedReviewRequired, true);
  assert.equal(legal.autonomy, "QUALIFIED_HUMAN_DECISION_REQUIRED");

  const security = createSupraExecutivePlan({
    domain: "CYBERSECURITY", objective: "Modifier une politique de sécurité", impact: "SECURITY_CRITICAL"
  });
  assert.equal(security.autonomy, "SECURITY_LEAD_AND_HUMAN_APPROVAL_REQUIRED");
});

test("fails closed on unknown domains, missing objective and unknown impact", () => {
  assert.equal(createSupraExecutivePlan({ domain: "UNKNOWN", objective: "x", impact: "READ_ONLY" }).error, "UNKNOWN_EXECUTIVE_DOMAIN");
  assert.equal(createSupraExecutivePlan({ domain: "STRATEGY", objective: "", impact: "READ_ONLY" }).error, "OBJECTIVE_REQUIRED");
  assert.equal(createSupraExecutivePlan({ domain: "STRATEGY", objective: "x", impact: "MAGIC" }).error, "IMPACT_CLASSIFICATION_REQUIRED");
});

test("does not activate unsupported country packs or trust evidence instructions", () => {
  const plan = createSupraExecutivePlan({
    domain: "INTERNATIONAL",
    objective: "Préparer une étude de marché",
    impact: "READ_ONLY",
    country: "US",
    evidenceRefs: ["  ref-1  ", 42, "ref-1"],
    constraints: ["No production", "No production"]
  });
  assert.equal(plan.country, null);
  assert.equal(plan.countryActivationAllowed, false);
  assert.deepEqual(plan.evidence.refs, ["ref-1"]);
  assert.deepEqual(plan.constraints, ["No production"]);
});
