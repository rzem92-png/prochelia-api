const CLIENT_CATEGORIES = Object.freeze([
  "service_quality", "late_no_show", "quote_price", "communication",
  "property_damage", "safety_concern", "privacy_data", "discrimination", "other"
]);
const MANAGER_CATEGORIES = new Set([...CLIENT_CATEGORIES, "reclamation_client", "fraude",
  "paiement_conteste", "remboursement_important", "litige_juridique", "incident_majeur",
  "violation_donnees", "decision_contractuelle", "conflit_reglementaire", "securite_domicile"]);
const OUTCOMES = new Set(["clarification", "correction", "reschedule", "review", "refund_request", "other"]);
const HIGH_RISK_CATEGORIES = new Set(["property_damage", "safety_concern", "privacy_data", "discrimination",
  "fraude", "paiement_conteste", "remboursement_important", "litige_juridique", "incident_majeur",
  "violation_donnees", "decision_contractuelle", "conflit_reglementaire", "securite_domicile"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function plainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function textValue(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}
function idValue(value) {
  if (value == null || value === "") return null;
  return typeof value === "string" && ID_PATTERN.test(value) ? value : undefined;
}

export function validateComplaintDraft(input, actorRole, now = new Date()) {
  const errors = {};
  if (!plainObject(input)) return { ok: false, errors: { body: "JSON_OBJECT_REQUIRED" } };
  const category = textValue(input.category, 64);
  const allowed = actorRole === "gerante" ? MANAGER_CATEGORIES : new Set(CLIENT_CATEGORIES);
  if (!category || !allowed.has(category)) errors.category = "CATEGORY_INVALID";
  const description = textValue(input.details ?? input.description, 3000);
  if (!description || description.length < 20) errors.description = "DESCRIPTION_LENGTH_INVALID";
  const incidentDate = input.incidentDate ?? input.incident_date ?? "";
  if (incidentDate !== "" && !validDate(incidentDate)) errors.incidentDate = "INCIDENT_DATE_INVALID";
  else if (incidentDate && validDate(incidentDate)) {
    const reference = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
    const today = reference.toISOString().slice(0, 10);
    if (incidentDate > today) errors.incidentDate = "INCIDENT_DATE_FUTURE";
  }
  const requestReference = textValue(input.requestReference ?? input.request_reference ?? "", 80);
  if (requestReference === null || (requestReference && !REFERENCE_PATTERN.test(requestReference))) errors.requestReference = "REQUEST_REFERENCE_INVALID";
  const desiredOutcome = input.desiredOutcome ?? input.desired_outcome ?? "";
  if (actorRole === "client" && !OUTCOMES.has(desiredOutcome)) errors.desiredOutcome = "OUTCOME_REQUIRED";
  if (desiredOutcome && !OUTCOMES.has(desiredOutcome)) errors.desiredOutcome = "OUTCOME_INVALID";
  const desiredOutcomeDetails = textValue(input.desiredOutcomeDetails ?? input.desired_outcome_details ?? "", 500);
  if (desiredOutcomeDetails === null) errors.desiredOutcomeDetails = "OUTCOME_DETAILS_INVALID";
  else if (desiredOutcome === "other" && desiredOutcomeDetails.length < 10) errors.desiredOutcomeDetails = "OUTCOME_DETAILS_REQUIRED";
  if (actorRole === "client" && input.privacyAcknowledged !== true && input.privacy_acknowledged !== true) errors.privacyAcknowledged = "PRIVACY_ACK_REQUIRED";
  if (input.attachments !== undefined && (!Array.isArray(input.attachments) || input.attachments.length !== 0)) errors.attachments = "ATTACHMENTS_NOT_ACCEPTED";
  if (actorRole === "gerante" && input.severity !== undefined && !SEVERITIES.has(input.severity)) errors.severity = "SEVERITY_INVALID";
  const clientId = idValue(input.client_id ?? input.clientId);
  const companyId = idValue(input.company_id ?? input.companyId);
  const missionId = idValue(input.mission_id ?? input.missionId);
  if (clientId === undefined) errors.clientId = "CLIENT_ID_INVALID";
  if (companyId === undefined) errors.companyId = "COMPANY_ID_INVALID";
  if (missionId === undefined) errors.missionId = "MISSION_ID_INVALID";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, normalized: {
    category, description, incidentDate: incidentDate || null, requestReference: requestReference || null,
    desiredOutcome: desiredOutcome || null, desiredOutcomeDetails: desiredOutcomeDetails || null,
    severity: actorRole === "gerante" ? (input.severity || null) : null, clientId, companyId, missionId
  }};
}

export function resolveComplaintScope(actor, draft, records = {}) {
  if (!plainObject(actor) || !draft || typeof draft !== "object") return { ok: false, status: 400, error: "SCOPE_INPUT_INVALID" };
  if (actor.role === "entreprise") return { ok: false, status: 403, error: "COMPANY_SCOPE_NOT_VERIFIED" };
  if (actor.role === "client") {
    const profile = records.clientProfile;
    if (!profile || !ID_PATTERN.test(String(profile.id || ""))) return { ok: false, status: 403, error: "CLIENT_PROFILE_NOT_FOUND" };
    if (draft.clientId && draft.clientId !== profile.id) return { ok: false, status: 403, error: "CLIENT_OWNERSHIP_MISMATCH" };
    if (draft.companyId) return { ok: false, status: 403, error: "COMPANY_SCOPE_NOT_ALLOWED" };
    if (draft.missionId && !records.mission) return { ok: false, status: 404, error: "MISSION_NOT_FOUND" };
    if (records.mission && records.mission.client_id !== profile.id) return { ok: false, status: 403, error: "MISSION_OWNERSHIP_MISMATCH" };
    return { ok: true, scope: {
      client_type: "B2C", client_id: profile.id, company_id: null, mission_id: records.mission?.id || null,
      severity: HIGH_RISK_CATEGORIES.has(draft.category) ? "HIGH" : "MEDIUM"
    }};
  }
  if (actor.role === "gerante") {
    if (draft.clientId && !records.clientProfile) return { ok: false, status: 404, error: "CLIENT_NOT_FOUND" };
    if (draft.companyId && !records.companyProfile) return { ok: false, status: 404, error: "COMPANY_NOT_FOUND" };
    if (draft.missionId && !records.mission) return { ok: false, status: 404, error: "MISSION_NOT_FOUND" };
    if (records.mission && draft.clientId && records.mission.client_id !== draft.clientId) return { ok: false, status: 409, error: "MISSION_CLIENT_SCOPE_MISMATCH" };
    if (records.mission && draft.companyId) return { ok: false, status: 409, error: "COMPANY_MISSION_SCOPE_UNVERIFIED" };
    const severity = draft.severity && SEVERITIES.has(draft.severity) ? draft.severity :
      (HIGH_RISK_CATEGORIES.has(draft.category) ? "HIGH" : "MEDIUM");
    return { ok: true, scope: {
      client_type: draft.companyId ? "B2B" : (draft.clientId || records.mission?.client_id ? "B2C" : "INTERNAL"),
      client_id: draft.clientId || records.mission?.client_id || null,
      company_id: draft.companyId || null, mission_id: records.mission?.id || null, severity
    }};
  }
  return { ok: false, status: 403, error: "ROLE_NOT_ALLOWED" };
}
