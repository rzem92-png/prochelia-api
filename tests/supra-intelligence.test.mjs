import test from "node:test";
import assert from "node:assert/strict";
import { assessSupraDecision, simulateResilience } from "../src/supra-intelligence.js";

test("SUPRA bloque toute affectation de remplaçant sans validation", () => {
  const result = assessSupraDecision({
    caseType: "absence_intervenant",
    impact: "LOW",
    requestedAction: "ASSIGN_REPLACEMENT",
    actorRole: "gerante",
    context: { mission_id: "m1", replacement_intervenant_id: "p2" }
  });
  assert.equal(result.executionAllowed, false);
  assert.equal(result.managerApprovalRequired, true);
  assert.deepEqual(result.missingEvidence, ["mission_ownership", "provider_eligibility", "provider_availability"]);
});

test("SUPRA exige une preuve PSP avant remboursement", () => {
  const result = assessSupraDecision({ requestedAction: "REFUND", impact: "LOW", actorRole: "gerante" });
  assert.equal(result.executionAllowed, false);
  assert.ok(result.missingEvidence.includes("psp_confirmation"));
});

test("SUPRA autorise uniquement une analyse de lecture seule", () => {
  const result = assessSupraDecision({ requestedAction: "GENERATE_SUMMARY", impact: "LOW", actorRole: "gerante" });
  assert.equal(result.autonomy, "AUTONOMOUS_READ_ONLY");
  assert.equal(result.executionAllowed, false);
});

test("SUPRA marque un dossier de litige comme décision Gérante", () => {
  const result = assessSupraDecision({ caseType: "litige", impact: "MEDIUM", requestedAction: "ANALYZE_AND_PROPOSE" });
  assert.equal(result.decisionOwner, "GERANTE");
  assert.equal(result.managerApprovalRequired, true);
});

test("simulation de crise valide calcule marge et runway sans action réelle", () => {
  const result = simulateResilience({
    monthlyRevenueCents: 1000000,
    monthlyFixedCostsCents: 300000,
    variableCostRate: 0.5,
    cashCents: 100000,
    demandShockRate: 0.3,
    costShockRate: 0.15
  });
  assert.equal(result.ok, true);
  assert.equal(result.stressed.monthlyRevenueCents, 700000);
  assert.equal(result.executionAllowed, false);
  assert.equal(result.decisionOwner, "GERANTE");
  assert.ok(result.proposedActions.length > 0);
});

test("simulation rejette les hypothèses incohérentes", () => {
  assert.deepEqual(simulateResilience({ monthlyRevenueCents: -1 }), { ok: false, error: "INVALID_SCENARIO_INPUT" });
});

test("malformed decision inputs fail closed without throwing", () => {
  for (const value of [null, "bad", 7, [], { context: [] }]) {
    const result = assessSupraDecision(value);
    assert.equal(result.executionAllowed, false);
    assert.equal(result.managerApprovalRequired, true);
    assert.equal(result.decisionOwner, "GERANTE");
  }
});

test("unknown impact fails closed", () => {
  const result = assessSupraDecision({ requestedAction: "GENERATE_SUMMARY", impact: "EXTREME", actorRole: "gerante" });
  assert.equal(result.executionAllowed, false);
  assert.equal(result.managerApprovalRequired, true);
});

test("accented and punctuated emergency case names are normalized", () => {
  const result = assessSupraDecision({ caseType: "Urgence médicale !!!", impact: "LOW" });
  assert.equal(result.professionalEscalationRequired, true);
  assert.equal(result.executionAllowed, false);
});

test("resilience rejects malformed and unsafe integer monetary inputs", () => {
  assert.equal(simulateResilience(null).ok, false);
  assert.equal(simulateResilience("bad").ok, false);
  assert.equal(simulateResilience({ monthlyRevenueCents: Number.MAX_SAFE_INTEGER + 1, monthlyFixedCostsCents: 0, variableCostRate: 0.2, cashCents: 0 }).ok, false);
});

test("resilience rejects arithmetic overflow rather than returning misleading figures", () => {
  const result = simulateResilience({
    monthlyRevenueCents: Number.MAX_SAFE_INTEGER,
    monthlyFixedCostsCents: Number.MAX_SAFE_INTEGER,
    variableCostRate: 1,
    cashCents: 0,
    costShockRate: 2
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "SCENARIO_AMOUNT_OVERFLOW");
});
