/* Nexus Supra compliance gate evaluator. Pure decision support; fail-closed, no legal interpretation or side effects. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusComplianceGate=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const STATES=new Set(["PASS","FAIL","UNKNOWN","NOT_APPLICABLE","EXCEPTION_APPROVED"]);
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function time(v){if(typeof v!=="string"||!ISO.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function blocked(reason){return {ok:false,decision:"BLOCKED",reason,launchAllowed:false,executionAllowed:false,humanReviewRequired:true,mode:"COMPLIANCE_GATE_ADVISORY_ONLY"}}
function evaluate(input={}){
 if(!plain(input)||!ID.test(input.profileId||"")||!ID.test(input.profileVersion||"")||!ID.test(input.countryCode||"")||!ID.test(input.activityCode||"")||!ID.test(input.marketRole||"")||!Array.isArray(input.controls)||input.controls.length<1||input.controls.length>300)return blocked("INPUT_INVALID");
 const now=time(input.now);if(now===null)return blocked("CLOCK_INVALID");
 if(input.target&&(!plain(input.target)||input.target.countryCode!==input.countryCode||input.target.activityCode!==input.activityCode||input.target.marketRole!==input.marketRole))return blocked("PROFILE_SCOPE_MISMATCH");
 let pass=0,fail=0,unknown=0,na=0,exceptions=0;const evaluated=[];
 for(const c of input.controls){
  if(!plain(c)||!ID.test(c.controlId||"")||!STATES.has(c.status)||typeof c.mandatory!=="boolean")return blocked("CONTROL_INVALID");
  if(c.status==="PASS"){
   if(!plain(c.evidence)||!ID.test(c.evidence.evidenceId||"")||!ID.test(c.evidence.sourceId||"")||time(c.evidence.verifiedAt)===null||time(c.evidence.expiresAt)===null||time(c.evidence.verifiedAt)>now||time(c.evidence.expiresAt)<=now)return blocked("PASS_EVIDENCE_MISSING_STALE_OR_INVALID");
   pass++;
  } else if(c.status==="FAIL"){fail++;} else if(c.status==="UNKNOWN"){unknown++;} else if(c.status==="NOT_APPLICABLE"){
   if(typeof c.rationale!=="string"||c.rationale.trim().length<12||!c.reviewedBy||!time(c.reviewedAt)||time(c.reviewedAt)>now)return blocked("NOT_APPLICABLE_REQUIRES_REVIEWED_RATIONALE");
   na++;
  } else {
   const e=c.exception;
   if(!plain(e)||!ID.test(String(e.approvalId||""))||!e.approvedBy||!time(e.approvedAt)||time(e.approvedAt)>now||time(e.expiresAt)===null||time(e.expiresAt)<=now||!Array.isArray(e.scope)||!e.scope.includes(input.profileId)||e.controlId!==c.controlId||e.riskAcceptance!=="HUMAN_APPROVED")return blocked("EXCEPTION_INVALID_EXPIRED_OR_SCOPE_MISMATCH");
   exceptions++;
  }
  evaluated.push({controlId:c.controlId,status:c.status,mandatory:c.mandatory,evidenceStatus:c.status==="PASS"?"CURRENT_VERIFIED":"NOT_APPLICABLE"});
 }
 const mandatoryBlocked=input.controls.some(c=>c.mandatory&&["FAIL","UNKNOWN"].includes(c.status));
 const decision=mandatoryBlocked?"BLOCKED":exceptions>0?"CONDITIONAL_HUMAN_APPROVAL":"READY_FOR_HUMAN_REVIEW";
 return {ok:true,decision,launchAllowed:false,executionAllowed:false,humanReviewRequired:true,profile:{profileId:input.profileId,version:input.profileVersion,countryCode:input.countryCode,activityCode:input.activityCode,marketRole:input.marketRole},counts:{pass,fail,unknown,notApplicable:na,exceptions,total:input.controls.length},controls:evaluated,reason:mandatoryBlocked?"MANDATORY_CONTROL_UNSATISFIED":exceptions>0?"VALID_EXCEPTION_REQUIRES_FINAL_REVIEW":"ALL_CONTROLS_EVIDENCED_PENDING_HUMAN_LEGAL_APPROVAL",mode:"COMPLIANCE_GATE_ADVISORY_ONLY",provenance:{evaluatedAt:input.now,sourceVersion:input.sourceVersion||"UNVERIFIED",decisionFingerprintStatus:"NOT_COMPUTED"}};
}
return Object.freeze({evaluate,states:Object.freeze([...STATES])});
});
