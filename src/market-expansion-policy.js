/**
 * PROCHÉLIA — fail-closed market activation policy.
 * A country/category pair stays unavailable until every mandatory control
 * is explicitly approved. This helper is advisory policy logic only:
 * it does not provide legal advice or establish regulatory compliance.
 */
const BASELINE_CHECKS = Object.freeze([
  "legalReview", "taxReview", "consumerTerms", "privacyReview",
  "paymentReview", "insuranceReview", "supportReady", "securityReview",
  "localizationReady"
]);
const CATEGORY_CHECKS = Object.freeze({
  home_support: ["workerStatusReview", "vulnerablePersonSafeguards"],
  food: ["foodSafetyReview", "allergenTraceability"],
  trades: ["qualificationInsuranceReview"],
  live: ["contentRightsReview", "minorSafetyReview"],
  local_goods: ["sellerTraceabilityReview", "returnsReview"],
  b2b: ["businessContractReview"]
});
const ALLOWED_STATUSES = new Set(["DRAFT", "REVIEW_REQUIRED", "APPROVED_FOR_PILOT", "ACTIVE", "SUSPENDED"]);
const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_CHECKS));
const COUNTRY_CODE = /^[A-Z]{2}$/;
const CATEGORY_CODE = /^[a-z][a-z0-9_]{1,39}$/;
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/**
 * Missing, malformed, or non-true checks fail closed.
 * ACTIVE requires the same evidence gates as pilot approval.
 */
export function evaluateMarketActivation(input = {}) {
  if (!isRecord(input)) throw new TypeError("input must be an object");
  const { countryCode, categoryCode, status, checks } = input;
  if (typeof countryCode !== "string" || !COUNTRY_CODE.test(countryCode)) {
    throw new TypeError("countryCode must be an uppercase ISO alpha-2 code");
  }
  if (typeof categoryCode !== "string" || !CATEGORY_CODE.test(categoryCode) || !ALLOWED_CATEGORIES.has(categoryCode)) {
    throw new TypeError("categoryCode must be a supported lowercase category code");
  }
  if (!ALLOWED_STATUSES.has(status)) throw new TypeError("status is not a supported market activation state");
  if (!isRecord(checks)) throw new TypeError("checks must be an object");
  const requiredChecks = [...BASELINE_CHECKS, ...(CATEGORY_CHECKS[categoryCode] || [])];
  const missingChecks = requiredChecks.filter((key) => checks[key] !== true);
  const approvedState = status === "APPROVED_FOR_PILOT" || status === "ACTIVE";
  const allowed = approvedState && missingChecks.length === 0;
  return Object.freeze({
    countryCode, categoryCode, status, allowed,
    requiredChecks: Object.freeze(requiredChecks),
    missingChecks: Object.freeze(missingChecks),
    reason: allowed ? "MARKET_GATES_PASSED" :
      status === "SUSPENDED" ? "MARKET_SUSPENDED" :
      !approvedState ? "MARKET_NOT_APPROVED" : "MARKET_CHECKS_INCOMPLETE"
  });
}
export const marketActivationRequirements = Object.freeze({
  baseline: BASELINE_CHECKS, categories: CATEGORY_CHECKS
});
