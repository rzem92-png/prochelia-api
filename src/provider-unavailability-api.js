const VERSION = "PROCHÉLIA-UNAVAILABILITY-API-1";

function response(body, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{8,180}$/.test(value);
}

function validUtc(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

async function readJsonLimited(request, limit = 4096) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > limit) return { ok: false, tooLarge: true };
  try {
    const text = await request.text();
    if (text.length > limit) return { ok: false, tooLarge: true };
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function resolveProviderTenant(env, auth) {
  if (!env?.DB || !auth?.user?.id || !auth?.session_id) {
    return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };
  }
  try {
    const result = await env.DB.prepare(`
      SELECT t.id AS tenant_id, m.role AS membership_role
        FROM sessions s
        JOIN tenant_memberships m ON m.user_id = s.user_id
        JOIN tenants t ON t.id = m.tenant_id
       WHERE s.id = ?
         AND s.user_id = ?
         AND s.expires_at > CURRENT_TIMESTAMP
         AND m.status = 'ACTIVE'
         AND t.status = 'ACTIVE'
       ORDER BY t.id
       LIMIT 2
    `).bind(auth.session_id, auth.user.id).all();
    if (result?.success !== true || !Array.isArray(result.results)) {
      return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };
    }
    if (result.results.length === 0) return { ok: false, status: 403, error: "TENANT_MEMBERSHIP_REQUIRED" };
    if (result.results.length > 1) return { ok: false, status: 409, error: "TENANT_SELECTION_REQUIRED" };
    const row = result.results[0];
    if (row.membership_role !== "PROVIDER") return { ok: false, status: 403, error: "PROVIDER_MEMBERSHIP_REQUIRED" };
    return { ok: true, tenant_id: row.tenant_id };
  } catch {
    return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };
  }
}

async function resolveProviderProfile(env, auth, tenantId) {
  try {
    const row = await env.DB.prepare(
      "SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1"
    ).bind(auth.user.id, tenantId).first();
    if (!row?.id) return { ok: false, status: 404, error: "INTERVENANT_PROFILE_NOT_FOUND" };
    return { ok: true, profile_id: row.id };
  } catch {
    return { ok: false, status: 503, error: "INTERVENANT_PROFILE_SCHEMA_UNAVAILABLE" };
  }
}

async function schemaReady(env) {
  try {
    const result = await env.DB.prepare("PRAGMA table_info(provider_unavailability)").all();
    if (result?.success !== true || !Array.isArray(result.results)) return false;
    const names = result.results.map(column => column.name);
    return [
      "id", "tenant_id", "intervenant_id", "start_at", "end_at", "timezone_name",
      "reason", "status", "created_by_user_id", "created_at", "updated_at", "idempotency_key"
    ].every(name => names.includes(name));
  } catch {
    return false;
  }
}

function normalizeInterval(body) {
  if (!validUtc(body?.start_at) || !validUtc(body?.end_at)) return null;
  const startMs = Date.parse(body.start_at);
  const endMs = Date.parse(body.end_at);
  const now = Date.now();
  if (startMs < now + 5 * 60 * 1000 || endMs <= startMs ||
      endMs - startMs > 366 * 24 * 60 * 60 * 1000 ||
      startMs > now + 366 * 24 * 60 * 60 * 1000) return null;
  return { start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString() };
}

function samePayload(existing, payload) {
  return Date.parse(existing.start_at) === Date.parse(payload.start_at) &&
    Date.parse(existing.end_at) === Date.parse(payload.end_at) &&
    existing.timezone_name === payload.timezone_name &&
    (existing.reason || "") === payload.reason;
}

export async function handleProviderUnavailabilityRoute(request, env, auth) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/intervenant/unavailability") return null;
  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    return response({ ok: false, error: "METHOD_NOT_ALLOWED", version: VERSION }, 405);
  }
  if (!auth?.user || !auth.session_id) return response({ ok: false, error: "UNAUTHENTICATED", version: VERSION }, 401);
  if (auth.user.role !== "intervenant") return response({ ok: false, error: "FORBIDDEN", version: VERSION }, 403);
  if (!env?.DB) return response({ ok: false, error: "DATABASE_UNAVAILABLE", version: VERSION }, 503);

  const tenant = await resolveProviderTenant(env, auth);
  if (!tenant.ok) return response({ ok: false, error: tenant.error, version: VERSION }, tenant.status);
  const profile = await resolveProviderProfile(env, auth, tenant.tenant_id);
  if (!profile.ok) return response({ ok: false, error: profile.error, version: VERSION }, profile.status);
  if (!(await schemaReady(env))) {
    return response({ ok: false, error: "PROVIDER_UNAVAILABILITY_SCHEMA_UNAVAILABLE", version: VERSION, write_enabled: false }, 503);
  }

  if (request.method === "GET") {
    const status = url.searchParams.get("status") || "ACTIVE";
    if (!["ACTIVE", "CANCELLED", "ALL"].includes(status)) {
      return response({ ok: false, error: "INVALID_STATUS", version: VERSION }, 400);
    }
    try {
      const query = status === "ALL"
        ? `SELECT id, start_at, end_at, timezone_name, reason, status, created_at, updated_at
             FROM provider_unavailability
            WHERE tenant_id = ? AND intervenant_id = ?
            ORDER BY start_at ASC LIMIT 100`
        : `SELECT id, start_at, end_at, timezone_name, reason, status, created_at, updated_at
             FROM provider_unavailability
            WHERE tenant_id = ? AND intervenant_id = ? AND status = ?
            ORDER BY start_at ASC LIMIT 100`;
      const result = status === "ALL"
        ? await env.DB.prepare(query).bind(tenant.tenant_id, profile.profile_id).all()
        : await env.DB.prepare(query).bind(tenant.tenant_id, profile.profile_id, status).all();
      if (result?.success !== true || !Array.isArray(result.results)) throw new Error("READ_FAILED");
      return response({ ok: true, read_only: true, version: VERSION, unavailability: result.results });
    } catch {
      return response({ ok: false, error: "PROVIDER_UNAVAILABILITY_READ_REJECTED", version: VERSION }, 503);
    }
  }

  if (request.method === "POST") {
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return response({ ok: false, error: "JSON_REQUIRED", version: VERSION }, 415);
    }
    const parsed = await readJsonLimited(request);
    if (!parsed.ok) return response({ ok: false, error: parsed.tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_JSON", version: VERSION }, parsed.tooLarge ? 413 : 400);
    const interval = normalizeInterval(parsed.value);
    const timezone = parsed.value?.timezone_name;
    const reason = typeof parsed.value?.reason === "string" ? parsed.value.reason.trim() : "";
    if (!interval || !validTimeZone(timezone) || reason.length > 120) {
      return response({ ok: false, error: "INVALID_UNAVAILABILITY_INPUT", version: VERSION }, 400);
    }
    const key = String(request.headers.get("Idempotency-Key") || request.headers.get("X-Idempotency-Key") || "").trim();
    if (!validId(key)) return response({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED", version: VERSION }, 400);
    const payload = { ...interval, timezone_name: timezone, reason };
    try {
      const previous = await env.DB.prepare(
        `SELECT id, start_at, end_at, timezone_name, reason, status
           FROM provider_unavailability
          WHERE tenant_id = ? AND intervenant_id = ? AND idempotency_key = ? LIMIT 1`
      ).bind(tenant.tenant_id, profile.profile_id, key).first();
      if (previous) {
        if (!samePayload(previous, payload)) return response({ ok: false, error: "IDEMPOTENCY_KEY_CONFLICT", version: VERSION }, 409);
        return response({ ok: true, idempotent_replay: true, version: VERSION, unavailability: previous }, 200);
      }
      const id = "unavailability-" + crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO provider_unavailability
          (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, status, created_by_user_id, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
      ).bind(id, tenant.tenant_id, profile.profile_id, payload.start_at, payload.end_at,
        payload.timezone_name, payload.reason, auth.user.id, key).run();
      return response({ ok: true, version: VERSION, unavailability: { id, ...payload, status: "ACTIVE" } }, 201);
    } catch (error) {
      if (String(error?.message || error).includes("PROVIDER_UNAVAILABILITY_OVERLAP")) {
        return response({ ok: false, error: "UNAVAILABILITY_OVERLAP", version: VERSION }, 409);
      }
      // Resolve a concurrent idempotent replay if the unique index rejected it.
      try {
        const replay = await env.DB.prepare(
          `SELECT id, start_at, end_at, timezone_name, reason, status
             FROM provider_unavailability
            WHERE tenant_id = ? AND intervenant_id = ? AND idempotency_key = ? LIMIT 1`
        ).bind(tenant.tenant_id, profile.profile_id, key).first();
        if (replay) {
          if (samePayload(replay, payload)) return response({ ok: true, idempotent_replay: true, version: VERSION, unavailability: replay }, 200);
          return response({ ok: false, error: "IDEMPOTENCY_KEY_CONFLICT", version: VERSION }, 409);
        }
      } catch {}
      return response({ ok: false, error: "PROVIDER_UNAVAILABILITY_WRITE_REJECTED", version: VERSION }, 503);
    }
  }

  const id = String(url.searchParams.get("id") || "").trim();
  if (!validId(id)) return response({ ok: false, error: "UNAVAILABILITY_ID_REQUIRED", version: VERSION }, 400);
  try {
    const existing = await env.DB.prepare(
      `SELECT id, start_at, status FROM provider_unavailability
        WHERE id = ? AND tenant_id = ? AND intervenant_id = ? LIMIT 1`
    ).bind(id, tenant.tenant_id, profile.profile_id).first();
    if (!existing) return response({ ok: false, error: "UNAVAILABILITY_NOT_FOUND", version: VERSION }, 404);
    if (existing.status === "CANCELLED") return response({ ok: true, idempotent_replay: true, version: VERSION, unavailability: { id, status: "CANCELLED" } });
    if (existing.status !== "ACTIVE" || Date.parse(existing.start_at) <= Date.now()) {
      return response({ ok: false, error: "UNAVAILABILITY_NOT_CANCELLABLE", version: VERSION }, 409);
    }
    const result = await env.DB.prepare(
      `UPDATE provider_unavailability SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ? AND intervenant_id = ? AND status = 'ACTIVE'
          AND start_at > ?`
    ).bind(id, tenant.tenant_id, profile.profile_id, new Date().toISOString()).run();
    if (Number(result?.meta?.changes || 0) !== 1) return response({ ok: false, error: "UNAVAILABILITY_NOT_CANCELLABLE", version: VERSION }, 409);
    return response({ ok: true, version: VERSION, unavailability: { id, status: "CANCELLED" } });
  } catch {
    return response({ ok: false, error: "PROVIDER_UNAVAILABILITY_CANCEL_REJECTED", version: VERSION }, 503);
  }
}
