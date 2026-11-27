/* Nexus root-cause analysis: evidence-weighted hypotheses, never autonomous conclusions.
 * Preview/dev/test only. No persistence, mutation, execution, or PII.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusRootCause=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,WEIGHT={verified:3,corroborated:2,unverified:1},POLARITY=new Set(["supports","contradicts","neutral"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function validTime(v){if(typeof v!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(v))return false;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v}
function invalid(){return {ok:false,status:"UNKNOWN",mode:"ROOT_CAUSE_HINTS_ONLY",executionAllowed:false,humanReviewRequired:true,reason:"INPUT_INVALID",hypotheses:[]}}
function evaluate(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!(input.tenantId===null||(typeof input.tenantId==="string"&&ID.test(input.tenantId)))||!validTime(input.now)||!Array.isArray(input.evidence)||input.evidence.length>100)return invalid();
 const ids=new Set();for(const e of input.evidence){if(!plain(e)||!ID.test(e.id)||ids.has(e.id)||e.tenantId!==input.tenantId||!ID.test(e.source)||!ID.test(e.rootCauseCode)||!POLARITY.has(e.polarity)||!Object.hasOwn(WEIGHT,e.reliability)||!validTime(e.collectedAt)||Date.parse(e.collectedAt)>Date.parse(input.now))return invalid();ids.add(e.id);}
 const groups=new Map();for(const e of input.evidence){let g=groups.get(e.rootCauseCode);if(!g){g={rootCauseCode:e.rootCauseCode,score:0,supportCount:0,contradictionCount:0,sourceSet:new Set(),evidenceCount:0};groups.set(e.rootCauseCode,g);}g.evidenceCount++;if(e.polarity==="supports"){g.score+=WEIGHT[e.reliability];g.supportCount++;g.sourceSet.add(e.source);}else if(e.polarity==="contradicts"){g.score-=WEIGHT[e.reliability];g.contradictionCount++;}}
 const hypotheses=[...groups.values()].map(g=>({rootCauseCode:g.rootCauseCode,score:g.score,supportCount:g.supportCount,contradictionCount:g.contradictionCount,evidenceCount:g.evidenceCount,distinctSupportingSources:g.sourceSet.size,confidence:g.score>=6&&g.sourceSet.size>=2&&g.contradictionCount===0?"HIGH":g.score>=3?"MEDIUM":"LOW",reviewRecommendation:g.contradictionCount?"Resolve conflicting evidence before attribution.":"Validate hypothesis with an accountable human; do not treat confidence as proof."})).sort((a,b)=>b.score-a.score||b.supportCount-a.supportCount);
 return {ok:true,status:hypotheses.length?"ANALYSIS_AVAILABLE":"NO_EVIDENCE",environment:input.environment,tenantId:input.tenantId,asOf:input.now,evidenceCount:input.evidence.length,hypothesisCount:hypotheses.length,hypotheses,executionAllowed:false,humanReviewRequired:true,mode:"ROOT_CAUSE_HINTS_ONLY"};
}
return Object.freeze({evaluate});
});
