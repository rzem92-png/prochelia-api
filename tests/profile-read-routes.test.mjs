import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const base = "https://prochelia-api.test";
const cookie = "prochelia_session=synthetic-test-session-token";

const clients = [
  {id:"client-1",user_id:"user-client-1",first_name:"Camille",last_name:"Test",email:"camille@example.test",phone:"0600000001",status:"active",address:"1 rue A",city:"Meudon",postal_code:"92190",notes:""},
  {id:"client-2",user_id:"user-client-2",first_name:"Paul",last_name:"Test",email:"paul@example.test",phone:"0600000002",status:"active",address:"2 rue B",city:"Sèvres",postal_code:"92310",notes:""}
];
const providers = [
  {id:"provider-1",user_id:"user-provider-1",first_name:"Alex",last_name:"Test",email:"alex@example.test",phone:"0600000011",user_status:"active",professional_status:"Aide à domicile",description:"Profil validé",service_area:"Meudon",hourly_rate:22,validation_status:"approved"},
  {id:"provider-2",user_id:"user-provider-2",first_name:"Marc",last_name:"Test",email:"marc@example.test",phone:"0600000012",user_status:"active",professional_status:"Ménage",description:"Profil en attente",service_area:"Sèvres",hourly_rate:20,validation_status:"pending"}
];

function makeEnv(role="gerante", userId="user-manager") {
  const calls=[];
  const sessionUser={id:userId,role,email:"user@example.test",first_name:"Test",last_name:"User",phone:null,status:"active",created_at:"2026-10-31",updated_at:"2026-10-31",session_id:"session-test"};
  const DB={
    prepare(sql) {
      calls.push(sql);
      const statement={
        args:[],
        bind(...args){this.args=args;return this;},
        async first(){
          if(sql.includes("FROM sessions s")) return sessionUser;
          return null;
        },
        async all(){
          const args=this.args;
          if(sql.includes("FROM clients c JOIN users u")) {
            const rows=sql.includes("WHERE c.user_id=?") ? clients.filter(x=>x.user_id===args[0]) : clients;
            return {results:rows};
          }
          if(sql.includes("FROM intervenants i JOIN users u")) {
            let rows=providers;
            if(sql.includes("WHERE u.status='active'")) rows=rows.filter(x=>x.user_status==="active" && x.validation_status==="approved");
            if(sql.includes("WHERE i.user_id=?")) rows=rows.filter(x=>x.user_id===args[0]);
            return {results:rows};
          }
          if(sql.includes("FROM disponibilites")) return {results:[]};
          return {results:[]};
        }
      };
      return statement;
    }
  };
  return {DB,calls};
}
async function get(path, env) {
  return worker.fetch(new Request(base+path,{headers:{Cookie:cookie}}),env);
}

test("client profile route requires authentication", async()=>{
  const response=await worker.fetch(new Request(base+"/api/clients"),{DB:{}});
  assert.equal(response.status,401);
});

test("manager can read D1 client profiles", async()=>{
  const env=makeEnv("gerante");
  const response=await get("/api/clients",env);
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.source,"D1");
  assert.equal(body.total,2);
  assert.ok(env.calls.some(sql=>sql.includes("FROM clients c JOIN users u")));
});

test("client receives only their own profile", async()=>{
  const env=makeEnv("client","user-client-1");
  const response=await get("/api/clients",env);
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.total,1);
  assert.equal(body.clients[0].id,"client-1");
});

test("client sees approved providers without email or phone", async()=>{
  const response=await get("/api/intervenants",makeEnv("client","user-client-1"));
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.total,1);
  assert.equal(body.intervenants[0].id,"provider-1");
  assert.equal(body.intervenants[0].email,null);
  assert.equal(body.intervenants[0].telephone,null);
});

test("provider receives only their own profile", async()=>{
  const response=await get("/api/intervenants",makeEnv("intervenant","user-provider-1"));
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.total,1);
  assert.equal(body.intervenants[0].id,"provider-1");
});

test("profile read routes reject non-GET methods before D1 rate limiting", async()=>{
  for(const route of ["/api/clients","/api/intervenants"]){
    const response=await worker.fetch(new Request(base+route,{method:"POST"}),{});
    assert.equal(response.status,405);
  }
});

test("public API contract advertises both profile routes", async()=>{
  const response=await worker.fetch(new Request(base+"/api/info"),{});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.ok(body.routes.includes("/api/clients"));
  assert.ok(body.routes.includes("/api/intervenants"));
});
