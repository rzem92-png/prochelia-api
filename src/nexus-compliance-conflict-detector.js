/* Nexus Supra compliance rule conflict detector. Advisory only; never resolves legal conflicts automatically. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusComplianceConflicts=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;const STATES=new Set(["REQUIRED","PROHIBITED","CONDITIONAL","UNKNOWN","NOT_APPLICABLE"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function dt(v){if(typeof v!=="string"||!ISO.test(v))return null;const n=Date.parse(v);return Number.isFinite(n)?n:null}
function block(reason){return {ok:false,status:"BLOCKED",reason,autoResolution:false,humanLegalReviewRequired:true,mode:"RULE_CONFLICT_ADVISORY_ONLY"}}
function overlap(a,b){return (a.countryCode===b.countryCode||a.countryCode==="*"||b.countryCode==="*")&&(a.activityCode===b.activityCode||a.activityCode==="*"||b.activityCode==="*")&&(a.marketRole===b.marketRole||a.marketRole==="*"||b.marketRole==="*")}
function evaluate(input={}){
 if(!plain(input)||!ID.test(input.profileId||"")||dt(input.now)===null||!Array.isArray(input.rules)||input.rules.length<1||input.rules.length>500)return block("INPUT_INVALID");
 const now=dt(input.now),ids=new Set(),active=[];
 for(const r of input.rules){if(!plain(r)||!ID.test(r.ruleId||"")||ids.has(r.ruleId)||!ID.test(r.controlId||"")||!STATES.has(r.effect)||!ID.test(r.countryCode||"")||!ID.test(r.activityCode||"")||!ID.test(r.marketRole||"")||dt(r.effectiveAt)===null||dt(r.effectiveAt)>now||dt(r.expiresAt)===null||dt(r.expiresAt)<=now||!Array.isArray(r.sourceIds)||r.sourceIds.length<1||r.sourceIds.some(x=>!ID.test(x)))return block("RULE_METADATA_INVALID_STALE_OR_INCOMPLETE");ids.add(r.ruleId);active.push(r);}
 const conflicts=[];for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const a=active[i],b=active[j];if(a.controlId===b.controlId&&overlap(a,b)&&a.effect!==b.effect)conflicts.push({ruleIds:[a.ruleId,b.ruleId],controlId:a.controlId,scope:{countryCode:a.countryCode,activityCode:a.activityCode,marketRole:a.marketRole},effects:[a.effect,b.effect],severity:"HIGH",resolution:"HUMAN_LEGAL_REVIEW_REQUIRED"});}
 return {ok:true,status:conflicts.length?"CONFLICTS_FOUND":"NO_CONFLICTS_DETECTED",profileId:input.profileId,checkedRuleCount:active.length,conflictCount:conflicts.length,conflicts,autoResolution:false,activationAllowed:false,legalReviewRequired:true,limitations:["Scope matching is conservative and does not model hierarchy, derogations, lex specialis, contract terms or legal interpretation.","Metadata validation is not verification of source content."],mode:"RULE_CONFLICT_ADVISORY_ONLY"};
}
return Object.freeze({evaluate});
});
