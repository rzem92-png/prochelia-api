/* Nexus release evidence completeness evaluator. Gate summary only; never deploys or authorizes Production. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusReleaseReadiness=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,CATEGORIES=["tenant_isolation","authentication_authorization","secrets_configuration","privacy_data_minimization","security_regression","migrations","backup_restore","integration_smoke","payments_sandbox","legal_compliance_review"],STATUSES=new Set(["verified","failed","pending","unavailable"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function validId(v){return typeof v==="string"&&ID.test(v)}
function time(v){if(typeof v!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.\d{3}Z$/.test(v))return false;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v}
function invalid(){return {ok:false,status:"UNKNOWN",mode:"RELEASE_EVIDENCE_GATE_ONLY",releaseReady:false,productionAuthorized:false,executionAllowed:false,humanReviewRequired:true,reason:"INPUT_INVALID",summary:null}}
function evaluate(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!(input.tenantId===null||(typeof input.tenantId==="string"&&ID.test(input.tenantId)))||!time(input.asOf)||!Array.isArray(input.evidence)||input.evidence.length>CATEGORIES.length)return invalid();
 const map=new Map();for(const e of input.evidence){if(!plain(e)||!CATEGORIES.includes(e.category)||map.has(e.category)||!STATUSES.has(e.status)||!validId(e.evidenceRef)||!time(e.checkedAt)||Date.parse(e.checkedAt)>Date.parse(input.asOf)||((e.status==="verified"||e.status==="failed")&&!validId(e.reviewerId)))return invalid();map.set(e.category,e);}
 const missing=CATEGORIES.filter(c=>!map.has(c)),pending=CATEGORIES.filter(c=>map.has(c)&&["pending","unavailable"].includes(map.get(c).status)),failed=CATEGORIES.filter(c=>map.has(c)&&map.get(c).status==="failed"),verified=CATEGORIES.filter(c=>map.has(c)&&map.get(c).status==="verified");
 const releaseReady=missing.length===0&&pending.length===0&&failed.length===0&&verified.length===CATEGORIES.length;
 const status=failed.length?"BLOCKED":releaseReady?"EVIDENCE_COMPLETE":"INCOMPLETE";
 return {ok:true,status,environment:input.environment,tenantId:input.tenantId,asOf:input.asOf,summary:{requiredCount:CATEGORIES.length,verifiedCount:verified.length,missingCount:missing.length,pendingCount:pending.length,failedCount:failed.length,missing,pending,failed,verified,releaseReady,productionAuthorized:false,executionAllowed:false,humanReviewRequired:true,limitations:["Evidence completeness does not prove system safety or authorize deployment.","Production release requires separate human authorization and independent validation."]},mode:"RELEASE_EVIDENCE_GATE_ONLY",releaseReady,productionAuthorized:false,executionAllowed:false,humanReviewRequired:true};
}
return Object.freeze({evaluate,requiredCategories:Object.freeze([...CATEGORIES])});
});
