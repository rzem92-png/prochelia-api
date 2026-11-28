/**
 * PROCHÉLIA LIVE — Nexus Supra adaptive visual protection policy.
 * Pure policy contract only: no media processing, auth, persistence or enforcement.
 * Fail closed when a safety detector/control path is unhealthy.
 */
export const SAFE_VISION_ACTIONS = Object.freeze([
  "allow",
  "targeted_blur",
  "expanded_blur",
  "full_frame_shield",
  "pause_live",
]);

const clampConfidence = (v) => Number.isFinite(v) && v >= 0 && v <= 1;

export function decideSafeVisionAction(input) {
  if (!input || typeof input !== "object") return { action: "full_frame_shield", reason: "invalid_input" };
  const { detectorHealthy, enforcementHealthy, confidence, severity, targetTrackReliable,
    context, repeated, imminentDanger, policyAllowsBlur } = input;

  // Fail closed: loss of detection or delivery/enforcement health cannot leave the viewer unprotected.
  if (detectorHealthy !== true || enforcementHealthy !== true)
    return { action: "full_frame_shield", reason: "safety_pipeline_unhealthy" };

  if (!clampConfidence(confidence) || !["low", "medium", "high", "critical"].includes(severity))
    return { action: "full_frame_shield", reason: "invalid_signal" };

  if (imminentDanger === true || severity === "critical")
    return { action: "pause_live", reason: "imminent_or_critical_risk" };

  // Context is a signal for review, never an automatic exemption from safety policy.
  const contextual = ["education", "medical", "journalism", "documentary", "fiction"].includes(context);
  if (contextual && severity !== "high" && repeated !== true)
    return { action: "targeted_blur", reason: "contextual_review_with_viewer_protection" };

  if (policyAllowsBlur !== true)
    return { action: "pause_live", reason: "policy_requires_interruption" };

  if (severity === "low" && confidence < 0.65)
    return { action: "allow", reason: "low_confidence_low_risk" };

  if (targetTrackReliable === true && confidence >= 0.8)
    return { action: "targeted_blur", reason: "reliable_localized_target" };

  if (confidence >= 0.55)
    return { action: "expanded_blur", reason: "uncertain_target_or_tracking" };

  return { action: "full_frame_shield", reason: "risk_signal_uncertain" };
}
