// PROCHÉLIA IA SUPRA — orchestration transversale V2
// Registre central des domaines, niveaux d'autonomie et plans d'action audités.
// Le planificateur prépare et gouverne les actions ; il ne simule pas l'exécution d'un adaptateur absent.

const DOMAIN_REGISTRY = Object.freeze({
  direction: ["strategie", "objectifs", "priorites", "gouvernance", "performance"],
  services: ["catalogue", "prestations", "devis", "commandes", "qualite", "continuite"],
  talents: ["profils", "competences", "qualifications", "disponibilites", "parcours"],
  live_createurs: ["diffusion", "createurs", "contenus", "moderation", "droits_image", "conversion"],
  opportunites: ["pipeline", "partenariats", "parrainage", "licences", "abonnements", "distribution"],
  rentabilite: ["marge_nette", "cac_reel", "valeur_vie_client", "revenus_par_activite", "tresorerie_13_semaines"],
  croissance: ["acquisition", "retention", "replication_territoriale", "seuils_de_croissance"],
  finance: ["tresorerie", "budget", "marges", "commissions", "couts", "previsions"],
  comptabilite: ["ledger", "rapprochement", "factures", "impayes", "cloture"],
  tarification: ["devis", "tarifs", "promotions", "majorations", "plafonds"],
  missions: ["reservation", "planning", "retards", "annulations", "qualite"],
  matching: ["competences", "zone", "distance", "disponibilite", "fiabilite"],
  intervenants: ["onboarding", "identite", "documents", "formation", "satisfaction"],
  clients: ["inscription", "besoins", "support", "fidelisation", "accessibilite"],
  entreprises: ["b2b", "contrats_cadres", "facturation", "comptes_entreprise"],
  reclamations: ["plaintes", "litiges", "mediation", "resolution"],
  commercial: ["prospection", "partenariats", "conversion", "retention"],
  marketing: ["campagnes", "contenus", "parrainage", "reputation"],
  securite: ["authentification", "fraude", "incidents", "continuite"],
  rgpd: ["minimisation", "droits", "conservation", "purge", "consentements"],
  juridique: ["contrats", "responsabilites", "conformite", "veille"],
  ressources: ["capacite", "recrutement_partenaire", "charge", "qualite"],
  international: ["pays", "langues", "devises", "paiements_locaux", "regles_locales"],
  innovation: ["automatisation", "produit", "experimentation", "avantage_concurrentiel"],
  crise: ["demande", "inflation", "couts", "rupture_prestataire", "liquidite"]
});

const DOMAIN_ALIASES = Object.freeze({
  paiement: "finance", remboursement: "finance", payout: "finance",
  marge: "finance", prix: "tarification", devis: "tarification",
  absence_intervenant: "missions", retard_intervenant: "missions",
  remplacement: "matching", litige: "reclamations", reclamation_client: "reclamations",
  rgpd: "rgpd", fraude: "securite", incident_technique: "securite",
  b2b: "entreprises", expansion: "international", crise_economique: "crise",
  prestation: "services", catalogue: "services", commande: "services",
  talent: "talents", profil_professionnel: "talents", createur: "live_createurs",
  live: "live_createurs", opportunite: "opportunites", partenariat: "opportunites",
  cac: "rentabilite", profitabilite: "rentabilite", marge_nette: "rentabilite",
  croissance_nationale: "croissance", developpement_territorial: "croissance",
  danger_personne: "securite", violence: "securite", urgence_medicale: "securite",
  suspicion_maltraitance: "securite", incident_grave: "securite",
  conseil_juridique_complexe: "juridique", fraude_financiere_majeure: "securite"
});

const HUMAN_DECISION_CASES = new Set([
  "litige", "reclamation_client", "remboursement", "paiement", "fraude",
  "securite", "rgpd", "juridique", "contrat", "recrutement",
  "resiliation", "suspension_compte", "incident_grave", "violence",
  "danger_personne", "crise_tresorerie"
]);

const SAFE_AUTONOMOUS_TASKS = new Set([
  "GENERATE_SUMMARY", "CLASSIFY_CASE", "DETECT_DUPLICATE",
  "CALCULATE_INDICATOR", "PREPARE_SCENARIO", "DRAFT_INTERNAL_TASK",
  "RECONCILE_READ_ONLY", "CHECK_BACKUP_STATUS"
]);

const PROFESSIONAL_ESCALATION_CASES = new Set([
  "danger_personne", "violence", "urgence_medicale", "suspicion_maltraitance",
  "conseil_juridique_complexe", "fraude_financiere_majeure"
]);

function cleanText(value, fallback = "") {
  return String(value ?? fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[ -]+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 100);
}

function inferDomain(caseType, requestedDomain) {
  const explicit = cleanText(requestedDomain);
  if (explicit && Object.hasOwn(DOMAIN_REGISTRY, explicit)) return explicit;
  const normalized = cleanText(caseType);
  return (Object.hasOwn(DOMAIN_ALIASES, normalized) ? DOMAIN_ALIASES[normalized] : null) || Object.keys(DOMAIN_REGISTRY).find(domain =>
    DOMAIN_REGISTRY[domain].some(term => normalized.includes(term))
  ) || "direction";
}

export function getSupraDomainRegistry() {
  return Object.entries(DOMAIN_REGISTRY).map(([domain, capabilities]) => ({
    domain, capabilities: [...capabilities]
  }));
}

function failClosedPlan(reason = "INVALID_INPUT_FAIL_CLOSED") {
  return {
    engine: "PROCHELIA_SUPRA_ORCHESTRATOR_V2",
    domain: "securite",
    connectedDomains: Object.keys(DOMAIN_REGISTRY),
    caseType: "input_invalide",
    requestedAction: "UNKNOWN",
    impact: "CRITICAL",
    marketPack: {
      market: "unknown",
      locale: null,
      currency: "LOCAL_CURRENCY_REQUIRED",
      localRulesStatus: "INPUT_REJECTED",
      launchAllowed: false
    },
    autonomy: {
      level: "PREPARE_RECOMMENDATION_AND_REQUIRE_GERANTE",
      routineReadOnlyAutonomy: false,
      approvalRequired: true,
      professionalEscalationRequired: false,
      executionAdapterReady: false,
      executionClaim: "FAIL_CLOSED_NO_EXECUTION"
    },
    missingEvidence: ["valid_typed_input", "server_verified_evidence"],
    method: ["reject_input", "log_security_event", "request_human_review"],
    decisionBrief: { required: true, fields: ["reason", "source", "impact", "approval_required"] },
    crisisReadiness: { monitor: [], scenarioPlanning: false, autoCommitmentsAllowed: false },
    decisionOwner: "GERANTE",
    executionAllowed: false,
    auditRequired: true,
    rejectionReason: reason
  };
}

function isPlainInput(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function buildSupraPlan(rawInput = {}) {
  // Public helper: malformed external callers fail closed; never coerce attacker-controlled values.
  if (!isPlainInput(rawInput)) return failClosedPlan();
  const input = rawInput;
  const allowedKeys = new Set(["caseType", "requestedAction", "impact", "domain", "market", "context"]);
  if (Object.keys(input).some(key => !allowedKeys.has(key))) return failClosedPlan("UNEXPECTED_INPUT_FIELD");
  for (const key of ["caseType", "requestedAction", "impact", "domain", "market"]) {
    if (input[key] !== undefined && typeof input[key] !== "string") return failClosedPlan("INVALID_FIELD_TYPE");
  }
  if (input.context !== undefined && !isPlainInput(input.context)) return failClosedPlan("INVALID_CONTEXT_TYPE");
  const rawContext = input.context || {};
  const allowedContextKeys = new Set([
    "mission_id", "provider_id", "client_id", "replacement_intervenant_id",
    "immediateDanger", "missionOwnershipVerified", "providerEligibilityVerified",
    "providerAvailabilityVerified", "clientOwnershipVerified", "pspConfirmed"
  ]);
  if (Object.keys(rawContext).some(key => !allowedContextKeys.has(key)) ||
      ["mission_id", "provider_id", "client_id", "replacement_intervenant_id"].some(key =>
        rawContext[key] !== undefined && (typeof rawContext[key] !== "string" || !rawContext[key].trim() || rawContext[key].length > 128)
      ) ||
      ["immediateDanger", "missionOwnershipVerified", "providerEligibilityVerified",
        "providerAvailabilityVerified", "clientOwnershipVerified", "pspConfirmed"].some(key =>
        rawContext[key] !== undefined && typeof rawContext[key] !== "boolean"
      )) {
    return failClosedPlan("INVALID_CONTEXT_FIELD");
  }
  const caseType = cleanText(input.caseType, "analyse_generale");
  const action = String(input.requestedAction ?? "ANALYZE_AND_PROPOSE").trim().toUpperCase();
  const impact = String(input.impact ?? "LOW").trim().toUpperCase();
  const market = cleanText(input.market, "fr");
  if (!caseType || caseType.length > 100 ||
      !/^[A-Z0-9_]{2,64}$/.test(action) ||
      !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(impact) ||
      !(market === "other" || /^[a-z]{2}$/.test(market))) {
    return failClosedPlan("INVALID_FIELD_VALUE");
  }
  const domain = inferDomain(caseType, input.domain);
  const context = rawContext;
  const emergency = PROFESSIONAL_ESCALATION_CASES.has(caseType) || context.immediateDanger === true;
  const sensitive = HUMAN_DECISION_CASES.has(caseType) ||
    ["HIGH", "CRITICAL"].includes(impact) ||
    ["REFUND", "PAYOUT", "CHARGE", "CHANGE_PRICE", "ACTIVATE_PROMOTION",
      "ASSIGN_REPLACEMENT", "RESCHEDULE_MISSION", "CANCEL_MISSION",
      "CONTRACT_CHANGE", "PERSONAL_DATA_EXPORT", "PERSONAL_DATA_DELETE",
      "ACCOUNT_SUSPENSION", "HIRE", "TERMINATE"].includes(action);
  const readOnly = SAFE_AUTONOMOUS_TASKS.has(action) && impact === "LOW" && !sensitive && !emergency;
  const autonomyLevel = emergency ? "URGENT_HUMAN_ESCALATION" :
    sensitive ? "PREPARE_RECOMMENDATION_AND_REQUIRE_GERANTE" :
    readOnly ? "AUTONOMOUS_READ_ONLY_OR_ROUTINE" : "AUTONOMOUS_PREPARATION_THEN_APPROVAL";
  const approvalRequired = !readOnly;
  const professionalRequired = emergency ||
    ["conseil_juridique_complexe", "urgence_medicale"].includes(caseType);
  const missingEvidence = [];
  // These flags may be supplied by an untrusted caller; only server adapters can satisfy evidence.
  if (context.mission_id) missingEvidence.push("verify_mission_ownership_server_side");
  if (context.provider_id) {
    missingEvidence.push("verify_provider_eligibility_server_side");
    missingEvidence.push("verify_provider_availability_server_side");
  }
  if (["REFUND", "PAYOUT", "CHARGE"].includes(action)) missingEvidence.push("verify_psp_event_and_ledger");
  if (context.client_id) missingEvidence.push("verify_client_ownership_server_side");

  const steps = [
    "detect_and_classify",
    "measure_urgency_and_risk",
    "collect_authorized_evidence",
    "identify_root_causes_and_dependencies",
    "evaluate_legal_operational_financial_and_reputational_impacts",
    "generate_at_least_two_feasible_options",
    "rank_options_by_safety_quality_cost_margin_and_time",
    "recommend_best_option_with_assumptions",
    "prepare_authorized_actions",
    "verify_outcomes_and_log_evidence"
  ];
  if (missingEvidence.length) steps.splice(3, 0, "block_execution_until_evidence_is_verified");
  if (approvalRequired) steps.splice(steps.length - 2, 0, "request_explicit_manager_approval");
  if (professionalRequired) steps.splice(2, 0, "escalate_to_emergency_or_qualified_professional");

  const marketPack = {
    market,
    locale: market === "fr" ? "fr-FR" : null,
    currency: market === "fr" ? "EUR" : "LOCAL_CURRENCY_REQUIRED",
    localRulesStatus: market === "fr" ? "REQUIRES_RULES_VERSIONING_AND_LEGAL_REVIEW" : "COUNTRY_ADAPTER_AND_LOCAL_LEGAL_REVIEW_REQUIRED",
    launchAllowed: false
  };

  return {
    engine: "PROCHELIA_SUPRA_ORCHESTRATOR_V2",
    domain,
    connectedDomains: Object.keys(DOMAIN_REGISTRY),
    caseType,
    requestedAction: action,
    impact,
    marketPack,
    autonomy: {
      level: autonomyLevel,
      routineReadOnlyAutonomy: readOnly,
      approvalRequired,
      professionalEscalationRequired: professionalRequired,
      executionAdapterReady: false,
      executionClaim: "PLAN_ONLY_UNTIL_REAL_ADAPTER_AND_END_TO_END_TESTS_EXIST"
    },
    missingEvidence,
    method: steps,
    decisionBrief: {
      required: true,
      fields: ["recommended_option", "why_best", "alternatives", "cost", "margin_impact",
        "legal_risk", "operational_impact", "reputation_impact", "assumptions",
        "consequences_of_waiting", "approval_required"]
    },
    crisisReadiness: {
      monitor: ["demand", "purchasing_power", "inflation", "provider_capacity",
        "payment_provider", "cash_runway", "regulatory_change", "country_risk"],
      scenarioPlanning: true,
      autoCommitmentsAllowed: false
    },
    decisionOwner: approvalRequired ? "GERANTE" : "SYSTEM_WITH_AUDIT",
    executionAllowed: false,
    auditRequired: true
  };
}
