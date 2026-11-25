import { getCountryConfig } from "./global-country-registry.js";

/**
 * Supported scheduling/display time zones for the first 14 launch jurisdictions.
 * This is a curated list, not an exhaustive legal/territorial coverage claim.
 * Countries with multiple zones require the caller to choose an explicit zone.
 */
const TIMEZONE_OPTIONS = {
  FR: [{ id: "Europe/Paris", label: "France métropolitaine", region: "Metropolitan France", primary: true }],
  DZ: [{ id: "Africa/Algiers", label: "Algérie", region: "Algeria", primary: true }],
  BE: [{ id: "Europe/Brussels", label: "Belgique", region: "Belgium", primary: true }],
  CH: [{ id: "Europe/Zurich", label: "Suisse", region: "Switzerland", primary: true }],
  LU: [{ id: "Europe/Luxembourg", label: "Luxembourg", region: "Luxembourg", primary: true }],
  CA: [
    { id: "America/St_Johns", label: "Terre-Neuve", region: "Newfoundland", primary: false },
    { id: "America/Halifax", label: "Atlantique", region: "Atlantic", primary: false },
    { id: "America/Toronto", label: "Est", region: "Eastern", primary: false },
    { id: "America/Winnipeg", label: "Centre", region: "Central", primary: false },
    { id: "America/Regina", label: "Saskatchewan", region: "Saskatchewan", primary: false },
    { id: "America/Edmonton", label: "Rocheuses", region: "Mountain", primary: false },
    { id: "America/Vancouver", label: "Pacifique", region: "Pacific", primary: false },
    { id: "America/Whitehorse", label: "Yukon", region: "Yukon", primary: false },
    { id: "America/Yellowknife", label: "Territoires du Nord-Ouest", region: "Northwest Territories", primary: false },
    { id: "America/Iqaluit", label: "Nunavut (Est)", region: "Nunavut Eastern", primary: false },
    { id: "America/Rankin_Inlet", label: "Nunavut (Centre)", region: "Nunavut Central", primary: false },
    { id: "America/Resolute", label: "Nunavut (Nord)", region: "Nunavut Northern", primary: false },
  ],
  MA: [{ id: "Africa/Casablanca", label: "Maroc", region: "Morocco", primary: true }],
  TN: [{ id: "Africa/Tunis", label: "Tunisie", region: "Tunisia", primary: true }],
  ES: [
    { id: "Europe/Madrid", label: "Espagne continentale", region: "Mainland Spain", primary: true },
    { id: "Atlantic/Canary", label: "Îles Canaries", region: "Canary Islands", primary: false },
  ],
  IT: [{ id: "Europe/Rome", label: "Italie", region: "Italy", primary: true }],
  DE: [{ id: "Europe/Berlin", label: "Allemagne", region: "Germany", primary: true }],
  GB: [{ id: "Europe/London", label: "Royaume-Uni", region: "United Kingdom", primary: true }],
  US: [
    { id: "America/New_York", label: "Est", region: "Eastern", primary: false },
    { id: "America/Chicago", label: "Centre", region: "Central", primary: false },
    { id: "America/Denver", label: "Rocheuses", region: "Mountain", primary: false },
    { id: "America/Phoenix", label: "Arizona", region: "Arizona", primary: false },
    { id: "America/Los_Angeles", label: "Pacifique", region: "Pacific", primary: false },
    { id: "America/Anchorage", label: "Alaska", region: "Alaska", primary: false },
    { id: "America/Adak", label: "Îles Aléoutiennes", region: "Aleutian Islands", primary: false },
    { id: "Pacific/Honolulu", label: "Hawaï", region: "Hawaii", primary: false },
    { id: "America/Puerto_Rico", label: "Porto Rico", region: "Puerto Rico", primary: false },
    { id: "Pacific/Guam", label: "Guam", region: "Guam", primary: false },
    { id: "Pacific/Pago_Pago", label: "Samoa américaines", region: "American Samoa", primary: false },
  ],
  AE: [{ id: "Asia/Dubai", label: "Émirats arabes unis", region: "United Arab Emirates", primary: true }],
};

const frozenOptions = Object.fromEntries(
  Object.entries(TIMEZONE_OPTIONS).map(([code, options]) => [
    code,
    Object.freeze(options.map((option) => Object.freeze({ ...option }))),
  ]),
);
Object.freeze(frozenOptions);

export function getCountryTimezones(countryCode) {
  const config = getCountryConfig(countryCode);
  if (!config) return null;
  return frozenOptions[config.code] ?? Object.freeze(
    config.timezone ? [{ id: config.timezone, label: config.name, region: config.code, primary: true }] : [],
  );
}

export function resolveCountryTimezone(countryCode, requestedTimezone) {
  const config = getCountryConfig(countryCode);
  if (!config) throw new RangeError("Unsupported country code");
  const options = getCountryTimezones(config.code);
  const selected = requestedTimezone ?? config.timezone;
  if (!selected) throw new RangeError("A timezone must be selected for this country");
  if (!options.some((option) => option.id === selected)) {
    throw new RangeError("Timezone is not supported for this country");
  }
  new Intl.DateTimeFormat("en", { timeZone: selected });
  return selected;
}

export function isCountryTimezoneSupported(countryCode, timezone) {
  try {
    resolveCountryTimezone(countryCode, timezone);
    return true;
  } catch {
    return false;
  }
}
