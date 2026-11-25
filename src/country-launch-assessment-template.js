/**
 * PROCHÉLIA country launch assessment template.
 *
 * This is a questionnaire schema, not legal/tax advice or an approval record.
 * Responses and evidence are deliberately not accepted or persisted by this module.
 */
const TERRITORIAL_SCOPE_HINTS = Object.freeze({
  FR: "Préciser le périmètre retenu (territoires, villes et zones réellement couvertes); ne pas présumer que tout le territoire est ouvert.",
  DZ: "Préciser les wilayas, villes et zones réellement couvertes; faire valider le périmètre par des responsables locaux qualifiés.",
  BE: "Préciser les régions, communes et langues de service couvertes; vérifier les différences territoriales pertinentes avec un conseil local.",
  CH: "Préciser les cantons, communes et langues de service couverts; ne pas présumer d'une couverture nationale uniforme.",
  LU: "Préciser les communes et langues de service couvertes ainsi que les limites opérationnelles.",
  CA: "Préciser les provinces, territoires et villes couverts; identifier les validations qui doivent être faites à chaque niveau.",
  MA: "Préciser les régions, villes et zones réellement couvertes; faire valider le périmètre local.",
  TN: "Préciser les gouvernorats, villes et zones réellement couvertes; faire valider le périmètre local.",
  ES: "Préciser les communautés autonomes, villes et langues de service couvertes; identifier les validations territoriales nécessaires.",
  IT: "Préciser les régions, provinces et villes couvertes; identifier les validations territoriales nécessaires.",
  DE: "Préciser les Länder, villes et zones couvertes; identifier les validations territoriales nécessaires.",
  GB: "Préciser les nations, régions, villes et zones couvertes; identifier les validations territoriales nécessaires.",
  US: "Préciser les États, territoires et villes couverts; identifier les validations à réaliser par niveau territorial.",
  AE: "Préciser les émirats, villes et zones couverts; faire confirmer les exigences par des conseils locaux qualifiés.",
});

const GATE_SECTIONS = Object.freeze([
  {
    id: "legal_review",
    label: "Juridique et modèle de service",
    reviewerRole: "Conseil juridique qualifié dans la juridiction",
    evidenceSuggested: ["legal_memo", "service_terms", "regulatory_review"],
    questions: [
      { id: "service_scope", type: "text", required: true, prompt: "Décrire précisément les services, actes, catégories de clients et intervenants prévus." },
      { id: "regulated_activity_review", type: "select", required: true, prompt: "La qualification et les éventuelles autorisations/réglementations ont-elles été examinées par un conseil local ?", choices: [{ value: "not_assessed", label: "Non évalué" }, { value: "review_in_progress", label: "Revue en cours" }, { value: "written_review_received", label: "Avis écrit reçu" }, { value: "blocked", label: "Blocage identifié" }] },
      { id: "contract_roles", type: "text", required: true, prompt: "Documenter les rôles, responsabilités, contrats, assurances et restrictions identifiés par le conseil." },
    ],
  },
  {
    id: "tax_review",
    label: "Fiscalité, facturation et comptabilité",
    reviewerRole: "Expert-comptable ou fiscaliste local qualifié",
    evidenceSuggested: ["tax_memo", "invoice_sample_review", "accounting_mapping"],
    questions: [
      { id: "tax_registration", type: "text", required: true, prompt: "Documenter les obligations d'enregistrement et les taxes applicables, avec sources et date de revue." },
      { id: "invoice_requirements", type: "text", required: true, prompt: "Lister les mentions, numérotation, langue, devise, archivage et règles de facturation à confirmer." },
      { id: "accounting_validation", type: "select", required: true, prompt: "Le traitement comptable et fiscal a-t-il reçu une validation écrite locale ?", choices: [{ value: "not_assessed", label: "Non évalué" }, { value: "review_in_progress", label: "Revue en cours" }, { value: "written_review_received", label: "Avis écrit reçu" }, { value: "blocked", label: "Blocage identifié" }] },
    ],
  },
  {
    id: "payments_review",
    label: "Paiements, remboursements et rapprochement",
    reviewerRole: "Responsable financier et PSP",
    evidenceSuggested: ["psp_confirmation", "refund_flow_review", "settlement_reconciliation"],
    questions: [
      { id: "psp_eligibility", type: "text", required: true, prompt: "Identifier le PSP envisagé, son autorisation/éligibilité locale, les restrictions et la confirmation écrite à obtenir." },
      { id: "refund_disputes", type: "text", required: true, prompt: "Décrire les parcours de remboursements, contestations, réclamations et protections, sans exécution de paiement." },
      { id: "settlement_reconciliation", type: "text", required: true, prompt: "Documenter les devises, délais, frais, rapprochement et contrôles de séparation des tâches à valider." },
    ],
  },
  {
    id: "data_protection_review",
    label: "Protection des données et sécurité",
    reviewerRole: "DPO ou conseil privacy qualifié",
    evidenceSuggested: ["data_inventory", "privacy_review", "security_assessment"],
    questions: [
      { id: "data_inventory", type: "text", required: true, prompt: "Lister les catégories de données, finalités, personnes concernées, destinataires et accès nécessaires." },
      { id: "retention_rights", type: "text", required: true, prompt: "Documenter les bases légales à confirmer, droits, délais de conservation, suppression et réponse aux demandes." },
      { id: "hosting_transfers", type: "text", required: true, prompt: "Évaluer hébergement, transferts, sous-traitants, mesures de sécurité et analyse d'impact si nécessaire." },
    ],
  },
  {
    id: "operations_review",
    label: "Opérations, qualité, sécurité et support",
    reviewerRole: "Responsable opérationnel local",
    evidenceSuggested: ["insurance_confirmation", "incident_procedure", "support_sla"],
    questions: [
      { id: "insurance_safety", type: "text", required: true, prompt: "Documenter les assurances, risques de service, vérifications des intervenants et mesures de sécurité à confirmer." },
      { id: "incident_response", type: "text", required: true, prompt: "Décrire les procédures d'urgence, incident, plainte, escalade et disponibilité du support." },
      { id: "operational_capacity", type: "text", required: true, prompt: "Décrire la capacité réelle, recrutement, formation, qualité, SLA et limites géographiques du pilote." },
    ],
  },
  {
    id: "human_activation",
    label: "Décision humaine de lancement",
    reviewerRole: "Fondateur ou responsable marché expressément habilité",
    evidenceSuggested: ["review_summary", "decision_record", "risk_acceptance"],
    questions: [
      { id: "previous_gates_review", type: "text", required: true, prompt: "Référencer les validations écrites de tous les autres contrôles et leurs éventuelles réserves." },
      { id: "named_market_owner", type: "text", required: true, prompt: "Identifier le responsable marché, son habilitation et le périmètre qu'il peut autoriser." },
      { id: "launch_decision", type: "select", required: true, prompt: "Quelle décision humaine documentée a été prise ? Ce champ de modèle ne vaut pas approbation.", choices: [{ value: "not_assessed", label: "Non évalué" }, { value: "pending", label: "En attente" }, { value: "approved_with_scope", label: "Avis favorable limité à un périmètre" }, { value: "rejected", label: "Refus / lancement bloqué" }] },
    ],
  },
]);

function cloneTemplate(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getCountryLaunchAssessmentTemplate(countryConfig) {
  if (!countryConfig || typeof countryConfig.code !== "string") return null;
  return {
    ok: true,
    templateVersion: "country-launch-assessment-v1.0.0",
    country: {
      code: countryConfig.code,
      name: countryConfig.name,
      marketStatus: countryConfig.marketStatus,
      defaultLocale: countryConfig.defaultLocale,
      locales: [...countryConfig.locales],
      currency: countryConfig.currency,
    },
    territorialScope: {
      required: true,
      hint: TERRITORIAL_SCOPE_HINTS[countryConfig.code] ?? "Préciser les subdivisions et zones couvertes; faire valider le périmètre local.",
      reviewerRole: "Responsable opérationnel et conseil juridique local",
      question: { id: "territorial_scope", type: "text", required: true, prompt: "Définir les subdivisions, villes, territoires, langues de service et limites exactes du périmètre envisagé." },
    },
    sections: cloneTemplate(GATE_SECTIONS),
    evidenceUploadEnabled: false,
    responsePersistenceEnabled: false,
    approvalRecorded: false,
    launchEligible: false,
    activationAllowed: false,
    note: "Modèle de préparation uniquement. Aucun contenu de réponse, justificatif, avis juridique ou approbation n'est enregistré ou vérifié. Les questions doivent être complétées et validées par des professionnels locaux et des responsables humains habilités.",
  };
}
