import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
test("operational case creation never triggers automatic execution",()=>{assert.doesNotMatch(source,/if\s*\(rec\.action\s*===\s*['"]AUTO_RESOLVE['"]\)\s*await\s*executeOperationalCase\s*\(env,id,null,true\)/);assert.match(source,/AUTO_PENDING_HUMAN_REVIEW/);});
test("automatic execution path fails closed",()=>{assert.match(source,/if\(automatic\)return\s*\{ok:false,error:'AUTONOMOUS_BUSINESS_EXECUTION_DISABLED'/);});
test("mission replacement is queued, not directly written",()=>{assert.match(source,/HUMAN_REVIEW_AND_OWNERSHIP_RECHECK_REQUIRED/);assert.doesNotMatch(source,/UPDATE missions SET intervenant_id=\?/);});
test("rescheduling is queued for runtime revalidation",()=>{assert.match(source,/HUMAN_REVIEW_AND_RUNTIME_VALIDATION_REQUIRED/);assert.doesNotMatch(source,/UPDATE missions SET \$\{target\}=\?/);});
test("financial review action remains queued and no money movement is implemented here",()=>{assert.match(source,/PSP_REFUND_REVIEW/);assert.match(source,/Financial actions are deliberately queued/);});
