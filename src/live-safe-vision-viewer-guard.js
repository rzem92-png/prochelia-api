/**
 * Viewer-output safety guard for adaptive Safe Vision.
 * This is a contract/guard only; it does not transform media.
 */
const REQUIRED_VIEWER_PATHS = Object.freeze(["live", "guest_preview", "recording", "clip", "replay", "thumbnail"]);

export function validateProtectedViewerOutput(result, requiredPaths = REQUIRED_VIEWER_PATHS) {
  if (!result || typeof result !== "object") return { ok: false, action: "full_frame_shield", reason: "invalid_transform_result" };
  if (result.transformHealthy !== true || result.outputVerified !== true)
    return { ok: false, action: "full_frame_shield", reason: "transform_or_verification_failed" };
  if (result.sourceMediaForwarded === true)
    return { ok: false, action: "pause_live", reason: "unmasked_source_forwarded" };
  if (!Array.isArray(result.protectedPaths))
    return { ok: false, action: "full_frame_shield", reason: "missing_protected_paths" };
  const missing = requiredPaths.filter(path => !result.protectedPaths.includes(path));
  if (missing.length) return { ok: false, action: "full_frame_shield", reason: "viewer_path_unprotected", missing };
  if (result.maskApplied !== true && result.shieldApplied !== true)
    return { ok: false, action: "full_frame_shield", reason: "protection_not_applied" };
  return { ok: true, action: "continue", reason: "all_required_viewer_paths_verified" };
}

export function safeVisionEscalation(guardResult, pauseCommandVerified) {
  if (guardResult?.ok === true) return { action: "continue" };
  if (pauseCommandVerified === true) return { action: "paused", reason: guardResult?.reason ?? "protection_failed" };
  return { action: "emergency_fail_closed", reason: "unable_to_verify_pause_or_protection" };
}
