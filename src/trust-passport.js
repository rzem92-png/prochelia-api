// PROCHÉLIA Trust Passport — deterministic admissibility policy.
// Pure helper only: the Worker must load authoritative D1 records and call this
// before booking and again at mission start. Never pass browser-supplied statuses.
const VERIFIED_STATUS_BY_CATEGORY = Object.freeze({
  IDENTITY: 'IDENTITY_VERIFIED',
  QUALIFICATION: 'QUALIFICATION_VERIFIED',
  DOCUMENT: 'DOCUMENT_VERIFIED',
  INSURANCE: 'DOCUMENT_VERIFIED',
  AUTHORIZATION: 'DOCUMENT_VERIFIED'
});

function normalized(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function validInstant(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function verificationApplies(record, service, category, missionMs) {
  if (!record || normalized(record.category) !== category) return false;
  if (normalized(record.status) !== (VERIFIED_STATUS_BY_CATEGORY[category] || 'DOCUMENT_VERIFIED')) return false;
  const scope = String(record.service_code || '').trim();
  const exactScope = scope === String(service.service_code);
  const approvedGlobalScope = scope === '*' && service.allow_global_scope === true;
  if (!exactScope && !approvedGlobalScope) return false;
  if (record.valid_from) {
    const start = validInstant(record.valid_from);
    if (start === null || start > missionMs) return false;
  }
  if (record.expires_at) {
    const expiry = validInstant(record.expires_at);
    if (expiry === null || expiry <= missionMs) return false;
  }
  if (record.requires_expiry === true && !record.expires_at) return false;
  return true;
}

/**
 * Returns an explainable, fail-closed decision.
 * `service.requirements` is the versioned, server-owned catalogue entry;
 * `profile` and `verifications` must come from trusted database reads.
 */
export function evaluateTaskEligibility({ service, profile, verifications, missionAt } = {}) {
  const reasons = [];
  const missionMs = validInstant(missionAt);
  if (missionMs === null) reasons.push('MISSION_DATE_INVALID');
  if (!service || normalized(service.status) !== 'ACTIVE' || !String(service.service_code || '').trim()) {
    reasons.push('SERVICE_CATALOG_NOT_ACTIVE');
  }
  if (!profile || normalized(profile.status) !== 'ACTIVE') reasons.push('INTERVENANT_NOT_ACTIVE');
  if (!Array.isArray(verifications)) reasons.push('VERIFICATIONS_UNAVAILABLE');
  if (!service || !Array.isArray(service.requirements)) reasons.push('SERVICE_REQUIREMENTS_UNAVAILABLE');

  if (reasons.length) return { decision: 'BLOCKED', reasons: [...new Set(reasons)] };
  const records = verifications;
  const serviceCode = String(service.service_code);
  if (service.require_identity !== false && !records.some(v => verificationApplies(v, service, 'IDENTITY', missionMs))) {
    reasons.push('IDENTITY_VERIFICATION_REQUIRED');
  }
  for (const requirement of service.requirements) {
    const category = normalized(requirement?.category);
    if (requirement?.required === false) continue;
    if (!category || !VERIFIED_STATUS_BY_CATEGORY[category]) {
      reasons.push('SERVICE_REQUIREMENT_INVALID');
      continue;
    }
    const found = records.some(v => verificationApplies(v, service, category, missionMs));
    if (!found) reasons.push('VERIFICATION_REQUIRED:' + category + ':' + serviceCode);
  }
  if (profile.suspended === true || normalized(profile.suspension_status) === 'SUSPENDED') reasons.push('INTERVENANT_SUSPENDED');
  return { decision: reasons.length ? 'BLOCKED' : 'ELIGIBLE', reasons: [...new Set(reasons)] };
}
