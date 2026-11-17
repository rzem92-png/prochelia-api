import test from "node:test";
import assert from "node:assert/strict";
import { paymentsConfigured } from "../src/index.js";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("provider name and webhook secret alone never enable payments", () => {
  assert.equal(paymentsConfigured({
    PAYMENT_PROVIDER: "stripe",
    PAYMENT_WEBHOOK_SECRET: "configured-test-secret"
  }), false);
});

test("payments remain disabled when configuration is absent or partial", () => {
  assert.equal(paymentsConfigured({}), false);
  assert.equal(paymentsConfigured({ PAYMENT_PROVIDER: "stripe" }), false);
  assert.equal(paymentsConfigured({ PAYMENT_WEBHOOK_SECRET: "configured-test-secret" }), false);
});

test("mission charge and payout request routes fail closed before financial writes without a real PSP", () => {
  const missionStart = source.indexOf("async function createMissionPayment(request, env)");
  const missionEnd = source.indexOf("async function finalizeMissionPayment", missionStart);
  const payoutStart = source.indexOf("async function payoutRequest(request, env)");
  const payoutEnd = source.indexOf("function constantTimeStringEqual", payoutStart);
  assert.ok(missionStart >= 0 && missionEnd > missionStart);
  assert.ok(payoutStart >= 0 && payoutEnd > payoutStart);
  const mission = source.slice(missionStart, missionEnd);
  const payout = source.slice(payoutStart, payoutEnd);
  assert.match(mission, /if \(!paymentsConfigured\(env\)\).*PAYMENT_PROVIDER_NOT_CONFIGURED/s);
  assert.match(payout, /if \(!paymentsConfigured\(env\)\).*PAYMENT_PROVIDER_NOT_CONFIGURED/s);
  assert.ok(mission.indexOf("PAYMENT_PROVIDER_NOT_CONFIGURED") < mission.indexOf("INSERT INTO payment_transactions"));
  assert.ok(payout.indexOf("PAYMENT_PROVIDER_NOT_CONFIGURED") < payout.indexOf("reservePayoutAtomically"));
});
