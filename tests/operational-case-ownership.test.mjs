import test from "node:test";
import assert from "node:assert/strict";
import { operationalCaseOwnershipAllowed } from "../src/index.js";

const mission = {
  client_user_id: "client-user-1",
  intervenant_user_id: "worker-user-1"
};

test("a client can attach an operational case only to their own mission", () => {
  assert.equal(operationalCaseOwnershipAllowed("client", "client-user-1", mission), true);
  assert.equal(operationalCaseOwnershipAllowed("client", "other-user", mission), false);
});

test("an intervenant can attach an operational case only to a mission assigned to them", () => {
  assert.equal(operationalCaseOwnershipAllowed("intervenant", "worker-user-1", mission), true);
  assert.equal(operationalCaseOwnershipAllowed("intervenant", "other-user", mission), false);
});

test("company and unknown roles fail closed without a verified ownership mapping", () => {
  assert.equal(operationalCaseOwnershipAllowed("entreprise", "company-user", mission), false);
  assert.equal(operationalCaseOwnershipAllowed("client", "client-user-1", null), false);
  assert.equal(operationalCaseOwnershipAllowed("unknown", "client-user-1", mission), false);
});

test("only a manager can bypass mission ownership verification", () => {
  assert.equal(operationalCaseOwnershipAllowed("gerante", "manager-user", null), true);
});
