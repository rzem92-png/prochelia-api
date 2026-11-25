/**
 * PROCHÉLIA global country/localization registry.
 *
 * This is configuration scaffolding only: it does not indicate that any
 * country is commercially enabled or legally approved. Each launch requires
 * a country-specific human review and explicit activation elsewhere.
 */
const COUNTRY_CONFIGS = {
  FR: {
    code: "FR", name: "France", marketStatus: "pilot_candidate",
    defaultLocale: "fr-FR", locales: ["fr-FR", "en-GB"],
    currency: "EUR", timezone: "Europe/Paris", callingCode: "+33",
  },
  DZ: {
    code: "DZ", name: "Algérie", marketStatus: "planned",
    defaultLocale: "fr-DZ", locales: ["fr-DZ", "ar-DZ"],
    currency: "DZD", timezone: "Africa/Algiers", callingCode: "+213",
  },
  BE: { code: "BE", name: "Belgique", marketStatus: "planned", defaultLocale: "fr-BE", locales: ["fr-BE", "nl-BE", "de-BE"], currency: "EUR", timezone: "Europe/Brussels", callingCode: "+32" },
  CH: { code: "CH", name: "Suisse", marketStatus: "planned", defaultLocale: "fr-CH", locales: ["fr-CH", "de-CH", "it-CH"], currency: "CHF", timezone: "Europe/Zurich", callingCode: "+41" },
  LU: { code: "LU", name: "Luxembourg", marketStatus: "planned", defaultLocale: "fr-LU", locales: ["fr-LU", "de-LU", "lb-LU"], currency: "EUR", timezone: "Europe/Luxembourg", callingCode: "+352" },
  CA: { code: "CA", name: "Canada", marketStatus: "planned", defaultLocale: "fr-CA", locales: ["fr-CA", "en-CA"], currency: "CAD", timezone: null, callingCode: "+1" },
  MA: { code: "MA", name: "Maroc", marketStatus: "planned", defaultLocale: "fr-MA", locales: ["fr-MA", "ar-MA"], currency: "MAD", timezone: "Africa/Casablanca", callingCode: "+212" },
  TN: { code: "TN", name: "Tunisie", marketStatus: "planned", defaultLocale: "fr-TN", locales: ["fr-TN", "ar-TN"], currency: "TND", timezone: "Africa/Tunis", callingCode: "+216" },
  ES: { code: "ES", name: "Espagne", marketStatus: "planned", defaultLocale: "es-ES", locales: ["es-ES", "ca-ES", "eu-ES", "gl-ES"], currency: "EUR", timezone: "Europe/Madrid", callingCode: "+34" },
  IT: { code: "IT", name: "Italie", marketStatus: "planned", defaultLocale: "it-IT", locales: ["it-IT"], currency: "EUR", timezone: "Europe/Rome", callingCode: "+39" },
  DE: { code: "DE", name: "Allemagne", marketStatus: "planned", defaultLocale: "de-DE", locales: ["de-DE"], currency: "EUR", timezone: "Europe/Berlin", callingCode: "+49" },
  GB: { code: "GB", name: "Royaume-Uni", marketStatus: "planned", defaultLocale: "en-GB", locales: ["en-GB"], currency: "GBP", timezone: "Europe/London", callingCode: "+44" },
  US: { code: "US", name: "États-Unis", marketStatus: "planned", defaultLocale: "en-US", locales: ["en-US", "es-US"], currency: "USD", timezone: null, callingCode: "+1" },
  AE: { code: "AE", name: "Émirats arabes unis", marketStatus: "planned", defaultLocale: "ar-AE", locales: ["ar-AE", "en-AE"], currency: "AED", timezone: "Asia/Dubai", callingCode: "+971" },
};

const freezeConfig = (config) => Object.freeze({ ...config, locales: Object.freeze([...config.locales]), launchGates: Object.freeze(["legal_review", "tax_review", "payments_review", "data_protection_review", "operations_review", "human_activation"]) });
for (const key of Object.keys(COUNTRY_CONFIGS)) COUNTRY_CONFIGS[key] = freezeConfig(COUNTRY_CONFIGS[key]);
Object.freeze(COUNTRY_CONFIGS);

export function normalizeCountryCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function getCountryConfig(countryCode) {
  const code = normalizeCountryCode(countryCode);
  return code ? COUNTRY_CONFIGS[code] ?? null : null;
}

export function listCountryConfigs() {
  return Object.values(COUNTRY_CONFIGS);
}

export function resolveLocale(countryCode, requestedLocale) {
  const config = getCountryConfig(countryCode);
  if (!config) return null;
  if (typeof requestedLocale === "string" && config.locales.includes(requestedLocale)) return requestedLocale;
  return config.defaultLocale;
}

export function isCountryLaunchEligible(countryCode) {
  const config = getCountryConfig(countryCode);
  // Configuration presence is not launch approval. No country is enabled here.
  return Boolean(config && config.marketStatus === "enabled");
}
