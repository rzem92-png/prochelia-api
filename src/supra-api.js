import { assessSupraDecision } from "./supra-intelligence.js";
import { buildSupraPlan, getSupraDomainRegistry } from "./supra-orchestrator.js";
import { handleSupraApprovalRoute } from "./supra-approvals.js";

const MAX_BODY_BYTES = 16 * 1024;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
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

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

async function writeAudit(env, auth, event) {
  if (!env?.DB?.prepare) throw new Error("SUPRA_AUDIT_DATABASE_REQUIRED");
  const tenantId = typeof auth?.user?.tenant_id === "string" ? auth.user.tenant_id : "";
  if (!tenantId) throw new Error("SUPRA_AUDIT_TENANT_REQUIRED");
  const result = await env.DB.prepare(`INSERT INTO supra_audit_events
    (id, tenant_id, actor_user_id, actor_role, event_type, domain, action, risk, approval_required, execution_allowed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .bind(crypto.randomUUID(), tenantId, auth.user.id, auth.user.role, event.eventType,
      event.domain, event.action, event.risk, event.approvalRequired ? 1 : 0).run();
  if (result?.success !== true) throw new Error("SUPRA_AUDIT_WRITE_UNCONFIRMED");
}

export async function handleSupraRoute(request, env, auth) {
  const approvalResponse = await handleSupraApprovalRoute(request, env, auth);
  if (approvalResponse) return approvalResponse;
  const url = new URL(request.url);
  if (!["/api/supra/domains", "/api/supra/plan"].includes(url.pathname)) return null;

  if (!auth?.user) return reply({ ok: false, error: "UNAUTHENTICATED" }, 401);
  if (String(auth.user.role || "").toUpperCase() !== "GERANTE" ||
      !["OWNER", "ADMIN", "MANAGER"].includes(String(auth.user.tenant_role || "").toUpperCase())) {
    return reply({ ok: false, error: "FORBIDDEN" }, 403);
  }
  if (!env?.DB?.prepare) return reply({ ok: false, error: "DATABASE_UNAVAILABLE" }, 503);

  if (url.pathname === "/api/supra/domains") {
    if (request.method !== "GET") return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    return reply({ ok: true, domains: getSupraDomainRegistry() });
  }

  if (request.method !== "POST") return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return reply({ ok: false, error: "JSON_CONTENT_TYPE_REQUIRED" }, 415);
  }
  const bounded = await readLimitedText(request, MAX_BODY_BYTES);
  if (bounded.error === "TOO_LARGE") return reply({ ok: false, error: "REQUEST_TOO_LARGE" }, 413);
  if (bounded.error) return reply({ ok: false, error: "INVALID_UTF8" }, 400);
  let body;
  try { body = JSON.parse(bounded.text); } catch { return reply({ ok: false, error: "INVALID_JSON" }, 400); }
  if (!isPlainRecord(body)) return reply({ ok: false, error: "INVALID_BODY" }, 400);

  const plan = buildSupraPlan(body);
  const rejected = typeof plan.rejectionReason === "string" && plan.rejectionReason.length > 0;
  const decision = rejected ? assessSupraDecision(null) : assessSupraDecision({
    caseType: body.caseType,
    impact: body.impact,
    requestedAction: body.requestedAction,
    actorRole: auth.user.role,
    context: isPlainRecord(body.context) ? {
      ...(body.context.mission_id !== undefined ? { mission_id: body.context.mission_id } : {}),
      ...(body.context.provider_id !== undefined ? { provider_id: body.context.provider_id } : {}),
      ...(body.context.replacement_intervenant_id !== undefined ? { replacement_intervenant_id: body.context.replacement_intervenant_id } : {}),
      ...(body.context.client_id !== undefined ? { client_id: body.context.client_id } : {}),
      ...(body.context.immediateDanger !== undefined ? { immediateDanger: body.context.immediateDanger } : {})
    } : undefined
  });

  const domain = rejected ? "securite" : (typeof plan.domain === "string" ? plan.domain : "securite");
  const action = rejected ? "INVALID_INPUT" : (typeof plan.requestedAction === "string" ? plan.requestedAction : "UNKNOWN");
  const risk = rejected ? "HIGH" : (typeof decision.risk === "string" ? decision.risk : "CRITICAL");
  try {
    await writeAudit(env, auth, {
      eventType: rejected ? "PLAN_INPUT_REJECTED" : "PLAN_PREPARED",
      domain,
      action,
      risk,
      approvalRequired: rejected || plan.autonomy?.approvalRequired !== false || decision.managerApprovalRequired
    });
  } catch {
    return reply({ ok: false, error: "SUPRA_AUDIT_UNAVAILABLE", executionAllowed: false }, 503);
  }

  return reply({
    ok: !rejected,
    ...(rejected ? { error: "SUPRA_INPUT_REJECTED" } : {}),
    engine: "PROCHELIA_NEXUS_SUPRA",
    plan,
    decision,
    audit: { recorded: true },
    executionAllowed: false
  }, rejected ? 422 : 200);
}
