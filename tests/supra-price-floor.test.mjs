import test from "node:test";
import assert from "node:assert/strict";
import { calculatePriceFloor } from "../src/supra-price-floor.js";

const example = {
  providerPayoutCents: 7000,
  variableCostCents: 250,
  fixedPspFeeCents: 25,
  pspRateBps: 150,
  riskReserveCents: 100,
  targetContributionCents: 1500,
  maxClientPriceCents: 10000
};

test("calculates a conservative minimum price with integer-cent rounding", () => {
  const r = calculatePriceFloor(example);
  assert.equal(r.ok, true);
  assert.equal(r.viable, true);
  assert.equal(r.bookingAllowedByPriceGuard, true);
  assert.ok(r.estimatedContributionCents >= example.targetContributionCents);
  assert.ok(Number.isSafeInteger(r.minClientPriceCents));
});

test("refuses price floor above client maximum rather than silently eroding margin", () => {
  const r = calculatePriceFloor({...example, maxClientPriceCents: 7000});
  assert.equal(r.ok, true);
  assert.equal(r.viable, false);
  assert.equal(r.bookingAllowedByPriceGuard, false);
});

test("provider payout is never reduced to hit client ceiling", () => {
  const r = calculatePriceFloor({...example, providerPayoutCents: 8000, maxClientPriceCents: 7500});
  assert.equal(r.providerPayoutCents, 8000);
  assert.equal(r.bookingAllowedByPriceGuard, false);
});

test("rejects negative, floating, missing, malformed and invalid-rate input", () => {
  assert.equal(calculatePriceFloor({...example, variableCostCents: -1}).ok, false);
  assert.equal(calculatePriceFloor({...example, providerPayoutCents: 1.2}).ok, false);
  assert.equal(calculatePriceFloor({...example, pspRateBps: 10000}).ok, false);
  assert.equal(calculatePriceFloor({...example, pspRateBps: "150"}).ok, false);
  assert.equal(calculatePriceFloor({}).ok, false);
});

test("rejects unsafe arithmetic overflow", () => {
  assert.equal(calculatePriceFloor({...example, providerPayoutCents: Number.MAX_SAFE_INTEGER}).ok, false);
});

test("calculation is read-only and cannot execute bookings or payouts", () => {
  const r = calculatePriceFloor(example);
  assert.equal(r.executionAllowed, false);
  assert.equal(r.bookingAllowedByPriceGuard, true);
});

test("uses exact arithmetic when the PSP fee multiplication exceeds Number safe precision", () => {
  const r = calculatePriceFloor({
    providerPayoutCents: 900_000_000_000,
    variableCostCents: 0,
    fixedPspFeeCents: 0,
    pspRateBps: 9999,
    riskReserveCents: 0,
    targetContributionCents: 0
  });
  assert.equal(r.ok, true);
  assert.equal(r.minClientPriceCents, 9_000_000_000_000_000);
  assert.equal(r.estimatedPspFeeCents, 8_999_100_000_000_000);
  assert.equal(r.estimatedContributionCents, 0);
  assert.equal(r.bookingAllowedByPriceGuard, true);
});

test("uses exact intermediate numerator when final cent amount remains safe", () => {
  const r = calculatePriceFloor({
    providerPayoutCents: 1_000_000_000_000,
    variableCostCents: 0,
    fixedPspFeeCents: 0,
    pspRateBps: 0,
    riskReserveCents: 0,
    targetContributionCents: 0
  });
  assert.equal(r.ok, true);
  assert.equal(r.minClientPriceCents, 1_000_000_000_000);
  assert.equal(r.estimatedPspFeeCents, 0);
  assert.equal(r.estimatedContributionCents, 0);
});
