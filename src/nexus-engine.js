/**
 * PROCHÉLIA NEXUS — deterministic, dependency-free V1.
 * No network, database, payment, or personal-data access.
 * Money is represented in integer cents; scores are basis points (0..10000).
 */

const DEFAULT_WEIGHTS = Object.freeze({
  skills: 4000,
  affordability: 2500,
  proximity: 1500,
  trust: 2000
});

const isInt = (n) => Number.isSafeInteger(n);
const MAX_RANK_CANDIDATES = 10000;
const MAX_COMPOSITION_CANDIDATES = 500;
const clamp = (n, min = 0, max = 10000) => Math.max(min, Math.min(max, n));

function validateRequest(request) {
  if (!request || typeof request !== "object") throw new TypeError("request is required");
  if (!Array.isArray(request.requiredSkills) || request.requiredSkills.length === 0 ||
      request.requiredSkills.some((skill) => typeof skill !== "string" || !skill.trim()) ||
      new Set(request.requiredSkills).size !== request.requiredSkills.length) {
    throw new TypeError("request.requiredSkills must contain unique non-empty strings");
  }
  if (request.slot !== undefined && (typeof request.slot !== "string" || !request.slot.trim())) {
    throw new TypeError("request.slot must be a non-empty string when provided");
  }
  if (request.budgetCents !== undefined &&
      (!isInt(request.budgetCents) || request.budgetCents < 0)) {
    throw new TypeError("budgetCents must be a non-negative safe integer");
  }
  if (request.maxDistanceKm !== undefined &&
      (!Number.isFinite(request.maxDistanceKm) || request.maxDistanceKm < 0)) {
    throw new TypeError("maxDistanceKm must be a non-negative finite number");
  }
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate.id !== "string" || !candidate.id.trim()) {
    throw new TypeError("each candidate needs a non-empty id");
  }
  if (!Array.isArray(candidate.skills) || candidate.skills.some((skill) => typeof skill !== "string" || !skill.trim()) ||
      new Set(candidate.skills).size !== candidate.skills.length) {
    throw new TypeError("candidate.skills must contain unique non-empty strings");
  }
  if (!isInt(candidate.priceCents) || candidate.priceCents < 0) {
    throw new TypeError("candidate.priceCents must be a non-negative safe integer");
  }
  if (!Number.isFinite(candidate.distanceKm) || candidate.distanceKm < 0) {
    throw new TypeError("candidate.distanceKm must be a non-negative finite number");
  }
  for (const key of ["ratingBps", "reliabilityBps"]) {
    if (!isInt(candidate[key]) || candidate[key] < 0 || candidate[key] > 10000) {
      throw new TypeError(`candidate.${key} must be an integer from 0 to 10000`);
    }
  }
}

function getWeights(weights = DEFAULT_WEIGHTS) {
  if (!weights || typeof weights !== "object" || Array.isArray(weights)) {
    throw new TypeError("weights must be an object");
  }
  const keys = Object.keys(DEFAULT_WEIGHTS);
  if (Object.keys(weights).some((key) => !keys.includes(key))) {
    throw new TypeError("weights contain unsupported dimensions");
  }
  const result = { ...weights };
  if (keys.some((key) => !isInt(result[key]) || result[key] < 0) ||
      keys.reduce((sum, key) => sum + result[key], 0) !== 10000) {
    throw new TypeError("weights must be non-negative integer basis points totaling 10000");
  }
  return result;
}

function eligibility(candidate, request, { partial = false } = {}) {
  if (candidate.active !== true || candidate.available !== true ||
      candidate.eligibilityVerified !== true) return false;
  if (request.budgetCents !== undefined && candidate.priceCents > request.budgetCents) return false;
  if (request.maxDistanceKm !== undefined && candidate.distanceKm > request.maxDistanceKm) return false;
  if (request.slot && (!Array.isArray(candidate.availabilitySlots) ||
      !candidate.availabilitySlots.includes(request.slot))) return false;
  const matched = request.requiredSkills.filter((skill) => candidate.skills.includes(skill));
  if (partial) return matched.length > 0;
  return matched.length === request.requiredSkills.length;
}

function scoreCandidate(candidate, request, weights) {
  const matched = request.requiredSkills.filter((skill) => candidate.skills.includes(skill));
  const skills = Math.floor(matched.length * 10000 / request.requiredSkills.length);
  const affordability = request.budgetCents === undefined
    ? 5000
    : request.budgetCents === 0 ? 10000
    : clamp(10000 - Math.floor(candidate.priceCents * 10000 / request.budgetCents));
  const proximity = request.maxDistanceKm === undefined
    ? 5000
    : request.maxDistanceKm === 0 ? 10000
    : clamp(10000 - Math.floor(candidate.distanceKm * 10000 / request.maxDistanceKm));
  const trust = Math.floor((candidate.ratingBps + candidate.reliabilityBps) / 2);
  const score = Math.floor((
    skills * weights.skills +
    affordability * weights.affordability +
    proximity * weights.proximity +
    trust * weights.trust
  ) / 10000);
  return {
    candidateId: candidate.id,
    scoreBps: score,
    explanation: { matchedSkills: matched, skillsBps: skills, affordabilityBps: affordability,
      proximityBps: proximity, trustBps: trust }
  };
}

/** Returns eligible solo matches in deterministic order. */
export function rankNexusOpportunities({ request, candidates, weights } = {}) {
  validateRequest(request);
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  if (candidates.length > MAX_RANK_CANDIDATES) throw new RangeError("candidate limit exceeded");
  const w = getWeights(weights);
  const seen = new Set();
  const ranked = [];
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (seen.has(candidate.id)) throw new TypeError("candidate ids must be unique");
    seen.add(candidate.id);
    if (eligibility(candidate, request)) ranked.push(scoreCandidate(candidate, request, w));
  }
  return ranked.sort((a, b) => b.scoreBps - a.scoreBps ||
    a.candidateId.localeCompare(b.candidateId));
}

/**
 * Builds only bounded two-provider scenarios. Each provider must contribute
 * at least one distinct required skill; both must be eligible, available in
 * the requested slot, and within the total budget.
 */
export function composeNexusScenarios({ request, candidates, maxActors = 2 } = {}) {
  validateRequest(request);
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  if (candidates.length > MAX_COMPOSITION_CANDIDATES) throw new RangeError("composition candidate limit exceeded");
  if (maxActors !== 2) throw new RangeError("V1 supports exactly two actors for composed scenarios");
  const ids = new Set();
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (ids.has(candidate.id)) throw new TypeError("candidate ids must be unique");
    ids.add(candidate.id);
  }
  const eligible = candidates.filter((c) => eligibility(c, request, { partial: true }));
  const scenarios = [];
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i], b = eligible[j];
      if (a.id === b.id) continue;
      const aSkills = request.requiredSkills.filter((s) => a.skills.includes(s));
      const bSkills = request.requiredSkills.filter((s) => b.skills.includes(s));
      const covered = [...new Set([...aSkills, ...bSkills])];
      if (covered.length !== request.requiredSkills.length) continue;
      if (aSkills.every((s) => bSkills.includes(s)) ||
          bSkills.every((s) => aSkills.includes(s))) continue;
      const totalPriceCents = a.priceCents + b.priceCents;
      if (!Number.isSafeInteger(totalPriceCents)) throw new RangeError("scenario price overflow");
      if (request.budgetCents !== undefined && totalPriceCents > request.budgetCents) continue;
      const ids = [a.id, b.id].sort((x, y) => x.localeCompare(y));
      scenarios.push({
        candidateIds: ids,
        totalPriceCents,
        coveredSkills: request.requiredSkills.filter((s) => covered.includes(s))
      });
    }
  }
  return scenarios.sort((a, b) => a.totalPriceCents - b.totalPriceCents ||
    a.candidateIds.join("|").localeCompare(b.candidateIds.join("|")));
}
