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
  const gate = body.indexOf("payments_configured:false");
  const ddl = body.indexOf("ensurePaymentSchema(env)");
  const walletInsert = body.indexOf("INSERT INTO wallets");
  assert.ok(gate >= 0 && ddl > gate && walletInsert > gate, "disabled status must return before schema or wallet writes");
  assert.ok(body.indexOf("write_enabled:false") >= 0);
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

import worker from "../src/index.js";

test("top-level disabled webhook gate returns before D1 rate limiting and body reads", async () => {
  let databaseCalls = 0;
  const request = new Request("https://api.example.test/api/payments/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "evt_synthetic_disabled", type: "payment_succeeded" })
  });
  const response = await worker.fetch(request, {
    DB: {
      prepare() {
        databaseCalls += 1;
        throw new Error("D1_ACCESS_FORBIDDEN_WHILE_PSP_DISABLED");
      }
    }
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  assert.equal(body.write_enabled, false);
  assert.equal(databaseCalls, 0);
  assert.equal(request.bodyUsed, false);
});
