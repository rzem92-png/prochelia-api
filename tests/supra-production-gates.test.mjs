import test from "node:test";
import assert from "node:assert/strict";
import { buildSupraPlan, getSupraDomainRegistry } from "../src/supra-orchestrator.js";

const SENSITIVE_ACTIONS = [
  "REFUND", "PAYOUT", "CHARGE", "CHANGE_PRICE", "ACTIVATE_PROMOTION",
  "ASSIGN_REPLACEMENT", "RESCHEDULE_MISSION", "CANCEL_MISSION",
  "CONTRACT_CHANGE", "PERSONAL_DATA_EXPORT", "PERSONAL_DATA_DELETE",
  "ACCOUNT_SUSPENSION", "HIRE", "TERMINATE"
];

test("every registered domain is unique and exposes capabilities", () => {
  const registry = getSupraDomainRegistry();
  const names = registry.map((entry) => entry.domain);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.length >= 18);
  for (const entry of registry) {
    assert.ok(Array.isArray(entry.capabilities));
    assert.ok(entry.capabilities.length > 0);
  }
});

test("every sensitive action is approval-gated and never executable by the planner", () => {
  for (const requestedAction of SENSITIVE_ACTIONS) {
    const plan = buildSupraPlan({ caseType: "analyse_generale", requestedAction, impact: "LOW" });
    assert.equal(plan.autonomy.approvalRequired, true, requestedAction);
    assert.equal(plan.decisionOwner, "GERANTE", requestedAction);
    assert.equal(plan.executionAllowed, false, requestedAction);
    assert.equal(plan.autonomy.executionAdapterReady, false, requestedAction);
  }
});

test("unknown and outbound side-effect actions fail closed", () => {
  for (const requestedAction of ["SEND_EMAIL", "SEND_SMS", "PUBLISH_CAMPAIGN", "DELETE_ACCOUNT", "UNKNOWN_ACTION"]) {
    const plan = buildSupraPlan({ requestedAction, impact: "LOW" });
    assert.equal(plan.autonomy.approvalRequired, true, requestedAction);
    assert.equal(plan.executionAllowed, false, requestedAction);
  }
});

test("high and critical impact always require approval", () => {
  for (const impact of ["HIGH", "CRITICAL"]) {
    const plan = buildSupraPlan({ requestedAction: "GENERATE_SUMMARY", impact });
    assert.equal(plan.autonomy.approvalRequired, true, impact);
    assert.equal(plan.executionAllowed, false, impact);
  }
});

test("caller-supplied evidence flags never authorize execution", () => {
  const plan = buildSupraPlan({
    caseType: "remboursement",
    requestedAction: "REFUND",
    impact: "LOW",
    context: {
      missionOwnershipVerified: true,
      providerEligibilityVerified: true,
      providerAvailabilityVerified: true,
      clientOwnershipVerified: true,
      pspConfirmed: true
    }
  });
  assert.equal(plan.autonomy.approvalRequired, true);
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.autonomy.executionAdapterReady, false);
});

test("emergency signals always override routine autonomy", () => {
  const plan = buildSupraPlan({
    caseType: "analyse_generale",
    requestedAction: "GENERATE_SUMMARY",
    impact: "LOW",
    context: { immediateDanger: true }
  });
  assert.equal(plan.autonomy.level, "URGENT_HUMAN_ESCALATION");
  assert.equal(plan.autonomy.professionalEscalationRequired, true);
  assert.equal(plan.executionAllowed, false);
});

test("international market packs cannot authorize launch", () => {
  for (const market of ["fr", "be", "ma", "ca", "ch"]) {
    const plan = buildSupraPlan({ caseType: "expansion", market, impact: "HIGH" });
    assert.equal(plan.marketPack.launchAllowed, false, market);
    assert.equal(plan.executionAllowed, false, market);
  }
});
