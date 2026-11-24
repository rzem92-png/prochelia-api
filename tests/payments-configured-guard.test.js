import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { paymentsConfigured } from "../src/index.js";

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

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing function: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing function boundary: ${endMarker}`);
  return source.slice(start, end);
}

test("payment onboarding and mission charge fail closed before schema DDL", () => {
  for (const [name, body, guard] of [
    ["onboarding", section("async function paymentOnboard(", "async function paymentStatus("), "paymentUnavailableResponse()"],
    ["mission charge", section("async function createMissionPayment(", "async function finalizeMissionPayment("), "paymentUnavailableResponse()"]
  ]) {
    const gate = body.indexOf(guard);
    const ddl = body.indexOf("ensurePaymentSchema(env)");
    assert.ok(gate >= 0 && ddl > gate, `${name} must reject before DDL`);
  }
});

test("payment status is read-only and does not create a schema or wallet while disabled", () => {
  const body = section("async function paymentStatus(", "async function createMissionPayment(");
  assert.ok(body.indexOf("payments_configured:false") >= 0);
  assert.ok(body.indexOf("write_enabled:false") >= 0);
  assert.doesNotMatch(body, /ensurePaymentSchema|INSERT INTO wallets/);
});

test("payout and dispute writes fail closed before schema DDL", () => {
  for (const [name, body] of [
    ["payout", section("async function payoutRequest(", "function constantTimeStringEqual(")],
    ["dispute", section("async function openPaymentDispute(", "async function paymentAdminResolve(")]
  ]) {
    const gate = body.indexOf("paymentUnavailableResponse()");
    const ddl = body.indexOf("ensurePaymentSchema(env)");
    assert.ok(gate >= 0 && ddl > gate, `${name} must reject before DDL`);
  }
});

test("webhook is rejected before reading its body or touching D1 while PSP is disabled", () => {
  const body = section("async function paymentWebhook(", "async function openPaymentDispute(");
  const gate = body.indexOf("paymentUnavailableResponse()");
  const read = body.indexOf("request.text()");
  const ddl = body.indexOf("ensurePaymentSchema(env)");
  assert.ok(gate >= 0 && read > gate && ddl > gate);
});
