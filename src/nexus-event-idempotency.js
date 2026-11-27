/* Nexus event idempotency decision evaluator. Storage adapter intentionally absent. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusEventIdempotency=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENV=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,FP=/^[A-Fa-f0-9]{32,128}$/,ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,MAX_WINDOW=86400000;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function validTime(v){if(typeof v!=="string"||!ISO.test(v))return false;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v}
function denied(reason){return {ok:false,status:"DENIED",reason,decision:"REJECT",storageRequired:true,storageAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"IDEMPOTENCY_DECISION_ONLY"}}
function evaluate(input={}){
 if(!plain(input)||!ENV.has(input.environment)||!ID.test(input.tenantId)||!ID.test(input.eventId)||!FP.test(input.fingerprint)||!validTime(input.now)||!Array.isArray(input.seen)||input.seen.length>100||!Number.isInteger(input.windowMs)||input.windowMs<1||input.windowMs>MAX_WINDOW)return denied("INPUT_INVALID");
 const now=Date.parse(input.now),seen=new Map();for(const x of input.seen){if(!plain(x)||!ID.test(x.tenantId)||!ID.test(x.eventId)||!FP.test(x.fingerprint)||!validTime(x.recordedAt)||Date.parse(x.recordedAt)>now||now-Date.parse(x.recordedAt)>MAX_WINDOW||seen.has(x.tenantId+"\u0000"+x.eventId))return denied("SEEN_RECORD_INVALID");seen.set(x.tenantId+"\u0000"+x.eventId,x);}
 const key=input.tenantId+"\u0000"+input.eventId,prior=seen.get(key);
 if(!prior)return {ok:true,status:"NEW_EVENT",decision:"ACCEPT_IF_PERSISTED",eventId:input.eventId,tenantId:input.tenantId,storageRequired:true,storageAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"IDEMPOTENCY_DECISION_ONLY"};
 if(now-Date.parse(prior.recordedAt)>input.windowMs)return {ok:true,status:"EXPIRED_KEY",decision:"ACCEPT_IF_PERSISTED",eventId:input.eventId,tenantId:input.tenantId,storageRequired:true,storageAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"IDEMPOTENCY_DECISION_ONLY"};
 if(prior.fingerprint===input.fingerprint)return {ok:true,status:"DUPLICATE",decision:"SUPPRESS_DUPLICATE",eventId:input.eventId,tenantId:input.tenantId,storageRequired:true,storageAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"IDEMPOTENCY_DECISION_ONLY"};
 return {ok:true,status:"IDEMPOTENCY_CONFLICT",decision:"QUARANTINE_REVIEW",eventId:input.eventId,tenantId:input.tenantId,storageRequired:true,storageAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"IDEMPOTENCY_DECISION_ONLY"};
}
return Object.freeze({evaluate,maxWindowMs:MAX_WINDOW});
});
