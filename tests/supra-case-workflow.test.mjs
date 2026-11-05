import test from "node:test";
import assert from "node:assert/strict";
import {
  createSupraCase,
  transitionSupraCase,
  canSupraExecuteAction,
  getSupraCaseTransitions
} from "../src/supra-case-workflow.js";

const base = {
  caseId: "CASE-001",
  caseType: "technical_support",
  title: "Erreur de connexion",
  actorId: "user-1",
  actorRole: "client",
  createdAt: "2026-11-05T09:00:00.000Z"
};

test("creates a case in new state with valid input", () => {
  const result = createSupraCase(base);
  assert.equal(result.ok, true);
  assert.equal(result.case.state, "new");
  assert.equal(result.case.risk, "NORMAL");
});

test("rejects malformed case input", () => {
  assert.equal(createSupraCase({ ...base, title: "" }).code, "INVALID_CASE_INPUT");
  assert.equal(createSupraCase(null).code, "INVALID_CASE_INPUT");
});

test("state machine rejects an invalid transition", () => {
  const created = createSupraCase(base).case;
  assert.equal(transitionSupraCase(created, "resolved").code, "TRANSITION_NOT_ALLOWED");
});

test("case cannot be resolved without independent evidence", () => {
  let current = createSupraCase(base).case;
  current = transitionSupraCase(current, "triaged").case;
  current = transitionSupraCase(current, "planned").case;
  current = transitionSupraCase(current, "in_progress").case;
  current = transitionSupraCase(current, "verification_pending").case;
  assert.equal(transitionSupraCase(current, "resolved").code, "RESOLUTION_EVIDENCE_REQUIRED");
});

test("resolution requires traceable evidence and creates audit entry", () => {
  let current = createSupraCase(base).case;
  for (const state of ["triaged", "planned", "in_progress", "verification_pending"]) {
    current = transitionSupraCase(current, state).case;
  }
  const result = transitionSupraCase(current, "resolved", {
    actorId: "support-agent-1",
    now: "2026-11-05T10:00:00.000Z",
    resolutionEvidence: {
      source: "test-system",
      reference: "check-123",
      verifiedBy: "support-agent-1",
      verifiedAt: "2026-11-05T10:00:00.000Z"
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.case.state, "resolved");
  assert.equal(result.case.audit.at(-1).to, "resolved");
});

test("high-risk case resolution requires human approval", () => {
  const created = createSupraCase({ ...base, caseType: "refund" }).case;
  let current = created;
  for (const state of ["triaged", "planned", "in_progress", "verification_pending"]) {
    current = transitionSupraCase(current, state).case;
  }
  const evidence = {
    source: "payment-provider",
    reference: "psp-ref-456",
    verifiedBy: "operator-2",
    verifiedAt: "2026-11-05T10:00:00.000Z"
  };
  assert.equal(transitionSupraCase(current, "resolved", { resolutionEvidence: evidence }).code, "HUMAN_APPROVAL_REQUIRED");
  assert.equal(transitionSupraCase(current, "resolved", { resolutionEvidence: evidence, humanApproval: true }).ok, true);
});

test("closed case is immutable", () => {
  let current = createSupraCase(base).case;
  current = transitionSupraCase(current, "triaged").case;
  current = transitionSupraCase(current, "waiting_user").case;
  current = transitionSupraCase(current, "closed").case;
  assert.equal(transitionSupraCase(current, "triaged").code, "CASE_CLOSED");
});

test("execution fails closed until all server controls are verified", () => {
  assert.equal(canSupraExecuteAction("SEND_NOTIFICATION").allowed, false);
  assert.equal(canSupraExecuteAction("SEND_NOTIFICATION", {
    executionAdapterReady: true,
    serverAuthorizationVerified: true,
    idempotencyKeyVerified: true,
    sourceOfTruthVerified: true
  }).allowed, true);
  assert.equal(canSupraExecuteAction("refund", {
    executionAdapterReady: true,
    serverAuthorizationVerified: true,
    idempotencyKeyVerified: true,
    sourceOfTruthVerified: true
  }).reason, "HUMAN_APPROVAL_REQUIRED");
});

test("unknown state has no transitions", () => {
  assert.deepEqual(getSupraCaseTransitions("unknown"), []);
});
