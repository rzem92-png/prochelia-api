/* Nexus controlled improvement triage: prioritization hints only.
 * Never approves, schedules, or executes corrective actions.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.ProcheliaNexusImprovementTriage=api;})(typeof window!=="undefined"?window:globalThis,function(){
"use strict";
const ENVS=new Set(["preview","development","test"]),ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,CATEGORIES=new Set(["reliability","security","product","operations","customer_experience","finance","compliance"]);
function plain(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d.enumerable&&Object.hasOwn(d,"value")})}
function invalid(){return {ok:false,status:"UNKNOWN",mode:"IMPROVEMENT_TRIAGE_ONLY",executionAllowed:false,humanApprovalRequired:true,reason:"INPUT_INVALID",proposals:[]}}
function score(p){return p.impact*p.confidence/100-p.effort-p.risk}
function evaluate(input={}){
 if(!plain(input)||!ENVS.has(input.environment)||!(input.tenantId===null||(typeof input.tenantId==="string"&&ID.test(input.tenantId)))||!Array.isArray(input.proposals)||input.proposals.length>50)return invalid();
 const ids=new Set();for(const p of input.proposals){if(!plain(p)||!ID.test(p.id)||ids.has(p.id)||p.tenantId!==input.tenantId||!CATEGORIES.has(p.category)||!ID.test(p.objectiveCode)||!Array.isArray(p.sourceIncidentIds)||p.sourceIncidentIds.length<1||p.sourceIncidentIds.length>20||p.sourceIncidentIds.some(x=>!ID.test(x))||new Set(p.sourceIncidentIds).size!==p.sourceIncidentIds.length||!Array.isArray(p.evidenceIds)||p.evidenceIds.length<1||p.evidenceIds.length>50||p.evidenceIds.some(x=>!ID.test(x))||new Set(p.evidenceIds).size!==p.evidenceIds.length||![1,2,3,4,5].includes(p.impact)||![1,2,3,4,5].includes(p.effort)||![1,2,3,4,5].includes(p.risk)||!Number.isInteger(p.confidence)||p.confidence<0||p.confidence>100)return invalid();ids.add(p.id);}
 const result=input.proposals.map(p=>{const highRisk=p.risk>=4||p.category==="security"||p.category==="compliance";return {id:p.id,category:p.category,objectiveCode:p.objectiveCode,impact:p.impact,effort:p.effort,risk:p.risk,confidence:p.confidence,sourceIncidentCount:p.sourceIncidentIds.length,evidenceCount:p.evidenceIds.length,priorityScore:Math.round(score(p)*100)/100,triage:score(p)>=2?"REVIEW_PRIORITY":"DEFER_OR_REASSESS",approvalGate:highRisk?"HUMAN_AND_SPECIALIST_REVIEW":"HUMAN_REVIEW",executionAllowed:false};}).sort((a,b)=>b.priorityScore-a.priorityScore);
 return {ok:true,status:result.length?"TRIAGE_AVAILABLE":"NO_PROPOSALS",environment:input.environment,tenantId:input.tenantId,proposalCount:result.length,proposals:result,humanApprovalRequired:true,executionAllowed:false,mode:"IMPROVEMENT_TRIAGE_ONLY"};
}
return Object.freeze({evaluate});
});
