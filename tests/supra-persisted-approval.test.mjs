import test from "node:test";
import assert from "node:assert/strict";
import {
  supraApprovalDigestInput,
  supraApprovalProofMatches,
  supraCaseCreationPolicy,
  outboxActionDisposition,
  outboxInterruptedApprovalDisposition,
  outboxIdempotencyMatches,
  operationalActionsPending
} from "../src/index.js";

test("SUPRA case creation is proposal-only and always requires manager approval", () => {
  assert.deepEqual(supraCaseCreationPolicy(), {
    mode: "MANAGER_APPROVAL",
    requiresManager: 1,
    status: "OPEN",
    executeImmediately: false
  });
});

test("approval digest binds the case, case type, mission and exact proposal", () => {
  const base = {
    id: "case-1",
    case_type: "absence_intervenant",
    mission_id: "mission-1",
    proposed_solution_json: '{"action":"SEARCH_REPLACEMENT"}'
  };
  const digestInput = supraApprovalDigestInput(base);
  assert.ok(digestInput);
  assert.notEqual(digestInput, supraApprovalDigestInput({ ...base, id: "case-2" }));
  assert.notEqual(digestInput, supraApprovalDigestInput({ ...base, mission_id: "mission-2" }));
  assert.notEqual(digestInput, supraApprovalDigestInput({ ...base, context_json: '{"refund_cents":100}' }));
  assert.notEqual(digestInput, supraApprovalDigestInput({ ...base, client_id: "another-client" }));
  assert.notEqual(digestInput, supraApprovalDigestInput({ ...base, proposed_solution_json: '{"action":"REFUND_REQUEST"}' }));
  assert.equal(supraApprovalDigestInput({ ...base, proposed_solution_json: "" }), null);
});

test("outbox proof requires the exact consumed approval, case and digest", () => {
  const approval = {
    id: "approval-1",
    case_id: "case-1",
    action_digest: "digest-1",
    status: "CONSUMED"
  };
  const payload = { approval_id: "approval-1", action_digest: "digest-1" };
  assert.equal(supraApprovalProofMatches(approval, payload, "case-1"), true);
  assert.equal(supraApprovalProofMatches({ ...approval, status: "EXECUTING" }, payload, "case-1"), false);
  assert.equal(supraApprovalProofMatches(approval, { ...payload, action_digest: "other" }, "case-1"), false);
  assert.equal(supraApprovalProofMatches(approval, payload, "case-2"), false);
  assert.equal(supraApprovalProofMatches(approval, { ...payload, approval_id: "other" }, "case-1"), false);
  assert.equal(supraApprovalProofMatches(null, payload, "case-1"), false);
});

test("outbox never treats an action without an executor as completed", () => {
  assert.equal(outboxActionDisposition("PSP_REFUND_REVIEW"), "WAITING_PROVIDER");
  assert.equal(outboxActionDisposition("NOTIFY_CLIENT"), "WAITING_PROVIDER");
  assert.equal(outboxActionDisposition("ASSIGN_REPLACEMENT"), "WAITING_PROVIDER");
  assert.equal(outboxActionDisposition("MISSION_VERIFY_AND_NOTIFY"), "WAITING_REVIEW");
  assert.equal(outboxActionDisposition("UNKNOWN_ACTION"), "WAITING_REVIEW");
  assert.equal(outboxActionDisposition(""), "WAITING_REVIEW");
});

test("outbox idempotency is bound to the same case, action and exact payload", () => {
  const existing = {
    case_id: "case-1",
    action_type: "NOTIFY_CLIENT",
    payload_json: '{"message":"approved"}'
  };
  assert.equal(outboxIdempotencyMatches(existing, "case-1", "NOTIFY_CLIENT", '{"message":"approved"}'), true);
  assert.equal(outboxIdempotencyMatches(existing, "case-2", "NOTIFY_CLIENT", '{"message":"approved"}'), false);
  assert.equal(outboxIdempotencyMatches(existing, "case-1", "PSP_REFUND_REVIEW", '{"message":"approved"}'), false);
  assert.equal(outboxIdempotencyMatches(existing, "case-1", "NOTIFY_CLIENT", '{"message":"changed"}'), false);
  assert.equal(outboxIdempotencyMatches(null, "case-1", "NOTIFY_CLIENT", '{"message":"approved"}'), false);
});

test("interrupted approvals wait only for a live commit and expire into explicit review", () => {
  assert.equal(outboxInterruptedApprovalDisposition({ approval_unexpired: 1 }), "WAITING_APPROVAL_COMMIT");
  assert.equal(outboxInterruptedApprovalDisposition({ approval_unexpired: 0 }), "WAITING_REVIEW");
  assert.equal(outboxInterruptedApprovalDisposition({ approval_unexpired: null }), "WAITING_REVIEW");
  assert.equal(outboxInterruptedApprovalDisposition(null), "WAITING_REVIEW");
});

test("SUPRA fails closed when no business action was queued", () => {
  assert.equal(operationalActionsPending([]), true);
  assert.equal(operationalActionsPending(null), true);
  assert.equal(operationalActionsPending(undefined), true);
});

test("SUPRA keeps review and processing outbox states pending", () => {
  assert.equal(operationalActionsPending([{ status: "WAITING_REVIEW" }]), true);
  assert.equal(operationalActionsPending([{ status: "PROCESSING" }]), true);
  assert.equal(operationalActionsPending([{ status: "WAITING_PROVIDER" }]), true);
  assert.equal(operationalActionsPending([{ status: "PENDING" }]), true);
  assert.equal(operationalActionsPending([{ status: "COMPLETED" }]), false);
});
