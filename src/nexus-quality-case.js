/* Nexus quality/complaint case policy. Deterministic state-transition guards only.
 * Preview/dev/test; no persistence, notifications, customer data, or execution.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusQualityCase=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),STATES=new Set(["OPEN","TRIAGED","INVESTIGATING","ACTION_PROPOSED","WAITING_CUSTOMER","RESOLVED","CLOSED","REOPENED"]),CATS=new Set(["service_quality","safety","schedule","communication","billing","provider_conduct","customer_conduct","accessibility","other"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TRANS={OPEN:["TRIAGED"],TRIAGED:["INVESTIGATING","WAITING_CUSTOMER"],INVESTIGATING:["ACTION_PROPOSED","WAITING_CUSTOMER","RESOLVED"],ACTION_PROPOSED:["INVESTIGATING","WAITING_CUSTOMER","RESOLVED"],WAITING_CUSTOMER:["INVESTIGATING","RESOLVED"],RESOLVED:["CLOSED","REOPENED"],CLOSED:["REOPENED"],REOPENED:["TRIAGED","INVESTIGATING"]};
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function invalid(reason="INPUT_INVALID"){return {ok:false,status:"UNKNOWN",reason,executionAllowed:false,humanApprovalRequired:true,mode:"QUALITY_CASE_POLICY_ONLY"}}
function evaluate(i={}){
 if(!plain(i)||!ENVS.has(i.environment)||!(i.tenantId===null||(typeof i.tenantId==="string"&&ID.test(i.tenantId)))||!ID.test(i.caseId)||!STATES.has(i.currentState)||!STATES.has(i.requestedState)||!CATS.has(i.category)||!Array.isArray(i.relatedIncidentIds)||i.relatedIncidentIds.length>20||i.relatedIncidentIds.some(x=>!ID.test(x))||new Set(i.relatedIncidentIds).size!==i.relatedIncidentIds.length||!Array.isArray(i.evidenceIds)||i.evidenceIds.length>50||i.evidenceIds.some(x=>!ID.test(x))||new Set(i.evidenceIds).size!==i.evidenceIds.length)return invalid();
 if(i.requestedState===i.currentState)return invalid("NO_OP");
 if(!TRANS[i.currentState]?.includes(i.requestedState))return invalid("TRANSITION_NOT_ALLOWED");
 const human= i.humanActor===true;
 const needsHuman=["RESOLVED","CLOSED","REOPENED"].includes(i.requestedState)||i.category==="safety"||i.category==="provider_conduct"||i.category==="customer_conduct";
 if(needsHuman&&!human)return invalid("HUMAN_REVIEW_REQUIRED");
 const ownerRequired=["TRIAGED","INVESTIGATING","ACTION_PROPOSED","WAITING_CUSTOMER"].includes(i.requestedState);
 if(ownerRequired&&!(typeof i.ownerId==="string"&&ID.test(i.ownerId)))return invalid("OWNER_REQUIRED");
 if(["RESOLVED","CLOSED"].includes(i.requestedState)&&i.evidenceIds.length===0)return invalid("EVIDENCE_REQUIRED");
 if(i.requestedState==="CLOSED"&&i.currentState!=="RESOLVED")return invalid("CLOSE_REQUIRES_RESOLUTION");
 return {ok:true,status:"TRANSITION_ALLOWED",caseId:i.caseId,tenantId:i.tenantId,environment:i.environment,from:i.currentState,to:i.requestedState,category:i.category,relatedIncidentCount:i.relatedIncidentIds.length,evidenceCount:i.evidenceIds.length,ownerAssigned:ownerRequired,approvalGate:needsHuman?"HUMAN_REVIEW":"POLICY_CHECK",humanApprovalRequired:needsHuman,executionAllowed:false,mode:"QUALITY_CASE_POLICY_ONLY"};
}
return Object.freeze({evaluate,transitions:Object.freeze(Object.fromEntries(Object.entries(TRANS).map(([k,v])=>[k,Object.freeze([...v])])) )});
});
