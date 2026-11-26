import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeSupportCaseEventRows } from "../src/index.js";

test("timeline normalizes only safe event fields and reverses newest-first results",()=>{
  const rows=[
    {event_type:"MANAGER_RESOLVED",actor_role:"OWNER",created_at:"2026-11-26T11:00:00Z",actor_id:"secret-user",details_json:'{"resolution":"private"}'},
    {event_type:"CREATED",actor_role:"CLIENT",created_at:"2026-11-26T09:00:00Z",actor_id:"secret-user",details_json:'{"scenario":"internal"}'},
    {event_type:"<script>",actor_role:"UNEXPECTED_ROLE",created_at:"not-a-date",details_json:"secret"}
  ];
  const result=normalizeSupportCaseEventRows(rows);
  assert.deepEqual(result.events.map(e=>e.type),["EVENT","CREATED","MANAGER_RESOLVED"]);
  assert.equal(result.events[0].actor_role,"TEAM");
  assert.equal(result.events[0].created_at,null);
  assert.equal(result.events[1].created_at,"2026-11-26T09:00:00Z");
  assert.deepEqual(Object.keys(result.events[1]).sort(),["actor_role","created_at","type"]);
  assert.equal(JSON.stringify(result).includes("secret"),false);
  assert.equal(result.has_more,false);
});

test("timeline bounds to 100 events and signals truncation",()=>{
  const rows=Array.from({length:101},(_,i)=>({
    event_type:"EVENT_"+i,actor_role:"CLIENT",created_at:"2026-11-26T"+String(i%24).padStart(2,"0")+":00:00Z"
  }));
  const result=normalizeSupportCaseEventRows(rows);
  assert.equal(result.events.length,100);
  assert.equal(result.has_more,true);
  assert.equal(result.events[0].type,"EVENT_1");
  assert.equal(result.events.at(-1).type,"EVENT_100");
});

test("support timeline endpoint is read-only, active-tenant and requester scoped",async()=>{
  const source=await readFile(new URL("../src/index.js",import.meta.url),"utf8");
  const start=source.indexOf("export async function supportCaseEventsRoute(");
  const end=source.indexOf("\n}",start)+2;
  assert.ok(start>=0&&end>start);
  const route=source.slice(start,end);
  assert.match(route,/supportAuth\(request,env\)/);
  assert.match(route,/support_cases:\['tenant_id','requester_id'\]/);
  assert.match(route,/WHERE id=\? AND tenant_id=\?/);
  assert.match(route,/WHERE id=\? AND tenant_id=\? AND requester_id=\?/);
  assert.match(route,/JOIN support_cases c ON c\.id=e\.case_id/);
  assert.match(route,/c\.tenant_id=\?/);
  assert.match(route,/c\.requester_id=\?/);
  assert.match(route,/SELECT e\.event_type,e\.actor_role,e\.created_at/);
  assert.doesNotMatch(route,/details_json|actor_id/);
  assert.match(route,/LIMIT 101/);
  assert.match(route,/allow:'GET'/);
  assert.match(source,/supportCaseEventsRoute\(request,env\)/);
});
