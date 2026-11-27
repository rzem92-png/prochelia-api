import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-module-health.js";
import "../src/nexus-executive-priority.js";
import "../src/nexus-budget-guard.js";
import "../src/nexus-service-sla-monitor.js";
import "../src/nexus-quality-signals.js";
import "../src/nexus-executive-cycle.js";

const evaluate=globalThis.ProcheliaNexusExecutiveCycle.evaluate;
const asOf="2026-11-27T21:00:00.000Z";
const modules=globalThis.ProcheliaNexusModuleHealth.requiredModules;
function health(status="operational",lastHeartbeat=asOf){return modules.map(module=>({module,reportedStatus:status,lastHeartbeat,latencyMs:100,errorRate:0}));}
function qualityItem(subjectRef="PROVIDER-REF-1",scores=[80,80,80,80],samples=20){return{subjectRef,periodRef:"PERIOD-2026-11",metrics:["customer_feedback","punctuality","completion","complaint_resolution"].map((name,i)=>({name,score:scores[i],sampleCount:samples}))};}
function base(){return{environment:"preview",tenantId:"tenant-42",asOf,observations:health(),priorityItems:[],budgets:[],slaItems:[],qualityItems:[]};}
function budget(id="B-1",actual=9000,forecast=10500){return{id,category:"ai_inference",period:"monthly",budgetMinor:10000,actualMinor:actual,forecastMinor:forecast,currency:"EUR",forecastConfidence:.8};}
function sla(id="S-1",elapsed=90,criticality="high"){return{id,kind:"response",state:"in_progress",targetMinutes:30,elapsedMinutes:elapsed,criticality};}

test("healthy explicit snapshot with no signals is not reported live",()=>{const r=evaluate(base());assert.equal(r.ok,true);assert.equal(r.status,"NO_SIGNALS");assert.equal(r.liveData,false);assert.equal(r.sourceStatus,"INPUT_SNAPSHOT_ONLY");assert.equal(r.executionAllowed,false);assert.equal(r.automatedActionCount,0);assert.equal(r.humanReviewRequired,true);assert.equal(r.summary.unknownModules,0);});
test("cross-domain finance and SLA breach become prioritized human-review signals",()=>{const i=base();i.budgets=[budget()];i.slaItems=[sla()];const r=evaluate(i);assert.equal(r.status,"CRITICAL");assert.equal(r.prioritySummary.p0,2);assert.deepEqual(r.priorityQueue.map(x=>x.domain).sort(),["finance","operations"]);assert.ok(r.recommendations.every(x=>x.humanReviewRequired&&x.executionAllowed===false));assert.equal(r.automatedActionCount,0);});
test("missing module observations stay UNKNOWN instead of false healthy",()=>{const i=base();i.observations=i.observations.slice(0,18);const r=evaluate(i);assert.equal(r.moduleStatuses.health,"UNKNOWN");assert.equal(r.summary.unknownModules,1);assert.equal(r.status,"UNKNOWN");assert.ok(r.priorityQueue.some(x=>x.id==="HEALTH:provider"));});
test("quality low sample signals human review only and strips PII",()=>{const i=base();const q=qualityItem("PROVIDER-REF-2",[20,20,20,20],4);q.name="Sensitive Name";q.email="private@example.invalid";i.qualityItems=[q];const r=evaluate(i);assert.equal(r.moduleSummary.quality.insufficient,1);assert.ok(r.priorityQueue.some(x=>x.id.startsWith("QUALITY:PROVIDER-REF-2:")));assert.equal(r.qualitySafeguard,"NO_AUTOMATED_PROVIDER_RANKING_OR_SANCTION");assert.doesNotMatch(JSON.stringify(r),/Sensitive Name|private@example/);});
test("production and invalid cycle context fail closed",()=>{assert.equal(evaluate({...base(),environment:"production"}).ok,false);assert.equal(evaluate({...base(),tenantId:""}).ok,false);assert.equal(evaluate({...base(),asOf:"2026-11-27"}).ok,false);assert.equal(evaluate({...base(),slaItems:Array(201).fill(sla())}).ok,false);});
test("module evaluator absence returns unavailable rather than healthy",()=>{const old=globalThis.ProcheliaNexusBudgetGuard;delete globalThis.ProcheliaNexusBudgetGuard;try{const r=evaluate(base());assert.equal(r.ok,false);assert.match(r.reason,/MODULE_UNAVAILABLE:budget/);assert.equal(r.status,"UNKNOWN");}finally{globalThis.ProcheliaNexusBudgetGuard=old;}});
test("priority queue caps at 100 and reports unprioritized signal count",()=>{const i=base();i.budgets=Array.from({length:50},(_,n)=>budget("B-"+(n+1),7500,9000));i.slaItems=Array.from({length:200},(_,n)=>sla("S-"+(n+1),80,"normal"));const r=evaluate(i);assert.equal(r.signalCount,250);assert.equal(r.priorityQueue.length,100);assert.equal(r.priorityInputsTruncated,true);assert.equal(r.unprioritizedSignalCount,150);});
test("unexpected module output fails closed and never authorizes actions",()=>{const old=globalThis.ProcheliaNexusExecutivePriority;globalThis.ProcheliaNexusExecutivePriority={evaluate:()=>({ok:false,status:"healthy"})};try{const r=evaluate(base());assert.equal(r.ok,false);assert.equal(r.executionAllowed,false);assert.equal(r.status,"UNKNOWN");}finally{globalThis.ProcheliaNexusExecutivePriority=old;}});
test("pre-existing executive priority inputs are included without raw text",()=>{const i=base();i.priorityItems=[{id:"RISK-1",severity:"critical",domain:"security",ageMinutes:20,slaBreached:false,affectedDomains:["security","technology"]}];const r=evaluate(i);assert.equal(r.priorityQueue.length,1);assert.equal(r.priorityQueue[0].priority,"P0");assert.equal(r.priorityQueue[0].domain,"security");});
test("long valid source identifiers are mapped to bounded deterministic references",()=>{const i=base();i.slaItems=[sla("S".repeat(128),90,"high")];const r=evaluate(i);assert.equal(r.ok,true);assert.ok(r.priorityQueue[0].id.length<=128);assert.equal(r.priorityQueue[0].id.startsWith("SLA:"),true);});
