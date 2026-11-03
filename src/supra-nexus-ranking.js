// PROCHÉLIA Nexus-SUPRA ranking v1 — deterministic, explainable, privacy-minimizing.
// This is a ranking proposal only. It cannot assign a mission, change prices, or execute payment.
const WEIGHTS = Object.freeze({
  skillFit: 0.30, availabilityFit: 0.20, reliability: 0.15,
  quality: 0.15, distanceFit: 0.10, priceFairness: 0.05, fairExposure: 0.05
});
const SCORE_FIELDS = Object.keys(WEIGHTS);
const MAX_CANDIDATES = 500;
const MAX_DISTANCE_KM = 500;
const MAX_PRICE_CENTS = 100000000;

function validScore(v) { return Number.isFinite(v) && v >= 0 && v <= 100; }
function invalid(reason) {
  return { ok:false, error:reason, rankings:[], executionAllowed:false, assignmentAllowed:false };
}

/**
 * Request:
 * { requiredSkills:string[], maxDistanceKm:number, budgetCents:number,
 *   providerCandidates:[{id,skills:string[],available:boolean,verified:boolean,
 *     reliability:0..100,quality:0..100,distanceKm:number,quoteCents:number,
 *     smallLocalProvider:boolean, recentExposure:0..100}] }
 * Server must populate eligibility/verification/availability; never trust client claims.
 */
export function rankNexusProviders(request = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request) ||
      !Array.isArray(request.requiredSkills) || !Array.isArray(request.providerCandidates) ||
      request.providerCandidates.length > MAX_CANDIDATES ||
      !Number.isFinite(request.maxDistanceKm) || request.maxDistanceKm <= 0 ||
      request.maxDistanceKm > MAX_DISTANCE_KM ||
      !Number.isSafeInteger(request.budgetCents) || request.budgetCents <= 0 ||
      request.budgetCents > MAX_PRICE_CENTS) return invalid("INVALID_REQUEST");
  const required = request.requiredSkills.map(s => typeof s === "string" ? s.trim().toLowerCase() : "");
  if (required.some(s => !s || s.length > 80) || new Set(required).size !== required.length) return invalid("INVALID_SKILLS");
  const ids = new Set();
  const eligible = [];
  for (const c of request.providerCandidates) {
    if (!c || typeof c !== "object" || Array.isArray(c) ||
        typeof c.id !== "string" || !c.id.trim() || c.id.length > 128 || ids.has(c.id)) return invalid("INVALID_CANDIDATE");
    ids.add(c.id);
    if (!Array.isArray(c.skills) || typeof c.available !== "boolean" || typeof c.verified !== "boolean" ||
        typeof c.smallLocalProvider !== "boolean" || !validScore(c.reliability) || !validScore(c.quality) ||
        !validScore(c.recentExposure) || !Number.isFinite(c.distanceKm) || c.distanceKm < 0 ||
        c.distanceKm > MAX_DISTANCE_KM || !Number.isSafeInteger(c.quoteCents) || c.quoteCents <= 0 ||
        c.quoteCents > MAX_PRICE_CENTS) return invalid("INVALID_CANDIDATE_FIELDS");
    if (!c.verified || !c.available || c.distanceKm > request.maxDistanceKm ||\n        c.quoteCents > request.budgetCents || c.quoteCents < c.minimumViableQuoteCents) continue;
    const skills = c.skills.map(s => typeof s === "string" ? s.trim().toLowerCase() : "");
    if (skills.some(s => !s || s.length > 80)) return invalid("INVALID_CANDIDATE_SKILLS");
    const skillFit = required.length === 0 ? 100 : required.filter(s => skills.includes(s)).length / required.length * 100;
    if (skillFit < 100) continue; // hard competency gate; no score can compensate
    const availabilityFit = 100; // hard availability gate passed; schedule fit must be server-derived
    const distanceFit = 100 * (1 - c.distanceKm / request.maxDistanceKm);
    // Do not reward the cheapest quote. Pricing is eligible only above a server-calculated\n    // provider/platform minimum; the score rewards proximity to the client budget only weakly.\n    const priceFairness = 100 * (1 - Math.min(1, Math.abs(request.budgetCents - c.quoteCents) / request.budgetCents));
    // Exposure is an anti-popularity signal: less recent exposure earns a modest boost.
    // No demographic, health, religion, ethnicity, or other sensitive attribute is used.
    const fairExposure = c.smallLocalProvider ? 100 * (1 - c.recentExposure / 100) : 0;
    const components = { skillFit, availabilityFit, reliability:c.reliability, quality:c.quality,
      distanceFit, priceFairness, fairExposure };
    const score = SCORE_FIELDS.reduce((sum, key) => sum + components[key] * WEIGHTS[key], 0);
    eligible.push({
      providerId:c.id, score:Number(score.toFixed(4)), components,
      reasonCodes:["VERIFIED","AVAILABLE","SKILLS_MATCH","WITHIN_DISTANCE","WITHIN_CLIENT_BUDGET","ABOVE_SERVER_MINIMUM_VIABLE_QUOTE",
        ...(c.smallLocalProvider ? ["LOCAL_SMALL_PROVIDER_EXPOSURE_BALANCE"] : [])],
      quoteCents:c.quoteCents, distanceKm:c.distanceKm,
      smallLocalProvider:c.smallLocalProvider
    });
  }
  eligible.sort((a,b)=>b.score-a.score || a.providerId.localeCompare(b.providerId));
  return {
    ok:true, algorithm:"NEXUS_SUPRA_FAIR_RANKING_V1", rankings:eligible,
    weights:{...WEIGHTS}, candidateCount:request.providerCandidates.length,
    eligibleCount:eligible.length, executionAllowed:false, assignmentAllowed:false,
    caveats:["Scores rank eligible candidates; they do not prove service quality or safety.",
      "No assignment/payment is performed; user confirmation and backend authorization are required.",
      "Weight changes require versioning, offline evaluation, fairness monitoring, and manager approval."]
  };
}
