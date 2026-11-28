/**
 * PROCHÉLIA LIVE safety-signal envelope validation.
 * This validates untrusted event shape only; auth/signature, tenant ownership,
 * replay protection, idempotency persistence and enforcement are separate gates.
 */
const ENUMS = {
  actor_type: new Set(["host","guest","viewer","system","detector","reviewer"]),
  modality: new Set(["video","audio","chat","gift","report","combined","system"]),
  severity: new Set(["info","low","medium","high","critical"]),
  categories: new Set([
    "drug_use_or_display","drug_sale_or_promotion","tobacco_or_nicotine_use",
    "alcohol_intoxication_or_promotion","dangerous_challenge","credible_violence_threat",
    "weapon_threat","sexual_exploitation","child_sexual_exploitation","child_safety_or_grooming",
    "self_harm_imminent","hate_or_harassment","doxxing_or_private_data_exposure",
    "scam_or_gift_manipulation","graphic_violence","sexualized_content",
    "copyrighted_rebroadcast","educational_or_news_context","unknown"
  ])
};
const MAX = { id:128, version:64, evidence:256, territory:8, context:24 };
function str(v,max){return typeof v==="string" && v.trim().length>0 && v.length<=max;}
function iso(v){return typeof v==="string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));}
function add(errors,field,code){errors.push({field,code});}
export function validateLiveSafetySignalEnvelope(input,{nowMs=Date.now(),maxAgeMs=10*60*1000,maxFutureMs=60*1000}={}) {
  const errors=[];
  if(!input||typeof input!=="object"||Array.isArray(input)){return {valid:false,errors:[{field:"event",code:"OBJECT_REQUIRED"}]};}
  if(!str(input.signal_id,MAX.id))add(errors,"signal_id","REQUIRED_OR_TOO_LONG");
  if(!str(input.stream_id,MAX.id))add(errors,"stream_id","REQUIRED_OR_TOO_LONG");
  if(!str(input.room_version,MAX.version))add(errors,"room_version","REQUIRED");
  if(!str(input.actor_id,MAX.id))add(errors,"actor_id","REQUIRED_OR_TOO_LONG");
  if(!ENUMS.actor_type.has(input.actor_type))add(errors,"actor_type","ENUM_INVALID");
  if(!ENUMS.categories.has(input.category))add(errors,"category","ENUM_INVALID");
  if(!ENUMS.severity.has(input.severity))add(errors,"severity","ENUM_INVALID");
  if(!ENUMS.modality.has(input.modality))add(errors,"modality","ENUM_INVALID");
  if(typeof input.confidence!=="number"||!Number.isFinite(input.confidence)||input.confidence<0||input.confidence>1)add(errors,"confidence","RANGE_0_TO_1");
  if(!iso(input.observed_at))add(errors,"observed_at","UTC_ISO_TIMESTAMP_REQUIRED");
  else {const t=Date.parse(input.observed_at);if(t<nowMs-maxAgeMs)add(errors,"observed_at","EVENT_TOO_OLD");if(t>nowMs+maxFutureMs)add(errors,"observed_at","EVENT_IN_FUTURE");}
  if(!str(input.territory,MAX.territory)||!/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(input.territory))add(errors,"territory","ISO_REGION_FORMAT_REQUIRED");
  if(!str(input.provider_id,MAX.id))add(errors,"provider_id","REQUIRED");
  if(!str(input.model_version,MAX.version))add(errors,"model_version","REQUIRED");
  if(!str(input.policy_version,MAX.version))add(errors,"policy_version","REQUIRED");
  if(input.evidence_ref!==undefined&&(!str(input.evidence_ref,MAX.evidence)||/^https?:\/\//i.test(input.evidence_ref)))add(errors,"evidence_ref","OPAQUE_REFERENCE_ONLY");
  if(input.context_flags!==undefined&&(!Array.isArray(input.context_flags)||input.context_flags.length>MAX.context||input.context_flags.some(v=>!str(v,64))))add(errors,"context_flags","INVALID_ARRAY");
  if(input.expires_at!==undefined&&!iso(input.expires_at))add(errors,"expires_at","UTC_ISO_TIMESTAMP_REQUIRED");
  if(input.expires_at!==undefined&&iso(input.expires_at)&&iso(input.observed_at)&&Date.parse(input.expires_at)<=Date.parse(input.observed_at))add(errors,"expires_at","MUST_FOLLOW_OBSERVED_AT");
  return {valid:errors.length===0,errors};
}
export const LIVE_SIGNAL_ENVELOPE_VERSION="1.0.0";
