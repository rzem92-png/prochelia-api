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

import { supportCaseReferenceAllowed } from "../src/index.js";
const supportMission = { id:"mission-1", client_user_id:"client-user-1", intervenant_user_id:"worker-user-1" };
test("support cases: client may link only their own mission", () => {
 assert.equal(supportCaseReferenceAllowed("CLIENT","client-user-1",supportMission),true);
 assert.equal(supportCaseReferenceAllowed("CLIENT","other-user",supportMission),false);
});
test("support cases: intervenant may link only their assigned mission", () => {
 assert.equal(supportCaseReferenceAllowed("INTERVENANT","worker-user-1",supportMission),true);
 assert.equal(supportCaseReferenceAllowed("INTERVENANT","other-user",supportMission),false);
});
test("support cases: complaint must belong to the same verified mission", () => {
 assert.equal(supportCaseReferenceAllowed("CLIENT","client-user-1",supportMission,{mission_id:"mission-1"}),true);
 assert.equal(supportCaseReferenceAllowed("CLIENT","client-user-1",supportMission,{mission_id:"other-mission"}),false);
});
test("support cases: company and unknown roles fail closed", () => {
 assert.equal(supportCaseReferenceAllowed("SOCIETE","company-user",supportMission),false);
 assert.equal(supportCaseReferenceAllowed("UNKNOWN","client-user-1",supportMission),false);
 assert.equal(supportCaseReferenceAllowed("CLIENT","client-user-1",null),false);
});
test("support cases: manager may resolve references after manager authentication", () => {
 assert.equal(supportCaseReferenceAllowed("GERANTE","manager-user",null),true);
 assert.equal(supportCaseReferenceAllowed("ADMIN","admin-user",null),true);
});


import { operationalCaseRequiresManagerApproval } from "../src/index.js";

test("all non-manager submitted operational cases require explicit manager approval", () => {
  for (const role of ["client", "intervenant", "entreprise", "unknown", "", null]) {
    assert.equal(operationalCaseRequiresManagerApproval(role), true);
  }
});

test("only an authenticated manager role may use the manager-only case policy", () => {
  assert.equal(operationalCaseRequiresManagerApproval("gerante"), false);
  assert.equal(operationalCaseRequiresManagerApproval("GERANTE"), false);
});
