import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("async function createMissionPayment");
const end = source.indexOf("\nasync function finalizeMissionPayment", start);
const body = source.slice(start, end);

test("mission payment verifies mission and exact client/intervenant parties", () => {
  assert.notEqual(start, -1);
  assert.match(body, /SELECT id,client_id,intervenant_id FROM missions WHERE id=\?/);
  assert.match(body, /MISSION_NOT_FOUND/);
  assert.match(body, /MISSION_PARTIES_MISMATCH/);
});

test("idempotency key reuse with a different payment payload is rejected", () => {
  assert.match(body, /const sameRequest = old\.mission_id === missionId/);
  assert.match(body, /Number\(old\.gross_cents\) === gross/);
  assert.match(body, /Number\(old\.commission_cents\) === commission/);
  assert.match(body, /IDEMPOTENCY_KEY_REUSED/);
});

test("mission payment creation fails closed before any D1 write without a PSP adapter", () => {
  assert.match(body, /if \(!paymentsConfigured\(env\)\) return json\(\{ok:false,error:'PAYMENT_PROVIDER_NOT_CONFIGURED',version:VERSION\},503\)/);
  assert.ok(body.indexOf("PAYMENT_PROVIDER_NOT_CONFIGURED") < body.indexOf("await ensurePaymentSchema(env)"));
});
