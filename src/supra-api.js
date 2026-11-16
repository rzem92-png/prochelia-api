import { assessSupraDecision } from "./supra-intelligence.js";
import { buildSupraPlan, getSupraDomainRegistry } from "./supra-orchestrator.js";

const MAX_BODY_BYTES = 16 * 1024;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

async function writeAudit(env, auth, event) {
  if (!env?.DB?.prepare) throw new Error("SUPRA_AUDIT_DATABASE_REQUIRED");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS supra_audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    event_type TEXT NOT NULL,
    domain TEXT NOT NULL,
    action TEXT NOT NULL,
    risk TEXT NOT NULL,
    approval_required INTEGER NOT NULL,
    execution_allowed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`INSERT INTO supra_audit_events
    (id, actor_user_id, actor_role, event_type, domain, action, risk, approval_required, execution_allowed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .bind(crypto.randomUUID(), auth.user.id, auth.user.role, event.eventType,
      event.domain, event.action, event.risk, event.approvalRequired ? 1 : 0).run();
}

export async function handleSupraRoute(request, env, auth) {
  const url = new URL(request.url);
  if (!["/api/supra/domains", "/api/supra/plan"].includes(url.pathname)) return null;

  if (!auth?.user) return reply({ ok: false, error: "UNAUTHENTICATED" }, 401);
  if (auth.user.role !== "gerante") return reply({ ok: false, error: "FORBIDDEN" }, 403);
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
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return reply({ ok: false, error: "REQUEST_TOO_LARGE" }, 413);
  }
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ ok: false, error: "INVALID_JSON" }, 400); }
  if (!isPlainRecord(body)) return reply({ ok: false, error: "INVALID_BODY" }, 400);

  const plan = buildSupraPlan(body);
  const decision = assessSupraDecision({
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

  const domain = typeof plan.domain === "string" ? plan.domain : "securite";
  const action = typeof plan.requestedAction === "string" ? plan.requestedAction : "UNKNOWN";
  const risk = typeof plan.impact === "string" ? plan.impact : "CRITICAL";
  try {
    await writeAudit(env, auth, {
      eventType: "PLAN_PREPARED",
      domain,
      action,
      risk,
      approvalRequired: plan.autonomy?.approvalRequired !== false || decision.managerApprovalRequired
    });
  } catch {
    return reply({ ok: false, error: "SUPRA_AUDIT_UNAVAILABLE", executionAllowed: false }, 503);
  }

  return reply({
    ok: true,
    engine: "PROCHELIA_NEXUS_SUPRA",
    plan,
    decision,
    audit: { recorded: true },
    executionAllowed: false
  });
}
