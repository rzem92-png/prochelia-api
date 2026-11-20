// Persisted human approvals for Nexus Supra. No sensitive action executor is exposed here.
const MAX_BODY_BYTES = 16 * 1024;
const APPROVAL_TTL_MS = 15 * 60 * 1000;
const ACTION_RISK = Object.freeze({
  PRICE_POLICY_CHANGE: "HIGH",
  PRICING_TARIFF_ACTIVATION: "HIGH",
  DATA_EXPORT: "HIGH",
  ACCOUNT_SUSPEND: "HIGH",
  REFUND_ISSUE: "HIGH",
  CONTRACT_SIGN: "HIGH",
  PRODUCTION_RELEASE: "CRITICAL",
  PAYMENT_ENABLE: "CRITICAL",
  PAYOUT_EXECUTE: "CRITICAL",
  GDPR_ERASURE: "CRITICAL"
});
const ACTION_AMOUNT_REQUIRED = new Set(["REFUND_ISSUE", "PAYOUT_EXECUTE"]);

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("INVALID_PAYLOAD_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (!isPlainRecord(value)) throw new Error("INVALID_PAYLOAD_TYPE");
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function manager(auth) {
  return !!auth?.user?.id &&
    String(auth.user.role || "").toUpperCase() === "GERANTE" &&
    ["OWNER", "ADMIN", "MANAGER"].includes(String(auth.user.tenant_role || "").toUpperCase()) &&
    typeof auth.user.tenant_id === "string" && auth.user.tenant_id.length > 0;
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}


async function readLimitedText(request, maxBytes) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) return { error: "TOO_LARGE" };
  if (!request.body) return { text: "" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      return { error: "TOO_LARGE" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) }; }
  catch { return { error: "INVALID_UTF8" }; }
}

async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return { error: reply({ ok: false, error: "JSON_CONTENT_TYPE_REQUIRED" }, 415) };
  }
  const bounded = await readLimitedText(request, MAX_BODY_BYTES);
  if (bounded.error === "TOO_LARGE") return { error: reply({ ok: false, error: "REQUEST_TOO_LARGE" }, 413) };
  if (bounded.error) return { error: reply({ ok: false, error: "INVALID_UTF8" }, 400) };
  try {
    const value = JSON.parse(bounded.text);
    return isPlainRecord(value) ? { value } : { error: reply({ ok: false, error: "INVALID_BODY" }, 400) };
  } catch {
    return { error: reply({ ok: false, error: "INVALID_JSON" }, 400) };
  }
}

async function appendEvent(env, requestId, actor, eventType, details = {}) {
  const result = await env.DB.prepare(`INSERT INTO supra_approval_events
    (id, request_id, actor_user_id, actor_role, event_type, details_json)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), requestId, actor.user.id, String(actor.user.role).toUpperCase(),
      eventType, JSON.stringify(details)).run();
  if (result?.success !== true) throw new Error("SUPRA_APPROVAL_EVENT_WRITE_UNCONFIRMED");
}

export async function handleSupraApprovalRoute(request, env, auth) {
  const path = new URL(request.url).pathname;
  if (!["/api/supra/approvals/request", "/api/supra/approvals/decide", "/api/supra/approvals/detail", "/api/supra/approvals/revoke"].includes(path)) return null;
  if (!manager(auth)) return reply({ ok: false, error: auth?.user ? "FORBIDDEN" : "UNAUTHENTICATED" }, auth?.user ? 403 : 401);
  if (!env?.DB?.prepare) return reply({ ok: false, error: "DATABASE_UNAVAILABLE" }, 503);
  if (path.endsWith("/revoke")) {
    if (request.method !== "POST") return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    if (!sameOrigin(request)) return reply({ ok: false, error: "ORIGIN_CHECK_FAILED" }, 403);
    const parsed = await readBody(request);
    if (parsed.error) return parsed.error;
    const requestId = typeof parsed.value.requestId === "string" ? parsed.value.requestId.trim() : "";
    const reason = typeof parsed.value.reason === "string" ? parsed.value.reason.trim() : "";
    if (!requestId || requestId.length > 128 || !reason || reason.length > 1000) return reply({ ok: false, error: "INVALID_REVOCATION" }, 400);
    try {
      const now = new Date().toISOString();
      const row = await env.DB.prepare("SELECT requester_user_id, tenant_id, status FROM supra_approval_requests WHERE id=? LIMIT 1").bind(requestId).first();
      if (!row) return reply({ ok: false, error: "APPROVAL_NOT_FOUND" }, 404);
      if (row.tenant_id !== auth.user.tenant_id) return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
      if (typeof auth.user.tenant_id !== "string" || row.tenant_id !== auth.user.tenant_id) return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
      if (row.requester_user_id !== auth.user.id) return reply({ ok: false, error: "ONLY_REQUESTER_CAN_REVOKE" }, 403);
      if (!["PENDING", "APPROVED"].includes(row.status)) return reply({ ok: false, error: "APPROVAL_NOT_REVOCABLE" }, 409);
      await env.DB.batch([
        env.DB.prepare("UPDATE supra_approval_requests SET status='REVOKED' WHERE id=? AND requester_user_id=? AND status IN ('PENDING','APPROVED') AND expires_at>?").bind(requestId, auth.user.id, now),
        env.DB.prepare("INSERT INTO supra_approval_events (id, request_id, actor_user_id, actor_role, event_type, details_json) SELECT ?, ?, ?, 'GERANTE', 'REVOKED', ? WHERE EXISTS (SELECT 1 FROM supra_approval_requests WHERE id=? AND status='REVOKED') AND NOT EXISTS (SELECT 1 FROM supra_approval_events WHERE request_id=? AND event_type='REVOKED')").bind(crypto.randomUUID(), requestId, auth.user.id, JSON.stringify({ reason }), requestId, requestId)
      ]);
      const current = await env.DB.prepare("SELECT status FROM supra_approval_requests WHERE id=?").bind(requestId).first();
      return current?.status === "REVOKED" ? reply({ ok: true, requestId, status: "REVOKED" }) : reply({ ok: false, error: "APPROVAL_NOT_REVOCABLE" }, 409);
    } catch {
      return reply({ ok: false, error: "APPROVAL_REVOCATION_FAILED" }, 503);
    }
  }
  if (path.endsWith("/detail")) {
    if (request.method !== "GET") return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return reply({ ok: false, error: "ORIGIN_CHECK_FAILED" }, 403);
    const requestId = new URL(request.url).searchParams.get("requestId") || "";
    if (!requestId || requestId.length > 128) return reply({ ok: false, error: "INVALID_REQUEST_ID" }, 400);
    try {
      const item = await env.DB.prepare("SELECT id, requester_user_id, tenant_id, action, resource_id, payload_hash, payload_json, amount_cents, currency, reason, risk, required_approvals, status, expires_at, created_at, approved_at, consumed_at, consumed_by FROM supra_approval_requests WHERE id=? LIMIT 1").bind(requestId).first();
      if (!item) return reply({ ok: false, error: "APPROVAL_NOT_FOUND" }, 404);
      if (item.tenant_id !== auth.user.tenant_id) return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
      const votes = await env.DB.prepare("SELECT approver_user_id, approver_role, decision, reason, created_at FROM supra_approval_votes WHERE request_id=? ORDER BY created_at, id").bind(requestId).all();
      if (votes?.success !== true || !Array.isArray(votes.results)) {
        return reply({ ok: false, error: "APPROVAL_LEDGER_UNAVAILABLE" }, 503);
      }
      let payload;
      try { payload = JSON.parse(item.payload_json); } catch { return reply({ ok: false, error: "APPROVAL_PAYLOAD_CORRUPT" }, 503); }
      return reply({ ok: true, request: { ...item, payload, votes: votes.results } });
    } catch {
      return reply({ ok: false, error: "APPROVAL_LEDGER_UNAVAILABLE" }, 503);
    }
  }
  if (request.method !== "POST") return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!sameOrigin(request)) return reply({ ok: false, error: "ORIGIN_CHECK_FAILED" }, 403);
  const parsed = await readBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.value;

  if (path.endsWith("/request")) {
    if (typeof auth.user.tenant_id !== "string" || !auth.user.tenant_id.trim() || body.tenantId !== auth.user.tenant_id) return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
    const action = typeof body.action === "string" ? body.action.trim().toUpperCase() : "";
    const risk = ACTION_RISK[action];
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!risk || !tenantId || tenantId.length > 128 || !resourceId || resourceId.length > 128 ||
        !reason || reason.length > 1000 || !isPlainRecord(body.payload)) {
      return reply({ ok: false, error: "INVALID_APPROVAL_REQUEST" }, 400);
    }
    if (typeof auth.user.tenant_id !== "string" || !auth.user.tenant_id.trim() || tenantId !== auth.user.tenant_id) {
      return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
    }
    const hasAmount = body.amountCents !== undefined && body.amountCents !== null;
    if (ACTION_AMOUNT_REQUIRED.has(action) && !hasAmount) return reply({ ok: false, error: "AMOUNT_REQUIRED_FOR_ACTION" }, 400);
    if (hasAmount && (!Number.isSafeInteger(body.amountCents) || body.amountCents < 0 ||
        typeof body.currency !== "string" || !/^[A-Z]{3}$/.test(body.currency))) {
      return reply({ ok: false, error: "INVALID_AMOUNT_OR_CURRENCY" }, 400);
    }
    let payloadHash, payloadJson;
    try { payloadJson = canonicalJson(body.payload); payloadHash = await sha256Hex(payloadJson); }
    catch { return reply({ ok: false, error: "INVALID_PAYLOAD" }, 400); }

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();
    const requiredApprovals = risk === "HIGH" || risk === "CRITICAL" ? 2 : 1;
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO supra_approval_requests
          (id, requester_user_id, tenant_id, action, resource_id, payload_hash, payload_json, amount_cents,
           currency, reason, risk, required_approvals, status, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`)
          .bind(id, auth.user.id, tenantId, action, resourceId, payloadHash, payloadJson,
            hasAmount ? body.amountCents : null, hasAmount ? body.currency : null,
            reason, risk, requiredApprovals, expiresAt),
        env.DB.prepare(`INSERT INTO supra_approval_events
          (id, request_id, actor_user_id, actor_role, event_type, details_json)
          VALUES (?, ?, ?, ?, 'REQUESTED', ?)`)
          .bind(crypto.randomUUID(), id, auth.user.id, "GERANTE",
            JSON.stringify({ action, resourceId, tenantId, payloadHash, risk, requiredApprovals }))
      ]);
    } catch {
      return reply({ ok: false, error: "APPROVAL_LEDGER_WRITE_FAILED" }, 503);
    }
    return reply({ ok: true, request: { id, action, resourceId, tenantId, payloadHash, risk, requiredApprovals, status: "PENDING", expiresAt } }, 201);
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const decision = typeof body.decision === "string" ? body.decision.trim().toUpperCase() : "APPROVE";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!requestId || requestId.length > 128 || !["APPROVE", "REJECT"].includes(decision) || !reason || reason.length > 1000) {
    return reply({ ok: false, error: "INVALID_APPROVAL_DECISION" }, 400);
  }

  let approval;
  try {
    approval = await env.DB.prepare(`SELECT id, requester_user_id, tenant_id, status, expires_at, required_approvals
      FROM supra_approval_requests WHERE id=? LIMIT 1`).bind(requestId).first();
  } catch {
    return reply({ ok: false, error: "APPROVAL_LEDGER_UNAVAILABLE" }, 503);
  }
  if (!approval) return reply({ ok: false, error: "APPROVAL_NOT_FOUND" }, 404);
  if (approval.tenant_id !== auth.user.tenant_id) return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
  if (typeof auth.user.tenant_id !== "string" || approval.tenant_id !== auth.user.tenant_id) {
    return reply({ ok: false, error: "TENANT_SCOPE_NOT_VERIFIED" }, 403);
  }
  if (approval.requester_user_id === auth.user.id) return reply({ ok: false, error: "SELF_APPROVAL_FORBIDDEN" }, 403);
  if (approval.status !== "PENDING") return reply({ ok: false, error: "APPROVAL_NOT_PENDING" }, 409);
  const now = new Date().toISOString();
  if (approval.expires_at <= now) {
    try {
      await env.DB.batch([
        env.DB.prepare("UPDATE supra_approval_requests SET status='EXPIRED' WHERE id=? AND status='PENDING' AND expires_at<=?").bind(requestId, now),
        env.DB.prepare(`INSERT INTO supra_approval_events
          (id, request_id, actor_user_id, actor_role, event_type, details_json)
          SELECT ?, ?, ?, 'GERANTE', 'EXPIRED', '{}'
           WHERE EXISTS (SELECT 1 FROM supra_approval_requests WHERE id=? AND status='EXPIRED')
             AND NOT EXISTS (SELECT 1 FROM supra_approval_events WHERE request_id=? AND event_type='EXPIRED')`).bind(crypto.randomUUID(), requestId, auth.user.id, requestId, requestId)
      ]);
    } catch {
      return reply({ ok: false, error: "APPROVAL_EXPIRY_WRITE_FAILED" }, 503);
    }
    return reply({ ok: false, error: "APPROVAL_EXPIRED" }, 409);
  }

  try {
    const batch = [
      env.DB.prepare(`INSERT INTO supra_approval_votes
        (id, request_id, approver_user_id, approver_role, decision, reason)
        SELECT ?, id, ?, 'GERANTE', ?, ?
          FROM supra_approval_requests
         WHERE id=? AND status='PENDING' AND expires_at>? AND requester_user_id<>?`)
        .bind(crypto.randomUUID(), auth.user.id, decision, reason, requestId, now, auth.user.id),
      env.DB.prepare(`UPDATE supra_approval_requests SET status='REJECTED'
        WHERE id=? AND status='PENDING' AND EXISTS
          (SELECT 1 FROM supra_approval_votes WHERE request_id=? AND approver_user_id=? AND decision='REJECT')`)
        .bind(requestId, requestId, auth.user.id),
      env.DB.prepare(`UPDATE supra_approval_requests SET status='APPROVED', approved_at=?
        WHERE id=? AND status='PENDING' AND expires_at>?
          AND (SELECT COUNT(*) FROM supra_approval_votes WHERE request_id=? AND decision='APPROVE')>=required_approvals`)
        .bind(now, requestId, now, requestId),
      env.DB.prepare(`INSERT INTO supra_approval_events
        (id, request_id, actor_user_id, actor_role, event_type, details_json)
        SELECT ?, ?, ?, 'GERANTE', 'VOTE_RECORDED', ?
         WHERE EXISTS (SELECT 1 FROM supra_approval_votes WHERE request_id=? AND approver_user_id=?)`)
        .bind(crypto.randomUUID(), requestId, auth.user.id, JSON.stringify({ decision }), requestId, auth.user.id),
      env.DB.prepare(`INSERT INTO supra_approval_events
        (id, request_id, actor_user_id, actor_role, event_type, details_json)
        SELECT ?, ?, ?, 'GERANTE', 'APPROVED', '{}'
         WHERE EXISTS (SELECT 1 FROM supra_approval_requests WHERE id=? AND status='APPROVED')
           AND NOT EXISTS (SELECT 1 FROM supra_approval_events WHERE request_id=? AND event_type='APPROVED')`)
        .bind(crypto.randomUUID(), requestId, auth.user.id, requestId, requestId),
      env.DB.prepare(`INSERT INTO supra_approval_events
        (id, request_id, actor_user_id, actor_role, event_type, details_json)
        SELECT ?, ?, ?, 'GERANTE', 'REJECTED', '{}'
         WHERE EXISTS (SELECT 1 FROM supra_approval_requests WHERE id=? AND status='REJECTED')
           AND NOT EXISTS (SELECT 1 FROM supra_approval_events WHERE request_id=? AND event_type='REJECTED')`)
        .bind(crypto.randomUUID(), requestId, auth.user.id, requestId, requestId)
    ];
    await env.DB.batch(batch);
  } catch (error) {
    const message = String(error?.message || "");
    if (/UNIQUE|constraint/i.test(message)) return reply({ ok: false, error: "DUPLICATE_OR_CONCURRENT_APPROVAL" }, 409);
    return reply({ ok: false, error: "APPROVAL_DECISION_WRITE_FAILED" }, 503);
  }
  const current = await env.DB.prepare("SELECT status, required_approvals FROM supra_approval_requests WHERE id=?").bind(requestId).first();
  const votes = await env.DB.prepare("SELECT COUNT(*) AS count FROM supra_approval_votes WHERE request_id=? AND decision='APPROVE'").bind(requestId).first();
  return reply({ ok: true, requestId, status: current?.status || "PENDING", approvalCount: Number(votes?.count || 0), requiredApprovals: Number(current?.required_approvals || 0) });
}

// Internal server-only primitive. Do not expose this as a browser route.
// The caller must supply values derived from the server-side action immediately before execution.
export async function consumeSupraApproval(env, input) {
  if (!env?.DB?.prepare || !isPlainRecord(input) || !isPlainRecord(input.payload)) {
    return { ok: false, error: "INVALID_CONSUMPTION_CONTEXT" };
  }
  const required = ["requestId", "actorUserId", "actorRole", "tenantId", "resourceId", "action"];
  if (required.some(key => typeof input[key] !== "string" || !input[key].trim())) {
    return { ok: false, error: "INVALID_CONSUMPTION_CONTEXT" };
  }
  const action = input.action.trim().toUpperCase();
  if (!ACTION_RISK[action]) return { ok: false, error: "ACTION_NOT_APPROVABLE" };
  let payloadHash;
  try { payloadHash = await sha256Hex(canonicalJson(input.payload)); }
  catch { return { ok: false, error: "INVALID_PAYLOAD" }; }
  const now = new Date().toISOString();
  const amount = input.amountCents === undefined || input.amountCents === null ? null : input.amountCents;
  const currency = amount === null ? null : input.currency;
  if (ACTION_AMOUNT_REQUIRED.has(action) && amount === null) return { ok: false, error: "AMOUNT_REQUIRED_FOR_ACTION" };
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency))) {
    return { ok: false, error: "INVALID_AMOUNT_OR_CURRENCY" };
  }
  try {
    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE supra_approval_requests SET status='CONSUMED', consumed_at=?, consumed_by=?
        WHERE id=? AND status='APPROVED' AND expires_at>?
          AND tenant_id=? AND resource_id=? AND action=? AND payload_hash=?
          AND ((amount_cents IS NULL AND ? IS NULL) OR amount_cents=?)
          AND ((currency IS NULL AND ? IS NULL) OR currency=?)`)
        .bind(now, input.actorUserId, input.requestId, now, input.tenantId, input.resourceId,
          action, payloadHash, amount, amount, currency, currency),
      env.DB.prepare(`INSERT INTO supra_approval_events
        (id, request_id, actor_user_id, actor_role, event_type, details_json)
        SELECT ?, ?, ?, ?, 'CONSUMED', ?
         WHERE EXISTS (SELECT 1 FROM supra_approval_requests WHERE id=? AND status='CONSUMED' AND consumed_by=? AND consumed_at=?)`)
        .bind(crypto.randomUUID(), input.requestId, input.actorUserId, String(input.actorRole).toUpperCase(),
          JSON.stringify({ action, resourceId: input.resourceId, tenantId: input.tenantId, payloadHash }),
          input.requestId, input.actorUserId, now)
    ]);
    const changes = Number(results?.[0]?.meta?.changes ?? results?.[0]?.changes ?? 0);
    if (changes !== 1) return { ok: false, error: "APPROVAL_NOT_MATCHED_OR_ALREADY_CONSUMED" };
    return { ok: true, requestId: input.requestId, consumedAt: now };
  } catch {
    return { ok: false, error: "APPROVAL_CONSUMPTION_FAILED" };
  }
}
