import test from "node:test";
import assert from "node:assert/strict";
import { complaintOwnershipAllowed } from "../src/index.js";

const client = { id: "client-1", user_id: "user-1" };

test("a client may create a complaint only under their own verified client profile", () => {
  assert.equal(complaintOwnershipAllowed("client", "user-1", client), true);
  assert.equal(complaintOwnershipAllowed("client", "user-2", client), false);
});

test("a client may link a complaint only to their own mission", () => {
  assert.equal(complaintOwnershipAllowed("client", "user-1", client, { id: "mission-1", client_id: "client-1" }), true);
  assert.equal(complaintOwnershipAllowed("client", "user-1", client, { id: "mission-2", client_id: "client-2" }), false);
});

test("missing profiles, missing missions and unsupported roles fail closed", () => {
  assert.equal(complaintOwnershipAllowed("client", "user-1", null), false);
  assert.equal(complaintOwnershipAllowed("client", "user-1", client, null), true);
  assert.equal(complaintOwnershipAllowed("entreprise", "user-1", client), false);
  assert.equal(complaintOwnershipAllowed("unknown", "user-1", client), false);
});

test("manager bypass is explicit and role-bound", () => {
  assert.equal(complaintOwnershipAllowed("gerante", "manager-1", null), true);
});
