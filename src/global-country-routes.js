import { getCountryConfig, listCountryConfigs, isCountryLaunchEligible } from "./global-country-registry.js";
import { getCountryTimezones } from "./global-timezone-registry.js";
import { COUNTRY_LAUNCH_GATES } from "./country-launch-gates.js";
import { getCountryLaunchAssessmentTemplate } from "./country-launch-assessment-template.js";

const LAUNCH_GATE_DETAILS = Object.freeze({
  legal_review: Object.freeze({
    label: "Revue juridique locale",
    owner: "Conseil juridique qualifié dans le pays",
    evidenceRequired: "Note juridique locale datée couvrant le modèle de service, les contrats, les responsabilités et les restrictions applicables.",
  }),
  tax_review: Object.freeze({
    label: "Revue fiscale et facturation",
    owner: "Expert-comptable ou fiscaliste local qualifié",
    evidenceRequired: "Validation écrite des taxes, règles de facturation, obligations déclaratives et traitement comptable applicables.",
  }),
  payments_review: Object.freeze({
    label: "Validation des paiements",
    owner: "Responsable financier et prestataire de paiement",
    evidenceRequired: "Confirmation du PSP, des moyens de paiement, remboursements, rapprochement et restrictions locales; aucun paiement réel n'est activé par cette API.",
  }),
  data_protection_review: Object.freeze({
    label: "Protection des données",
    owner: "DPO ou conseil privacy qualifié",
    evidenceRequired: "Analyse des données, bases légales, droits, rétention, hébergement, transferts et mesures de sécurité; DPIA si requise.",
  }),
  operations_review: Object.freeze({
    label: "Validation opérationnelle",
    owner: "Responsable opérations local",
    evidenceRequired: "Capacité de support, procédures d'urgence, qualité, SLA, assurance et processus de réclamation adaptés.",
  }),
  human_activation: Object.freeze({
    label: "Autorisation humaine de lancement",
    owner: "Fondateur ou responsable marché habilité",
    evidenceRequired: "Décision explicite, datée et traçable de l'autorité habilitée, après examen des validations précédentes.",
  }),
});

function parseCountryRoute(pathname) {
  const segments = pathname.split("/");
  if (segments.length < 5 || segments[0] !== "" || segments[1] !== "api" || segments[2] !== "global" || segments[3] !== "countries") return null;
  const code = segments[4];
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  if (segments.length === 5) return { code, subroute: null };
  if (segments.length === 6 && ["timezones", "launch-checklist", "launch-assessment-template"].includes(segments[5])) return { code, subroute: segments[5] };
  return null;
}

function publicCountry(config) {
  return {
    code: config.code,
    name: config.name,
    defaultLocale: config.defaultLocale,
    locales: [...config.locales],
    currency: config.currency,
    timezone: config.timezone,
    timezones: getCountryTimezones(config.code),
    callingCode: config.callingCode,
    available: isCountryLaunchEligible(config.code),
  };
}

function publicLaunchChecklist(config) {
  const gates = (config.launchGates ?? COUNTRY_LAUNCH_GATES).map((gateId) => {
    const details = LAUNCH_GATE_DETAILS[gateId];
    return {
      id: gateId,
      label: details?.label ?? gateId,
      owner: details?.owner ?? "Responsable qualifié à désigner",
      evidenceRequired: details?.evidenceRequired ?? "Validation humaine documentée à fournir.",
      required: true,
      status: "not_assessed",
      approvalRecorded: false,
    };
  });
  return {
    ok: true,
    country: { code: config.code, name: config.name, marketStatus: config.marketStatus },
    checklist: {
      requiredCount: gates.length,
      assessedCount: 0,
      approvedCount: 0,
      gates,
    },
    launchEligible: false,
    activationAllowed: false,
    note: "Checklist descriptive uniquement : cet endpoint ne stocke ni ne vérifie les preuves et approbations. Toute activation exige une validation humaine séparée.",
  };
}


function publicLaunchOverview() {
  const countries = listCountryConfigs().sort((a, b) => a.code.localeCompare(b.code));
  const rows = countries.map((config) => {
    const checklist = publicLaunchChecklist(config).checklist;
    return {
      code: config.code,
      name: config.name,
      marketStatus: config.marketStatus,
      requiredCount: checklist.requiredCount,
      assessedCount: checklist.assessedCount,
      approvedCount: checklist.approvedCount,
      status: "not_assessed",
      launchEligible: false,
      activationAllowed: false,
      gates: checklist.gates.map((gate) => ({ id: gate.id, label: gate.label, status: gate.status, approvalRecorded: gate.approvalRecorded })),
    };
  });
  const requiredGateCount = rows.reduce((sum, country) => sum + country.requiredCount, 0);
  return {
    ok: true,
    summary: {
      countryCount: rows.length,
      marketEnabledCount: rows.filter((country) => country.marketStatus === "enabled").length,
      requiredGateCount,
      assessedGateCount: 0,
      approvedGateCount: 0,
      status: "not_assessed",
      launchEligible: false,
      activationAllowed: false,
    },
    countries: rows,
    note: "Vue agrégée descriptive uniquement : aucun dossier de preuve ni approbation n'est stocké ou vérifié. Aucun pays n'est activé par cet endpoint.",
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function handleGlobalCountryRoute(request, pathname) {
  const launchSummaryPath = "/api/global/countries/launch-summary";
  if (pathname !== "/api/global/countries" && pathname !== launchSummaryPath && !parseCountryRoute(pathname)) return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET" });

  if (pathname === launchSummaryPath) return json(publicLaunchOverview());

  if (pathname === "/api/global/countries") {
    const countries = listCountryConfigs()
      .map(publicCountry)
      .sort((a, b) => a.code.localeCompare(b.code));
    return json({ ok: true, count: countries.length, countries });
  }

  const route = parseCountryRoute(pathname);
  const config = getCountryConfig(route?.code);
  if (!config) return json({ ok: false, error: "COUNTRY_NOT_FOUND" }, 404);

  if (route.subroute === "timezones") {
    return json({
      ok: true,
      countryCode: config.code,
      defaultTimezone: config.timezone,
      timezones: getCountryTimezones(config.code),
    });
  }
  if (route.subroute === "launch-checklist") {
    return json(publicLaunchChecklist(config));
  }
  if (route.subroute === "launch-assessment-template") {
    return json(getCountryLaunchAssessmentTemplate(config));
  }
  return json({ ok: true, country: publicCountry(config) });
}
