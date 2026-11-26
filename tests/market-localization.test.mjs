import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKET_LOCALES, getMarketLocale, resolveMarketTimeZone, formatMarketCurrency, formatMarketDateTime, isMarketLaunchEnabled } from '../src/market-localization.js';

test('all initial target markets are configured but remain disabled pending human validation', () => {
  assert.deepEqual(Object.keys(MARKET_LOCALES).sort(), ['AE','BE','CA','CH','DE','DZ','ES','FR','GB','IT','LU','MA','TN','US']);
  for (const country of Object.keys(MARKET_LOCALES)) {
    const market = getMarketLocale(country);
    assert.equal(market.marketStatus, 'evaluation');
    assert.equal(market.launchEnabled, false);
    assert.equal(isMarketLaunchEnabled(country), false);
  }
});

test('locale resolution supports language selection and defaults', () => {
  assert.equal(getMarketLocale('dz').locale, 'fr-DZ');
  assert.equal(getMarketLocale('DZ', 'ar').locale, 'ar-DZ');
  assert.equal(getMarketLocale('CA', 'en').locale, 'en-CA');
  assert.equal(getMarketLocale('US', 'es').locale, 'es-US');
  assert.equal(getMarketLocale('XX'), null);
});

test('currency formatter uses market currency and rejects unsafe inputs', () => {
  assert.match(formatMarketCurrency(1234.5, 'FR'), /1/);
  assert.ok(formatMarketCurrency(1234.5, 'DZ', 'ar').includes('د.ج.'));
  assert.throws(() => formatMarketCurrency(NaN, 'FR'), /finite/);
  assert.throws(() => formatMarketCurrency(10, 'XX'), /unsupported/);
});

test('single-timezone markets resolve automatically; multi-timezone markets require explicit selection', () => {
  assert.equal(resolveMarketTimeZone('FR'), 'Europe/Paris');
  assert.equal(getMarketLocale('FR').timeZone, 'Europe/Paris');
  assert.equal(getMarketLocale('FR').timeZoneRequired, false);
  assert.equal(resolveMarketTimeZone('CA'), null);
  assert.equal(resolveMarketTimeZone('US'), null);
  assert.equal(getMarketLocale('CA').timeZone, null);
  assert.equal(getMarketLocale('US').timeZoneRequired, true);
  assert.equal(resolveMarketTimeZone('US', 'America/Los_Angeles'), 'America/Los_Angeles');
  assert.equal(getMarketLocale('CA', 'en', 'America/Toronto').timeZone, 'America/Toronto');
  assert.throws(() => resolveMarketTimeZone('US', 'Europe/Paris'), /registry/);
  assert.equal(resolveMarketTimeZone('XX'), null);
});

test('all registered timezones are recognized by the runtime Intl implementation', () => {
  for (const market of Object.values(MARKET_LOCALES)) {
    for (const zone of market.timeZones) {
      assert.doesNotThrow(() => new Intl.DateTimeFormat(market.locales[0], { timeZone: zone }), `${market.name}: ${zone}`);
    }
  }
});

test('datetime formatter requires a timezone choice for multi-timezone markets', () => {
  assert.doesNotThrow(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'FR'));
  assert.doesNotThrow(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'CA', 'en', 'America/Toronto'));
  assert.doesNotThrow(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'US', 'en', 'America/Los_Angeles'));
  assert.throws(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'CA'), /selection required/);
  assert.throws(() => formatMarketDateTime('not-a-date', 'FR'), /invalid date/);
  assert.throws(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'CA', 'en', 'Europe/Paris'), /registry/);
});
