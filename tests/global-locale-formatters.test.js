import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatDateTime, formatNumber, getDisplayLocale } from "../src/global-locale-formatters.js";

test("currency formatting uses configured currency and locale", () => {
  assert.match(formatCurrency(1234.5, "FR", "fr-FR"), /1\s?234,50/);
  assert.match(formatCurrency(1234.5, "DZ", "ar-DZ"), /DZD|د\.ج/);
  assert.match(formatCurrency(1234.5, "GB", "en-GB"), /£|GBP/);
  assert.throws(() => formatCurrency(NaN, "FR"), TypeError);
  assert.throws(() => formatCurrency(1, "ZZ"), RangeError);
});

test("number formatting follows locale conventions", () => {
  assert.match(formatNumber(1234.5, "FR", "fr-FR"), /1\s?234,5/);
  assert.match(formatNumber(1234.5, "US", "en-US"), /1,234\.5/);
  assert.throws(() => formatNumber(Infinity, "FR"), TypeError);
});

test("datetime formatter uses configured timezone and requires one for multi-zone countries", () => {
  const date = new Date("2026-01-15T12:00:00.000Z");
  assert.doesNotThrow(() => formatDateTime(date, "FR", "fr-FR"));
  assert.throws(() => formatDateTime(date, "US", "en-US"), RangeError);
  assert.doesNotThrow(() => formatDateTime(date, "US", "en-US", "America/New_York"));
  assert.throws(() => formatDateTime("invalid", "FR"), TypeError);
});

test("display locale falls back to configured country default", () => {
  assert.equal(getDisplayLocale("DZ", "ar-DZ"), "ar-DZ");
  assert.equal(getDisplayLocale("DZ", "en-US"), "fr-DZ");
  assert.equal(getDisplayLocale("XX", "fr-FR"), null);
});
