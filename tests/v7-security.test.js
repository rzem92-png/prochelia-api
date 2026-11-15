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


test("DSA notice endpoint rejects anonymous submissions", async () => {
  const response = await handleV7Route(
    post("/api/compliance/notices", {
      subject_type: "LISTING", subject_id: "listing-1",
      notice_type: "ILLEGAL_CONTENT", explanation: "A sufficiently detailed report."
    }),
    { DB: { prepare() { throw new Error("must not query DB"); } } },
    "/api/compliance/notices",
    null
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "UNAUTHENTICATED");
});

test("DSA notice endpoint validates required fields and bounded explanation", async () => {
  const response = await handleV7Route(
    post("/api/compliance/notices", {
      subject_type: "LISTING", subject_id: "listing-1",
      notice_type: "ILLEGAL_CONTENT", explanation: "short"
    }),
    { DB: { prepare() { throw new Error("must not query DB"); } } },
    "/api/compliance/notices",
    { user: { id: "reporter-1", role: "client" } }
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_NOTICE");
});

test("DSA notice endpoint persists authenticated reporter identity, never body identity", async () => {
  let sql = "";
  let values = [];
  const env = { DB: { prepare(query) {
    sql = query;
    return { bind(...args) { values = args; return this; }, async run() { return { success: true }; } };
  } } };
  const response = await handleV7Route(
    post("/api/compliance/notices", {
      reporter_user_id: "forged-user",
      subject_type: "LISTING", subject_id: "listing-42",
      notice_type: "ILLEGAL_CONTENT", legal_basis: "Applicable law",
      explanation: "This listing appears to offer an illegal service."
    }),
    env,
    "/api/compliance/notices",
    { user: { id: "authenticated-reporter", role: "client" } }
  );
  assert.equal(response.status, 201);
  assert.match(sql, /INSERT INTO dsa_notices/);
  assert.equal(values[1], "authenticated-reporter");
  assert.equal(values[0].length > 10, true);
  assert.equal(values[3], "listing-42");
  assert.equal(values[4], "ILLEGAL_CONTENT");
  assert.equal(values[6], "This listing appears to offer an illegal service.");
  const payload = await response.json();
  assert.equal(payload.notice.status, "RECEIVED");
  assert.ok(payload.notice.id);
});

test("DSA notice endpoint fails closed when compliance storage is unavailable", async () => {
  const response = await handleV7Route(
    post("/api/compliance/notices", {
      subject_type: "LISTING", subject_id: "listing-1",
      notice_type: "ILLEGAL_CONTENT", explanation: "This listing appears to offer an illegal service."
    }),
    {},
    "/api/compliance/notices",
    { user: { id: "reporter-1", role: "client" } }
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "COMPLIANCE_STORE_UNAVAILABLE");
});


test("DSA notice status listing is authenticated and scoped to the session reporter", async () => {
  let values = [];
  let sql = "";
  const env = { DB: { prepare(query) {
    sql = query;
    return { bind(...args) { values = args; return this; }, async all() { return { results: [{ id: "n1", status: "RECEIVED" }] }; } };
  } } };
  const denied = await handleV7Route(
    new Request("https://example.test/api/compliance/notices"),
    env, "/api/compliance/notices", null
  );
  assert.equal(denied.status, 401);

  const allowed = await handleV7Route(
    new Request("https://example.test/api/compliance/notices"),
    env, "/api/compliance/notices",
    { user: { id: "reporter-real", role: "client" } }
  );
  assert.equal(allowed.status, 200);
  assert.match(sql, /WHERE reporter_user_id = \?/);
  assert.equal(values[0], "reporter-real");
  assert.deepEqual((await allowed.json()).notices, [{ id: "n1", status: "RECEIVED" }]);
});


test("DSA appeal endpoint rejects anonymous and malformed submissions", async () => {
  const anonymous = await handleV7Route(
    post("/api/compliance/appeals", { decision_id: "d1", grounds: "A sufficiently detailed appeal ground." }),
    {}, "/api/compliance/appeals", null
  );
  assert.equal(anonymous.status, 401);
  const malformed = await handleV7Route(
    post("/api/compliance/appeals", { decision_id: "d1", grounds: "short" }),
    { DB: {} }, "/api/compliance/appeals", { user: { id: "affected-1", role: "client" } }
  );
  assert.equal(malformed.status, 400);
});

test("DSA appeal endpoint only accepts an affected user's appeal and prevents duplicate pending appeals", async () => {
  const statements = [];
  const env = { DB: { prepare(sql) {
    statements.push(sql);
    return {
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes("FROM moderation_decisions")) return { id: "decision-1" };
        return null;
      },
      async run() { return { success: true }; }
    };
  } } };
  const response = await handleV7Route(
    post("/api/compliance/appeals", {
      decision_id: "decision-1", appellant_user_id: "forged-user",
      grounds: "The moderation decision contains factual errors."
    }),
    env, "/api/compliance/appeals",
    { user: { id: "affected-user", role: "client" } }
  );
  assert.equal(response.status, 201);
  assert.deepEqual(statements.map(s => s.trim().split(/\\s+/).slice(0,3).join(" ")), [
    "SELECT id FROM moderation_decisions",
    "SELECT id FROM moderation_appeals",
    "INSERT INTO moderation_appeals"
  ]);
  assert.equal((await response.json()).appeal.status, "SUBMITTED");
});

test("DSA appeal endpoint does not expose another user's decision", async () => {
  const env = { DB: { prepare() {
    return { bind() { return this; }, async first() { return null; } };
  } } };
  const response = await handleV7Route(
    post("/api/compliance/appeals", {
      decision_id: "decision-other", grounds: "I believe this decision should be reviewed."
    }),
    env, "/api/compliance/appeals",
    { user: { id: "unrelated-user", role: "client" } }
  );
  assert.equal(response.status, 404);
});
