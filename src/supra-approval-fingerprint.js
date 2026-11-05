// SUPRA approval fingerprint: binds a human decision to one exact case/proposal/version.
// This is an integrity fingerprint, NOT authentication, authorization, or an execution token.
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("NON_FINITE_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("CIRCULAR_VALUE");
    seen.add(value);
    const result = "[" + value.map(item => canonicalize(item, seen)).join(",") + "]";
    seen.delete(value);
    return result;
  }
  if (!isPlainObject(value)) throw new TypeError("NON_JSON_VALUE");
  if (seen.has(value)) throw new TypeError("CIRCULAR_VALUE");
  seen.add(value);
  const keys = Object.keys(value).sort();
  const result = "{" + keys.map(key => JSON.stringify(key) + ":" + canonicalize(value[key], seen)).join(",") + "}";
  seen.delete(value);
  return result;
}

function validBinding(input) {
  return isPlainObject(input) &&
    typeof input.caseId === "string" && input.caseId.trim().length > 0 && input.caseId.length <= 128 &&
    typeof input.proposalId === "string" && input.proposalId.trim().length > 0 && input.proposalId.length <= 128 &&
    (typeof input.proposalVersion === "string" || Number.isSafeInteger(input.proposalVersion)) &&
    input.proposalVersion !== "" &&
    isPlainObject(input.proposal);
}

export async function createSupraApprovalFingerprint(input) {
  if (!validBinding(input)) return { ok: false, code: "INVALID_APPROVAL_BINDING" };
  try {
    const payload = canonicalize({
      caseId: input.caseId,
      proposalId: input.proposalId,
      proposalVersion: input.proposalVersion,
      proposal: input.proposal
    });
    const bytes = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    return { ok: true, fingerprint, algorithm: "SHA-256", executionAllowed: false };
  } catch {
    return { ok: false, code: "INVALID_CANONICAL_PAYLOAD" };
  }
}

export async function verifySupraApprovalFingerprint(input, expectedFingerprint) {
  if (typeof expectedFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    return { ok: false, code: "INVALID_FINGERPRINT", matches: false };
  }
  const result = await createSupraApprovalFingerprint(input);
  if (!result.ok) return { ...result, matches: false };
  return { ok: true, matches: result.fingerprint === expectedFingerprint, executionAllowed: false };
}
