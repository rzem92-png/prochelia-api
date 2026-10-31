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
const PROFESSIONAL_ESCALATION_CASES = new Set(["danger_personne","violence","urgence_medicale","suspicion_maltraitance","conseil_juridique_complexe","fraude_financiere_majeure"]);
const SENSITIVE_CASES = new Set([
  "reclamation_client", "litige", "absence_intervenant", "retard_intervenant",
  "paiement", "remboursement", "rgpd", "securite", "fraude", "juridique",
  "recrutement", "resiliation", "suspension_compte", "incident_grave"
]);
const LOW_IMPACT_READ_ONLY = new Set([
  "GENERATE_SUMMARY", "CLASSIFY_CASE", "DETECT_DUPLICATE",
  "CALCULATE_INDICATOR", "PREPARE_SCENARIO", "DRAFT_INTERNAL_TASK",
  "RECONCILE_READ_ONLY", "CHECK_BACKUP_STATUS"
]);

function normalized(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeCaseType(value) {
  return String(value ?? "unknown")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "unknown";
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function invalidDecision(reason = "INVALID_INPUT_FAIL_CLOSED") {
  return {
    engine: "PROCHELIA_SUPRA_GOVERNANCE_V1",
    caseType: "unknown",
    action: "UNKNOWN",
    risk: "HIGH",
    autonomy: "RECOMMEND_AND_WAIT",
    managerApprovalRequired: true,
    executionAllowed: false,
    missingEvidence: ["validate_input_and_server_authorized_evidence"],
    recommendedNextStep: "ESCALATE_FOR_HUMAN_REVIEW",
    decisionOwner: "GERANTE",
    professionalEscalationRequired: false,
    rationale: reason
  };
}

export function assessSupraDecision(rawInput = {}) {
  if (!isPlainRecord(rawInput)) return invalidDecision();
  const input = rawInput;
  const allowedKeys = new Set(["caseType", "impact", "requestedAction", "actorRole", "context"]);
  if (Object.keys(input).some(key => !allowedKeys.has(key))) {
    return invalidDecision("UNEXPECTED_OR_UNTRUSTED_FIELD_FAIL_CLOSED");
  }
  for (const key of ["caseType", "impact", "requestedAction", "actorRole"]) {
    if (input[key] !== undefined && typeof input[key] !== "string") {
      return invalidDecision("INVALID_FIELD_TYPE_FAIL_CLOSED");
    }
  }
  if (input.context !== undefined && !isPlainRecord(input.context)) {
    return invalidDecision("INVALID_CONTEXT_FAIL_CLOSED");
  }
  const caseType = normalizeCaseType(input.caseType);
  const impact = normalized(input.impact || "LOW");
  const action = normalized(input.requestedAction || "ANALYZE_AND_PROPOSE");
  const role = normalized(input.actorRole || "unknown").toLowerCase();
  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(impact)) return invalidDecision("INVALID_IMPACT_FAIL_CLOSED");
  const context = input.context || {};
  const allowedContextKeys = new Set(["mission_id", "provider_id", "replacement_intervenant_id", "client_id", "immediateDanger"]);
  if (Object.keys(context).some(key => !allowedContextKeys.has(key)) ||
      ["mission_id", "provider_id", "replacement_intervenant_id", "client_id"].some(key =>
        context[key] !== undefined && (typeof context[key] !== "string" || !context[key].trim() || context[key].length > 128)
      ) ||
      (context.immediateDanger !== undefined && typeof context.immediateDanger !== "boolean")) {
    return invalidDecision("INVALID_CONTEXT_FIELD_FAIL_CLOSED");
  }
  // No caller-supplied evidence is accepted. Only trusted server-side adapters may
  // satisfy these checks after independently reading authoritative records.
  const evidence = Object.create(null);
  const missingEvidence = [];
  if (context.mission_id && evidence.missionOwnershipVerified !== true) missingEvidence.push("mission_ownership");
  if ((context.provider_id || context.replacement_intervenant_id) && evidence.providerEligibilityVerified !== true) missingEvidence.push("provider_eligibility");
  if ((context.provider_id || context.replacement_intervenant_id) && evidence.providerAvailabilityVerified !== true) missingEvidence.push("provider_availability");
  if (["REFUND", "PAYOUT", "CHARGE"].includes(action) && evidence.pspConfirmation !== true) missingEvidence.push("psp_confirmation");
  if (["CHANGE_PRICE", "ACTIVATE_PROMOTION"].includes(action) && evidence.serverPricingPolicy !== true) missingEvidence.push("server_pricing_policy");
  if (context.client_id && evidence.clientOwnershipVerified !== true) missingEvidence.push("client_ownership");

  const professionalEscalationRequired = PROFESSIONAL_ESCALATION_CASES.has(caseType) || context.immediateDanger === true;
  const sensitive = professionalEscalationRequired || impact === "HIGH" || impact === "CRITICAL" ||
    SENSITIVE_CASES.has(caseType) || SENSITIVE_ACTIONS.has(action) ||
    missingEvidence.length > 0;
  const safeReadOnly = LOW_IMPACT_READ_ONLY.has(action) &&
    impact === "LOW" && missingEvidence.length === 0 && !professionalEscalationRequired;
  const managerApprovalRequired = !safeReadOnly || role !== "gerante";
  const autonomy = professionalEscalationRequired ? "URGENT_HUMAN_ESCALATION" : safeReadOnly && !managerApprovalRequired ? "AUTONOMOUS_READ_ONLY" : "RECOMMEND_AND_WAIT";
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
    recommendedNextStep: professionalEscalationRequired
      ? "ESCALATE_TO_EMERGENCY_OR_QUALIFIED_PROFESSIONAL"
      : missingEvidence.length
      ? "COLLECT_AND_VERIFY_EVIDENCE"
      : safeReadOnly ? "RETURN_ANALYSIS_ONLY" : "PRESENT_OPTIONS_TO_MANAGER",
    decisionOwner: professionalEscalationRequired ? "HUMAN_PROFESSIONAL_AND_GERANTE" : safeReadOnly && role === "gerante" ? "SYSTEM_WITH_AUDIT" : "GERANTE",
    professionalEscalationRequired,
    rationale: sensitive
      ? "Action sensible ou impact élevé : aucune exécution sans validation explicite de la Gérante."
      : "La couche V1 autorise uniquement l'analyse en lecture seule ; les écritures restent bloquées."
  };
}

export function simulateResilience(rawInput = {}) {
  if (!isPlainRecord(rawInput)) return { ok: false, error: "INVALID_SCENARIO_INPUT" };
  const input = rawInput;
  const revenue = input.monthlyRevenueCents;
  const fixed = input.monthlyFixedCostsCents;
  const variableRate = input.variableCostRate;
  const cash = input.cashCents;
  const demandShock = input.demandShockRate ?? 0;
  const costShock = input.costShockRate ?? 0;
  const monetaryValues = [revenue, fixed, cash];
  const rateValues = [variableRate, demandShock, costShock];
  if (monetaryValues.some(v => typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) ||
      rateValues.some(v => typeof v !== "number" || !Number.isFinite(v)) ||
      variableRate < 0 || variableRate > 1 ||
      demandShock < 0 || demandShock > 1 || costShock < 0) {
    return { ok: false, error: "INVALID_SCENARIO_INPUT" };
  }
  const stressedRevenue = Math.round(revenue * (1 - demandShock));
  const stressedVariableCosts = Math.round(stressedRevenue * variableRate * (1 + costShock));
  const stressedFixedCosts = Math.round(fixed * (1 + costShock));
  if (![stressedRevenue, stressedVariableCosts, stressedFixedCosts].every(Number.isSafeInteger)) {
    return { ok: false, error: "SCENARIO_AMOUNT_OVERFLOW" };
  }
  const monthlyNet = stressedRevenue - stressedVariableCosts - stressedFixedCosts;
  if (!Number.isSafeInteger(monthlyNet)) return { ok: false, error: "SCENARIO_AMOUNT_OVERFLOW" };
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
