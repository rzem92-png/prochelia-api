/* Nexus Supra shared event envelope validator. Validation only: no bus, persistence or side effects. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusEventContract=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENV=new Set(["preview","development","test"]),MODULES=new Set(["alerting","incident","correlation","root_cause","improvement","impact","case_linkage","release_readiness","operations","customer","provider","finance","security","compliance"]),TYPES=new Set(["alert.created","alert.updated","incident.opened","incident.updated","incident.resolved","incident.reopened","correlation.created","root_cause.hypothesis.created","improvement.proposed","impact.assessed","case.link.proposed","release.evidence.updated","operations.review.requested","customer.case.updated","provider.assignment.updated","finance.review.requested","security.review.requested","compliance.review.requested"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PAYLOAD_KEYS=new Set(["status","severity","category","code","count","score","referenceId","recordType","reviewRequired","evidenceCount","estimatedExposureMinor","currency","environment","sourceStatus"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function validTime(v){if(typeof v!=="string"||!ISO.test(v))return false;const d=Date.parse(v);return Number.isFinite(d)&&new Date(d).toISOString()===v}
function invalid(reason){return {ok:false,status:"REJECTED",reason,accepted:false,executionAllowed:false,humanReviewRequired:true,event:null}}
function validate(e,now=null){
 if(!plain(e)||e.contractVersion!=="1.0"||!ENV.has(e.environment)||!ID.test(e.eventId)||!ID.test(e.traceId)||!ID.test(e.tenantId)||!MODULES.has(e.producer)||!TYPES.has(e.eventType)||!validTime(e.occurredAt)||!plain(e.payload)||Object.keys(e.payload).length>12)return invalid("ENVELOPE_INVALID");
 if(now!==null&&(!validTime(now)||Date.parse(e.occurredAt)>Date.parse(now)))return invalid("EVENT_TIME_INVALID");
 for(const [k,v] of Object.entries(e.payload)){if(!PAYLOAD_KEYS.has(k))return invalid("PAYLOAD_FIELD_NOT_ALLOWED");if(typeof v==="string"&&v.length>128)return invalid("PAYLOAD_VALUE_TOO_LONG");if(typeof v==="number"&&(!Number.isFinite(v)||Math.abs(v)>1e12))return invalid("PAYLOAD_NUMBER_INVALID");if(typeof v==="boolean"||v===null)continue;if(typeof v!=="string"&&typeof v!=="number")return invalid("PAYLOAD_TYPE_INVALID");}
 if(e.payload.currency!==undefined&&e.payload.currency!==null&&!/^[A-Z]{3}$/.test(e.payload.currency))return invalid("CURRENCY_INVALID");
 if(e.payload.estimatedExposureMinor!==undefined&&(!Number.isSafeInteger(e.payload.estimatedExposureMinor)||e.payload.estimatedExposureMinor<0))return invalid("FINANCIAL_VALUE_INVALID");
 const event={contractVersion:"1.0",eventId:e.eventId,traceId:e.traceId,tenantId:e.tenantId,environment:e.environment,producer:e.producer,eventType:e.eventType,occurredAt:e.occurredAt,payload:Object.fromEntries(Object.entries(e.payload).sort(([a],[b])=>a.localeCompare(b)))};
 return {ok:true,status:"VALIDATED",accepted:true,executionAllowed:false,humanReviewRequired:true,event};
}
return Object.freeze({validate,contractVersion:"1.0",allowedProducers:Object.freeze([...MODULES]),allowedEventTypes:Object.freeze([...TYPES]),allowedPayloadFields:Object.freeze([...PAYLOAD_KEYS])});
});
