import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function makeDB(role="gerante",failHealth=false) {
  let healthCalls=0;
  const db={
    prepare(sql) {
      return {bind(...args) {return {async first() {
        if(sql.includes("FROM sessions s")) {
          return {
            id:"manager-test-id",role,email:"manager@example.test",first_name:"Test",last_name:"Manager",
            phone:null,status:"active",created_at:"2026-01-01",updated_at:"2026-01-01",session_id:"session-1"
          };
        }
        if(sql.includes("FROM background_jobs")) {
          healthCalls++;
          if(failHealth) throw new Error("private database detail");
          return {
            snapshot_at:"2026-11-28 03:00:00",total:3,pending:1,pending_due:1,pending_future:0,
            running:1,running_unlocked:0,stale_running:0,waiting_provider:0,failed:0,done:1,
            exhausted_pending:0,unknown_status:0,oldest_due_pending_at:"2026-11-28 02:00:00",
            last_updated_at:"2026-11-28 03:00:00"
          };
        }
        throw new Error("unexpected query");
      }}}};
    },
    get healthCalls(){return healthCalls;}
  };
  return db;
}
const sessionCookie="prochelia_session=test-session";

test("queue health requires an authenticated session",async()=>{
  const db=makeDB();
  const response=await worker.fetch(new Request("https://preview.example/api/jobs/health"),{DB:db});
  assert.equal(response.status,401);
  assert.equal(db.healthCalls,0);
});

test("queue health denies non-manager roles",async()=>{
  const db=makeDB("client");
  const response=await worker.fetch(new Request("https://preview.example/api/jobs/health",{headers:{cookie:sessionCookie}}),{DB:db});
  assert.equal(response.status,403);
  assert.equal(db.healthCalls,0);
});

test("manager receives read-only minimal metrics with no-store and security headers",async()=>{
  const db=makeDB();
  const response=await worker.fetch(new Request("https://preview.example/api/jobs/health",{headers:{cookie:sessionCookie}}),{DB:db});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(response.headers.get("x-frame-options"),"DENY");
  assert.equal(response.headers.get("referrer-policy"),"no-referrer");
  assert.ok(response.headers.get("strict-transport-security"));
  const body=await response.json();
  assert.equal(body.monitoring,"READ_ONLY");
  assert.equal(body.status,"BACKLOG");
  assert.equal(body.counts.pendingDue,1);
  assert.equal(body.counts.running,1);
  assert.equal(db.healthCalls,1);
  for(const forbidden of ["manager-test-id","test-session","payload_json","last_error","job_id"]) assert.equal(JSON.stringify(body).includes(forbidden),false);
});

test("storage failure returns generic 503 and no-store",async()=>{
  const db=makeDB("gerante",true);
  const response=await worker.fetch(new Request("https://preview.example/api/jobs/health",{headers:{cookie:sessionCookie}}),{DB:db});
  assert.equal(response.status,503);
  assert.equal(response.headers.get("cache-control"),"no-store");
  const body=await response.json();
  assert.equal(body.error,"QUEUE_HEALTH_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(body),/private database detail/);
});
