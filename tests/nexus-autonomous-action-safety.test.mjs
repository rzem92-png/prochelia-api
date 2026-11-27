import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
test("operational case creation never triggers automatic execution",()=>{assert.doesNotMatch(source,/if\s*\(rec\.action\s*===\s*['"]AUTO_RESOLVE['"]\)\s*await\s*executeOperationalCase\s*\(env,id,null,true\)/);assert.match(source,/AUTO_PENDING_HUMAN_REVIEW/);});
test("automatic execution path fails closed",()=>{assert.match(source,/if\(automatic\)return\s*\{ok:false,error:'AUTONOMOUS_BUSINESS_EXECUTION_DISABLED'/);});
test("mission replacement is queued, not directly written",()=>{assert.match(source,/HUMAN_REVIEW_AND_OWNERSHIP_RECHECK_REQUIRED/);assert.doesNotMatch(source,/UPDATE missions SET intervenant_id=\?/);});
test("rescheduling is queued for runtime revalidation",()=>{assert.match(source,/HUMAN_REVIEW_AND_RUNTIME_VALIDATION_REQUIRED/);assert.doesNotMatch(source,/UPDATE missions SET \$\{target\}=\?/);});
test("financial review action remains queued and no money movement is implemented here",()=>{assert.match(source,/PSP_REFUND_REVIEW/);assert.match(source,/Financial actions are deliberately queued/);});
test("case stays pending when external action is queued",()=>{assert.match(source,/awaitingProvider/);assert.match(source,/status:\s*awaitingProvider\?'WAITING_PROVIDER':'RESOLVED'/);assert.match(source,/awaitingProvider\?'WAITING_PROVIDER':'RESOLVED'/);});

test("operational case scope is derived from authenticated profile and mission",()=>{assert.match(source,/SELECT id FROM clients WHERE user_id=\?/);assert.match(source,/SELECT id FROM intervenants WHERE user_id=\?/);assert.match(source,/MISSION_OWNERSHIP_MISMATCH/);assert.match(source,/MISSION_ASSIGNMENT_MISMATCH/);assert.match(source,/CALLER_SCOPE_FIELD_MISMATCH/);});
test("non-manager company case scope fails closed until relationship verification",()=>{assert.match(source,/COMPANY_CASE_SCOPE_NOT_VERIFIED/);assert.match(source,/COMPANY_SCOPE_NOT_VERIFIED/);});
test("all operational cases require human review regardless of low-impact recommendation",()=>{assert.match(source,/const requiresManager=1/);assert.match(source,/const status='OPEN'/);assert.match(source,/solution:\{\.\.\.rec\.solution,automatic:false\}/);});
