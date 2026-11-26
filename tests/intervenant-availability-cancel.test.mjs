import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { intervenantAvailabilityRoute } from "../src/index.js";
globalThis.crypto ??= webcrypto;

function makeMock({ slot = { id: "availability-12345678", start_at: new Date(Date.now()+3600000).toISOString(), end_at: new Date(Date.now()+7200000).toISOString(), status: "available" }, changes = 1 } = {}) {
  const calls=[];
  const DB={prepare(sql){calls.push(sql);return {bind(...args){return {
    async first(){
      if(sql.includes("FROM sessions s")&&sql.includes("JOIN users u")) return {id:"user-a",role:"intervenant",email:"provider@example.test",first_name:"P",last_name:"R",phone:null,status:"active",session_id:"session-a",session_active_tenant_id:"tenant-a"};
      if(sql.includes("FROM intervenants WHERE user_id")) return {id:"provider-a"};
      if(sql.includes("FROM disponibilites")&&sql.includes("WHERE id =")) return slot;
      throw new Error("Unexpected first query: "+sql);
    },
    async run(){return {meta:{changes}}}
  }}}}};
  return {DB,calls};
}
function req(id){return new Request("https://api.test/api/intervenant/availability?id="+encodeURIComponent(id),{method:"DELETE",headers:{cookie:"prochelia_session=synthetic-session"}})}
const url=new URL("https://api.test/api/intervenant/availability");

test("cancel future availability: scoped read and conditional update",async()=>{
 const mock=makeMock();const res=await intervenantAvailabilityRoute(req("availability-12345678"),{DB:mock.DB},url);assert.equal(res.status,200);const body=await res.json();assert.equal(body.availability.status,"cancelled");assert.match(mock.calls.at(-1),/tenant_id = \? AND status = 'available'/);assert.match(mock.calls.at(-1),/julianday\(start_at\) > julianday\(\?\)/);
});

test("missing slot identifier rejected",async()=>{
 const mock=makeMock();const res=await intervenantAvailabilityRoute(req(""),{DB:mock.DB},url);assert.equal(res.status,400);assert.equal((await res.json()).error,"AVAILABILITY_ID_REQUIRED");
});

test("unknown slot returns not found",async()=>{
 const mock=makeMock({slot:null});const res=await intervenantAvailabilityRoute(req("availability-12345678"),{DB:mock.DB},url);assert.equal(res.status,404);
});

test("already cancelled slot is idempotent",async()=>{
 const mock=makeMock({slot:{id:"availability-12345678",start_at:new Date(Date.now()+3600000).toISOString(),end_at:new Date(Date.now()+7200000).toISOString(),status:"cancelled"}});const res=await intervenantAvailabilityRoute(req("availability-12345678"),{DB:mock.DB},url);assert.equal(res.status,200);assert.equal((await res.json()).idempotent_replay,true);
});

test("booked slot cannot be cancelled",async()=>{
 const mock=makeMock({slot:{id:"availability-12345678",start_at:new Date(Date.now()+3600000).toISOString(),end_at:new Date(Date.now()+7200000).toISOString(),status:"booked"}});const res=await intervenantAvailabilityRoute(req("availability-12345678"),{DB:mock.DB},url);assert.equal(res.status,409);assert.equal((await res.json()).error,"AVAILABILITY_NOT_CANCELLABLE");
});

test("expired slot cannot be cancelled",async()=>{
 const mock=makeMock({slot:{id:"availability-12345678",start_at:new Date(Date.now()-3600000).toISOString(),end_at:new Date(Date.now()-1800000).toISOString(),status:"available"}});const res=await intervenantAvailabilityRoute(req("availability-12345678"),{DB:mock.DB},url);assert.equal(res.status,409);
});

test("concurrent state change is rejected when conditional update affects no row",async()=>{
 const mock=makeMock({changes:0});const res=await intervenantAvailabilityRoute(req("availability-12345678"),{DB:mock.DB},url);assert.equal(res.status,409);
});
