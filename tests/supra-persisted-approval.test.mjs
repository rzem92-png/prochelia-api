import test from "node:test";
import assert from "node:assert/strict";
import {
  supraApprovalDigestInput,
  supraApprovalProofMatches,
  supraCaseCreationPolicy
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
