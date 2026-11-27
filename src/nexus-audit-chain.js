/* Nexus audit-chain structural consistency checker. Does NOT cryptographically recompute hashes. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusAuditChain=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENV=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,HASH=/^[a-f0-9]{64}$/,GENESIS="0".repeat(64),ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function time(v){if(typeof v!=="string"||!ISO.test(v))return false;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v}
function invalid(reason){return {ok:false,status:"UNKNOWN",mode:"AUDIT_CHAIN_STRUCTURE_ONLY",executionAllowed:false,humanReviewRequired:true,reason,summary:null}}
function evaluate(input={}){
 if(!plain(input)||!ENV.has(input.environment)||!ID.test(input.tenantId)||!Array.isArray(input.records)||input.records.length>200)return invalid("INPUT_INVALID");
 const ids=new Set();for(const r of input.records){if(!plain(r)||!ID.test(r.eventId)||ids.has(r.eventId)||r.tenantId!==input.tenantId||r.environment!==input.environment||!Number.isSafeInteger(r.sequence)||r.sequence<1||!HASH.test(r.hash)||!(r.previousHash===GENESIS||HASH.test(r.previousHash))||!time(r.occurredAt))return invalid("RECORD_INVALID");ids.add(r.eventId);}
 const failures=[];for(let i=0;i<input.records.length;i++){const r=input.records[i];if(i===0){if(r.sequence!==1||r.previousHash!==GENESIS)failures.push({eventId:r.eventId,reason:"GENESIS_INVALID"});}else{const p=input.records[i-1];if(r.sequence!==p.sequence+1)failures.push({eventId:r.eventId,reason:"SEQUENCE_GAP"});if(r.previousHash!==p.hash)failures.push({eventId:r.eventId,reason:"PREVIOUS_HASH_LINK_MISMATCH"});if(Date.parse(r.occurredAt)<Date.parse(p.occurredAt))failures.push({eventId:r.eventId,reason:"TIME_ORDER_INVALID"});}}
 const status=failures.length?"CHAIN_INCONSISTENT":input.records.length?"STRUCTURE_CONSISTENT":"EMPTY_CHAIN";
 return {ok:true,status,environment:input.environment,tenantId:input.tenantId,recordCount:input.records.length,summary:{failureCount:failures.length,failures,firstSequence:input.records[0]?.sequence??null,lastSequence:input.records.at(-1)?.sequence??null},executionAllowed:false,humanReviewRequired:failures.length>0,mode:"AUDIT_CHAIN_STRUCTURE_ONLY",limitations:["Hash values and link structure are checked only; cryptographic hash recomputation, signature validation and immutable storage are not performed."]};
}
return Object.freeze({evaluate,genesisHash:GENESIS});
});
