// PROCHÉLIA IA SUPRA-INTELLIGENTE — gouvernance déterministe V1
// Cette couche ne prétend pas remplacer un modèle IA : elle encadre ses recommandations
// et interdit l'exécution autonome des décisions sensibles.
const SENSITIVE_ACTIONS = new Set([
  "ASSIGN_REPLACEMENT", "RESCHEDULE_MISSION", "CANCEL_MISSION",
  "REFUND", "PAYOUT", "CHARGE", "CHANGE_PRICE", "ACTIVATE_PROMOTION",
  "LEGAL_DECISION", "CONTRACT_CHANGE", "ACCOUNT_SUSPENSION",
  "PERSONAL_DATA_EXPORT", "PERSONAL_DATA_DELETE", "DISCIPLINARY_ACTION",
  "HIRE", "TERMINATE", "COMPLAINT_RESOLUTION", "DISPUTE_RESOLUTION"
]);
const SENSITIVE_CASES = new Set([
  "reclamation_client", "litige", "absence_intervenant", "retard_intervenant",
  "paiement", "remboursement", "rgpd", "securite", "fraude", "juridique",
  "recrutement", "resiliation", "suspension_compte", "incident_grave"
]);
const LOW_IMPACT_READ_ONLY = new Set([
  "GENERATE_SUMMARY", "CLASSIFY_CASE", "DRAFT_NOTIFICATION",
  "DETECT_DUPLICATE", "CALCULATE_INDICATOR", "PREPARE_SCENARIO"
]);

function normalized(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function assessSupraDecision(input = {}) {
  const caseType = String(input.caseType ?? "unknown").trim().toLowerCase();
  const impact = normalized(input.impact || "LOW");
  const action = normalized(input.requestedAction || "ANALYZE_AND_PROPOSE");
  const role = normalized(input.actorRole || "unknown").toLowerCase();
  const context = input.context && typeof input.context === "object" ? input.context : {};
  const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : {};
  const missingEvidence = [];
  if (context.mission_id && evidence.missionOwnershipVerified !== true) missingEvidence.push("mission_ownership");
  if (context.replacement_intervenant_id && evidence.providerEligibilityVerified !== true) missingEvidence.push("provider_eligibility");
  if (context.replacement_intervenant_id && evidence.providerAvailabilityVerified !== true) missingEvidence.push("provider_availability");
  if (["REFUND", "PAYOUT", "CHARGE"].includes(action) && evidence.pspConfirmation !== true) missingEvidence.push("psp_confirmation");
  if (["CHANGE_PRICE", "ACTIVATE_PROMOTION"].includes(action) && evidence.serverPricingPolicy !== true) missingEvidence.push("server_pricing_policy");
  if (context.client_id && evidence.clientOwnershipVerified !== true) missingEvidence.push("client_ownership");

  const sensitive = impact === "HIGH" || impact === "CRITICAL" ||
    SENSITIVE_CASES.has(caseType) || SENSITIVE_ACTIONS.has(action) ||
    missingEvidence.length > 0;
  const safeReadOnly = LOW_IMPACT_READ_ONLY.has(action) &&
    impact === "LOW" && missingEvidence.length === 0;
  const managerApprovalRequired = !safeReadOnly || role !== "gerante";
  const autonomy = safeReadOnly ? "AUTONOMOUS_READ_ONLY" : "RECOMMEND_AND_WAIT";
  const risk = impact === "CRITICAL" ? "CRITICAL" :
    (sensitive ? "HIGH" : (impact === "MEDIUM" ? "MEDIUM" : "LOW"));

  return {
    engine: "PROCHELIA_SUPRA_GOVERNANCE_V1",
    caseType,
    action,
    risk,
    autonomy,
    managerApprovalRequired,
    executionAllowed: false,
    missingEvidence,
    recommendedNextStep: missingEvidence.length
      ? "COLLECT_AND_VERIFY_EVIDENCE"
      : safeReadOnly ? "RETURN_ANALYSIS_ONLY" : "PRESENT_OPTIONS_TO_MANAGER",
    decisionOwner: safeReadOnly && role === "gerante" ? "SYSTEM_WITH_AUDIT" : "GERANTE",
    rationale: sensitive
      ? "Action sensible ou impact élevé : aucune exécution sans validation explicite de la Gérante."
      : "La couche V1 autorise uniquement l'analyse en lecture seule ; les écritures restent bloquées."
  };
}

export function simulateResilience(input = {}) {
  const revenue = Number(input.monthlyRevenueCents);
  const fixed = Number(input.monthlyFixedCostsCents);
  const variableRate = Number(input.variableCostRate);
  const cash = Number(input.cashCents);
  const demandShock = Number(input.demandShockRate ?? 0);
  const costShock = Number(input.costShockRate ?? 0);
  const values = [revenue, fixed, variableRate, cash, demandShock, costShock];
  if (values.some(v => !Number.isFinite(v)) || revenue < 0 || fixed < 0 ||
      cash < 0 || variableRate < 0 || variableRate > 1 ||
      demandShock < 0 || demandShock > 1 || costShock < 0) {
    return { ok: false, error: "INVALID_SCENARIO_INPUT" };
  }
  const stressedRevenue = Math.round(revenue * (1 - demandShock));
  const stressedVariableCosts = Math.round(stressedRevenue * variableRate * (1 + costShock));
  const stressedFixedCosts = Math.round(fixed * (1 + costShock));
  const monthlyNet = stressedRevenue - stressedVariableCosts - stressedFixedCosts;
  const burn = Math.max(0, -monthlyNet);
  const runwayMonths = burn > 0 ? Number((cash / burn).toFixed(1)) : null;
  const actions = [];
  if (demandShock >= 0.2) actions.push("Diversifier_les_canaux_et_les_segments_B2B_B2C");
  if (costShock >= 0.1) actions.push("Renegocier_les_couts_et_revoir_les_zones_de_service");
  if (monthlyNet < 0) actions.push("Geler_les_depenses_non_essentielles_et_revoir_les_prix_sans_depassement_reglementaire");
  if (runwayMonths !== null && runwayMonths < 3) actions.push("Alerte_tresorerie_critique_et_validation_gerante_immediate");
  return {
    ok: true,
    engine: "PROCHELIA_SUPRA_RESILIENCE_V1",
    currency: "EUR_CENTS",
    scenario: { demandShockRate: demandShock, costShockRate: costShock },
    stressed: {
      monthlyRevenueCents: stressedRevenue,
      monthlyVariableCostsCents: stressedVariableCosts,
      monthlyFixedCostsCents: stressedFixedCosts,
      monthlyNetCents: monthlyNet,
      cashRunwayMonths: runwayMonths
    },
    recommendation: monthlyNet >= 0 ? "RESILIENCE_ACCEPTABLE" : "PROTECT_CASH_AND_REVIEW_MODEL",
    proposedActions: actions,
    decisionOwner: "GERANTE",
    executionAllowed: false,
    disclaimer: "Simulation indicative fondée exclusivement sur les hypothèses fournies ; elle ne prédit pas l'avenir et ne déclenche aucune action."
  };
}
