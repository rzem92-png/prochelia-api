import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSupraAction } from "../src/supra-governance.js";

test("allows analysis without granting execution", () => {
  const result = evaluateSupraAction({ actionType: "READ_ANALYZE" });
  assert.equal(result.decision, "ALLOW_ANALYSIS_ONLY");
  assert.equal(result.executionGranted, false);
  assert.equal(result.auditRequired, true);
});

test("denies unknown and missing action types by default", () => {
  assert.equal(evaluateSupraAction({}).decision, "DENY");
  assert.equal(evaluateSupraAction({ actionType: "RUN_ANYTHING" }).decision, "DENY");
});

test("blocks legal and contract decisions from autonomous execution", () => {
  for (const actionType of ["CONTRACT_SIGN", "LEGAL_DECISION", "REGULATORY_FILING", "IDENTITY_DECISION"]) {
    assert.equal(evaluateSupraAction({ actionType }).decision, "BLOCK_AUTONOMOUS");
  }
});

test("allows only preauthorized low-risk reversible internal actions with idempotency", () => {
  const allowed = evaluateSupraAction({
    actionType: "INTERNAL_TASK_CREATE",
    riskLevel: "LOW",
    reversible: true,
    preauthorized: true,
    idempotencyKey: "task-123"
  });
  assert.equal(allowed.decision, "ALLOW_CONTROLLED_EXECUTION");
  assert.equal(allowed.executionGranted, true);

  const denied = evaluateSupraAction({
    actionType: "INTERNAL_TASK_CREATE",
    riskLevel: "LOW",
    reversible: true,
    preauthorized: true
  });
  assert.equal(denied.decision, "REQUIRE_HUMAN_APPROVAL");
});

test("requires an explicit manager approval for externally visible and sensitive actions", () => {
  for (const actionType of ["EXTERNAL_MESSAGE_SEND", "PRICE_POLICY_CHANGE", "TALENT_SUSPEND"]) {
    assert.equal(evaluateSupraAction({ actionType }).decision, "REQUIRE_HUMAN_APPROVAL");
  }
  const approved = evaluateSupraAction({
    actionType: "PRICE_POLICY_CHANGE",
    humanApproval: { approved: true, approverRole: "gerante", approvalId: "approval-1" }
  });
  assert.equal(approved.decision, "ALLOW_CONTROLLED_EXECUTION");
});

test("financial actions require manager approval, ledger, provider authorization and idempotency", () => {
  const approval = { approved: true, approverRole: "gerante", approvalId: "approval-fin-1" };
  const missingGates = evaluateSupraAction({
    actionType: "PAYOUT_RELEASE",
    humanApproval: approval,
    ledgerReady: true,
    providerAuthorization: true
  });
  assert.equal(missingGates.decision, "REQUIRE_HUMAN_APPROVAL");

  const ready = evaluateSupraAction({
    actionType: "PAYOUT_RELEASE",
    humanApproval: approval,
    ledgerReady: true,
    providerAuthorization: true,
    idempotencyKey: "payout-123"
  });
  assert.equal(ready.decision, "ALLOW_CONTROLLED_EXECUTION");
});

test("data, security and production actions require their dedicated reviews", () => {
  const approval = { approved: true, approverRole: "gerante", approvalId: "approval-2" };
  assert.equal(evaluateSupraAction({ actionType: "DATA_EXPORT", humanApproval: approval }).decision, "REQUIRE_HUMAN_APPROVAL");
  assert.equal(evaluateSupraAction({ actionType: "DATA_ERASURE", humanApproval: approval }).decision, "REQUIRE_HUMAN_APPROVAL");
  assert.equal(evaluateSupraAction({ actionType: "SECURITY_POLICY_CHANGE", humanApproval: approval }).decision, "REQUIRE_HUMAN_APPROVAL");
  assert.equal(evaluateSupraAction({ actionType: "PRODUCTION_DEPLOY", humanApproval: approval }).decision, "REQUIRE_HUMAN_APPROVAL");
  assert.equal(evaluateSupraAction({
    actionType: "PRODUCTION_DEPLOY",
    humanApproval: approval,
    releaseGatePassed: true,
    twoPersonApproval: true
  }).decision, "ALLOW_CONTROLLED_EXECUTION");
});

test("rejects malformed manager approval and overlong idempotency keys", () => {
  assert.equal(evaluateSupraAction({
    actionType: "REFUND_ISSUE",
    humanApproval: { approved: true, approverRole: "client", approvalId: "x" },
    ledgerReady: true,
    providerAuthorization: true,
    idempotencyKey: "refund-1"
  }).decision, "REQUIRE_HUMAN_APPROVAL");

  assert.equal(evaluateSupraAction({
    actionType: "INTERNAL_TASK_CREATE",
    riskLevel: "LOW",
    reversible: true,
    preauthorized: true,
    idempotencyKey: "x".repeat(129)
  }).decision, "REQUIRE_HUMAN_APPROVAL");
});
