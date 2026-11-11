import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
function handler(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing handler ${name}`);
  const next = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

test("mission security derives client and provider from the canonical mission", () => {
  const h = handler("securityPrepareMission");
  assert.match(h, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\? LIMIT 1/);
  assert.match(h, /MISSION_PARTY_MISMATCH/);
  assert.match(h, /const clientId=String\(mission\.client_id\), intervenantId=String\(mission\.intervenant_id\)/);
  assert.match(h, /requireVerifiedIntervenant\(env,intervenantId\)/);
});

test("mission payment binds parties to mission and validates positive bounded amounts", () => {
  const h = handler("createMissionPayment");
  assert.match(h, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\? LIMIT 1/);
  assert.match(h, /MISSION_PARTY_MISMATCH/);
  assert.match(h, /gross<=0\|\|commission<0\|\|commission>gross/);
  assert.match(h, /const clientId=String\(mission\.client_id\), intervenantId=String\(mission\.intervenant_id\)/);
});

test("client payment disputes require ownership and cannot exceed paid transaction gross", () => {
  const h = handler("openPaymentDispute");
  assert.match(h, /SELECT id FROM clients WHERE user_id=\? LIMIT 1/);
  assert.match(h, /String\(tx\.client_id\)!==String\(own\.id\)/);
  assert.match(h, /amount>Number\(tx\.gross_cents\|\|0\)/);
  assert.match(h, /tx\.status!=='paid'/);
});
