/* Nexus incident impact estimator. Aggregates explicitly supplied estimates only.
 * No accounting assertion, transaction, refund, payout, or execution authority.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusImpactEstimate=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,CATS=new Set(["service_credit_estimate","refund_estimate","provider_time_cost","platform_operational_cost","lost_revenue_estimate","other_estimate"]),SEV={info:1,low:2,medium:3,high:4,critical:5},MAX=1000000000000;
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function invalid(reason="INPUT_INVALID"){return {ok:false,status:"UNKNOWN",mode:"ESTIMATE_ONLY",executionAllowed:false,reason,totals:[]}}
function evaluate(i={}){
 if(!plain(i)||!ENVS.has(i.environment)||!(i.tenantId===null||(typeof i.tenantId==="string"&&ID.test(i.tenantId)))||!ID.test(i.caseId)||!ID.test(i.incidentId)||!Array.isArray(i.items)||i.items.length>100)return invalid();
 const seen=new Set();for(const x of i.items){if(!plain(x)||!ID.test(x.id)||seen.has(x.id)||x.tenantId!==i.tenantId||!CATS.has(x.category)||typeof x.currency!=="string"||!/^[A-Z]{3}$/.test(x.currency)||!Number.isSafeInteger(x.amountMinor)||x.amountMinor<0||x.amountMinor>MAX||!Number.isSafeInteger(x.minutes)||x.minutes<0||x.minutes>1000000||!Object.hasOwn(SEV,x.severity)||!ID.test(x.evidenceId))return invalid();seen.add(x.id);}
 const currencies=[...new Set(i.items.map(x=>x.currency))];const totals=currencies.map(currency=>{const items=i.items.filter(x=>x.currency===currency);const categories={};for(const x of items)categories[x.category]=(categories[x.category]||0)+x.amountMinor;return {currency,totalEstimateMinor:items.reduce((a,x)=>a+x.amountMinor,0),itemCount:items.length,categoryTotals:categories};});
 const minutes=i.items.reduce((a,x)=>a+x.minutes,0);const severity=i.items.reduce((a,x)=>Math.max(a,SEV[x.severity]),0);
 return {ok:true,status:i.items.length?"ESTIMATE_AVAILABLE":"NO_ESTIMATE",tenantId:i.tenantId,environment:i.environment,caseId:i.caseId,incidentId:i.incidentId,itemCount:i.items.length,currencyCount:currencies.length,totals,estimatedAffectedMinutes:minutes,highestSeverity:Object.keys(SEV).find(k=>SEV[k]===severity)||"info",humanReviewRequired:true,executionAllowed:false,mode:"ESTIMATE_ONLY",disclaimer:"Estimates are not accounting entries, refunds, credits, or payment instructions."};
}
return Object.freeze({evaluate});
});
