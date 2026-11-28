import { decideSafeVisionAction } from "./live-safe-vision-policy.js";
import { validateMaskPlan } from "./live-safe-vision-mask-plan.js";
import { validateMaskPlanBinding } from "./live-safe-vision-binding.js";

/**
 * Deterministic frame decision coordinator. It validates contracts only;
 * actual transform, output verification and pause execution are runtime duties.
 */
export function evaluateSafeVisionFrame({ signal, maskPlan, binding, nowMs = Date.now() } = {}) {
  const decision = decideSafeVisionAction(signal);
  if (decision.action === "allow") return { action:"allow", decision, protection:"none" };
  if (decision.action === "pause_live") return { action:"pause_live", decision, protection:"pause_required" };
  if (decision.action === "full_frame_shield") return { action:"shield", decision, protection:"full_frame" };

  if (!maskPlan || maskPlan.mode !== decision.action) {
    return { action:"shield", decision, protection:"full_frame", reason:"mask_mode_mismatch" };
  }
  const maskValidation = validateMaskPlan(maskPlan, nowMs);
  if (!maskValidation.ok) return { action:"shield", decision, protection:"full_frame", reason:maskValidation.reason, maskValidation };
  const bindingValidation = validateMaskPlanBinding(binding?.plan, binding?.expected, nowMs);
  if (!bindingValidation.ok) return { action:"shield", decision, protection:"full_frame", reason:bindingValidation.reason, bindingValidation };
  if (binding.plan.frameId !== maskPlan.frameId) return { action:"shield", decision, protection:"full_frame", reason:"frame_binding_mismatch" };
  return { action:"transform", decision, protection:decision.action, maskValidation, bindingValidation };
}
