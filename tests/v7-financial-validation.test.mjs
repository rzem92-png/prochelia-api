import test from "node:test";
import assert from "node:assert/strict";
import { procheliaV7 } from "../src/v7.js";

test("pricing validator rejects invalid bounds and negative amount", () => {
  assert.equal(procheliaV7.checkPricing({ amount: 20, minimum: "NaN" }).ok, false);
  assert.equal(procheliaV7.checkPricing({ amount: 20, minimum: 30, maximum: 10 }).ok, false);
  assert.equal(procheliaV7.checkPricing({ amount: -0.01, minimum: 0 }).ok, false);
  assert.equal(procheliaV7.checkPricing({ amount: 10, minimum: 0, maximum: 10 }).ok, true);
});

test("pricing validator rejects non-finite and empty values", () => {
  for (const amount of [undefined, null, "", "NaN", Infinity, -Infinity]) {
    assert.equal(procheliaV7.checkPricing({ amount, minimum: 0 }).ok, false);
  }
});

test("finance calculator rejects invalid, negative, and out-of-policy inputs", () => {
  for (const input of [
    { clientAmount: -1 },
    { commissionRate: 101 },
    { paymentFees: -1 },
    { otherFees: -2 },
    { clientAmount: "Infinity" },
    { commissionRate: "NaN" }
  ]) {
    assert.equal(procheliaV7.calculateFinance(input).ok, false);
  }
});

test("finance calculation rounds money to two decimals and reports advisory", () => {
  const result = procheliaV7.calculateFinance({
    clientAmount: 100.005,
    commissionRate: 12.5,
    paymentFees: 1.25,
    otherFees: 0.5
  });
  assert.equal(result.ok, true);
  assert.equal(result.commissionAmount, 12.5);
  assert.equal(result.intervenantAmount, 87.51);
  assert.equal(result.grossMargin, 10.75);
  assert.equal(result.authoritative, false);
});

test("payment validator never trusts caller-provided successful status", () => {
  for (const status of ["PAID", "SUCCEEDED", "SUCCESS", "COMPLETED"]) {
    const result = procheliaV7.checkPayment({ status });
    assert.equal(result.ok, false);
    assert.equal(result.paymentConfirmed, false);
    assert.equal(result.authoritative, false);
    assert.equal(result.claimedStatus, status);
    assert.match(result.error, /preuve PSP vérifiée/);
  }
});
