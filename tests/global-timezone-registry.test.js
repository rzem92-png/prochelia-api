import test from "node:test";
import assert from "node:assert/strict";
import { getCountryTimezones, isCountryTimezoneSupported, resolveCountryTimezone } from "../src/global-timezone-registry.js";

test("single-zone countries expose a validated IANA timezone", () => {
  assert.equal(resolveCountryTimezone("FR"), "Europe/Paris");
  assert.equal(resolveCountryTimezone("DZ"), "Africa/Algiers");
  assert.equal(resolveCountryTimezone("AE"), "Asia/Dubai");
  assert.ok(getCountryTimezones("FR").every((entry) => new Intl.DateTimeFormat("en", { timeZone: entry.id })));
});

test("Canada and United States require an explicit supported region", () => {
  assert.throws(() => resolveCountryTimezone("CA"), /must be selected/);
  assert.throws(() => resolveCountryTimezone("US"), /must be selected/);
  assert.equal(resolveCountryTimezone("CA", "America/Toronto"), "America/Toronto");
  assert.equal(resolveCountryTimezone("US", "America/Los_Angeles"), "America/Los_Angeles");
  assert.equal(isCountryTimezoneSupported("US", "America/Phoenix"), true);
  assert.equal(isCountryTimezoneSupported("US", "Europe/Paris"), false);
});

test("Spain exposes mainland and Canary time zones", () => {
  const zones = getCountryTimezones("ES").map((entry) => entry.id);
  assert.deepEqual(zones, ["Europe/Madrid", "Atlantic/Canary"]);
  assert.equal(resolveCountryTimezone("ES", "Atlantic/Canary"), "Atlantic/Canary");
});

test("timezone metadata is immutable and unknown countries fail closed", () => {
  const options = getCountryTimezones("CA");
  assert.ok(Object.isFrozen(options));
  assert.ok(options.every((entry) => Object.isFrozen(entry)));
  assert.equal(getCountryTimezones("ZZ"), null);
  assert.throws(() => resolveCountryTimezone("ZZ", "Europe/Paris"), RangeError);
  assert.throws(() => resolveCountryTimezone("CA", "Europe/Paris"), RangeError);
});
