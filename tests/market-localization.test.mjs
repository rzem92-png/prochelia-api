import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKET_LOCALES, getMarketLocale, formatMarketCurrency, formatMarketDateTime, isMarketLaunchEnabled } from '../src/market-localization.js';

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
  assert.match(formatMarketCurrency(1234.5, 'DZ', 'ar'), /DZD|د\\.ج\\.|دج/);
  assert.throws(() => formatMarketCurrency(NaN, 'FR'), /finite/);
  assert.throws(() => formatMarketCurrency(10, 'XX'), /unsupported/);
});

test('datetime formatter requires valid date and a reviewed timezone', () => {
  assert.doesNotThrow(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'FR'));
  assert.doesNotThrow(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'CA', 'en', 'America/Toronto'));
  assert.throws(() => formatMarketDateTime('not-a-date', 'FR'), /invalid date/);
  assert.throws(() => formatMarketDateTime('2026-11-26T12:00:00Z', 'CA', 'en', 'Europe/Paris'), /timezone/);
});
