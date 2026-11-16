import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { paymentsConfigured } from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

function handlerBody(name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`\n${nextName}`, start);
  assert.notEqual(start, -1, `${name} handler exists`);
  assert.notEqual(end, -1, `${nextName} boundary exists`);
  return source.slice(start, end);
}

test("provider name and webhook secret never imply executable payment capability", () => {
  assert.equal(paymentsConfigured({ PAYMENT_PROVIDER: "stripe", PAYMENT_WEBHOOK_SECRET: "secret" }), false);
  assert.equal(paymentsConfigured({ PAYMENT_PROVIDER: "psp_adapter", PAYMENT_WEBHOOK_SECRET: "secret" }), false);
  assert.equal(paymentsConfigured({}), false);
});

test("mission charge refuses before D1 writes without PSP adapter", () => {
  const body = handlerBody("createMissionPayment", "async function finalizeMissionPayment");
  assert.match(body, /PSP_ADAPTER_NOT_IMPLEMENTED/);
  assert.ok(body.indexOf("PSP_ADAPTER_NOT_IMPLEMENTED") < body.indexOf("ensurePaymentSchema"));
  assert.ok(body.indexOf("PSP_ADAPTER_NOT_IMPLEMENTED") < body.indexOf("ensurePaymentSchema"));
});

test("payout refuses before wallet reservation without PSP adapter", () => {
  const body = handlerBody("payoutRequest", "function constantTimeStringEqual");
  assert.match(body, /PSP_ADAPTER_NOT_IMPLEMENTED/);
  assert.ok(body.indexOf("PSP_ADAPTER_NOT_IMPLEMENTED") < body.indexOf("ensurePaymentSchema"));
  assert.doesNotMatch(body, /reservePayoutAtomically\(/);
});

test("provider onboarding refuses rather than creating a placeholder payout account", () => {
  const body = handlerBody("paymentOnboard", "async function paymentStatus");
  assert.match(body, /PSP_ADAPTER_NOT_IMPLEMENTED/);
  assert.ok(body.indexOf("PSP_ADAPTER_NOT_IMPLEMENTED") < body.indexOf("ensurePaymentSchema"));
});
