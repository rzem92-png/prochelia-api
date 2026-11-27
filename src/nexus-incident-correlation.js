/* Nexus incident correlation: deterministic grouping hints only.
 * No persistence, mutation, execution, or production support.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusIncidentCorrelation=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),SEV={info:1,warning:2,high:3,critical:4},ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function invalid(){return {ok:false,status:"UNKNOWN",mode:"CORRELATION_HINTS_ONLY",executionAllowed:false,reason:"INPUT_INVALID",groups:[]}}
function evaluate(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!(input.tenantId===null||ID.test(input.tenantId))||!Array.isArray(input.signals)||input.signals.length>200||input.signals.some(s=>!plain(s)||!ID.test(s.code)||!ID.test(s.source)||!Object.hasOwn(SEV,s.severity)||!ID.test(s.category)||typeof s.occurredAt!=="string"||!Number.isFinite(Date.parse(s.occurredAt))||new Date(s.occurredAt).toISOString()!==s.occurredAt))return invalid();
 const scope=input.tenantId??"__GLOBAL__";const groups=new Map();
 for(const s of input.signals){const key=[scope,input.environment,s.source,s.category,s.code].join("|");let g=groups.get(key);if(!g){g={source:s.source,category:s.category,code:s.code,count:0,highestSeverity:"info",firstAt:s.occurredAt,lastAt:s.occurredAt};groups.set(key,g);}g.count++;if(SEV[s.severity]>SEV[g.highestSeverity])g.highestSeverity=s.severity;if(s.occurredAt<g.firstAt)g.firstAt=s.occurredAt;if(s.occurredAt>g.lastAt)g.lastAt=s.occurredAt;}
 const result=[...groups.values()].map(g=>({...g,recommendation:g.highestSeverity==="critical"?"Immediate human triage; keep automated actions disabled.":g.highestSeverity==="high"?"Assign human owner and assess impact.":g.count>=5?"Review repeated signal and consider incident creation.":"Monitor; correlate only within the validated tenant/environment scope."})).sort((a,b)=>SEV[b.highestSeverity]-SEV[a.highestSeverity]||b.count-a.count);
 return {ok:true,status:result.some(g=>g.highestSeverity==="critical")?"CRITICAL":result.some(g=>g.highestSeverity==="high"||g.count>=5)?"DEGRADED":"HEALTHY",scope:{tenantId:input.tenantId??null,environment:input.environment},signalCount:input.signals.length,groupCount:result.length,groups:result,executionAllowed:false,mode:"CORRELATION_HINTS_ONLY"};
}
return Object.freeze({evaluate});
});