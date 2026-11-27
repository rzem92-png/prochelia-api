/* Nexus incident-to-domain record linkage hints. Reference-only; no data access or actions. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusCaseLinkage=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,KINDS=new Set(["complaint","quality_review","booking","provider_assignment","customer_case","financial_review","security_case","compliance_case","operations_review"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function invalid(){return {ok:false,status:"UNKNOWN",mode:"LINKAGE_HINTS_ONLY",executionAllowed:false,humanReviewRequired:true,reason:"INPUT_INVALID",links:[]}}
function evaluate(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!(input.tenantId===null||(typeof input.tenantId==="string"&&ID.test(input.tenantId)))||!Array.isArray(input.incidentIds)||input.incidentIds.length<1||input.incidentIds.length>50||input.incidentIds.some(x=>!ID.test(x))||new Set(input.incidentIds).size!==input.incidentIds.length||!Array.isArray(input.links)||input.links.length>200)return invalid();
 const ids=new Set();for(const l of input.links){if(!plain(l)||!ID.test(l.id)||ids.has(l.id)||l.tenantId!==input.tenantId||!input.incidentIds.includes(l.incidentId)||!ID.test(l.relatedRecordId)||!KINDS.has(l.recordType)||!Array.isArray(l.evidenceIds)||l.evidenceIds.length>20||l.evidenceIds.some(x=>!ID.test(x))||new Set(l.evidenceIds).size!==l.evidenceIds.length)return invalid();ids.add(l.id);}
 const output=input.links.map(l=>({incidentId:l.incidentId,recordType:l.recordType,relatedRecordId:l.relatedRecordId,evidenceCount:l.evidenceIds.length,reviewGate:["financial_review","security_case","compliance_case"].includes(l.recordType)?"HUMAN_AND_SPECIALIST_REVIEW":"HUMAN_REVIEW",linkageStatus:"REFERENCE_ONLY_UNVERIFIED"})).sort((a,b)=>a.incidentId.localeCompare(b.incidentId)||a.recordType.localeCompare(b.recordType)||a.relatedRecordId.localeCompare(b.relatedRecordId));
 const kinds=new Set(output.map(x=>x.recordType));
 return {ok:true,status:output.length?"LINKAGE_HINTS_AVAILABLE":"NO_LINKS",environment:input.environment,tenantId:input.tenantId,incidentCount:input.incidentIds.length,linkCount:output.length,linkedRecordTypes:[...kinds].sort(),links:output,humanReviewRequired:true,executionAllowed:false,mode:"LINKAGE_HINTS_ONLY"};
}
return Object.freeze({evaluate});
});
