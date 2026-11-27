/* Nexus bounded retry/quarantine decision evaluator. No queue, DLQ or execution. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusRetryQuarantine=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENV=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,ERRORS=new Set(["TRANSIENT_NETWORK","RATE_LIMIT","DEPENDENCY_UNAVAILABLE","TIMEOUT","INVALID_EVENT","AUTHORIZATION_DENIED","TENANT_SCOPE_FAILURE","INTEGRITY_CONFLICT","UNKNOWN"]),DELAYS=[1000,5000,30000,120000,600000],MAX=5;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function denied(reason){return {ok:false,status:"DENIED",reason,decision:"QUARANTINE_REVIEW",queueAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"RETRY_POLICY_ONLY"}}
function evaluate(input={}){
 if(!plain(input)||!ENV.has(input.environment)||!ID.test(input.tenantId)||!ID.test(input.eventId)||!Number.isInteger(input.attempt)||input.attempt<1||input.attempt>MAX||!ERRORS.has(input.errorCode)||typeof input.retryable!=="boolean")return denied("INPUT_INVALID");
 const hardStop=["INVALID_EVENT","AUTHORIZATION_DENIED","TENANT_SCOPE_FAILURE","INTEGRITY_CONFLICT"].includes(input.errorCode);
 if(hardStop||!input.retryable)return {ok:true,status:"QUARANTINE",decision:"QUARANTINE_REVIEW",reason:hardStop?"NON_RETRYABLE_SECURITY_OR_INTEGRITY":"ERROR_NOT_RETRYABLE",attempt:input.attempt,eventId:input.eventId,tenantId:input.tenantId,queueAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"RETRY_POLICY_ONLY"};
 if(input.attempt>=MAX)return {ok:true,status:"RETRY_EXHAUSTED",decision:"QUARANTINE_REVIEW",reason:"MAX_ATTEMPTS_REACHED",attempt:input.attempt,eventId:input.eventId,tenantId:input.tenantId,queueAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"RETRY_POLICY_ONLY"};
 return {ok:true,status:"RETRY_PROPOSED",decision:"RETRY_IF_SCHEDULED",reason:"RETRYABLE_FAILURE",attempt:input.attempt,nextAttempt:input.attempt+1,delayMs:DELAYS[input.attempt-1],eventId:input.eventId,tenantId:input.tenantId,queueAvailable:false,executionAllowed:false,humanReviewRequired:true,mode:"RETRY_POLICY_ONLY"};
}
return Object.freeze({evaluate,maxAttempts:MAX,retryDelaysMs:Object.freeze([...DELAYS])});
});
