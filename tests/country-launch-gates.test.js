import test from "node:test";
import assert from "node:assert/strict";
import { assertCountryLaunchReady, COUNTRY_LAUNCH_GATES, evaluateCountryLaunch } from "../src/country-launch-gates.js";

const allApproved = Object.fromEntries(COUNTRY_LAUNCH_GATES.map((gate) => [gate, true]));

test("unknown countries fail closed with all gates missing", () => {
  const result = evaluateCountryLaunch("XX", allApproved);
  assert.equal(result.knownCountry, false);
  assert.equal(result.ready, false);
  assert.equal(result.missingGates.length, COUNTRY_LAUNCH_GATES.length);
  assert.throws(() => assertCountryLaunchReady("XX", allApproved), RangeError);
});

test("every launch gate must be explicitly true", () => {
  const partial = { ...allApproved, payments_review: false };
  const result = evaluateCountryLaunch("FR", partial);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingGates, ["payments_review"]);
  assert.throws(() => assertCountryLaunchReady("FR", partial), /gates incomplete/);
  assert.equal(evaluateCountryLaunch("FR", null).missingGates.length, COUNTRY_LAUNCH_GATES.length);
});

test("complete review record is reported ready but never activates a market", () => {
  const result = assertCountryLaunchReady("DZ", allApproved);
  assert.equal(result.ready, true);
  assert.equal(result.activationAllowedByThisEvaluator, false);
  assert.equal(result.marketStatus, "planned");
  assert.deepEqual(result.missingGates, []);
});

test("approval flags require literal true and are immutable", () => {
  const falsey = { ...allApproved, legal_review: "approved" };
  assert.equal(evaluateCountryLaunch("BE", falsey).ready, false);
  assert.throws(() => { COUNTRY_LAUNCH_GATES.push("unsafe"); }, TypeError);
});
