import test from "node:test";
import assert from "node:assert/strict";
import { operationalActionsPending } from "../src/index.js";

test("queued provider actions keep the operational case pending", () => {
  assert.equal(operationalActionsPending([{ action: "RESCHEDULE_MISSION", status: "PENDING" }]), true);
  assert.equal(operationalActionsPending([{ action: "NOTIFY_CLIENT", status: "WAITING_PROVIDER" }]), true);
});

test("completed actions do not keep the case pending", () => {
  assert.equal(operationalActionsPending([{ action: "INTERNAL_NOTE", status: "COMPLETED" }]), false);
  assert.equal(operationalActionsPending([]), false);
  assert.equal(operationalActionsPending(null), false);
});
