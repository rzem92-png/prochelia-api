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

test("directory listing validates offsets and returns a bounded pagination contract", async () => {
  const rows=Array.from({length:101},(_,i)=>({id:"client-"+i}));
  let boundValues;
  const env={DB:{prepare(){return {bind(...values){boundValues=values;return this;},async all(){return {results:rows};}};}}};
  const invalid=await directoryList(new Request("https://example.test/api/clients?offset=not-a-number"),env,"clients",async()=>({user:{id:"manager",role:"gerante"}}));
  assert.equal(invalid.status,400);
  const response=await directoryList(new Request("https://example.test/api/clients"),env,"clients",async()=>({user:{id:"manager",role:"gerante"}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.items.length,100);
  assert.equal(body.has_more,true);
  assert.equal(body.next_offset,100);
  assert.deepEqual(boundValues,[101,0]);
  const large=await directoryList(new Request("https://example.test/api/clients?offset=50001"),env,"clients",async()=>({user:{id:"manager",role:"gerante"}}));
  assert.equal(large.status,200);
  assert.deepEqual(boundValues,[101,50001]);
});

test("intervenant directory returns the deterministic final-page contract", async () => {
  let query;
  const env={DB:{prepare(sql){query=sql;return {bind(){return this;},async all(){return {results:[{id:"provider-1"}]};}};}}};
  const response=await directoryList(new Request("https://example.test/api/intervenants"),env,"intervenants",async()=>({user:{id:"manager",role:"gerante"}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.items[0].id,"provider-1");
  assert.equal(body.has_more,false);
  assert.equal(body.next_offset,null);
  assert.match(query,/FROM intervenants i JOIN users u/);
});
