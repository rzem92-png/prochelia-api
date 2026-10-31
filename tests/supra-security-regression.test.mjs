import test from "node:test";
import assert from "node:assert/strict";
import { getSupraDomainRegistry, buildSupraPlan } from "../src/supra-orchestrator.js";
import { assessSupraDecision, simulateResilience } from "../src/supra-intelligence.js";

test("registry exposes the expected cross-functional domains without duplicates", () => {
  const domains = getSupraDomainRegistry();
  const names = domains.map(x => x.domain);
  assert.ok(names.length >= 18);
  assert.equal(new Set(names).size, names.length);
  for (const required of ["direction","finance","comptabilite","tarification","missions","matching","clients","securite","rgpd","juridique","international","crise"]) {
    assert.ok(names.includes(required), "missing domain: " + required);
  }
});

test("sensitive actions are never executable autonomously", () => {
  for (const action of ["REFUND","PAYOUT","CHANGE_PRICE","CONTRACT_CHANGE","PERSONAL_DATA_DELETE","TERMINATE"]) {
    const decision = assessSupraDecision({caseType:"routine",impact:"LOW",requestedAction:action,actorRole:"gerante"});
    assert.equal(decision.executionAllowed, false, action);
    assert.equal(decision.managerApprovalRequired, true, action);
  }
});

test("high and critical impacts require manager approval", () => {
  for (const impact of ["HIGH","CRITICAL"]) {
    const decision = assessSupraDecision({caseType:"routine",impact,requestedAction:"GENERATE_SUMMARY",actorRole:"gerante"});
    assert.equal(decision.executionAllowed, false);
    assert.equal(decision.managerApprovalRequired, true);
  }
});

test("plans include evidence collection, alternatives and approval for sensitive work", () => {
  const plan = buildSupraPlan({
    caseType:"remboursement", impact:"HIGH", requestedAction:"REFUND",
    context:{mission_id:"m1",client_id:"c1"}, market:"fr"
  });
  assert.equal(plan.autonomy.approvalRequired, true);
  assert.ok(plan.steps.includes("collect_authorized_evidence"));
  assert.ok(plan.steps.includes("request_explicit_manager_approval"));
  assert.ok(plan.steps.includes("verify_outcomes_and_log_evidence"));
});

test("emergency and safeguarding signals are escalated", () => {
  const plan = buildSupraPlan({caseType:"danger_personne",impact:"CRITICAL",context:{immediateDanger:true}});
  assert.ok(plan.escalation);
  assert.equal(plan.autonomy.executionAllowed, false);
});

test("resilience rejects invalid financial assumptions", () => {
  const result = simulateResilience({monthlyRevenueCents:-1,monthlyFixedCostsCents:100,variableCostRate:0.2,cashCents:100});
  assert.equal(result.ok, false);
});

test("resilience output is indicative and never triggers execution", () => {
  const result = simulateResilience({monthlyRevenueCents:1000000,monthlyFixedCostsCents:300000,variableCostRate:0.25,cashCents:500000});
  assert.equal(result.ok, true);
  assert.equal(result.executionAllowed, false);
  assert.equal(result.decisionOwner, "GERANTE");
});
