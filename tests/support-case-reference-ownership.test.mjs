import test from "node:test";
import assert from "node:assert/strict";
import { supportCaseReferenceAllowed } from "../src/index.js";

const mission = {
  id: "mission-1",
  client_user_id: "client-user-1",
  intervenant_user_id: "worker-user-1"
};

test("client may link support only to their own mission", () => {
  assert.equal(supportCaseReferenceAllowed("CLIENT", "client-user-1", mission), true);
  assert.equal(supportCaseReferenceAllowed("CLIENT", "other-user", mission), false);
});

test("intervenant may link support only to their assigned mission", () => {
  assert.equal(supportCaseReferenceAllowed("INTERVENANT", "worker-user-1", mission), true);
  assert.equal(supportCaseReferenceAllowed("INTERVENANT", "other-user", mission), false);
});

test("complaint must belong to the same verified mission", () => {
  assert.equal(supportCaseReferenceAllowed("CLIENT", "client-user-1", mission, { mission_id: "mission-1" }), true);
  assert.equal(supportCaseReferenceAllowed("CLIENT", "client-user-1", mission, { mission_id: "other-mission" }), false);
});

test("company and unknown roles fail closed until ownership mapping exists", () => {
  assert.equal(supportCaseReferenceAllowed("SOCIETE", "company-user", mission), false);
  assert.equal(supportCaseReferenceAllowed("UNKNOWN", "client-user-1", mission), false);
  assert.equal(supportCaseReferenceAllowed("CLIENT", "client-user-1", null), false);
});

test("manager may resolve references after manager authentication", () => {
  assert.equal(supportCaseReferenceAllowed("GERANTE", "manager-user", null), true);
  assert.equal(supportCaseReferenceAllowed("ADMIN", "admin-user", null), true);
});
