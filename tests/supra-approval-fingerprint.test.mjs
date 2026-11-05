import test from "node:test";
import assert from "node:assert/strict";
import { createSupraApprovalFingerprint, verifySupraApprovalFingerprint } from "../src/supra-approval-fingerprint.js";

const input = {
  caseId: "case-001",
  proposalId: "proposal-001",
  proposalVersion: 3,
  proposal: { title: "Resolve booking conflict", action: "reconcile", expectedOutcome: "One booking remains", risk: "high" }
};

test("fingerprint is deterministic regardless of object key order", async () => {
  const first = await createSupraApprovalFingerprint(input);
  const reordered = await createSupraApprovalFingerprint({
    proposal: { risk: "high", expectedOutcome: "One booking remains", action: "reconcile", title: "Resolve booking conflict" },
    proposalVersion: 3, proposalId: "proposal-001", caseId: "case-001"
  });
  assert.equal(first.ok, true);
  assert.equal(first.fingerprint, reordered.fingerprint);
  assert.equal(first.executionAllowed, false);
});

test("fingerprint verification rejects changed case, proposal, version or content", async () => {
  const created = await createSupraApprovalFingerprint(input);
  assert.equal((await verifySupraApprovalFingerprint(input, created.fingerprint)).matches, true);
  for (const changed of [
    { ...input, caseId: "case-002" },
    { ...input, proposalId: "proposal-002" },
    { ...input, proposalVersion: 4 },
    { ...input, proposal: { ...input.proposal, risk: "critical" } }
  ]) {
    assert.equal((await verifySupraApprovalFingerprint(changed, created.fingerprint)).matches, false);
  }
});

test("invalid binding and malformed fingerprint fail closed", async () => {
  assert.equal((await createSupraApprovalFingerprint({})).ok, false);
  assert.equal((await verifySupraApprovalFingerprint(input, "not-a-hash")).matches, false);
});
