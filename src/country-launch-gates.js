import { getCountryConfig } from "./global-country-registry.js";

export const COUNTRY_LAUNCH_GATES = Object.freeze([
  "legal_review",
  "tax_review",
  "payments_review",
  "data_protection_review",
  "operations_review",
  "human_activation",
]);

/**
 * Evaluate a supplied launch-review record. This function does not activate a
 * market or persist anything. Only literal true satisfies a gate.
 */
export function evaluateCountryLaunch(countryCode, gateRecord) {
  const config = getCountryConfig(countryCode);
  if (!config) {
    return Object.freeze({ countryCode: null, knownCountry: false, ready: false, missingGates: [...COUNTRY_LAUNCH_GATES] });
  }
  const record = gateRecord && typeof gateRecord === "object" && !Array.isArray(gateRecord) ? gateRecord : {};
  const missingGates = COUNTRY_LAUNCH_GATES.filter((gate) => record[gate] !== true);
  return Object.freeze({
    countryCode: config.code,
    knownCountry: true,
    ready: missingGates.length === 0,
    missingGates: Object.freeze(missingGates),
    marketStatus: config.marketStatus,
    activationAllowedByThisEvaluator: false,
  });
}

/** Fail-closed helper for a separate human-controlled activation system. */
export function assertCountryLaunchReady(countryCode, gateRecord) {
  const result = evaluateCountryLaunch(countryCode, gateRecord);
  if (!result.knownCountry) throw new RangeError("Unsupported country code");
  if (!result.ready) throw new Error("Country launch gates incomplete: " + result.missingGates.join(", "));
  // Deliberately never changes the registry's status or enables the country.
  return result;
}
