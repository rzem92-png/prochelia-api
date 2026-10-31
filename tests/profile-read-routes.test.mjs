import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const base = "https://prochelia-api.test";
const cookie = "prochelia_session=synthetic-test-session-token";

function makeEnv(role="gerante") {
  const calls=[];
  const sessionUser={
    id:"user-test-1",role,email:"manager@example.test",first_name:"Test",last_name:"Manager",
    phone:null,status:"active",created_at:"2026-10-31 00:00:00",updated_at:"2026-10-31 00:00:00",
    session_id:"session-test-1"
  };
  const DB={
    prepare(sql) {
      calls.push(sql);
      return {
        bind(){return this;},
        async first(){
          if(sql.includes("FROM sessions s")) return sessionUser;
          return null;
        },
        async all(){
          if(sql.includes("FROM clients c JOIN users u")) return {results:[{
            id:"client-1",user_id:"user-client-1",first_name:"Camille",last_name:"Test",
            email:"camille@example.test",phone:null,status:"active",address:"",city:"Meudon",postal_code:"",notes:""
          }]};
          if(sql.includes("FROM intervenants i JOIN users u")) return {results:[{
            id:"provider-1",user_id:"user-provider-1",first_name:"Alex",last_name:"Test",
            email:"alex@example.test",phone:"0600000000",user_status:"active",
            professional_status:"Aide à domicile",description:"Profil de test",service_area:"Meudon",
            hourly_rate:22,validation_status:"approved"
          }]};
          if(sql.includes("FROM disponibilites")) return {results:[]};
          return {results:[]};
        }
      };
    }
  };
  return {DB,calls};
}

test("GET /api/clients requires authentication and returns D1-backed records", async()=>{
  const unauth=await worker.fetch(new Request(base+"/api/clients"),makeEnv());
  assert.equal(unauth.status,401);
  const env=makeEnv();
  const response=await worker.fetch(new Request(base+"/api/clients",{headers:{Cookie:cookie}}),env);
  assert.equal(response.status,200,JSON.stringify(body));
  const body=await response.json();
  assert.equal(body.source,"D1");
  assert.equal(body.clients[0].id,"client-1");
  assert.ok(env.calls.some(sql=>sql.includes("FROM clients c JOIN users u")));
});

test("GET /api/intervenants hides private contact details from clients",async()=>{
  const unauth=await worker.fetch(new Request(base+"/api/intervenants"),makeEnv());
  assert.equal(unauth.status,401);
  const env=makeEnv("client");
  const response=await worker.fetch(new Request(base+"/api/intervenants",{headers:{Cookie:cookie}}),env);
  assert.equal(response.status,200,JSON.stringify(body));
  const body=await response.json();
  assert.equal(body.source,"D1");
  assert.equal(body.intervenants[0].email,null);
  assert.equal(body.intervenants[0].telephone,null);
});

test("profile read routes reject non-GET methods",async()=>{
  const env=makeEnv();
  for(const route of ["/api/clients","/api/intervenants"]){
    const response=await worker.fetch(new Request(base+route,{method:"POST",headers:{Cookie:cookie}}),env);
    assert.equal(response.status,405);
  }
});

test("public API contract advertises both profile routes",async()=>{
  const response=await worker.fetch(new Request(base+"/api/info"),makeEnv());
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.ok(body.routes.includes("/api/clients"));
  assert.ok(body.routes.includes("/api/intervenants"));
});

import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const token = "unit-test-session-token";
const tokenHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))).toString("base64url");
const clientRows = [
  {id:"c1",user_id:"u-client-1",first_name:"Claire",last_name:"Client",email:"claire@example.test",phone:"0600000001",status:"active",city:"Meudon",address:"1 rue A",postal_code:"92190",notes:""},
  {id:"c2",user_id:"u-client-2",first_name:"Paul",last_name:"Client",email:"paul@example.test",phone:"0600000002",status:"active",city:"Sèvres",address:"2 rue B",postal_code:"92310",notes:""}
];
const providerRows = [
  {id:"i1",user_id:"u-provider-1",first_name:"Sophie",last_name:"Provider",email:"sophie@example.test",phone:"0600000011",user_status:"active",professional_status:"Micro-entrepreneur",description:"Accompagnement",service_area:"Meudon",hourly_rate:22,validation_status:"approved"},
  {id:"i2",user_id:"u-provider-2",first_name:"Marc",last_name:"Provider",email:"marc@example.test",phone:"0600000012",user_status:"active",professional_status:"Indépendant",description:"Ménage",service_area:"Sèvres",hourly_rate:20,validation_status:"pending"}
];
const availabilityRows = [
  {intervenant_id:"i1",start_at:"2026-11-02T09:00:00",end_at:"2026-11-02T12:00:00",status:"available"}
];

function fakeEnv(role,userId) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM sessions s")) {
                  return {id:userId,role,email:"user@example.test",first_name:"Test",last_name:"User",phone:"0600000000",status:"active",created_at:"2026-01-01",updated_at:"2026-01-01",session_id:"s1"};
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM clients c")) {
                  const rows=sql.includes("WHERE c.user_id=?") ? clientRows.filter(x=>x.user_id===args[0]) : clientRows;
                  return {results:rows};
                }
                if (sql.includes("FROM intervenants i")) {
                  let rows=providerRows;
                  if (sql.includes("WHERE u.status='active'")) rows=rows.filter(x=>x.user_status==="active" && ["approved","validated","valide","validé"].includes(x.validation_status.toLowerCase()));
                  if (sql.includes("WHERE i.user_id=?")) rows=rows.filter(x=>x.user_id===args[0]);
                  return {results:rows};
                }
                if (sql.includes("FROM disponibilites")) {
                  const ids=new Set(args);
                  return {results:availabilityRows.filter(x=>ids.has(x.intervenant_id))};
                }
                return {results:[]};
              }
            };
          }
        };
      }
    }
  };
}

async function authenticatedGet(path,userId,role) {
  return worker.fetch(new Request(base + path,{headers:{Cookie:"prochelia_session="+token}}),fakeEnv(role,userId));
}

test("manager can read all client profiles from D1", async () => {
  const response=await authenticatedGet("/api/clients","u-manager","gerante");
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.source,"D1");
  assert.equal(body.total,2);
  assert.equal(body.clients[0].email,"claire@example.test");
});

test("client can read only their own client profile", async () => {
  const response=await authenticatedGet("/api/clients","u-client-1","client");
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.total,1);
  assert.equal(body.clients[0].id,"c1");
});

test("client sees only approved providers and no direct contact details", async () => {
  const response=await authenticatedGet("/api/intervenants","u-client-1","client");
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.total,1);
  assert.equal(body.intervenants[0].id,"i1");
  assert.equal(body.intervenants[0].email,null);
  assert.equal(body.intervenants[0].telephone,null);
  assert.equal(body.intervenants[0].disponibiliteSlots.length,1);
});

test("provider can read only their own provider profile", async () => {
  const response=await authenticatedGet("/api/intervenants","u-provider-1","intervenant");
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.total,1);
  assert.equal(body.intervenants[0].id,"i1");
});
