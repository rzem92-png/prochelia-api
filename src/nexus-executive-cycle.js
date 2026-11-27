/* Nexus Supra cross-domain executive cycle. Snapshot-only planner; no actions or persistence. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusExecutiveCycle=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENV=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,MAX_PRIORITY_INPUTS=100;
const MODULES=Object.freeze([
 {key:"health",global:"ProcheliaNexusModuleHealth",inputField:"observations",evaluatorField:"observations",limit:19},
 {key:"priority",global:"ProcheliaNexusExecutivePriority",inputField:"priorityItems",evaluatorField:"items",limit:100},
 {key:"budget",global:"ProcheliaNexusBudgetGuard",inputField:"budgets",evaluatorField:"budgets",limit:50},
 {key:"sla",global:"ProcheliaNexusSlaMonitor",inputField:"slaItems",evaluatorField:"items",limit:200},
 {key:"quality",global:"ProcheliaNexusQualitySignals",inputField:"qualityItems",evaluatorField:"items",limit:100}
]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function validTime(v){if(typeof v!=="string"||!ISO.test(v))return false;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v}
function deny(reason){return {ok:false,status:"UNKNOWN",reason,mode:"EXECUTIVE_SNAPSHOT_RECOMMENDATIONS_ONLY",executionAllowed:false,humanReviewRequired:true,liveData:false,sourceStatus:"INPUT_SNAPSHOT_ONLY",tenantScopeStatus:"UNVERIFIED_INPUT_SCOPE",freshnessStatus:"UNVERIFIED",provenanceStatus:"UNVERIFIED",modules:{},priorityQueue:[],recommendations:[],summary:null}}
function moduleStatus(r){return plain(r)&&typeof r.status==="string"?r.status:"UNKNOWN"}
function severityRank(s){return s==="critical"?0:s==="high"?1:s==="medium"?2:3}
function stableSuffix(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function boundedId(prefix,value){const raw=String(value);return prefix+raw.slice(0,100)+":"+stableSuffix(raw)}
function evaluate(input={}){
 if(!plain(input)||!ENV.has(input.environment)||!ID.test(input.tenantId)||!validTime(input.asOf))return deny("CYCLE_CONTEXT_INVALID");
 for(const m of MODULES){const list=input[m.inputField];if(!Array.isArray(list)||list.length>m.limit)return deny("CYCLE_INPUT_INVALID");}
 const modules={};for(const m of MODULES){const evaluator=rootModule(m.global);if(!evaluator)return deny("MODULE_UNAVAILABLE:"+m.key);const moduleInput={environment:input.environment,tenantId:input.tenantId,[m.evaluatorField]:input[m.inputField]};if(m.key==="health")moduleInput.asOf=input.asOf;let result;try{result=evaluator(moduleInput)}catch(_){return deny("MODULE_EVALUATION_FAILED:"+m.key)}if(!plain(result)||result.ok!==true)return deny("MODULE_INPUT_REJECTED:"+m.key);modules[m.key]=result;}
 const candidates=[];
 for(const p of modules.priority.items||[])candidates.push({id:boundedId("INPUT:",p.id),severity:p.severity,domain:p.domain,slaBreached:p.slaBreached,ageMinutes:p.ageMinutes,affectedDomains:p.affectedDomains,signal:"INPUT_PRIORITY"});
 const health=modules.health;for(const h of health.modules||[]){if(h.status==="CRITICAL"||h.status==="DEGRADED"||h.status==="STALE"||h.status==="UNKNOWN")candidates.push({id:"HEALTH:"+h.module,severity:h.status==="CRITICAL"?"critical":h.status==="DEGRADED"||h.status==="STALE"?"high":"medium",domain:"technology",slaBreached:false,ageMinutes:Number.isInteger(h.ageMs)?Math.min(525600,Math.max(0,Math.floor(h.ageMs/60000))):0,affectedDomains:["technology","continuity"],signal:h.status});}
 for(const b of modules.budget.items||[]){if(b.level!=="NORMAL")candidates.push({id:boundedId("BUDGET:",b.id),severity:b.level==="CRITICAL"?"critical":b.level==="HIGH"?"high":"medium",domain:"finance",slaBreached:false,ageMinutes:0,affectedDomains:["finance","technology"],signal:b.level});}
 for(const s of modules.sla.items||[]){if(s.reviewRequired)candidates.push({id:boundedId("SLA:",s.id),severity:s.slaBreached?(s.escalationRecommendation==="ESCALATION_P0"?"critical":"high"):"medium",domain:"operations",slaBreached:!!s.slaBreached,ageMinutes:Math.min(525600,Math.max(0,s.elapsedMinutes||0)),affectedDomains:["operations","customer","provider"],signal:s.status});}
 for(const q of modules.quality.items||[]){if(q.qualityReviewRecommended)candidates.push({id:boundedId("QUALITY:",q.subjectRef),severity:q.status==="REVIEW_SIGNALS"&&q.confidence==="HIGH"?"high":q.status==="REVIEW_SIGNALS"?"medium":"low",domain:"quality",slaBreached:false,ageMinutes:0,affectedDomains:["quality","customer","provider"],signal:q.status});}
 const sorted=candidates.sort((a,b)=>severityRank(a.severity)-severityRank(b.severity)||a.domain.localeCompare(b.domain)||a.id.localeCompare(b.id));const capped=sorted.slice(0,MAX_PRIORITY_INPUTS),truncated=sorted.length>MAX_PRIORITY_INPUTS;
 const priorities=rootModule("ProcheliaNexusExecutivePriority");let queue;try{queue=priorities({environment:input.environment,tenantId:input.tenantId,items:capped})}catch(_){return deny("PRIORITY_EVALUATION_FAILED")}if(!plain(queue)||queue.ok!==true)return deny("PRIORITY_INPUT_REJECTED");
 const status=queue.summary?.p0?"CRITICAL":queue.summary?.p1?"HIGH":health.status==="DEGRADED"?"DEGRADED":health.status==="UNKNOWN"?"UNKNOWN":queue.itemCount?"REVIEW_REQUIRED":"NO_SIGNALS";
 const recommendations=(queue.items||[]).map(x=>({id:x.id,priority:x.priority,domain:x.domain,recommendation:x.recommendation,humanReviewRequired:true,executionAllowed:false}));
 return {ok:true,status,environment:input.environment,tenantId:input.tenantId,asOf:input.asOf,sourceStatus:"INPUT_SNAPSHOT_ONLY",liveData:false,tenantScopeStatus:"UNVERIFIED_INPUT_SCOPE",freshnessStatus:"UNVERIFIED",provenanceStatus:"UNVERIFIED",mode:"EXECUTIVE_SNAPSHOT_RECOMMENDATIONS_ONLY",moduleStatuses:{health:moduleStatus(health),priority:moduleStatus(queue),budget:moduleStatus(modules.budget),sla:moduleStatus(modules.sla),quality:moduleStatus(modules.quality)},moduleSummary:{health:health.summary,budget:modules.budget.summary,sla:modules.sla.summary,quality:modules.quality.summary},priorityQueue:queue.items||[],prioritySummary:queue.summary,signalCount:candidates.length,priorityInputsTruncated:truncated,unprioritizedSignalCount:Math.max(0,candidates.length-capped.length),recommendations,executionAllowed:false,automatedActionCount:0,humanReviewRequired:true,qualitySafeguard:"NO_AUTOMATED_PROVIDER_RANKING_OR_SANCTION",financeSafeguard:"NO_SPEND_OR_PAYMENT_ACTION",summary:{critical:queue.summary?.p0||0,high:queue.summary?.p1||0,medium:queue.summary?.p2||0,low:queue.summary?.p3||0,unknownModules:health.summary?.unknown||0}};
}
function rootModule(name){return typeof globalThis!=="undefined"?globalThis[name]?.evaluate:null}
return Object.freeze({evaluate,requiredModules:Object.freeze(MODULES.map(m=>m.key)),maximumPriorityInputs:MAX_PRIORITY_INPUTS});
});
