import test from "node:test";
import assert from "node:assert/strict";
import { missionPaymentPartiesMatch, missionPaymentIdempotencyMatches } from "../src/index.js";

const mission = { id: "mission-1", client_id: "client-1", intervenant_id: "worker-1" };
const request = { missionId: "mission-1", clientId: "client-1", intervenantId: "worker-1", grossCents: 12500, commissionCents: 1500 };

test("payment parties must exactly match the persisted mission", () => {
  assert.equal(missionPaymentPartiesMatch(request, mission), true);
  assert.equal(missionPaymentPartiesMatch({ ...request, clientId: "other-client" }, mission), false);
  assert.equal(missionPaymentPartiesMatch({ ...request, intervenantId: "other-worker" }, mission), false);
  assert.equal(missionPaymentPartiesMatch({ ...request, missionId: "other-mission" }, mission), false);
  assert.equal(missionPaymentPartiesMatch(request, null), false);
});

test("idempotent replay is accepted only for the same mission, parties and amounts", () => {
  const existing = {
    mission_id: "mission-1", client_id: "client-1", intervenant_id: "worker-1",
    gross_cents: 12500, commission_cents: 1500
  };
  assert.equal(missionPaymentIdempotencyMatches(existing, request), true);
  assert.equal(missionPaymentIdempotencyMatches(existing, { ...request, grossCents: 9900 }), false);
  assert.equal(missionPaymentIdempotencyMatches(existing, { ...request, commissionCents: 100 }), false);
  assert.equal(missionPaymentIdempotencyMatches(existing, { ...request, clientId: "attacker" }), false);
  assert.equal(missionPaymentIdempotencyMatches(null, request), false);
});
