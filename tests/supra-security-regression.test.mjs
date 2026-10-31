import test from "node:test";
import assert from "node:assert/strict";
import { getSupraDomainRegistry, buildSupraPlan } from "../src/supra-orchestrator.js";
import { assessSupraDecision, simulateResilience } from "../src/supra-intelligence.js";

test("registry exposes the expected cross-functional domains without duplicates", () => {
  const domains=getSupraDomainRegistry(), names=domains.map(x=>x.domain);
  assert.ok(names.length>=18);
  assert.equal(new Set(names).size,names.length);
  for(const required of ["direction","finance","comptabilite","tarification","missions","matching","clients","securite","rgpd","juridique","international","crise"])
    assert.ok(names.includes(required),"missing domain: "+required);
});

test("sensitive actions are never executable autonomously", () => {
  for(const action of ["REFUND","PAYOUT","CHANGE_PRICE","CONTRACT_CHANGE","PERSONAL_DATA_DELETE","TERMINATE"]) {
    const decision=assessSupraDecision({caseType:"routine",impact:"LOW",requestedAction:action,actorRole:"gerante"});
    assert.equal(decision.executionAllowed,false,action);
    assert.equal(decision.managerApprovalRequired,true,action);
  }
});

test("high and critical impacts require manager approval", () => {
  for(const impact of ["HIGH","CRITICAL"]) {
    const decision=assessSupraDecision({caseType:"routine",impact,requestedAction:"GENERATE_SUMMARY",actorRole:"gerante"});
    assert.equal(decision.executionAllowed,false);
    assert.equal(decision.managerApprovalRequired,true);
  }
});

test("sensitive plans explicitly require manager approval and evidence collection", () => {
  const plan=buildSupraPlan({caseType:"remboursement",impact:"HIGH",requestedAction:"REFUND",
    context:{mission_id:"m1",client_id:"c1"},market:"fr"});
  assert.equal(plan.autonomy.approvalRequired,true);
  assert.equal(plan.autonomy.executionAdapterReady,false);
  assert.ok(plan.method.includes("collect_authorized_evidence"));
  assert.ok(plan.method.includes("request_explicit_manager_approval"));
  assert.ok(plan.method.includes("verify_outcomes_and_log_evidence"));
  assert.ok(Array.isArray(plan.missingEvidence));
});

test("emergency and safeguarding signals are escalated without execution", () => {
  const plan=buildSupraPlan({caseType:"danger_personne",impact:"CRITICAL",context:{immediateDanger:true}});
  assert.equal(plan.autonomy.level,"URGENT_HUMAN_ESCALATION");
  assert.equal(plan.autonomy.executionAdapterReady,false);
  assert.equal(plan.autonomy.professionalEscalationRequired,true);
  assert.ok(plan.method.includes("escalate_to_emergency_or_qualified_professional"));
});

test("resilience rejects invalid financial assumptions", () => {
  const result=simulateResilience({monthlyRevenueCents:-1,monthlyFixedCostsCents:100,variableCostRate:0.2,cashCents:100});
  assert.equal(result.ok,false);
});

test("resilience output is indicative and never triggers execution", () => {
  const result=simulateResilience({monthlyRevenueCents:1000000,monthlyFixedCostsCents:300000,variableCostRate:0.25,cashCents:500000});
  assert.equal(result.ok,true);
  assert.equal(result.executionAllowed,false);
  assert.equal(result.decisionOwner,"GERANTE");
});


test("accented French emergency wording is normalized and escalated", () => {
  const plan = buildSupraPlan({ caseType: "urgence médicale", impact: "CRITICAL" });
  assert.equal(plan.caseType, "urgence_medicale");
  assert.equal(plan.autonomy.level, "URGENT_HUMAN_ESCALATION");
  assert.equal(plan.autonomy.professionalEscalationRequired, true);
  assert.equal(plan.executionAllowed, false);
});

test("routine reminders are not autonomous until consent and channel controls exist", () => {
  const plan = buildSupraPlan({
    caseType: "routine",
    impact: "LOW",
    requestedAction: "SEND_ROUTINE_REMINDER"
  });
  assert.equal(plan.autonomy.routineReadOnlyAutonomy, false);
  assert.equal(plan.autonomy.approvalRequired, true);
  assert.equal(plan.executionAllowed, false);
});

test("ordinary low-impact read-only tasks remain auditable and non-executable", () => {
  const plan = buildSupraPlan({
    caseType: "routine",
    impact: "LOW",
    requestedAction: "GENERATE_SUMMARY"
  });
  assert.equal(plan.autonomy.routineReadOnlyAutonomy, true);
  assert.equal(plan.autonomy.approvalRequired, false);
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.auditRequired, true);
});


test("urgent safeguarding cases are routed to the security domain", () => {
  for (const caseType of ["urgence médicale", "danger personne", "suspicion maltraitance"]) {
    const plan = buildSupraPlan({ caseType, impact: "CRITICAL" });
    assert.equal(plan.domain, "securite", caseType);
    assert.equal(plan.autonomy.level, "URGENT_HUMAN_ESCALATION", caseType);
  }
});

test("complex legal cases are routed to the legal domain and require human review", () => {
  const plan = buildSupraPlan({ caseType: "conseil juridique complexe", impact: "HIGH" });
  assert.equal(plan.domain, "juridique");
  assert.equal(plan.autonomy.approvalRequired, true);
  assert.equal(plan.executionAllowed, false);
});


test("decision engine normalizes accented emergency cases and escalates to a qualified human", () => {
  const decision = assessSupraDecision({
    caseType: "urgence médicale",
    impact: "LOW",
    requestedAction: "GENERATE_SUMMARY",
    actorRole: "gerante"
  });
  assert.equal(decision.caseType, "urgence_medicale");
  assert.equal(decision.autonomy, "URGENT_HUMAN_ESCALATION");
  assert.equal(decision.professionalEscalationRequired, true);
  assert.equal(decision.recommendedNextStep, "ESCALATE_TO_EMERGENCY_OR_QUALIFIED_PROFESSIONAL");
  assert.equal(decision.executionAllowed, false);
});

test("immediate danger overrides an otherwise read-only action", () => {
  const decision = assessSupraDecision({
    caseType: "routine",
    impact: "LOW",
    requestedAction: "GENERATE_SUMMARY",
    actorRole: "gerante",
    context: { immediateDanger: true }
  });
  assert.equal(decision.autonomy, "URGENT_HUMAN_ESCALATION");
  assert.equal(decision.managerApprovalRequired, true);
  assert.equal(decision.executionAllowed, false);
});
