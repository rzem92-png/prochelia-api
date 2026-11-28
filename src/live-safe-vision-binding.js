/**
 * Safe Vision binding contract prevents mask plans from being replayed across
 * rooms/streams or stale policy/model versions. Cryptographic signature
 * verification and durable replay storage belong to the runtime integration.
 */
export function validateMaskPlanBinding(plan, expected, nowMs = Date.now()) {
  const fail = reason => ({ ok:false, reason, fallback:"full_frame_shield" });
  if (!plan || !expected || typeof plan !== "object" || typeof expected !== "object") return fail("missing_binding");
  const required = ["streamId","roomId","roomVersion","policyVersion","modelVersion","sequence"];
  for (const key of required) {
    if (typeof plan[key] !== "string" && !(key === "sequence" && Number.isSafeInteger(plan[key]))) return fail("invalid_"+key);
    if (plan[key] === "" || plan[key] === 0) return fail("empty_"+key);
    if (plan[key] !== expected[key]) return fail("binding_mismatch_"+key);
  }
  if (!Number.isFinite(plan.issuedAtMs) || Math.abs(nowMs-plan.issuedAtMs)>1000) return fail("stale_or_future_plan");
  if (!Number.isFinite(plan.expiresAtMs) || plan.expiresAtMs <= nowMs || plan.expiresAtMs-plan.issuedAtMs > 1500)
    return fail("invalid_expiry");
  if (expected.lastSequence !== undefined && plan.sequence <= expected.lastSequence) return fail("replay_or_out_of_order");
  if (plan.signatureVerified !== true) return fail("signature_not_verified");
  return { ok:true, reason:"binding_verified" };
}
