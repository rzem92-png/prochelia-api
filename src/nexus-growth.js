/**
 * PROCHÉLIA NEXUS GROWTH — deterministic monthly offer simulator.
 * Advisory only: uses explicit assumptions, no personal data, no live spend or commitments.
 * Currency is integer cents; rates are basis points (0..10000).
 */

const isInt = Number.isSafeInteger;
const MAX_OFFERS = 1000;

function money(value, field) {
  if (!isInt(value) || value < 0) throw new TypeError(`${field} must be non-negative integer cents`);
}

function boundedRate(value, field) {
  if (!isInt(value) || value < 0 || value > 10000) {
    throw new TypeError(`${field} must be integer basis points from 0 to 10000`);
  }
}

function safeNumber(big, field) {
  if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${field} exceeds safe integer range`);
  }
  return Number(big);
}

function scenario(offer, assumption, label) {
  if (!assumption || !isInt(assumption.qualifiedLeads) || assumption.qualifiedLeads < 0) {
    throw new TypeError(`${label}.qualifiedLeads must be a non-negative integer`);
  }
  boundedRate(assumption.conversionBps, `${label}.conversionBps`);
  const demandOrders = BigInt(assumption.qualifiedLeads) * BigInt(assumption.conversionBps) / 10000n;
  const orders = demandOrders > BigInt(offer.monthlyCapacity)
    ? BigInt(offer.monthlyCapacity) : demandOrders;
  const revenue = orders * BigInt(offer.priceCents);
  const directCosts = orders * BigInt(offer.directCostPerOrderCents);
  const totalCosts = directCosts + BigInt(offer.monthlyFixedCostCents) +
    BigInt(offer.monthlyAcquisitionCostCents);
  const contribution = revenue - totalCosts;
  return Object.freeze({
    label,
    qualifiedLeads: assumption.qualifiedLeads,
    conversionBps: assumption.conversionBps,
    estimatedOrders: safeNumber(orders, `${label}.estimatedOrders`),
    capacityLimited: demandOrders > BigInt(offer.monthlyCapacity),
    estimatedRevenueCents: safeNumber(revenue, `${label}.estimatedRevenueCents`),
    directCostsCents: safeNumber(directCosts, `${label}.directCostsCents`),
    fixedCostsCents: offer.monthlyFixedCostCents,
    acquisitionCostsCents: offer.monthlyAcquisitionCostCents,
    estimatedContributionCents: safeNumber(contribution, `${label}.estimatedContributionCents`),
    contributionPositive: contribution > 0n
  });
}

function validateOffer(offer) {
  if (!offer || typeof offer.id !== "string" || !offer.id.trim()) {
    throw new TypeError("offer.id is required");
  }
  for (const field of ["priceCents", "directCostPerOrderCents", "monthlyFixedCostCents",
    "monthlyAcquisitionCostCents"]) money(offer[field], field);
  if (offer.directCostPerOrderCents > offer.priceCents) {
    // Allowed: the model should expose loss-making offers rather than hide them.
  }
  if (!isInt(offer.monthlyCapacity) || offer.monthlyCapacity < 0) {
    throw new TypeError("monthlyCapacity must be a non-negative integer");
  }
  if (offer.monthlyCapacity > 10000000) throw new RangeError("monthlyCapacity limit exceeded");
  if (!offer.assumptions || typeof offer.assumptions !== "object") {
    throw new TypeError("offer.assumptions is required");
  }
  for (const key of ["conservative", "base", "optimistic"]) {
    if (!offer.assumptions[key]) throw new TypeError(`offer.assumptions.${key} is required`);
  }
}

/** Simulates three explicitly supplied demand scenarios for one offer. */
export function simulateNexusGrowthOffer({ offer } = {}) {
  validateOffer(offer);
  const scenarios = ["conservative", "base", "optimistic"].map((key) =>
    scenario(offer, offer.assumptions[key], key));
  const base = scenarios[1];
  const breakEvenOrders = offer.priceCents <= offer.directCostPerOrderCents
    ? null
    : safeNumber(
      (BigInt(offer.monthlyFixedCostCents + offer.monthlyAcquisitionCostCents) +
        BigInt(offer.priceCents - offer.directCostPerOrderCents) - 1n) /
        BigInt(offer.priceCents - offer.directCostPerOrderCents),
      "breakEvenOrders"
    );
  return Object.freeze({
    offerId: offer.id,
    scenarios,
    baseCase: base,
    breakEvenOrders,
    recommendation: base.contributionPositive ? "test_with_bounded_pilot" : "revise_or_do_not_launch",
    requiresHumanApproval: true,
    disclaimer: "Projections depend on supplied assumptions; they are not guaranteed sales or profit."
  });
}

/** Stable ranking by base-case contribution, with negative cases retained and visible. */
export function rankNexusGrowthOffers({ offers } = {}) {
  if (!Array.isArray(offers)) throw new TypeError("offers must be an array");
  if (offers.length > MAX_OFFERS) throw new RangeError("offer limit exceeded");
  const seen = new Set();
  const results = offers.map((offer) => {
    if (seen.has(offer?.id)) throw new TypeError("offer ids must be unique");
    seen.add(offer?.id);
    return simulateNexusGrowthOffer({ offer });
  });
  return results.sort((a, b) =>
    b.baseCase.estimatedContributionCents - a.baseCase.estimatedContributionCents ||
    a.offerId.localeCompare(b.offerId));
}
