/**
 * Safe Vision binding contract prevents mask plans from being replayed across
 * rooms/streams or stale policy/model versions. Runtime must verify signatures
 * and persist sequence state before calling this validator.
 */
export function validateMaskPlanBinding(plan, expected, nowMs = Date.now()) {
  const fail = reason => ({ ok:false, reason, fallback:"full_frame_shield" });
  if (!plan || !expected || typeof plan !== "object" || typeof expected !== "object") return fail("missing_binding");
  const fields = ["streamId","roomId","roomVersion","policyVersion","modelVersion"];
  for (const key of fields) {
    if (typeof plan[key] !== "string" || !plan[key].trim() || typeof expected[key] !== "string" || !expected[key].trim())
      return fail("invalid_"+key);
    if (plan[key] !== expected[key]) return fail("binding_mismatch_"+key);
  }
  if (!Number.isSafeInteger(plan.sequence) || plan.sequence < 1) return fail("invalid_sequence");
  if (expected.lastSequence !== undefined && (!Number.isSafeInteger(expected.lastSequence) || plan.sequence <= expected.lastSequence))
    return fail("replay_or_out_of_order");
  if (!Number.isFinite(plan.issuedAtMs) || Math.abs(nowMs-plan.issuedAtMs)>1000) return fail("stale_or_future_plan");
  if (!Number.isFinite(plan.expiresAtMs) || plan.expiresAtMs <= nowMs || plan.expiresAtMs-plan.issuedAtMs > 1500 || plan.expiresAtMs <= plan.issuedAtMs)
    return fail("invalid_expiry");
  if (plan.signatureVerified !== true) return fail("signature_not_verified");
  return { ok:true, reason:"binding_verified" };
}
