export const MARKET_LOCALES = Object.freeze({
  FR: Object.freeze({ name: 'France', languages: ['fr'], locales: ['fr-FR'], currency: 'EUR', timeZones: ['Europe/Paris'], marketStatus: 'evaluation', launchEnabled: false }),
  DZ: Object.freeze({ name: 'Algérie', languages: ['fr', 'ar'], locales: ['fr-DZ', 'ar-DZ'], currency: 'DZD', timeZones: ['Africa/Algiers'], marketStatus: 'evaluation', launchEnabled: false }),
  BE: Object.freeze({ name: 'Belgique', languages: ['fr', 'nl', 'de'], locales: ['fr-BE', 'nl-BE', 'de-BE'], currency: 'EUR', timeZones: ['Europe/Brussels'], marketStatus: 'evaluation', launchEnabled: false }),
  CH: Object.freeze({ name: 'Suisse', languages: ['fr', 'de', 'it'], locales: ['fr-CH', 'de-CH', 'it-CH'], currency: 'CHF', timeZones: ['Europe/Zurich'], marketStatus: 'evaluation', launchEnabled: false }),
  LU: Object.freeze({ name: 'Luxembourg', languages: ['fr', 'de', 'lb'], locales: ['fr-LU', 'de-LU', 'lb-LU'], currency: 'EUR', timeZones: ['Europe/Luxembourg'], marketStatus: 'evaluation', launchEnabled: false }),
  CA: Object.freeze({ name: 'Canada', languages: ['fr', 'en'], locales: ['fr-CA', 'en-CA'], currency: 'CAD', timeZones: ['America/St_Johns', 'America/Halifax', 'America/Moncton', 'America/Toronto', 'America/Winnipeg', 'America/Regina', 'America/Edmonton', 'America/Vancouver', 'America/Whitehorse', 'America/Yellowknife', 'America/Iqaluit', 'America/Rankin_Inlet', 'America/Resolute', 'America/Inuvik', 'America/Dawson_Creek', 'America/Blanc-Sablon'], marketStatus: 'evaluation', launchEnabled: false }),
  MA: Object.freeze({ name: 'Maroc', languages: ['fr', 'ar'], locales: ['fr-MA', 'ar-MA'], currency: 'MAD', timeZones: ['Africa/Casablanca'], marketStatus: 'evaluation', launchEnabled: false }),
  TN: Object.freeze({ name: 'Tunisie', languages: ['fr', 'ar'], locales: ['fr-TN', 'ar-TN'], currency: 'TND', timeZones: ['Africa/Tunis'], marketStatus: 'evaluation', launchEnabled: false }),
  ES: Object.freeze({ name: 'Espagne', languages: ['es'], locales: ['es-ES'], currency: 'EUR', timeZones: ['Europe/Madrid', 'Atlantic/Canary'], marketStatus: 'evaluation', launchEnabled: false }),
  IT: Object.freeze({ name: 'Italie', languages: ['it'], locales: ['it-IT'], currency: 'EUR', timeZones: ['Europe/Rome'], marketStatus: 'evaluation', launchEnabled: false }),
  DE: Object.freeze({ name: 'Allemagne', languages: ['de'], locales: ['de-DE'], currency: 'EUR', timeZones: ['Europe/Berlin'], marketStatus: 'evaluation', launchEnabled: false }),
  GB: Object.freeze({ name: 'Royaume-Uni', languages: ['en'], locales: ['en-GB'], currency: 'GBP', timeZones: ['Europe/London'], marketStatus: 'evaluation', launchEnabled: false }),
  US: Object.freeze({ name: 'États-Unis', languages: ['en', 'es'], locales: ['en-US', 'es-US'], currency: 'USD', timeZones: ['America/New_York', 'America/Detroit', 'America/Indiana/Indianapolis', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'America/Juneau', 'America/Sitka', 'America/Adak', 'Pacific/Honolulu', 'America/Puerto_Rico', 'Pacific/Guam', 'Pacific/Saipan', 'Pacific/Pago_Pago'], marketStatus: 'evaluation', launchEnabled: false }),
  AE: Object.freeze({ name: 'Émirats arabes unis', languages: ['ar', 'en'], locales: ['ar-AE', 'en-AE'], currency: 'AED', timeZones: ['Asia/Dubai'], marketStatus: 'evaluation', launchEnabled: false })
});

export function resolveMarketTimeZone(countryCode, requestedTimeZone) {
  const country = String(countryCode || '').trim().toUpperCase();
  const entry = MARKET_LOCALES[country];
  if (!entry) return null;
  const requested = String(requestedTimeZone || '').trim();
  if (requested) {
    if (!entry.timeZones.includes(requested)) {
      throw new RangeError('timezone is not in the market registry');
    }
    return requested;
  }
  return entry.timeZones.length === 1 ? entry.timeZones[0] : null;
}

export function getMarketLocale(countryCode, language, requestedTimeZone) {
  const country = String(countryCode || '').trim().toUpperCase();
  const entry = MARKET_LOCALES[country];
  if (!entry) return null;
  const requested = String(language || '').trim().toLowerCase();
  const index = requested ? entry.languages.findIndex((item, i) => item.toLowerCase() === requested || entry.locales[i]?.toLowerCase() === requested) : -1;
  const locale = index >= 0 ? entry.locales[index] : entry.locales[0];
  const timeZone = resolveMarketTimeZone(country, requestedTimeZone);
  return Object.freeze({ countryCode: country, ...entry, language: index >= 0 ? entry.languages[index] : entry.languages[0], locale, timeZone, timeZoneRequired: timeZone === null });
}

export function formatMarketCurrency(amount, countryCode, language) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new TypeError('amount must be a finite number');
  const market = getMarketLocale(countryCode, language);
  if (!market) throw new RangeError('unsupported country');
  return new Intl.NumberFormat(market.locale, { style: 'currency', currency: market.currency }).format(amount);
}

export function formatMarketDateTime(value, countryCode, language, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('invalid date');
  const market = getMarketLocale(countryCode, language, timeZone);
  if (!market) throw new RangeError('unsupported country');
  if (market.timeZoneRequired) throw new TypeError('timezone selection required for multi-timezone market');
  return new Intl.DateTimeFormat(market.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: market.timeZone }).format(date);
}

export function isMarketLaunchEnabled(countryCode) {
  const market = getMarketLocale(countryCode);
  return market?.launchEnabled === true && market.marketStatus === 'validated';
}
