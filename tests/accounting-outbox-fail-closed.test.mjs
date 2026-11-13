import test from "node:test";
import assert from "node:assert/strict";
import { queuedActionFinalStatus } from "../src/index.js";

test("accounting actions requiring a balanced journal remain awaiting review", () => {
  assert.equal(queuedActionFinalStatus({ performed: false, requires_review: true, reason: "BALANCED_LEDGER_JOURNAL_REQUIRED" }), "WAITING_REVIEW");
});

test("provider-dependent actions remain waiting for provider", () => {
  assert.equal(queuedActionFinalStatus({ performed: false, requires_provider: true }), "WAITING_PROVIDER");
});

test("only explicitly performed actions are marked done", () => {
  assert.equal(queuedActionFinalStatus({ performed: true }), "DONE");
  assert.equal(queuedActionFinalStatus({ performed: false }), "FAILED");
  assert.equal(queuedActionFinalStatus({}), "FAILED");
});
