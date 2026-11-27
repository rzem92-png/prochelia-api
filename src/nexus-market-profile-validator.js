/* Nexus Supra market profile metadata validator; cannot authorize market launch. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusMarketProfile=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;const ROLE=new Set(["INTERMEDIARY","AGENT","SELLER","SERVICE_PROVIDER","EMPLOYER_LIKE","PAYMENT_FACILITATOR","CONTROLLER","PROCESSOR","UNDETERMINED"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function dt(v){if(typeof v!=="string"||!ISO.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function fail(reason){return {ok:false,status:"BLOCKED",reason,activationAllowed:false,legalReviewRequired:true,mode:"PROFILE_METADATA_VALIDATION_ONLY"}}
function uniqIds(a){return Array.isArray(a)&&a.length>=1&&a.length<=250&&a.every(v=>ID.test(v))&&new Set(a).size===a.length}
function evaluate(x={}){
 if(!plain(x)||!ID.test(x.profileId||"")||!ID.test(x.version||"")||!plain(x.jurisdiction)||!/^[A-Z]{2}$/.test(x.jurisdiction.countryCode||"")||x.jurisdiction.regionCode!==undefined&&(!ID.test(x.jurisdiction.regionCode)||x.jurisdiction.regionCode.length>32)||!ID.test(x.activityCode||"")||!ROLE.has(x.marketRole)||!ID.test(x.reviewedBy||"")||dt(x.reviewedAt)===null||dt(x.effectiveAt)===null||dt(x.expiresAt)===null||!uniqIds(x.controlIds)||!uniqIds(x.sourceIds))return fail("PROFILE_SCHEMA_INVALID");
 const now=dt(x.now);if(now===null)return fail("EVALUATION_TIME_INVALID");
 if(dt(x.reviewedAt)>now||dt(x.effectiveAt)>now||dt(x.expiresAt)<=now)return fail("PROFILE_NOT_CURRENT");
 if(dt(x.reviewedAt)>dt(x.effectiveAt))return fail("REVIEW_AFTER_EFFECTIVE_DATE");
 return {ok:true,status:"PROFILE_METADATA_VALID",profileId:x.profileId,version:x.version,jurisdiction:{countryCode:x.jurisdiction.countryCode,regionCode:x.jurisdiction.regionCode||null},activityCode:x.activityCode,marketRole:x.marketRole,controlCount:x.controlIds.length,sourceCount:x.sourceIds.length,reviewedBy:x.reviewedBy,expiresAt:x.expiresAt,activationAllowed:false,launchApprovalRequired:true,legalReviewRequired:true,mode:"PROFILE_METADATA_VALIDATION_ONLY",limitations:["Metadata validation does not verify source content, control implementation, legal applicability or qualified review quality.","This result is not market launch authorization."]};
}
return Object.freeze({evaluate});
});
