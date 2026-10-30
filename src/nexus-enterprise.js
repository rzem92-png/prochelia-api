/**
 * PROCHÉLIA NEXUS — enterprise opportunity fit and responsibility gates.
 * Pure deterministic advisory logic. It never contacts a company or commits funds.
 * Missing approvals block launch; a high score cannot override a hard gate.
 */

const isInt = Number.isSafeInteger;
const MAX_CAPABILITIES = 100;
const MAX_OPPORTUNITIES = 5000;
const REQUIRED_GATES = Object.freeze([
  "legalReview",
  "insuranceVerified",
  "privacyReview",
  "safetyReview",
  "financialReview",
  "providerConsent",
  "customerConsent",
  "companyApproval"
]);

function stringList(value, field) {
  if (!Array.isArray(value) || value.length > MAX_CAPABILITIES ||
      value.some((item) => typeof item !== "string" || !item.trim()) ||
      new Set(value).size !== value.length) {
    throw new TypeError(`${field} must be a list of unique non-empty strings`);
  }
  return value;
}

function money(value, field) {
  if (!isInt(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer in cents`);
  }
}

function validateCompany(company) {
  if (!company || typeof company.id !== "string" || !company.id.trim()) {
    throw new TypeError("company.id is required");
  }
  stringList(company.capabilities, "company.capabilities");
  stringList(company.objectives, "company.objectives");
  if (!isInt(company.capacityUnits) || company.capacityUnits < 0) {
    throw new TypeError("company.capacityUnits must be a non-negative integer");
  }
  if (!isInt(company.availableBudgetCents) || company.availableBudgetCents < 0) {
    throw new TypeError("company.availableBudgetCents must be a non-negative safe integer");
  }
}

function validateOpportunity(opportunity) {
  if (!opportunity || typeof opportunity.id !== "string" || !opportunity.id.trim()) {
    throw new TypeError("opportunity.id is required");
  }
  stringList(opportunity.requiredCapabilities, "opportunity.requiredCapabilities");
  stringList(opportunity.targetOutcomes, "opportunity.targetOutcomes");
  if (!isInt(opportunity.requiredCapacityUnits) || opportunity.requiredCapacityUnits < 0) {
    throw new TypeError("requiredCapacityUnits must be a non-negative integer");
  }
  money(opportunity.estimatedInvestmentCents, "estimatedInvestmentCents");
  money(opportunity.estimatedRevenueCents, "estimatedRevenueCents");
  if (opportunity.estimatedInvestmentCents > opportunity.estimatedRevenueCents &&
      opportunity.riskLevel === "low") {
    // Not intrinsically invalid, but a low-risk label must not conceal a forecast loss.
    throw new RangeError("loss-making opportunity cannot be labelled low risk");
  }
  if (!["low", "medium", "high", "unknown"].includes(opportunity.riskLevel)) {
    throw new TypeError("riskLevel must be low, medium, high or unknown");
  }
}

function gateReport(approvals = {}) {
  const gates = REQUIRED_GATES.map((name) => ({
    name,
    passed: approvals[name] === true
  }));
  return {
    gates,
    passed: gates.every((gate) => gate.passed),
    blocked: gates.filter((gate) => !gate.passed).map((gate) => gate.name)
  };
}

/**
 * Scores an opportunity for a particular enterprise.
 * Only explicit, non-sensitive business attributes are accepted.
 * Returns advisory status only; never performs a launch or financial commitment.
 */
export function evaluateNexusEnterpriseOpportunity({ company, opportunity } = {}) {
  validateCompany(company);
  validateOpportunity(opportunity);

  const capabilityMatches = opportunity.requiredCapabilities.filter((item) =>
    company.capabilities.includes(item));
  const objectiveMatches = opportunity.targetOutcomes.filter((item) =>
    company.objectives.includes(item));

  const capabilityBps = opportunity.requiredCapabilities.length === 0
    ? 10000
    : Math.floor(capabilityMatches.length * 10000 / opportunity.requiredCapabilities.length);
  const objectiveBps = opportunity.targetOutcomes.length === 0
    ? 10000
    : Math.floor(objectiveMatches.length * 10000 / opportunity.targetOutcomes.length);
  const capacityBps = opportunity.requiredCapacityUnits === 0
    ? 10000
    : Math.min(10000, Math.floor(company.capacityUnits * 10000 /
      opportunity.requiredCapacityUnits));

  const budgetFits = company.availableBudgetCents >= opportunity.estimatedInvestmentCents;
  const capacityFits = company.capacityUnits >= opportunity.requiredCapacityUnits;
  const gates = gateReport(opportunity.approvals);
  const fitScoreBps = Math.floor(
    (capabilityBps * 4500 + objectiveBps * 3500 + capacityBps * 2000) / 10000
  );
  const launchEligible = budgetFits && capacityFits && gates.passed &&
    opportunity.riskLevel !== "high" && opportunity.riskLevel !== "unknown";

  return Object.freeze({
    companyId: company.id,
    opportunityId: opportunity.id,
    fitScoreBps,
    capabilityMatches,
    objectiveMatches,
    budgetFits,
    capacityFits,
    gates,
    riskLevel: opportunity.riskLevel,
    estimatedInvestmentCents: opportunity.estimatedInvestmentCents,
    estimatedRevenueCents: opportunity.estimatedRevenueCents,
    estimatedGrossDifferenceCents: opportunity.estimatedRevenueCents -
      opportunity.estimatedInvestmentCents,
    status: launchEligible ? "eligible_for_human_decision" : "proposal_only",
    launchEligible,
    requiresHumanApproval: true,
    disclaimer: "Estimates are not guarantees. This assessment does not authorize launch, spending or contracting."
  });
}

/** Stable, bounded ranking of opportunities for one enterprise. */
export function rankNexusEnterpriseOpportunities({ company, opportunities } = {}) {
  validateCompany(company);
  if (!Array.isArray(opportunities)) throw new TypeError("opportunities must be an array");
  if (opportunities.length > MAX_OPPORTUNITIES) throw new RangeError("opportunity limit exceeded");
  const seen = new Set();
  return opportunities.map((opportunity) => {
    if (seen.has(opportunity?.id)) throw new TypeError("opportunity ids must be unique");
    seen.add(opportunity?.id);
    return evaluateNexusEnterpriseOpportunity({ company, opportunity });
  }).sort((a, b) => Number(b.launchEligible) - Number(a.launchEligible) ||
    b.fitScoreBps - a.fitScoreBps ||
    a.opportunityId.localeCompare(b.opportunityId));
}
