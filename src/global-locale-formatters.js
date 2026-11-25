import { getCountryConfig, resolveLocale } from "./global-country-registry.js";

/**
 * Locale-aware presentation helpers. These are display helpers only; they do
 * not perform accounting rounding, exchange-rate conversion or tax calculation.
 */
export function formatCurrency(amount, countryCode, requestedLocale) {
  const config = getCountryConfig(countryCode);
  if (!config) throw new RangeError("Unsupported country code");
  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new TypeError("Amount must be a finite number");
  const locale = resolveLocale(countryCode, requestedLocale);
  return new Intl.NumberFormat(locale, { style: "currency", currency: config.currency }).format(amount);
}

export function formatNumber(value, countryCode, requestedLocale, options = {}) {
  const config = getCountryConfig(countryCode);
  if (!config) throw new RangeError("Unsupported country code");
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("Value must be a finite number");
  const locale = resolveLocale(countryCode, requestedLocale);
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDateTime(date, countryCode, requestedLocale, timezoneOverride) {
  const config = getCountryConfig(countryCode);
  if (!config) throw new RangeError("Unsupported country code");
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) throw new TypeError("Invalid date");
  const locale = resolveLocale(countryCode, requestedLocale);
  const timezone = timezoneOverride ?? config.timezone;
  if (!timezone) throw new RangeError("A timezone is required for this country or region");
  // Intl validates timezone identifiers; intentionally do not silently fall back.
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(value);
}

export function getDisplayLocale(countryCode, requestedLocale) {
  return resolveLocale(countryCode, requestedLocale);
}
