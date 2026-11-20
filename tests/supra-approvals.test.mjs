import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleSupraApprovalRoute, consumeSupraApproval } from "../src/supra-approvals.js";

function fakeDb(firstRows = []) {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          calls.push({ kind: "first", sql: this.sql, values: this.values });
          return firstRows.shift() ?? null;
        },
        async run() {
          calls.push({ kind: "run", sql: this.sql, values: this.values });
          return { success: true, meta: { changes: 1 } };
        },
        async all() {
          calls.push({ kind: "all", sql: this.sql, values: this.values });
          return { results: [{ approver_user_id: "manager-b", decision: "APPROVE" }] };
        }
      };
    },
    async batch(statements) {
      calls.push(...statements.map(s => ({ kind: "batch", sql: s.sql, values: s.values })));
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    }
  };
  return db;
}

function post(path, body, origin = "https://app.example") {
  return new Request("https://app.example" + path, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const managerA = { user: { id: "manager-a", role: "gerante", tenant_id: "tenant-1" } };
const managerB = { user: { id: "manager-b", role: "gerante", tenant_id: "tenant-1" } };

test("approval routes reject anonymous and non-manager callers", async () => {
  const env = { DB: fakeDb() };
  const request = post("/api/supra/approvals/request", {});
  assert.equal((await handleSupraApprovalRoute(request, env, null)).status, 401);
  assert.equal((await handleSupraApprovalRoute(request, env, { user: { id: "client", role: "client" } })).status, 403);
});

test("approval mutations require an exact same-origin Origin header", async () => {
  const env = { DB: fakeDb() };
  const response = await handleSupraApprovalRoute(
    post("/api/supra/approvals/request", {}, "https://evil.example"), env, managerA
  );
  assert.equal(response.status, 403);
});

test("high-risk requests bind an immutable payload hash and require two distinct approvers", async () => {
  const db = fakeDb();
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/request", {
    action: "PAYMENT_ENABLE",
    tenantId: "tenant-1",
    resourceId: "payments-production",
    payload: { enabled: true, account: "psp-1" },
    reason: "Controlled release review",
    amountCents: 120000,
    currency: "EUR",
    requiredApprovals: 1,
    risk: "LOW"
  }), { DB: db }, managerA);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.request.risk, "CRITICAL");
  assert.equal(body.request.requiredApprovals, 2);
  assert.equal(body.request.status, "PENDING");
  assert.match(body.request.payloadHash, /^[a-f0-9]{64}$/);
  assert.ok(db.calls.some(x => x.sql.includes("INSERT INTO supra_approval_requests")));
  assert.ok(db.calls.some(x => x.sql.includes("INSERT INTO supra_approval_events")));
});

test("requester cannot approve their own action", async () => {
  const db = fakeDb([{ id: "req-1", requester_user_id: "manager-a", tenant_id: "tenant-1", status: "PENDING", expires_at: "2999-01-01T00:00:00.000Z", required_approvals: 2 }]);
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/decide", {
    requestId: "req-1", decision: "APPROVE", reason: "I approve"
  }), { DB: db }, managerA);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "SELF_APPROVAL_FORBIDDEN");
  assert.equal(db.calls.filter(x => x.kind === "batch").length, 0);
});

test("approval decision records distinct approver votes and only approves at the persisted threshold", async () => {
  const db = fakeDb([
    { id: "req-2", requester_user_id: "manager-a", tenant_id: "tenant-1", status: "PENDING", expires_at: "2999-01-01T00:00:00.000Z", required_approvals: 2 },
    { status: "PENDING", required_approvals: 2 },
    { count: 1 }
  ]);
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/decide", {
    requestId: "req-2", decision: "APPROVE", reason: "Independent review"
  }), { DB: db }, managerB);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "PENDING");
  assert.equal(body.approvalCount, 1);
  assert.ok(db.calls.some(x => x.sql.includes("UNIQUE") || x.sql.includes("INSERT INTO supra_approval_votes")));
  assert.ok(db.calls.some(x => x.sql.includes("COUNT(*)") && x.sql.includes("required_approvals")));
});

test("approval consumption is server-only, one-time, and bound to action, tenant, resource, amount and payload hash", async () => {
  const db = fakeDb();
  const result = await consumeSupraApproval({ DB: db }, {
    requestId: "req-3",
    actorUserId: "executor-1",
    actorRole: "gerante",
    action: "REFUND_ISSUE",
    tenantId: "tenant-1",
    resourceId: "refund-42",
    payload: { amountCents: 5000, missionId: "mission-1" },
    amountCents: 5000,
    currency: "EUR"
  });
  assert.equal(result.ok, true);
  const update = db.calls.find(x => x.sql.includes("UPDATE supra_approval_requests SET status='CONSUMED'"));
  assert.ok(update);
  for (const field of ["status='APPROVED'", "expires_at>?", "tenant_id=?", "resource_id=?", "action=?", "payload_hash=?", "amount_cents=?", "currency=?"]) {
    assert.ok(update.sql.includes(field), "missing one-time consumption binding: " + field);
  }
  assert.ok(db.calls.some(x => x.sql.includes("'CONSUMED'")));
});

test("consumption rejects malformed or unapproved action types", async () => {
  const invalid = await consumeSupraApproval({ DB: fakeDb() }, {
    requestId: "r", actorUserId: "u", actorRole: "gerante",
    action: "UNKNOWN_ACTION", tenantId: "t", resourceId: "r", payload: {}
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, "ACTION_NOT_APPROVABLE");
});

test("approval ledger schema protects immutable request identity and append-only votes/events", async () => {
  const schema = await readFile(new URL("../migrations-preview-canonical/0022_supra_persisted_approvals.sql", import.meta.url), "utf8");
  const guards = await readFile(new URL("../migrations-preview-canonical/0029_supra_append_only_audit_guards.sql", import.meta.url), "utf8");
  const sql = schema + "\n" + guards;
  assert.match(sql, /trg_supra_approval_requests_immutable/);
  assert.match(sql, /trg_supra_approval_requests_no_delete/);
  assert.match(sql, /trg_supra_approval_votes_no_update/);
  assert.match(sql, /trg_supra_approval_votes_no_delete/);
  assert.match(sql, /trg_supra_approval_events_no_update/);
  assert.match(sql, /trg_supra_approval_events_no_delete/);
  assert.match(sql, /trg_supra_approval_status_transitions/);
  assert.match(sql, /trg_supra_approval_status_evidence/);
  assert.match(sql, /payload_json TEXT NOT NULL/);
  assert.match(sql, /created_at, payload_json/);
  assert.match(sql, /UNIQUE \(request_id, approver_user_id\)/);
});


test("SUPRA audit trail and approval requests cannot be updated or deleted", async () => {
  const auditSql = await readFile(new URL("../migrations-preview-canonical/0021_supra_audit_events.sql", import.meta.url), "utf8");
  const approvalSql = await readFile(new URL("../migrations-preview-canonical/0022_supra_persisted_approvals.sql", import.meta.url), "utf8");
  assert.match(auditSql, /trg_supra_audit_events_no_update/);
  assert.match(auditSql, /trg_supra_audit_events_no_delete/);
  assert.match(approvalSql, /trg_supra_approval_requests_no_delete/);
  assert.match(auditSql, /SUPRA_AUDIT_EVENTS_ARE_APPEND_ONLY/);
  assert.match(approvalSql, /APPROVAL_REQUESTS_ARE_APPEND_ONLY/);
});

test("additive Preview repair migration installs all missing append-only guards", async () => {
  const sql = await readFile(new URL("../migrations-preview-canonical/0029_supra_append_only_audit_guards.sql", import.meta.url), "utf8");
  assert.match(sql, /trg_supra_audit_events_no_update/);
  assert.match(sql, /trg_supra_audit_events_no_delete/);
  assert.match(sql, /trg_supra_approval_requests_no_delete/);
  assert.match(sql, /SUPRA_AUDIT_EVENTS_ARE_APPEND_ONLY/);
  assert.match(sql, /APPROVAL_REQUESTS_ARE_APPEND_ONLY/);
});

test("all approval endpoints fail closed when the authenticated session has no server-derived tenant", async () => {
  const managerWithoutTenant = { user: { id: "manager-no-tenant", role: "gerante" } };

  const requestDb = fakeDb();
  const requestResponse = await handleSupraApprovalRoute(post("/api/supra/approvals/request", {
    action: "PRODUCTION_RELEASE", tenantId: "tenant-1", resourceId: "release-1",
    payload: { commit: "abc" }, reason: "Review"
  }), { DB: requestDb }, managerWithoutTenant);
  assert.equal(requestResponse.status, 403);
  assert.equal((await requestResponse.json()).error, "TENANT_SCOPE_NOT_VERIFIED");
  assert.equal(requestDb.calls.length, 0);

  const decideDb = fakeDb([{
    id: "req-no-tenant", requester_user_id: "another-manager", tenant_id: "tenant-1",
    status: "PENDING", expires_at: "2999-01-01T00:00:00.000Z", required_approvals: 1
  }]);
  const decideResponse = await handleSupraApprovalRoute(post("/api/supra/approvals/decide", {
    requestId: "req-no-tenant", decision: "APPROVE", reason: "Review"
  }), { DB: decideDb }, managerWithoutTenant);
  assert.equal(decideResponse.status, 403);
  assert.equal((await decideResponse.json()).error, "TENANT_SCOPE_NOT_VERIFIED");
  assert.equal(decideDb.calls.filter(x => x.kind === "batch").length, 0);

  const detailDb = fakeDb([{
    id: "req-no-tenant", requester_user_id: "another-manager", tenant_id: "tenant-1"
  }]);
  const detailResponse = await handleSupraApprovalRoute(new Request(
    "https://app.example/api/supra/approvals/detail?requestId=req-no-tenant"
  ), { DB: detailDb }, managerWithoutTenant);
  assert.equal(detailResponse.status, 403);
  assert.equal((await detailResponse.json()).error, "TENANT_SCOPE_NOT_VERIFIED");
  assert.equal(detailDb.calls.filter(x => x.kind === "all").length, 0);

  const revokeDb = fakeDb([{
    requester_user_id: "manager-no-tenant", tenant_id: "tenant-1", status: "PENDING"
  }]);
  const revokeResponse = await handleSupraApprovalRoute(post("/api/supra/approvals/revoke", {
    requestId: "req-no-tenant", reason: "Review"
  }), { DB: revokeDb }, managerWithoutTenant);
  assert.equal(revokeResponse.status, 403);
  assert.equal((await revokeResponse.json()).error, "TENANT_SCOPE_NOT_VERIFIED");
  assert.equal(revokeDb.calls.filter(x => x.kind === "batch").length, 0);
});

test("approval requests cannot be created for a tenant outside the authenticated manager session", async () => {
  const db = fakeDb();
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/request", {
    action: "PRODUCTION_RELEASE",
    tenantId: "another-tenant",
    resourceId: "release-1",
    payload: { commit: "abc" },
    reason: "Release review"
  }), { DB: db }, managerA);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "TENANT_SCOPE_NOT_VERIFIED");
  assert.equal(db.calls.length, 0);
});

test("approval votes cannot cross authenticated tenant boundaries", async () => {
  const db = fakeDb([{
    id: "req-other-tenant",
    requester_user_id: "manager-x",
    tenant_id: "another-tenant",
    status: "PENDING",
    expires_at: "2999-01-01T00:00:00.000Z",
    required_approvals: 2
  }]);
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/decide", {
    requestId: "req-other-tenant", decision: "APPROVE", reason: "Review"
  }), { DB: db }, managerA);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "TENANT_SCOPE_NOT_VERIFIED");
  assert.equal(db.calls.filter(x => x.kind === "batch").length, 0);
});

test("approval detail returns the exact persisted payload and recorded votes to managers", async () => {
  const db = fakeDb([{
    id: "req-detail", requester_user_id: "manager-a", tenant_id: "tenant-1",
    action: "PRICE_POLICY_CHANGE", resource_id: "policy-1", payload_hash: "a".repeat(64),
    payload_json: '{"commission":12}', amount_cents: null, currency: null,
    reason: "Review policy", risk: "HIGH", required_approvals: 2, status: "PENDING",
    expires_at: "2999-01-01T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z"
  }]);
  const response = await handleSupraApprovalRoute(new Request(
    "https://app.example/api/supra/approvals/detail?requestId=req-detail",
    { method: "GET" }
  ), { DB: db }, managerB);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.request.payload, { commission: 12 });
  assert.equal(body.request.votes[0].approver_user_id, "manager-b");
});

test("refund and payout approval requests require an integer amount and ISO currency", async () => {
  const db = fakeDb();
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/request", {
    action: "PAYOUT_EXECUTE", tenantId: "tenant-1", resourceId: "payout-1",
    payload: { payoutId: "payout-1" }, reason: "Payout review"
  }), { DB: db }, managerA);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "AMOUNT_REQUIRED_FOR_ACTION");
  assert.equal(db.calls.length, 0);
});

test("only the requester can revoke an unconsumed approval", async () => {
  const db = fakeDb([
    { requester_user_id: "manager-a", tenant_id: "tenant-1", status: "APPROVED" },
    { status: "REVOKED" }
  ]);
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/revoke", {
    requestId: "req-revoke", reason: "Release window cancelled"
  }), { DB: db }, managerA);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "REVOKED");
  assert.ok(db.calls.some(x => x.sql.includes("status IN ('PENDING','APPROVED')")));
});

test("a different manager cannot revoke another manager's request", async () => {
  const db = fakeDb([{ requester_user_id: "manager-a", tenant_id: "tenant-1", status: "PENDING" }]);
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/revoke", {
    requestId: "req-revoke", reason: "Not requester"
  }), { DB: db }, managerB);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ONLY_REQUESTER_CAN_REVOKE");
});


test("approval request body limit is enforced while streaming before D1 access", async () => {
  const db = fakeDb();
  const response = await handleSupraApprovalRoute(post("/api/supra/approvals/request", {
    action: "REFUND_ISSUE", tenantId: "tenant-1", resourceId: "refund-1",
    payload: { note: "x".repeat(17000) }, reason: "Oversize test"
  }), { DB: db }, managerA);
  assert.equal(response.status, 413);
  assert.equal(db.calls.length, 0);
});
