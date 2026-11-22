import test from "node:test";
import assert from "node:assert/strict";
import { handleV7Route } from "../src/v7-routes.js";
import { directoryList } from "../src/index.js";

const post = (path, body) => new Request("https://example.test" + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body ?? {})
});

test("permission route rejects unauthenticated caller", async () => {
  const response = await handleV7Route(
    post("/api/v7/check/permissions", { role: "gerante", permissions: { anything: true } }),
    {},
    "/api/v7/check/permissions",
    null
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("permission route ignores caller-supplied role and permission map", async () => {
  const response = await handleV7Route(
    post("/api/v7/check/permissions", { role: "gerante", permissions: { delete_users: true } }),
    {},
    "/api/v7/check/permissions",
    { user: { id: "client-1", role: "client" } }
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "FORBIDDEN");
});

test("permission route uses manager role from authenticated session", async () => {
  const response = await handleV7Route(
    post("/api/v7/check/permissions", { role: "client", permissions: { delete_users: false }, permission: "delete_users" }),
    {},
    "/api/v7/check/permissions",
    { user: { id: "manager-1", role: "gerante" } }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.role, "gerante");
});

test("audit route rejects unauthenticated caller", async () => {
  const response = await handleV7Route(
    post("/api/v7/security/audit", { action: "TEST", actorId: "forged", actorRole: "gerante" }),
    {},
    "/api/v7/security/audit",
    null
  );
  assert.equal(response.status, 401);
});

test("audit route rejects non-manager session", async () => {
  const response = await handleV7Route(
    post("/api/v7/security/audit", { action: "TEST", actorId: "forged", actorRole: "gerante" }),
    {},
    "/api/v7/security/audit",
    { user: { id: "client-1", role: "client" } }
  );
  assert.equal(response.status, 403);
});

test("audit actor is taken from authenticated session, not request body", async () => {
  const response = await handleV7Route(
    post("/api/v7/security/audit", { action: "TEST_ACTION", actorId: "forged", actorRole: "admin" }),
    {},
    "/api/v7/security/audit",
    { user: { id: "manager-real", role: "gerante" } }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.audit.actorId, "manager-real");
  assert.equal(body.audit.actorRole, "gerante");
});


test("directory listing rejects anonymous and non-manager callers before database reads", async () => {
  const requests=[];
  const env={DB:{prepare(sql){requests.push(sql);return {bind(){return this;},async all(){return {results:[]};}};}}};
  const unauth=await directoryList(new Request("https://example.test/api/clients"),env,"clients",async()=>null);
  assert.equal(unauth.status,401);
  const denied=await directoryList(new Request("https://example.test/api/clients"),env,"clients",async()=>({user:{id:"client-1",role:"client"}}));
  assert.equal(denied.status,403);
  assert.equal(requests.length,0);
});

function directoryDb(rows = [], includeTenant = true) {
  let query = null;
  let boundValues = null;
  let executed = false;
  const DB = {
    prepare(sql) {
      if (sql.startsWith("SELECT name FROM sqlite_master")) {
        return { bind() { return this; }, async first() { return {name:sql.includes("'clients'") ? "clients" : "intervenants"}; } };
      }
      if (sql.startsWith("PRAGMA table_info")) {
        return { async all() { return {results:includeTenant ? [{name:"id"},{name:"tenant_id"}] : [{name:"id"}]}; } };
      }
      query = sql;
      return {
        bind(...values) { boundValues=values; return this; },
        async all() { executed=true; return {results:rows}; }
      };
    }
  };
  return {DB,get query(){return query;},get boundValues(){return boundValues;},get executed(){return executed;}};
}
const managerSession = async () => ({user:{id:"manager",role:"gerante"}});
const activeTenant = async () => ({ok:true,tenant:{id:"tenant-a"}});

test("directory listing validates offsets and returns only active-tenant rows", async () => {
  const rows=Array.from({length:101},(_,i)=>({id:"client-"+i}));
  const fake=directoryDb(rows);
  const env={DB:fake.DB};
  const invalid=await directoryList(new Request("https://example.test/api/clients?offset=not-a-number"),env,"clients",managerSession,activeTenant);
  assert.equal(invalid.status,400);
  const response=await directoryList(new Request("https://example.test/api/clients"),env,"clients",managerSession,activeTenant);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.items.length,100);
  assert.equal(body.has_more,true);
  assert.equal(body.next_offset,100);
  assert.deepEqual(fake.boundValues,["tenant-a",101,0]);
  assert.match(fake.query,/WHERE c\.tenant_id=\?/);
  const large=await directoryList(new Request("https://example.test/api/clients?offset=50001"),env,"clients",managerSession,activeTenant);
  assert.equal(large.status,200);
  assert.deepEqual(fake.boundValues,["tenant-a",101,50001]);
});

test("intervenant directory filters by active tenant and preserves deterministic pagination", async () => {
  const fake=directoryDb([{id:"provider-1"}]);
  const response=await directoryList(new Request("https://example.test/api/intervenants"),{DB:fake.DB},"intervenants",managerSession,activeTenant);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.items[0].id,"provider-1");
  assert.equal(body.has_more,false);
  assert.equal(body.next_offset,null);
  assert.match(fake.query,/FROM intervenants i JOIN users u/);
  assert.match(fake.query,/WHERE i\.tenant_id=\?/);
  assert.deepEqual(fake.boundValues,["tenant-a",101,0]);
});

test("directory listing fails closed without an active tenant or tenant_id schema", async () => {
  const noTenant=directoryDb([{id:"must-not-leak"}]);
  const denied=await directoryList(new Request("https://example.test/api/clients"),{DB:noTenant.DB},"clients",managerSession,async()=>({ok:false,error:"ACTIVE_TENANT_REQUIRED",status:403}));
  assert.equal(denied.status,403);
  assert.equal(noTenant.executed,false);
  const noColumn=directoryDb([{id:"must-not-leak"}],false);
  const unavailable=await directoryList(new Request("https://example.test/api/clients"),{DB:noColumn.DB},"clients",managerSession,activeTenant);
  assert.equal(unavailable.status,503);
  assert.equal(noColumn.executed,false);
});


test("legacy loyalty mutations fail closed until their tenant-scoped schema exists", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const start=source.indexOf("async function loyaltyUpdate(request, env) {");
  const end=source.indexOf("async function qualityCreate",start);
  const body=source.slice(start,end);
  assert.ok(start>=0 && end>start);
  assert.ok(body.indexOf("return legacyTenantScopeBlocked();") < body.indexOf("ensureOperationalSchema(env)"));
});
