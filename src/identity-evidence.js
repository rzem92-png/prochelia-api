const PROVIDER = "manual_control";
const LEVELS = new Set(["standard", "enhanced"]);
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,127}$/;

export function normalizeIdentityDecision(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "INVALID_IDENTITY_DECISION" };
  }
  const status = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  const level = raw.level === undefined ? "standard" :
    typeof raw.level === "string" ? raw.level.trim().toLowerCase() : "";
  const provider = raw.provider === undefined ? PROVIDER :
    typeof raw.provider === "string" ? raw.provider.trim().toLowerCase() : "";
  const providerReference = typeof raw.provider_reference === "string"
    ? raw.provider_reference.trim() : "";
  const rejectionReason = typeof raw.rejection_reason === "string"
    ? raw.rejection_reason.trim() : "";

  if (!["verified", "rejected"].includes(status) ||
      !LEVELS.has(level) || provider !== PROVIDER) {
    return { ok: false, error: "INVALID_IDENTITY_DECISION" };
  }
  if (status === "verified" && !REF_PATTERN.test(providerReference)) {
    return { ok: false, error: "IDENTITY_EVIDENCE_REFERENCE_REQUIRED" };
  }
  if (status === "rejected" && (rejectionReason.length < 8 || rejectionReason.length > 500)) {
    return { ok: false, error: "IDENTITY_REJECTION_REASON_REQUIRED" };
  }
  if (providerReference.length > 128 || rejectionReason.length > 500) {
    return { ok: false, error: "INVALID_IDENTITY_DECISION" };
  }
  return {
    ok: true,
    value: {
      status, level, provider: PROVIDER,
      providerReference: status === "verified" ? providerReference : null,
      rejectionReason: status === "rejected" ? rejectionReason : null
    }
  };
}

export function isCurrentIdentityEvidence(row, now = Date.now()) {
  if (!row || typeof row !== "object" || !Number.isFinite(now)) return false;
  if (row.status !== "verified" || row.provider !== PROVIDER ||
      typeof row.provider_reference !== "string" || !REF_PATTERN.test(row.provider_reference)) return false;
  const verifiedAt = Date.parse(row.verified_at);
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(verifiedAt) || !Number.isFinite(expiresAt)) return false;
  const maximumValidity = 30 * 24 * 60 * 60 * 1000;
  return verifiedAt <= now && expiresAt > now &&
    expiresAt > verifiedAt && expiresAt - verifiedAt <= maximumValidity;
}
