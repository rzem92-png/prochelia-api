// PROCHÉLIA — NEXUS SUPRA Executive Orchestrator V1
// Deterministic planning layer. It does not call tools, send messages, mutate data,
// change prices, move money, or deploy code. All collected content is untrusted data.

const AGENTS = Object.freeze({
  STRATEGY: "CEO_STRATEGY",
  MARKET_INTELLIGENCE: "MARKET_INTELLIGENCE",
  MARKETING: "CMO_MARKETING",
  SALES: "CRO_BUSINESS",
  NEGOTIATION: "NEGOTIATION_PARTNERSHIPS",
  FINANCE: "CFO_FINANCE",
  PRICING: "PRICING_GOVERNANCE",
  OPERATIONS: "COO_OPERATIONS",
  TALENT: "TALENT_AND_QUALITY",
  ENGINEERING: "CTO_ENGINEERING",
  CYBERSECURITY: "CISO_SECURITY",
  LEGAL_COMPLIANCE: "LEGAL_COMPLIANCE_REVIEW",
  INTERNATIONAL: "INTERNATIONAL_EXPANSION",
  CRISIS: "CRISIS_CONTINUITY",
  CLIENT_PROTECTION: "CLIENT_SAFEGUARDING",
  PROVIDER_PROTECTION: "PROVIDER_SAFEGUARDING",
  DATA_PROTECTION: "DATA_PROTECTION"
});

const IMPACT = Object.freeze({
  READ_ONLY: "READ_ONLY",
  INTERNAL_REVERSIBLE: "INTERNAL_REVERSIBLE",
  EXTERNAL_OR_FINANCIAL: "EXTERNAL_OR_FINANCIAL",
  LEGAL_OR_REGULATORY: "LEGAL_OR_REGULATORY",
  SECURITY_CRITICAL: "SECURITY_CRITICAL"
});

const DOMAIN_CHECKS = Object.freeze({
  STRATEGY: ["objectives_and_constraints", "scenarios_and_risks", "measurable_kpis"],
  MARKET_INTELLIGENCE: ["source_authorization_and_provenance", "freshness_and_sample_quality", "independent_market_comparison"],
  MARKETING: ["audience_and_consent", "budget_and_roi", "claims_and_brand_compliance"],
  SALES: ["customer_need_and_fit", "transparent_offer", "commercial_authority"],
  NEGOTIATION: ["mandate_and_reservation_price", "counterparty_and_conflicts", "approval_before_binding_commitment"],
  FINANCE: ["integer_minor_units_and_currency", "cashflow_and_margin_scenarios", "ledger_and_reconciliation_evidence"],
  PRICING: ["market_range_and_freshness", "provider_floor_and_client_ceiling", "margin_and_fairness_impact", "approval_before_active_policy_change"],
  OPERATIONS: ["mission_ownership_and_state", "service_quality_and_sla", "incident_escalation_and_continuity"],
  TALENT: ["skills_and_qualification_evidence", "availability_and_fair_matching", "provider_safety_and_right_to_decline"],
  ENGINEERING: ["reproduce_and_scope_defect", "tests_and_security_review", "rollback_and_observability"],
  CYBERSECURITY: ["threat_model_and_scope", "containment_without_evidence_destruction", "independent_validation_and_recovery"],
  LEGAL_COMPLIANCE: ["country_and_activity_scope", "qualified_professional_review", "documented_decision_and_expiry"],
  INTERNATIONAL: ["country_pack_and_local_validation", "currency_tax_data_and_payment_rules", "pilot_gates_and_exit_plan"],
  CRISIS: ["severity_and_people_safety", "continuity_and_communications", "recovery_criteria_and_postmortem"],
  CLIENT_PROTECTION: ["informed_consent_and_clear_scope", "vulnerability_and_safety_escalation", "complaint_and_redress_path"],
  PROVIDER_PROTECTION: ["qualification_and_insurance_scope", "safe_work_conditions_and_right_to_refuse", "transparent_pay_and_incident_support"],
  DATA_PROTECTION: ["purpose_and_legal_basis_review", "minimization_retention_and_access", "rights_and_breach_escalation"]
});

const STEP_TEMPLATES = Object.freeze([
  { id: "OBSERVE", title: "Collecter et qualifier les éléments", mode: "ANALYSIS_ONLY" },
  { id: "ANALYZE", title: "Analyser les causes, options et risques", mode: "ANALYSIS_ONLY" },
  { id: "SIMULATE", title: "Simuler les impacts et scénarios", mode: "ANALYSIS_ONLY" },
  { id: "PROPOSE", title: "Produire une recommandation explicable", mode: "PROPOSAL_ONLY" },
  { id: "GOVERN", title: "Vérifier les permissions et approbations", mode: "GOVERNANCE_GATE" },
  { id: "VERIFY", title: "Définir les preuves de résultat et le retour arrière", mode: "VERIFICATION_PLAN" }
]);

function boundedText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeImpact(value) {
  const impact = typeof value === "string" ? value.trim().toUpperCase() : "";
  return Object.values(IMPACT).includes(impact) ? impact : null;
}

function uniqueStrings(values, maxItems, maxLength) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().slice(0, maxLength))
    .filter(Boolean))].slice(0, maxItems);
}

function autonomyForImpact(impact) {
  if (impact === IMPACT.READ_ONLY) return "AUTONOMOUS_ANALYSIS";
  if (impact === IMPACT.INTERNAL_REVERSIBLE) return "POLICY_BOUNDED_REVERSIBLE_ONLY";
  if (impact === IMPACT.EXTERNAL_OR_FINANCIAL) return "HUMAN_APPROVAL_REQUIRED";
  if (impact === IMPACT.LEGAL_OR_REGULATORY) return "QUALIFIED_HUMAN_DECISION_REQUIRED";
  if (impact === IMPACT.SECURITY_CRITICAL) return "SECURITY_LEAD_AND_HUMAN_APPROVAL_REQUIRED";
  return "DENY_UNKNOWN_IMPACT";
}

/**
 * Build a structured executive plan for a supported PROCHÉLIA domain.
 * evidenceRefs are identifiers only; their contents must be fetched and treated
 * as untrusted data by a separately authorized component.
 */
export function createSupraExecutivePlan(input = {}) {
  const domain = typeof input.domain === "string" ? input.domain.trim().toUpperCase() : "";
  const objective = boundedText(input.objective, 500);
  const impact = normalizeImpact(input.impact);
  if (!Object.hasOwn(AGENTS, domain)) return { ok: false, error: "UNKNOWN_EXECUTIVE_DOMAIN" };
  if (!objective) return { ok: false, error: "OBJECTIVE_REQUIRED" };
  if (!impact) return { ok: false, error: "IMPACT_CLASSIFICATION_REQUIRED" };

  const evidenceRefs = uniqueStrings(input.evidenceRefs, 20, 160);
  const constraints = uniqueStrings(input.constraints, 20, 240);
  const country = boundedText(input.country, 2).toUpperCase();
  const supportedCountry = country === "" || ["FR", "DZ"].includes(country);

  return Object.freeze({
    ok: true,
    planVersion: "NEXUS_SUPRA_EXECUTIVE_PLAN_V1",
    status: "PROPOSAL_ONLY",
    domain,
    agent: AGENTS[domain],
    objective,
    impact,
    autonomy: autonomyForImpact(impact),
    executionGranted: false,
    humanApprovalRequired: impact !== IMPACT.READ_ONLY,
    qualifiedReviewRequired: impact === IMPACT.LEGAL_OR_REGULATORY,
    country: supportedCountry ? (country || null) : null,
    countryActivationAllowed: false,
    evidence: Object.freeze({
      refs: Object.freeze(evidenceRefs),
      treatedAsUntrusted: true,
      sourceVerificationRequired: true,
      freshnessVerificationRequired: domain === "MARKET_INTELLIGENCE" || domain === "PRICING" || domain === "INTERNATIONAL"
    }),
    constraints: Object.freeze(constraints),
    requiredChecks: Object.freeze([...DOMAIN_CHECKS[domain]]),
    steps: Object.freeze(STEP_TEMPLATES.map((step, index) => Object.freeze({
      ...step,
      order: index + 1
    }))),
    safeguards: Object.freeze([
      "No external side effect is executed by this planner.",
      "No price, budget, contract, account, personal data, payment, migration or deployment is changed.",
      "Client, provider and platform interests and safety must be assessed separately.",
      "No qualification, insurance, compliance status, partnership or payment capability is assumed without evidence.",
      "Unknown, stale, conflicting or unauthorized evidence must stop the recommendation.",
      "France and Algeria require separate country-specific validation."
    ])
  });
}

export const supraExecutiveDomains = Object.freeze(Object.keys(AGENTS));
export const supraExecutiveImpacts = IMPACT;
