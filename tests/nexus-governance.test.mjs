import test from "node:test";
import assert from "node:assert/strict";
import "../src/nexus-governance.js";
const {evaluateAction,validatePolicy,canonicalActionPayload,computeActionHash,evaluateActionWithVerifiedHash}=globalThis.ProcheliaNexusGovernance;
const NOW=Date.parse("2026-11-27T08:00:00Z");
const policy={version:"nexus-policy-v1",mode:"EXECUTE_APPROVED",allowedEnvironments:["preview"],approvalRequiredActionClasses:["COUNTRY_ACTIVATION"],approverIds:["human-1","human-2"],consumedApprovalIds:[],killSwitch:{global:false,agents:{},tools:{},tenants:{},workflows:{}},agents:{ops:{enabled:true,allowedTools:["catalog","payments"],allowedActions:["readMarkets","globalCheck","updateCatalog","transferFunds","activateCountry"],allowedScopes:["market:read","market:write","finance:read","finance:write","global"],actionGrants:{"catalog:readMarkets":{classes:["READ"],scopes:["market:read"]},"catalog:updateCatalog":{classes:["WRITE"],scopes:["market:write"]},"catalog:globalCheck":{classes:["READ"],scopes:["global"]},"payments:transferFunds":{classes:["FINANCIAL"],scopes:["finance:write"]},"catalog:activateCountry":{classes:["COUNTRY_ACTIVATION"],scopes:["market:write"]}},allowedEnvironments:["preview"],allowedTenants:["tenant-a"],globalTaskAllowed:true,budget:{maxActionsPerTask:5,maxCostUnits:100,maxRetries:2,maxRuntimeMs:30000}}}};
const base={agentId:"ops",toolId:"catalog",action:"readMarkets",actionClass:"READ",environment:"preview",tenantId:"tenant-a",scope:"market:read",taskId:"task-01",now:NOW};
function approval(approverId,approvalId="approval-"+approverId,overrides={}){return{approved:true,approvalId,approverId,actionHash:"a".repeat(64),taskId:"task-01",tenantId:"tenant-a",environment:"preview",toolId:"payments",action:"transferFunds",expiresAt:NOW+60000,...overrides}}
const financial={...base,toolId:"payments",action:"transferFunds",actionClass:"FINANCIAL",scope:"finance:write",idempotencyKey:"idempotency-key-0001",actionHash:"a".repeat(64),estimatedCostUnits:1};
test("policy requires bounded agent grants and kill-switch structure",()=>{assert.equal(validatePolicy(policy),true);assert.equal(validatePolicy({...policy,killSwitch:{global:false}}),false);assert.equal(validatePolicy({...policy,agents:{ops:{...policy.agents.ops,budget:{maxRetries:-1}}}}),false)});
test("allows a scoped read-only tool in OBSERVE mode",()=>{const result=evaluateAction({...policy,mode:"OBSERVE"},{...base});assert.equal(result.allowed,true);assert.equal(result.decision,"ALLOW_READ_ONLY");assert.equal(result.authorization,"READ_ONLY")});
test("SUGGEST and OBSERVE never authorize mutations",()=>{for(const mode of ["OBSERVE","SUGGEST"]){const result=evaluateAction({...policy,mode},{...base,action:"updateCatalog",actionClass:"WRITE",scope:"market:write",idempotencyKey:"idempotency-key-0001"});assert.equal(result.allowed,false);assert.equal(result.code,"MODE_NOT_EXECUTABLE")}});
test("request cannot override the policy mode",()=>{const result=evaluateAction({...policy,mode:"OBSERVE"},{...base,mode:"EXECUTE_APPROVED",action:"updateCatalog",actionClass:"WRITE",scope:"market:write",idempotencyKey:"idempotency-key-0001"});assert.equal(result.allowed,false)});
test("production is always denied even if listed in policy",()=>{const result=evaluateAction({...policy,allowedEnvironments:["preview","production"],agents:{ops:{...policy.agents.ops,allowedEnvironments:["preview","production"]}}},{...base,environment:"production"});assert.equal(result.code,"PRODUCTION_NO_GO")});
test("global kill switch denies otherwise authorized actions",()=>{const result=evaluateAction({...policy,killSwitch:{...policy.killSwitch,global:true}},{...base});assert.equal(result.code,"KILL_SWITCH_ACTIVE")});
test("agent, tool, action and scope grants are least-privilege",()=>{assert.equal(evaluateAction({...policy,agents:{...policy.agents,ops:{...policy.agents.ops,enabled:false}}},{...base}).code,"AGENT_DISABLED_OR_UNKNOWN");assert.equal(evaluateAction(policy,{...base,toolId:"unlisted"}).code,"TOOL_OR_ACTION_NOT_GRANTED");assert.equal(evaluateAction(policy,{...base,scope:"finance:write"}).code,"SCOPE_DENIED")});
test("tenant crossing and unapproved global tasks are denied",()=>{assert.equal(evaluateAction(policy,{...base,tenantId:"tenant-b"}).code,"TENANT_SCOPE_DENIED");assert.equal(evaluateAction({...policy,agents:{ops:{...policy.agents.ops,globalTaskAllowed:false}}},{...base,action:"globalCheck",tenantId:null,scope:"global"}).code,"GLOBAL_SCOPE_DENIED")});
test("write actions require task identity and idempotency key",()=>{assert.equal(evaluateAction(policy,{...base,action:"updateCatalog",actionClass:"WRITE",scope:"market:write"}).code,"IDEMPOTENCY_REQUIRED")});
test("action and cost caps fail closed",()=>{assert.equal(evaluateAction(policy,{...base,usage:{actionsUsed:5}}).code,"ACTION_BUDGET_EXCEEDED");assert.equal(evaluateAction(policy,{...base,estimatedCostUnits:101}).code,"COST_BUDGET_EXCEEDED")});
test("negative or malformed budget counters are denied",()=>{assert.equal(evaluateAction(policy,{...base,usage:{actionsUsed:-1}}).code,"INVALID_BUDGET_INPUT");assert.equal(evaluateAction(policy,{...base,estimatedCostUnits:-10}).code,"INVALID_BUDGET_INPUT")});
test("retry and runtime caps are enforced",()=>{assert.equal(evaluateAction(policy,{...base,retryAttempt:3}).code,"RETRY_LIMIT_EXCEEDED");assert.equal(evaluateAction(policy,{...base,estimatedRuntimeMs:30001}).code,"RUNTIME_LIMIT_EXCEEDED")});
test("high-risk action without approval enters approval-required state",()=>{const result=evaluateAction(policy,financial);assert.equal(result.allowed,false);assert.equal(result.decision,"REQUIRES_APPROVAL");assert.equal(result.code,"HUMAN_APPROVAL_REQUIRED")});
test("financial execution needs two distinct human approvals and is only authorized",()=>{const result=evaluateAction(policy,{...financial,approvals:[approval("human-1"),approval("human-2")]});assert.equal(result.allowed,true);assert.equal(result.decision,"ALLOW_EXECUTION");assert.equal(result.approvalRequired,true);assert.equal(result.approvalIds.length,2);assert.match(result.reason,/ne l'exécute pas/)});
test("expired, replayed, wrong-scope or duplicate approver records are denied",()=>{const cases=[[approval("human-1","old",{expiresAt:NOW-1}),approval("human-2")],[approval("human-1"),approval("human-2","second",{tenantId:"tenant-b"})],[approval("human-1"),approval("human-1","second")],[approval("human-1","consumed",{consumed:true}),approval("human-2")]];for(const approvals of cases){const result=evaluateAction(policy,{...financial,approvals});assert.equal(result.allowed,false);assert.equal(result.code,"APPROVAL_INVALID_OR_REPLAYED")}});
test("a valid but insufficient quorum requests another approval",()=>{const result=evaluateAction(policy,{...financial,approvals:[approval("human-1")]});assert.equal(result.decision,"REQUIRES_APPROVAL");assert.match(result.reason,/1\/2/)});
test("action hash must be a SHA-256-shaped value and bind approvals to the action",()=>{const result=evaluateAction(policy,{...financial,actionHash:"not-hash",approvals:[approval("human-1"),approval("human-2")]});assert.equal(result.code,"APPROVAL_INVALID_OR_REPLAYED")});
test("malformed policy or request is rejected without side effects",()=>{assert.equal(evaluateAction(null,base).code,"INVALID_INPUT");assert.equal(evaluateAction({...policy,mode:"AUTO"},{...base}).code,"INVALID_POLICY_OR_REQUEST");const result=evaluateAction(policy,base);assert.equal(result.allowed,true);assert.equal(result.authorization,"READ_ONLY")});

test("actions below the action cap remain permitted",()=>{const result=evaluateAction(policy,{...base,usage:{actionsUsed:1}});assert.equal(result.allowed,true);assert.equal(result.code,"READ_ONLY_ALLOWED")});

test("action class cannot be downgraded to READ to bypass approval",()=>{const result=evaluateAction(policy,{...financial,actionClass:"READ",scope:"finance:write"});assert.equal(result.code,"ACTION_CLASS_NOT_GRANTED")});
test("persisted consumed approval IDs reject replay",()=>{const approvals=[approval("human-1"),approval("human-2")];const result=evaluateAction({...policy,consumedApprovalIds:["approval-human-1"]},{...financial,approvals});assert.equal(result.code,"APPROVAL_INVALID_OR_REPLAYED")});


test("financial approval quorum policy cannot be weakened below two and rejects unknown classes",()=>{
 const weakened={...policy,approvalQuorumByClass:{FINANCIAL:1}};
 assert.equal(validatePolicy(weakened),false);
 assert.equal(validatePolicy({...policy,approvalQuorumByClass:{UNKNOWN_CLASS:2}}),false);
 assert.equal(validatePolicy({...policy,approvalQuorumByClass:{FINANCIAL:3}}),true);
});
test("financial quorum override may strengthen but never weaken the two-person floor",()=>{
 const strengthened={...policy,approverIds:[...policy.approverIds,"human-3"],approvalQuorumByClass:{FINANCIAL:3}};
 const two=evaluateAction(strengthened,{...financial,approvals:[approval("human-1"),approval("human-2")]});
 assert.equal(two.allowed,false);assert.equal(two.decision,"REQUIRES_APPROVAL");assert.ok(two.reason.includes("2/3"));
 const three=evaluateAction(strengthened,{...financial,approvals:[approval("human-1"),approval("human-2"),approval("human-3")]});
 assert.equal(three.allowed,true);assert.equal(three.approvalIds.length,3);
});

test("canonical action payload ignores object-key order but binds context and payload",()=>{
 const a={...financial,payload:{amount:125,currency:"EUR",details:{b:2,a:1}}};
 const b={...financial,payload:{details:{a:1,b:2},currency:"EUR",amount:125}};
 assert.equal(canonicalActionPayload(a),canonicalActionPayload(b));
 assert.notEqual(canonicalActionPayload(a),canonicalActionPayload({...a,payload:{...a.payload,amount:126}}));
 assert.notEqual(canonicalActionPayload(a),canonicalActionPayload({...a,tenantId:"tenant-b"}));
});
test("SHA-256 action hash is stable and changes when normalized payload changes",async()=>{
 const request={...financial,payload:{amount:125,currency:"EUR",details:{b:2,a:1}}};
 const hash=await computeActionHash(request);
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(hash,await computeActionHash({...request,payload:{details:{a:1,b:2},currency:"EUR",amount:125}}));
 assert.notEqual(hash,await computeActionHash({...request,payload:{...request.payload,amount:126}}));
});
test("canonical action payload rejects cycles and unsafe/non-JSON values",()=>{
 const cyclic={};cyclic.self=cyclic;
 assert.throws(()=>canonicalActionPayload({...financial,payload:cyclic}),/ACTION_PAYLOAD_INVALID_OBJECT/);
 assert.throws(()=>canonicalActionPayload({...financial,payload:{value:NaN}}),/ACTION_PAYLOAD_NONFINITE_NUMBER/);
 assert.throws(()=>canonicalActionPayload({...financial,payload:{value:undefined}}),/ACTION_PAYLOAD_UNSUPPORTED_VALUE/);
 assert.throws(()=>canonicalActionPayload({...financial,payload:new Date()}),/ACTION_PAYLOAD_NONPLAIN_OBJECT/);
});
test("verified-hash gateway rejects missing or mismatched hashes and accepts only bound approvals",async()=>{
 const action={...financial,payload:{amount:125,currency:"EUR"}};
 const hash=await computeActionHash(action);
 const valid={...action,actionHash:hash,approvals:[approval("human-1","approval-1",{actionHash:hash}),approval("human-2","approval-2",{actionHash:hash})]};
 const accepted=await evaluateActionWithVerifiedHash(policy,valid);
 assert.equal(accepted.allowed,true);assert.equal(accepted.code,"APPROVED_ACTION_ALLOWED");
 assert.equal((await evaluateActionWithVerifiedHash(policy,{...action,actionHash:undefined})).code,"ACTION_HASH_REQUIRED");
 assert.equal((await evaluateActionWithVerifiedHash(policy,{...valid,payload:{amount:126,currency:"EUR"}})).code,"ACTION_HASH_MISMATCH");
});
