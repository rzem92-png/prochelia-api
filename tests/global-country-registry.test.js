import test from "node:test";
import assert from "node:assert/strict";
import { getCountryConfig, isCountryLaunchEligible, listCountryConfigs, normalizeCountryCode, resolveLocale } from "../src/global-country-registry.js";

test("country code normalization is strict and locale-independent", () => {
  assert.equal(normalizeCountryCode(" fr "), "FR");
  assert.equal(normalizeCountryCode("dz"), "DZ");
  assert.equal(normalizeCountryCode("FRA"), null);
  assert.equal(normalizeCountryCode("1F"), null);
  assert.equal(normalizeCountryCode(null), null);
});

test("registry contains the launch market and global expansion targets", () => {
  const codes = listCountryConfigs().map((entry) => entry.code);
  for (const code of ["FR", "DZ", "BE", "CH", "LU", "CA", "MA", "TN", "ES", "IT", "DE", "GB", "US", "AE"]) assert.ok(codes.includes(code), code);
  assert.equal(getCountryConfig("FR").currency, "EUR");
  assert.equal(getCountryConfig("DZ").currency, "DZD");
  assert.equal(getCountryConfig("CH").currency, "CHF");
  assert.equal(getCountryConfig("GB").currency, "GBP");
  assert.equal(getCountryConfig("US").timezone, null, "multi-time-zone countries must not pretend to have one national timezone");
});

test("locale resolution accepts only configured locales and falls back safely", () => {
  assert.equal(resolveLocale("DZ", "ar-DZ"), "ar-DZ");
  assert.equal(resolveLocale("DZ", "en-US"), "fr-DZ");
  assert.equal(resolveLocale("FR", "fr-FR"), "fr-FR");
  assert.equal(resolveLocale("ZZ", "fr-FR"), null);
});

test("country configuration cannot be mistaken for launch approval", () => {
  assert.equal(isCountryLaunchEligible("FR"), false);
  assert.equal(isCountryLaunchEligible("DZ"), false);
  assert.equal(isCountryLaunchEligible("US"), false);
  assert.equal(isCountryLaunchEligible("ZZ"), false);
  assert.ok(getCountryConfig("FR").launchGates.includes("human_activation"));
  assert.throws(() => { getCountryConfig("FR").currency = "XXX"; }, TypeError);
});
