import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeSupportCaseEventRows, encodeSupportCaseEventCursor, decodeSupportCaseEventCursor } from "../src/index.js";

test("timeline normalizes only safe event fields and reverses newest-first results",()=>{
  const rows=[
    {id:"event-003",event_type:"MANAGER_RESOLVED",actor_role:"OWNER",created_at:"2026-11-26T11:00:00Z",actor_id:"secret-user",details_json:'{"resolution":"private"}'},
    {id:"event-002",event_type:"CREATED",actor_role:"CLIENT",created_at:"2026-11-26T09:00:00Z",actor_id:"secret-user",details_json:'{"scenario":"internal"}'},
    {id:"event-001",event_type:"<script>",actor_role:"UNEXPECTED_ROLE",created_at:"not-a-date",details_json:"secret"}
  ];
  const result=normalizeSupportCaseEventRows(rows);
  assert.deepEqual(result.events.map(e=>e.type),["SCRIPT","CREATED","MANAGER_RESOLVED"]);
  assert.equal(result.events[0].actor_role,"TEAM");
  assert.equal(result.events[0].created_at,null);
  assert.equal(result.events[1].created_at,"2026-11-26T09:00:00Z");
  assert.deepEqual(Object.keys(result.events[1]).sort(),["actor_role","created_at","type"]);
  assert.equal(JSON.stringify(result).includes("secret"),false);
  assert.equal(result.has_more,false);
});

test("timeline bounds to 100 events and signals truncation",()=>{
  const rows=Array.from({length:101},(_,i)=>{
    const n=100-i;
    return {id:"event-"+String(n).padStart(3,"0"),event_type:"EVENT_"+n,actor_role:"CLIENT",created_at:new Date(Date.UTC(2026,10,26,n)).toISOString()};
  });
  const result=normalizeSupportCaseEventRows(rows);
  assert.equal(result.events.length,100);
  assert.equal(result.has_more,true);
  assert.equal(result.events[0].type,"EVENT_1");
  assert.equal(result.events.at(-1).type,"EVENT_100");
  assert.equal(decodeSupportCaseEventCursor(result.next_cursor)?.id,"event-001");
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
  assert.match(route,/SELECT e\.id,e\.event_type,e\.actor_role,e\.created_at/);
  assert.doesNotMatch(route,/details_json|actor_id/);
  assert.match(route,/LIMIT 101/);
  assert.match(route,/allow:'GET'/);
  assert.match(source,/supportCaseEventsRoute\(request,env\)/);
});

test("event cursor round-trips bounded keyset and rejects malformed or oversized tokens",()=>{
  const row={id:"event-123",created_at:"2026-11-26T12:48:00Z"};
  const cursor=encodeSupportCaseEventCursor(row);
  assert.ok(cursor);
  assert.deepEqual(decodeSupportCaseEventCursor(cursor),row);
  assert.equal(decodeSupportCaseEventCursor("%%%"),null);
  assert.equal(decodeSupportCaseEventCursor("A".repeat(513)),null);
  assert.equal(encodeSupportCaseEventCursor({id:"",created_at:"2026-11-26T12:48:00Z"}),null);
});

test("timeline route uses tenant/requester-scoped keyset pagination and rejects bad cursors",async()=>{
  const source=await readFile(new URL("../src/index.js",import.meta.url),"utf8");
  const start=source.indexOf("export async function supportCaseEventsRoute(");
  const end=source.indexOf("\n}",start)+2;
  const route=source.slice(start,end);
  assert.match(route,/decodeSupportCaseEventCursor/);
  assert.match(route,/CURSOR_INVALID/);
  assert.match(route,/e\.created_at < \?/);
  assert.match(route,/e\.id < \?/);
  assert.match(route,/ORDER BY e\.created_at DESC,e\.id DESC LIMIT 101/);
  assert.match(route,/next_cursor:normalized\.next_cursor/);
  assert.match(route,/support_cases:\['tenant_id','requester_id'\],support_case_events:\['case_id','event_type','actor_role','created_at','id'\]/);
});
