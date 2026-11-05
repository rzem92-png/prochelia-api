import test from "node:test";
import assert from "node:assert/strict";
import { validateSupraApprovalDecision } from "../src/supra-approval-policy.js";

const now = Date.parse("2026-11-05T09:00:00Z");
const record = {
  approvalId: "approval-123", caseId: "case-123", proposalId: "proposal-123",
  proposalVersion: 2, fingerprint: "a".repeat(64), decision: "approve",
  createdAt: "2026-11-05T08:59:00Z", expiresAt: "2026-11-05T09:30:00Z"
};
const trusted = {
  authenticated: true, actorRole: "gerante", actorId: "manager-1",
  caseId: "case-123", proposalId: "proposal-123", proposalVersion: 2,
  fingerprint: "a".repeat(64), currentStatus: "approval_required",
  alreadyConsumed: false, nowMs: now
};

test("approval decision accepts matching authenticated server context, but never executes", () => {
  const result = validateSupraApprovalDecision(record, trusted);
  assert.equal(result.ok, true);
  assert.equal(result.consumeAtomically, true);
  assert.equal(result.executionAllowed, false);
  assert.equal(result.nextStep, "HUMAN_APPROVED_AWAITING_SERVER_POLICY");
});

test("rejects unauthenticated or non-manager actor", () => {
  assert.equal(validateSupraApprovalDecision(record, { ...trusted, authenticated: false }).code, "TRUSTED_CONTEXT_MISMATCH");
  assert.equal(validateSupraApprovalDecision(record, { ...trusted, actorRole: "client" }).code, "TRUSTED_CONTEXT_MISMATCH");
});

test("rejects stale context, replay, and wrong case/proposal/version/hash", () => {
  assert.equal(validateSupraApprovalDecision(record, { ...trusted, currentStatus: "resolved" }).code, "CASE_NOT_AWAITING_APPROVAL");
  assert.equal(validateSupraApprovalDecision(record, { ...trusted, alreadyConsumed: true }).code, "APPROVAL_ALREADY_CONSUMED");
  assert.equal(validateSupraApprovalDecision(record, { ...trusted, proposalVersion: 3 }).code, "TRUSTED_CONTEXT_MISMATCH");
  assert.equal(validateSupraApprovalDecision(record, { ...trusted, fingerprint: "b".repeat(64) }).code, "TRUSTED_CONTEXT_MISMATCH");
});

test("rejects expired, future-created, and overlong approvals", () => {
  assert.equal(validateSupraApprovalDecision({ ...record, expiresAt: "2026-11-05T08:59:59Z" }, trusted).code, "APPROVAL_EXPIRED");
  assert.equal(validateSupraApprovalDecision({ ...record, createdAt: "2026-11-05T09:02:00Z" }, trusted).code, "APPROVAL_CREATED_IN_FUTURE");
  assert.equal(validateSupraApprovalDecision({ ...record, expiresAt: "2026-11-07T09:00:00Z" }, trusted).code, "APPROVAL_TTL_TOO_LONG");
});

test("only documented decision values are accepted", () => {
  assert.equal(validateSupraApprovalDecision({ ...record, decision: "execute_now" }, trusted).code, "INVALID_APPROVAL_RECORD");
});
