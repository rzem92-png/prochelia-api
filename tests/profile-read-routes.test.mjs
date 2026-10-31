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
  assert.equal(response.status,200);
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
  assert.equal(response.status,200);
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
  assert.equal(response.status,200);
  assert.ok(body.routes.includes("/api/clients"));
  assert.ok(body.routes.includes("/api/intervenants"));
});
