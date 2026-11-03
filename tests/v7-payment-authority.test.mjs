import test from "node:test";
import assert from "node:assert/strict";
import { handleV7Route } from "../src/v7-routes.js";

test("V7 payment check never treats client-supplied status as authoritative", async () => {
  const request = new Request("https://prochelia-api-preview.example/api/v7/check/payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payment: { status: "PAID", amount: 999999, missionId: "attacker-controlled" } })
  });

  const response = await handleV7Route(request, {}, "/api/v7/check/payment");
  assert.equal(response.status, 409);

  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.paymentConfirmed, false);
  assert.equal(body.authoritative, false);
  assert.equal(body.error, "PAYMENT_STATUS_NOT_AUTHORITATIVE");
});
