import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleV7Route } from "../src/v7-routes.js";
import { directoryList, resolveMissionSecurityAssignment, findAssignedMissionSecurity, isMissionPresenceFresh, isTrustedDeviceActive, hmacSha256Base64url, isSameMissionPaymentRequest, paymentsConfigured, supportAutoResolve } from "../src/index.js";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

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


test("mission security assignment resolves business IDs to their owning users", async () => {
  let sql = "";
  let values = [];
  const expected = {
    mission_id: "mission-1",
    client_id: "client-record-1",
    intervenant_id: "provider-record-1",
    client_user_id: "client-user-1",
    intervenant_user_id: "provider-user-1"
  };
  const env = { DB: { prepare(statement) {
    sql = statement;
    return { bind(...args) {
      values = args;
      return { async first() { return expected; } };
    } };
  } } };
  const row = await resolveMissionSecurityAssignment(env, {
    missionId: "mission-1",
    clientId: "client-record-1",
    intervenantId: "provider-record-1"
  });
  assert.deepEqual(values, ["mission-1", "client-record-1", "provider-record-1"]);
  assert.match(sql, /JOIN clients c ON c\.id = m\.client_id/);
  assert.match(sql, /JOIN intervenants i ON i\.id = m\.intervenant_id/);
  assert.match(sql, /c\.user_id AS client_user_id/);
  assert.match(sql, /i\.user_id AS intervenant_user_id/);
  assert.equal(row.client_user_id, "client-user-1");
  assert.equal(row.intervenant_user_id, "provider-user-1");
});

test("mission security assignment fails closed when required identifiers are missing", async () => {
  let databaseReads = 0;
  const env = { DB: { prepare() { databaseReads++; throw new Error("unexpected database read"); } } };
  assert.equal(await resolveMissionSecurityAssignment(env, {
    missionId: "mission-1", clientId: "", intervenantId: "provider-1"
  }), null);
  assert.equal(databaseReads, 0);
});

test("mission security assignment fails closed without a database", async () => {
  assert.equal(await resolveMissionSecurityAssignment({}, {
    missionId: "mission-1", clientId: "client-1", intervenantId: "provider-1"
  }), null);
});


test("mission security code lookup binds business assignment to the authenticated user", async () => {
  let sql = "";
  let values = [];
  const expected = { id: "security-1", mission_id: "mission-1", intervenant_id: "provider-record-1" };
  const env = { DB: { prepare(statement) {
    sql = statement;
    return { bind(...args) {
      values = args;
      return { async first() { return args[0] === "mission-1" && args[1] === "provider-user-1" ? expected : null; } };
    } };
  } } };
  assert.equal(await findAssignedMissionSecurity(env, "mission-1", "provider-user-1"), expected);
  assert.equal(await findAssignedMissionSecurity(env, "mission-1", "different-user"), null);
  assert.deepEqual(values, ["mission-1", "different-user"]);
  assert.match(sql, /JOIN intervenants i ON i\.id = ms\.intervenant_id/);
  assert.match(sql, /i\.user_id = \?/);
});

test("mission security code lookup fails closed for missing identity", async () => {
  let reads = 0;
  const env = { DB: { prepare() { reads++; throw new Error("unexpected database read"); } } };
  assert.equal(await findAssignedMissionSecurity(env, "mission-1", ""), null);
  assert.equal(reads, 0);
});


test("mission code verification requires a fresh presence timestamp", () => {
  const now = Date.parse("2026-11-18T12:00:00.000Z");
  assert.equal(isMissionPresenceFresh("2026-11-18 11:50:00", now), true);
  assert.equal(isMissionPresenceFresh("2026-11-18 11:49:59", now), false);
  assert.equal(isMissionPresenceFresh("2026-11-18 12:00:01", now), false);
  assert.equal(isMissionPresenceFresh(null, now), false);
  assert.equal(isMissionPresenceFresh("not-a-date", now), false);
});


test("security notification signatures use standard HMAC-SHA256", async () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const message = '{"event":"PROCHELIA_SECURITY_CODES","mission_id":"synthetic"}';
  const expected = createHmac("sha256", secret).update(message).digest("base64url");
  assert.equal(await hmacSha256Base64url(secret, message), expected);
  await assert.rejects(() => hmacSha256Base64url("short", message), /HMAC_SECRET_OR_MESSAGE_INVALID/);
  await assert.rejects(() => hmacSha256Base64url(secret, null), /HMAC_SECRET_OR_MESSAGE_INVALID/);
});


test("revoked or expired devices cannot pass mission trust checks", () => {
  const now = Date.parse("2026-11-18T12:00:00.000Z");
  assert.equal(isTrustedDeviceActive({status:"active",revoked_at:null,expires_at:"2026-11-18 12:05:00"},now),true);
  assert.equal(isTrustedDeviceActive({status:"revoked",revoked_at:"2026-11-18 11:59:00",expires_at:"2026-11-18 12:05:00"},now),false);
  assert.equal(isTrustedDeviceActive({status:"active",revoked_at:"2026-11-18 11:59:00",expires_at:"2026-11-18 12:05:00"},now),false);
  assert.equal(isTrustedDeviceActive({status:"active",revoked_at:null,expires_at:"2026-11-18 11:59:59"},now),false);
  assert.equal(isTrustedDeviceActive(null,now),false);
});


test("mission payment idempotency keys are bound to the full payment request", () => {
  const existing = {mission_id:"m-1",client_id:"c-1",intervenant_id:"i-1",gross_cents:12500,commission_cents:1500};
  const same = {missionId:"m-1",clientId:"c-1",intervenantId:"i-1",grossCents:12500,commissionCents:1500};
  assert.equal(isSameMissionPaymentRequest(existing,same),true);
  assert.equal(isSameMissionPaymentRequest(existing,{...same,grossCents:12501}),false);
  assert.equal(isSameMissionPaymentRequest(existing,{...same,commissionCents:1499}),false);
  assert.equal(isSameMissionPaymentRequest(existing,{...same,missionId:"m-2"}),false);
  assert.equal(isSameMissionPaymentRequest(existing,{...same,clientId:"c-2"}),false);
  assert.equal(isSameMissionPaymentRequest(existing,{...same,intervenantId:"i-2"}),false);
  assert.equal(isSameMissionPaymentRequest(null,same),false);
});


test("real payout reservations remain disabled until a PSP adapter is implemented", () => {
  assert.equal(paymentsConfigured({PAYMENT_PROVIDER:"stripe",PAYMENT_WEBHOOK_SECRET:"x".repeat(48)}),false);
  assert.equal(paymentsConfigured({PAYMENT_PROVIDER:"psp_adapter"}),false);
  assert.equal(paymentsConfigured({}),false);
});


test("support auto-resolution ignores caller-supplied execution_verified and remains open pending server evidence", async () => {
  const calls=[];
  const DB = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              calls.push({sql,values});
              return {success:true};
            }
          };
        }
      };
    }
  };
  const result=await supportAutoResolve({DB},"synthetic-case","synthetic-user","client","DELAY_LIGHT",{execution_verified:true});
  assert.equal(result.status,"WAITING_ACTION");
  assert.equal(result.closed,false);
  assert.equal(result.reason,"NO_SERVER_VERIFIED_DOWNSTREAM_ACTION");
  const update=calls.find(call=>call.sql.includes("UPDATE support_cases"));
  assert.ok(update);
  assert.match(update.sql,/status='WAITING_ACTION'/);
  assert.doesNotMatch(update.sql,/status='RESOLVED'/);
  assert.ok(calls.some(call=>call.sql.includes("INSERT INTO support_case_events")));
  assert.ok(calls.some(call=>call.sql.includes("INSERT INTO journal")));
});


test("backup status never claims an automatic daily schedule without a configured trigger", () => {
  const scaleStart=source.indexOf("async function nationalScaleStatus");
  const scaleEnd=source.indexOf("\nasync function backupStatus",scaleStart);
  const backupStart=scaleEnd;
  const backupEnd=source.indexOf("\n\nconst __procheliaNationalHandle",backupStart);
  assert.notEqual(scaleStart,-1);
  assert.notEqual(scaleEnd,-1);
  assert.notEqual(backupEnd,-1);
  const scaleBody=source.slice(scaleStart,scaleEnd);
  const backupBody=source.slice(backupStart,backupEnd);
  assert.match(scaleBody,/automatic:false/);
  assert.match(scaleBody,/scheduleStatus:'NOT_CONFIGURED'/);
  assert.match(backupBody,/automatic:false/);
  assert.match(backupBody,/scheduleStatus:'NOT_CONFIGURED'/);
  assert.match(backupBody,/retentionStatus:'UNVERIFIED'/);
  assert.doesNotMatch(backupBody,/frequency:'DAILY'/);
});
