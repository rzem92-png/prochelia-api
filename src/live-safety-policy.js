/**
 * PROCHÉLIA LIVE SAFETY POLICY — candidate rules engine (not wired to LIVE).
 * Detector signals must come from validated providers or human reviewers.
 */
export const LIVE_SAFETY_POLICY_VERSION = "2026-11-28.1";
const HARD_STOP = new Set(["drug_use_or_display","drug_sale_or_promotion","child_sexual_exploitation","credible_violence_threat","sexual_exploitation","weapon_threat","self_harm_imminent","doxxing_or_private_data_exposure"]);
const RESTRICT = new Set(["tobacco_or_nicotine_use","alcohol_intoxication_or_promotion","dangerous_challenge","harassment_or_hate","scam_or_gift_manipulation","graphic_violence","sexualized_content","copyrighted_rebroadcast"]);
function result(action,reason,severity,confidence){return {policy_version:LIVE_SAFETY_POLICY_VERSION,action,reason,severity,confidence,monetization:action==="ALLOW"?"ELIGIBLE_PENDING_OTHER_CHECKS":"BLOCKED",human_review:action==="END_LIVE"||action==="SUSPEND_LIVE"||confidence<0.9};}
export function evaluateLiveSafetySignal(signal={}) {
 const category=String(signal.category||"unknown"), confidence=Number(signal.confidence), severity=String(signal.severity||"unknown"), guest=signal.actor_type==="guest";
 if(!Number.isFinite(confidence)||confidence<0||confidence>1)return result("HOLD_FOR_REVIEW","INVALID_OR_MISSING_CONFIDENCE","unknown",0);
 if(signal.host_verified_adult!==true)return result("BLOCK_START_OR_END_LIVE","LIVE_HOST_NOT_VERIFIED_18_PLUS","critical",confidence);
 if(signal.minor_present===true&&signal.live_minor_protection!==true)return result("END_LIVE","MINOR_SAFETY_CONTROL_FAILURE","critical",confidence);
 if(HARD_STOP.has(category)){if(confidence>=0.72||severity==="critical")return result(guest?"REMOVE_GUEST_AND_END_IF_CONTINUING":"END_LIVE",category,"critical",confidence);return result("PAUSE_AND_HUMAN_REVIEW",category,"high",confidence);}
 if(RESTRICT.has(category)){if(confidence>=0.88)return result(guest?"REMOVE_GUEST":"INTERRUPT_AND_RESTRICT",category,"high",confidence);if(confidence>=0.62)return result("WARN_AND_PAUSE_OR_BLUR",category,"medium",confidence);return result("HOLD_FOR_REVIEW",category,"low",confidence);}
 if(category==="educational_or_news_context")return result(confidence>=0.8?"AGE_RESTRICT_AND_REVIEW":"HOLD_FOR_REVIEW","CONTEXTUAL_SENSITIVE_CONTENT","medium",confidence);
 if(category==="unknown"||confidence<0.55)return result("HOLD_FOR_REVIEW","UNCERTAIN_SIGNAL","low",confidence);
 return result("ALLOW","NO_POLICY_MATCH","low",confidence);
}
export function evaluateLiveStart({hostVerifiedAdult,safetySystemsReady,moderationProviderHealthy,guestControlsReady=true}={}) {
 const missing=[];if(hostVerifiedAdult!==true)missing.push("HOST_AGE_VERIFICATION");if(safetySystemsReady!==true)missing.push("SAFETY_CONTROLS_NOT_READY");if(moderationProviderHealthy!==true)missing.push("MODERATION_PROVIDER_UNAVAILABLE");if(guestControlsReady!==true)missing.push("GUEST_CONTROLS_NOT_READY");
 return {allowed:missing.length===0,fail_closed:true,missing,policy_version:LIVE_SAFETY_POLICY_VERSION};
}
