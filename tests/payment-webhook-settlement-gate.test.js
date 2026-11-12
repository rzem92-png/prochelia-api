import test from "node:test";
import assert from "node:assert/strict";
import { requiresAtomicFinancialSettlement } from "../src/index.js";

test("all payment and payout finalization events require the atomic settlement ledger", () => {
  for (const type of ["payment_succeeded","charge_succeeded","payment_failed","charge_failed","payment_refunded","payout_paid","payout_failed","payout_canceled"]) {
    assert.equal(requiresAtomicFinancialSettlement(type), true, type);
  }
});

test("non-financial and unknown event types are not classified as settlement events", () => {
  for (const type of ["payout_processing","customer.updated","",null,undefined]) {
    assert.equal(requiresAtomicFinancialSettlement(type), false, String(type));
  }
});
