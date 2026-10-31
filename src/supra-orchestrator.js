// PROCHÉLIA IA SUPRA — orchestration transversale V2
// Registre central des domaines, niveaux d'autonomie et plans d'action audités.
// Le planificateur prépare et gouverne les actions ; il ne simule pas l'exécution d'un adaptateur absent.

const DOMAIN_REGISTRY = Object.freeze({
  direction: ["strategie", "objectifs", "priorites", "gouvernance", "performance"],
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
  if (explicit && DOMAIN_REGISTRY[explicit]) return explicit;
  const normalized = cleanText(caseType);
  return DOMAIN_ALIASES[normalized] || Object.keys(DOMAIN_REGISTRY).find(domain =>
    DOMAIN_REGISTRY[domain].some(term => normalized.includes(term))
  ) || "direction";
}

export function getSupraDomainRegistry() {
  return Object.entries(DOMAIN_REGISTRY).map(([domain, capabilities]) => ({
    domain, capabilities: [...capabilities]
  }));
}

export function buildSupraPlan(input = {}) {
  const caseType = cleanText(input.caseType, "analyse_generale");
  const action = String(input.requestedAction ?? "ANALYZE_AND_PROPOSE").trim().toUpperCase();
  const impact = String(input.impact ?? "LOW").trim().toUpperCase();
  const domain = inferDomain(caseType, input.domain);
  const market = cleanText(input.market, "fr");
  const context = input.context && typeof input.context === "object" ? input.context : {};
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
  if (context.mission_id && context.missionOwnershipVerified !== true) missingEvidence.push("verify_mission_ownership_server_side");
  if (context.provider_id && context.providerEligibilityVerified !== true) missingEvidence.push("verify_provider_eligibility_server_side");
  if (context.provider_id && context.providerAvailabilityVerified !== true) missingEvidence.push("verify_provider_availability_server_side");
  if (["REFUND", "PAYOUT", "CHARGE"].includes(action) && context.pspConfirmed !== true) missingEvidence.push("verify_psp_event_and_ledger");
  if (context.client_id && context.clientOwnershipVerified !== true) missingEvidence.push("verify_client_ownership_server_side");

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
