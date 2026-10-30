/**
 * PROCHÉLIA NEXUS — privacy-conscious opportunity intelligence and unit economics.
 * Pure deterministic helpers: no network, storage, personal identifiers or side effects.
 * Aggregations expose a group only when it reaches the configured minimum cohort size.
 */

const isInt = Number.isSafeInteger;
const MAX_SIGNALS = 100000;
const MAX_GROUPS = 20000;
const MIN_COHORT = 5;

function assertMoney(value, field) {
  if (!isInt(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer in cents`);
  }
}

function safeAdd(values, field) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!isInt(total)) throw new RangeError(`${field} exceeds safe integer range`);
  return total;
}

/**
 * Simulates one transaction's platform contribution.
 * All monetary inputs are explicit; no tax, commission, refund or PSP rate is guessed.
 * grossCollected must cover the provider payout and recognized platform revenue.
 */
export function simulateNexusUnitEconomics(input = {}) {
  const fields = [
    "grossCollectedCents", "providerPayoutCents", "platformRevenueCents",
    "pspFeeCents", "variableOperatingCostCents", "platformRefundCostCents"
  ];
  for (const field of fields) assertMoney(input[field], field);

  const allocated = safeAdd(
    [input.providerPayoutCents, input.platformRevenueCents],
    "provider payout plus platform revenue"
  );
  if (allocated > input.grossCollectedCents) {
    throw new RangeError("provider payout plus platform revenue cannot exceed gross collected");
  }

  const platformCosts = safeAdd(
    [input.pspFeeCents, input.variableOperatingCostCents, input.platformRefundCostCents],
    "platform costs"
  );
  const contributionMarginCents = input.platformRevenueCents - platformCosts;
  const contributionMarginBps = input.platformRevenueCents === 0
    ? null
    : Math.floor(contributionMarginCents * 10000 / input.platformRevenueCents);

  return Object.freeze({
    grossCollectedCents: input.grossCollectedCents,
    providerPayoutCents: input.providerPayoutCents,
    platformRevenueCents: input.platformRevenueCents,
    pspFeeCents: input.pspFeeCents,
    variableOperatingCostCents: input.variableOperatingCostCents,
    platformRefundCostCents: input.platformRefundCostCents,
    platformCostsCents: platformCosts,
    contributionMarginCents,
    contributionMarginBps,
    isContributionPositive: contributionMarginCents > 0,
    isFullyAllocated: allocated === input.grossCollectedCents
  });
}

/**
 * Aggregates coarse category/area demand signals.
 * No user IDs, names, exact addresses, free text or individual budgets are accepted.
 * Small cohorts are suppressed to reduce re-identification risk.
 */
export function aggregateNexusDemand({ signals, minCohortSize = MIN_COHORT } = {}) {
  if (!Array.isArray(signals)) throw new TypeError("signals must be an array");
  if (signals.length > MAX_SIGNALS) throw new RangeError("signal limit exceeded");
  if (!isInt(minCohortSize) || minCohortSize < MIN_COHORT) {
    throw new RangeError(`minCohortSize must be an integer of at least ${MIN_COHORT}`);
  }

  const groups = new Map();
  for (const signal of signals) {
    if (!signal || typeof signal.categoryKey !== "string" || !signal.categoryKey.trim() ||
        typeof signal.areaKey !== "string" || !signal.areaKey.trim()) {
      throw new TypeError("each signal needs coarse categoryKey and areaKey strings");
    }
    if (!["unmet", "fulfilled"].includes(signal.outcome)) {
      throw new TypeError("signal outcome must be unmet or fulfilled");
    }
    if (signal.categoryKey.length > 80 || signal.areaKey.length > 80) {
      throw new RangeError("categoryKey and areaKey must not exceed 80 characters");
    }
    const key = JSON.stringify([signal.categoryKey, signal.areaKey]);
    const group = groups.get(key) || {
      categoryKey: signal.categoryKey,
      areaKey: signal.areaKey,
      totalSignals: 0,
      unmetSignals: 0,
      fulfilledSignals: 0
    };
    group.totalSignals += 1;
    if (signal.outcome === "unmet") group.unmetSignals += 1;
    else group.fulfilledSignals += 1;
    groups.set(key, group);
    if (groups.size > MAX_GROUPS) throw new RangeError("demand group limit exceeded");
  }

  return [...groups.values()]
    .filter((group) => group.totalSignals >= minCohortSize)
    .map((group) => Object.freeze({
      categoryKey: group.categoryKey,
      areaKey: group.areaKey,
      totalSignals: group.totalSignals,
      unmetSignals: group.unmetSignals,
      fulfilledSignals: group.fulfilledSignals,
      unmetRateBps: Math.floor(group.unmetSignals * 10000 / group.totalSignals)
    }))
    .sort((a, b) => b.unmetRateBps - a.unmetRateBps ||
      a.categoryKey.localeCompare(b.categoryKey) ||
      a.areaKey.localeCompare(b.areaKey));
}
