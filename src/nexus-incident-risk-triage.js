/* Nexus Supra incident triage: deterministic, advisory-only, fail-closed. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusIncidentTriage=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const TYPES=new Set(["SECURITY","PRIVACY","PAYMENT","LEGAL_COMPLIANCE","SAFETY","SERVICE_QUALITY","AVAILABILITY","DATA_INTEGRITY","CUSTOMER_COMPLAINT","FRAUD_SIGNAL","OTHER"]);
const IMPACT=new Set(["NONE","LOW","MODERATE","HIGH","CRITICAL","UNKNOWN"]);
const block=(reason)=>({ok:false,status:"BLOCKED",reason,automaticAction:false,humanReviewRequired:true,mode:"ADVISORY_ONLY"});
function date(v){if(typeof v!=="string"||!ISO.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function evaluate(x={}){
 if(!plain(x)||!ID.test(x.incidentId||"")||!TYPES.has(x.type)||!IMPACT.has(x.impact)||date(x.detectedAt)===null||date(x.detectedAt)>Date.now()||!Number.isInteger(x.affectedCount)||x.affectedCount<0||x.affectedCount>100000000||!Number.isInteger(x.recurrenceCount)||x.recurrenceCount<0||x.recurrenceCount>1000000||typeof x.evidenceComplete!=="boolean"||typeof x.containmentVerified!=="boolean")return block("INPUT_INVALID_OR_UNTRUSTED");
 const criticalTypes=new Set(["SECURITY","PRIVACY","PAYMENT","LEGAL_COMPLIANCE","SAFETY","DATA_INTEGRITY"]);
 let level="P3",reasons=[];
 if(x.impact==="CRITICAL"||(["SECURITY","PRIVACY","PAYMENT","SAFETY","DATA_INTEGRITY"].includes(x.type)&&x.impact==="HIGH")||x.impact==="UNKNOWN"&&criticalTypes.has(x.type)){level="P0";reasons.push("CRITICAL_IMPACT_OR_CRITICAL_DOMAIN_UNCERTAINTY");}
 else if(x.impact==="HIGH"||criticalTypes.has(x.type)&&!x.evidenceComplete){level="P1";reasons.push("HIGH_IMPACT_OR_CRITICAL_DOMAIN_EVIDENCE_GAP");}
 else if(x.impact==="MODERATE"||x.recurrenceCount>=3||x.affectedCount>=10){level="P2";reasons.push("MODERATE_IMPACT_OR_REPEATED_OR_BROAD_SCOPE");}
 else reasons.push("LOW_INITIAL_SEVERITY");
 if(!x.evidenceComplete){reasons.push("EVIDENCE_INCOMPLETE");if(level==="P3")level="P2";}
 if(!x.containmentVerified){reasons.push("CONTAINMENT_UNVERIFIED");if(level==="P3")level="P2";}
 if(x.recurrenceCount>=3&&level==="P3")level="P2";
 const actions=level==="P0"?["ESCALATE_IMMEDIATELY","ALERT_RESPONSIBLE_ON_CALL","PRESERVE_EVIDENCE","HUMAN_ASSESSMENT_REQUIRED"]:level==="P1"?["URGENT_REVIEW","ALERT_OWNER","PRESERVE_EVIDENCE"]:level==="P2"?["PRIORITIZED_REVIEW","MONITOR_RECURRENCE"]:["LOG_AND_MONITOR"];
 const autoCandidates=["CREATE_TRACKING_TASK","SEND_INTERNAL_ALERT","DEDUPLICATE_ALERTS","RETRY_IDEMPOTENT_TECHNICAL_OPERATION_IF_TESTED"];
 return {ok:true,status:"TRIAGED",incidentId:x.incidentId,priority:level,reasons,proposedWorkflow:actions,automaticRemediationCandidates:autoCandidates,automaticAction:false,containmentVerified:x.containmentVerified,evidenceComplete:x.evidenceComplete,humanReviewRequired:level==="P0"||level==="P1"||criticalTypes.has(x.type)||!x.evidenceComplete,neverAutonomously:["LEGAL_OR_REGULATORY_CONCLUSION","CUSTOMER_OR_PROVIDER_SANCTION","REFUND_OR_PAYOUT","ACCOUNT_TERMINATION","PUBLIC_DISCLOSURE","PRODUCTION_DEPLOYMENT"],dataMinimization:"Return only incident reference, category, priority and reason codes; no personal data or payload.",mode:"ADVISORY_ONLY"};
}
return Object.freeze({evaluate});
});
