import test from "node:test";
import assert from "node:assert/strict";
import { disputeClientOwnsPayment } from "../src/index.js";

test("client dispute access compares the payment client profile ID, not the session user ID", () => {
  const profile = { id: "client-profile-1", user_id: "auth-user-1" };
  assert.equal(disputeClientOwnsPayment(profile, { client_id: "client-profile-1" }), true);
  assert.equal(disputeClientOwnsPayment(profile, { client_id: "auth-user-1" }), false);
  assert.equal(disputeClientOwnsPayment(profile, { client_id: "other-client-profile" }), false);
});

test("missing profile or payment fails closed", () => {
  assert.equal(disputeClientOwnsPayment(null, { client_id: "client-profile-1" }), false);
  assert.equal(disputeClientOwnsPayment({ id: "client-profile-1" }, null), false);
  assert.equal(disputeClientOwnsPayment({}, { client_id: "client-profile-1" }), false);
});
