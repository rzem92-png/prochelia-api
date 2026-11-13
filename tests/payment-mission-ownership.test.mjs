import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("mission payment parties must match the persisted mission", () => {
  const start = source.indexOf("async function createMissionPayment");
  const end = source.indexOf("async function finalizeMissionPayment", start);
  const handler = source.slice(start, end);
  assert.match(handler, /FROM missions m\s+JOIN clients c ON c\.id=m\.client_id\s+JOIN intervenants i ON i\.id=m\.intervenant_id/i);
  assert.match(handler, /mission\.client_id!==clientId/);
  assert.match(handler, /mission\.intervenant_id!==intervenantId/);
  assert.match(handler, /MISSION_PARTIES_MISMATCH/);
});

test("client dispute authorization maps client profile ID to authenticated user ID", () => {
  const start = source.indexOf("async function openPaymentDispute");
  const end = source.indexOf("async function paymentAdminResolve", start);
  const handler = source.slice(start, end);
  assert.match(handler, /LEFT JOIN clients c ON c\.id=pt\.client_id/i);
  assert.match(handler, /c\.user_id AS client_user_id/);
  assert.match(handler, /tx\.client_user_id !== auth\.user\.id/);
  assert.doesNotMatch(handler, /tx\.client_id !== auth\.user\.id/);
});

test("mission security stores and verifies the intervenant user ID, not profile ID", () => {
  const start = source.indexOf("async function securityPrepareMission");
  const end = source.indexOf("async function securityPresence", start);
  const handler = source.slice(start, end);
  assert.match(handler, /i\.user_id AS intervenant_user_id/);
  assert.match(handler, /requireVerifiedIntervenant\(env,intervenantUserId\)/);
  assert.match(handler, /mission\.intervenant_profile_id!==intervenantId/);
  assert.match(handler, /mission\.client_id,intervenantUserId/);
});
