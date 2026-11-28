/**
 * Safe Vision mask metadata contract. No image processing is performed here.
 * Coordinates must be normalized [0,1] and masks must be short-lived.
 */
export function validateMaskPlan(plan, nowMs = Date.now()) {
  const fail = reason => ({ ok:false, reason, fallback:"full_frame_shield" });
  if (!plan || typeof plan !== "object") return fail("invalid_plan");
  if (typeof plan.frameId !== "string" || !plan.frameId.trim()) return fail("missing_frame_id");
  if (!Number.isFinite(plan.createdAtMs) || !Number.isFinite(plan.expiresAtMs)) return fail("invalid_time");
  if (plan.createdAtMs > nowMs + 1000 || plan.expiresAtMs <= nowMs) return fail("expired_or_future_plan");
  if (plan.expiresAtMs - plan.createdAtMs > 1500) return fail("mask_ttl_too_long");
  if (!["targeted_blur","expanded_blur","full_frame_shield"].includes(plan.mode)) return fail("invalid_mode");
  if (plan.mode === "full_frame_shield") return { ok:true, mode:plan.mode, masks:[], reason:"full_frame_shield" };
  if (!Array.isArray(plan.masks) || plan.masks.length === 0) return fail("missing_masks");
  if (plan.masks.length > 32) return fail("too_many_masks");
  for (const mask of plan.masks) {
    if (!mask || !Array.isArray(mask.rect) || mask.rect.length !== 4) return fail("invalid_rect");
    const [x,y,w,h] = mask.rect;
    if (![x,y,w,h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x+w > 1 || y+h > 1)
      return fail("rect_out_of_bounds");
    if (typeof mask.trackId !== "string" || !mask.trackId.trim()) return fail("missing_track_id");
    if (!Number.isFinite(mask.confidence) || mask.confidence < 0.8 || mask.confidence > 1) return fail("low_mask_confidence");
  }
  return { ok:true, mode:plan.mode, masks:plan.masks.length, reason:"validated_short_lived_mask_plan" };
}
