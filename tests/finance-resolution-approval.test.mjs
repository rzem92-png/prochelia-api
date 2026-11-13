import test from "node:test";
import assert from "node:assert/strict";
import { financeResolutionDecision } from "../src/index.js";

test("finance case owner cannot approve their own resolution", () => {
  assert.equal(financeResolutionDecision("CLIENT", true, true), "MANAGER_APPROVAL_REQUIRED");
  assert.equal(financeResolutionDecision("INTERVENANT", true, true), "MANAGER_APPROVAL_REQUIRED");
});

test("finance case owner may escalate but cannot resolve", () => {
  assert.equal(financeResolutionDecision("CLIENT", true, false), "ESCALATED");
  assert.equal(financeResolutionDecision("INTERVENANT", true, false), "ESCALATED");
});

test("only manager roles can approve a finance resolution", () => {
  for (const role of ["GERANTE", "ADMIN", "FINANCE"]) {
    assert.equal(financeResolutionDecision(role, false, true), "RESOLVED");
  }
});

test("unrelated users cannot resolve or escalate another user's finance case", () => {
  assert.equal(financeResolutionDecision("CLIENT", false, false), "FORBIDDEN");
  assert.equal(financeResolutionDecision("CLIENT", false, true), "FORBIDDEN");
});
