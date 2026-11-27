/* Nexus Supra legal-source freshness validator. Metadata-only, no network fetch or legal interpretation. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusComplianceSources=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function date(v){if(typeof v!=="string"||!ISO.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function blocked(reason){return {ok:false,status:"BLOCKED",reason,profileReady:false,legalApprovalRequired:true,mode:"SOURCE_METADATA_VALIDATION_ONLY"}}
function hostTrusted(host,domains){return domains.some(d=>typeof d==="string"&&d.length>0&&(host===d.toLowerCase()||host.endsWith("."+d.toLowerCase())))}
function evaluate(input={}){
 if(!plain(input)||!ID.test(input.profileId||"")||!ID.test(input.countryCode||"")||!ID.test(input.activityCode||"")||!Array.isArray(input.sources)||input.sources.length<1||input.sources.length>200||!Array.isArray(input.trustedDomains)||input.trustedDomains.length<1||input.trustedDomains.length>100)return blocked("INPUT_INVALID");
 const now=date(input.now);if(now===null)return blocked("CLOCK_INVALID");const seen=new Set(),validated=[];
 for(const s of input.sources){if(!plain(s)||!ID.test(s.sourceId||"")||seen.has(s.sourceId)||s.jurisdiction!==input.countryCode||s.activityCode!==input.activityCode||s.reviewStatus!=="VERIFIED"||!s.reviewerId||date(s.reviewedAt)===null||date(s.reviewedAt)>now||date(s.expiresAt)===null||date(s.expiresAt)<=now||date(s.effectiveAt)===null||date(s.effectiveAt)>now)return blocked("SOURCE_METADATA_INVALID_STALE_OR_SCOPE_MISMATCH");let u;try{u=new URL(s.url)}catch(_){return blocked("SOURCE_URL_INVALID")}if(u.protocol!=="https:"||u.username||u.password||!hostTrusted(u.hostname,input.trustedDomains))return blocked("SOURCE_DOMAIN_UNTRUSTED");seen.add(s.sourceId);validated.push({sourceId:s.sourceId,host:u.hostname,jurisdiction:s.jurisdiction,activityCode:s.activityCode,reviewedAt:s.reviewedAt,expiresAt:s.expiresAt});}
 return {ok:true,status:"SOURCES_CURRENT_METADATA_VALIDATED",profileReady:false,legalApprovalRequired:true,sourceCount:validated.length,sources:validated,reason:"METADATA_VALIDATION_ONLY_NO_SOURCE_CONTENT_FETCH_OR_LEGAL_INTERPRETATION",mode:"SOURCE_METADATA_VALIDATION_ONLY"};
}
return Object.freeze({evaluate});
});
