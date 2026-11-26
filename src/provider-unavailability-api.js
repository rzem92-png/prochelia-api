const BASE = "/api/v7/provider-unavailability";
const READ_ROLES = new Set(["OWNER", "ADMIN", "OPS", "PROVIDER", "SUPPORT", "READ_ONLY"]);
const WRITE_ROLES = new Set(["OWNER", "ADMIN", "OPS", "PROVIDER"]);
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function response(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    },
  });
}

function parseUtc(value) {
  if (typeof value !== "string" || !UTC_ISO.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function normalizeReason(value) {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length <= 120 ? reason : null;
}

async function tenantMemberships(env, userId, requestedTenantId) {
  const sql = `SELECT tm.tenant_id, tm.role, tm.status, t.status AS tenant_status
    FROM tenant_memberships tm
    JOIN tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = ? AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'${requestedTenantId ? " AND tm.tenant_id = ?" : ""}
    ORDER BY tm.tenant_id`;
  const statement = env.DB.prepare(sql);
  const result = await (requestedTenantId ? statement.bind(userId, requestedTenantId) : statement.bind(userId)).all();
  return result?.results || [];
}

async function resolveTenant(request, env, auth) {
  const userId = auth?.user?.id;
  if (!userId) return { error: response({ ok: false, error: "UNAUTHENTICATED" }, 401) };
  if (!env?.DB) return { error: response({ ok: false, error: "DATABASE_UNAVAILABLE" }, 503) };
  const requested = (request.headers.get("x-tenant-id") || "").trim();
  if (requested && requested.length > 128) return { error: response({ ok: false, error: "INVALID_TENANT_ID" }, 400) };
  let memberships;
  try {
    memberships = await tenantMemberships(env, userId, requested || null);
  } catch {
    return { error: response({ ok: false, error: "TENANT_SCHEMA_UNAVAILABLE" }, 503) };
  }
  if (requested) {
    if (!memberships.length) return { error: response({ ok: false, error: "TENANT_MEMBERSHIP_REQUIRED" }, 403) };
    return { context: { tenantId: memberships[0].tenant_id, role: memberships[0].role, userId } };
  }
  if (!memberships.length) return { error: response({ ok: false, error: "TENANT_MEMBERSHIP_REQUIRED" }, 403) };
  if (memberships.length > 1) return { error: response({ ok: false, error: "TENANT_SELECTION_REQUIRED" }, 409) };
  return { context: { tenantId: memberships[0].tenant_id, role: memberships[0].role, userId } };
}

async function providerForTenant(env, providerId, tenantId) {
  return env.DB.prepare("SELECT id FROM intervenants WHERE id = ? AND tenant_id = ? LIMIT 1").bind(providerId, tenantId).first();
}

async function ownProvider(env, userId, tenantId) {
  return env.DB.prepare("SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1").bind(userId, tenantId).first();
}

function dbError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("PROVIDER_UNAVAILABILITY_OVERLAP")) return response({ ok: false, error: "UNAVAILABILITY_CONFLICT" }, 409);
  if (message.includes("PROVIDER_TENANT_MISMATCH")) return response({ ok: false, error: "PROVIDER_TENANT_MISMATCH" }, 403);
  return response({ ok: false, error: "DATABASE_OPERATION_UNAVAILABLE" }, 503);
}

function rowDto(row) {
  return {
    id: row.id,
    providerId: row.intervenant_id,
    startAt: row.start_at,
    endAt: row.end_at,
    timeZone: row.timezone_name,
    reason: row.reason || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleProviderUnavailabilityRoute(request, env, path, auth = null) {
  if (path !== BASE && !path.startsWith(BASE + "/")) return null;
  const method = request.method.toUpperCase();
  const suffix = path.slice(BASE.length);
  if (path !== BASE && (method !== "DELETE" || !suffix.startsWith("/") || suffix.length < 2 || suffix.slice(1).includes("/"))) return response({ ok: false, error: "NOT_FOUND" }, 404);
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return response({ ok: false, error: "METHOD_NOT_ALLOWED", allowed: ["GET", "POST", "DELETE"] }, 405);
  }
  const resolved = await resolveTenant(request, env, auth);
  if (resolved.error) return resolved.error;
  const context = resolved.context;
  if (method === "GET" && !READ_ROLES.has(context.role)) return response({ ok: false, error: "FORBIDDEN" }, 403);
  if (method !== "GET" && !WRITE_ROLES.has(context.role)) return response({ ok: false, error: "FORBIDDEN" }, 403);

  try {
    if (method === "GET") {
      const url = new URL(request.url);
      const requestedProvider = (url.searchParams.get("providerId") || "").trim();
      let providerId = requestedProvider || null;
      if (context.role === "PROVIDER") {
        const own = await ownProvider(env, context.userId, context.tenantId);
        if (!own) return response({ ok: false, error: "PROVIDER_PROFILE_REQUIRED" }, 403);
        if (requestedProvider && requestedProvider !== own.id) return response({ ok: false, error: "FORBIDDEN" }, 403);
        providerId = own.id;
      } else if (providerId) {
        const provider = await providerForTenant(env, providerId, context.tenantId);
        if (!provider) return response({ ok: false, error: "PROVIDER_NOT_FOUND" }, 404);
      }
      const includeCancelled = url.searchParams.get("includeCancelled") === "true";
      if (includeCancelled && !["OWNER", "ADMIN", "OPS"].includes(context.role)) return response({ ok: false, error: "FORBIDDEN" }, 403);
      const from = url.searchParams.get("from") ? parseUtc(url.searchParams.get("from")) : null;
      const to = url.searchParams.get("to") ? parseUtc(url.searchParams.get("to")) : null;
      if ((url.searchParams.has("from") && !from) || (url.searchParams.has("to") && !to) || (from && to && from >= to)) return response({ ok: false, error: "INVALID_RANGE" }, 400);
      let sql = "SELECT id, intervenant_id, start_at, end_at, timezone_name, reason, status, created_at, updated_at FROM provider_unavailability WHERE tenant_id = ?";
      const params = [context.tenantId];
      if (!includeCancelled) sql += " AND status = 'ACTIVE'";
      if (providerId) { sql += " AND intervenant_id = ?"; params.push(providerId); }
      if (to) { sql += " AND start_at < ?"; params.push(to); }
      if (from) { sql += " AND end_at > ?"; params.push(from); }
      sql += " ORDER BY start_at LIMIT 200";
      const result = await env.DB.prepare(sql).bind(...params).all();
      return response({ ok: true, tenantId: context.tenantId, unavailability: (result?.results || []).map(rowDto), limit: 200 });
    }

    if (method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) return response({ ok: false, error: "INVALID_BODY" }, 400);
      const requestedProviderId = typeof body.providerId === "string" ? body.providerId.trim() : "";
      const startAt = parseUtc(body.startAt);
      const endAt = parseUtc(body.endAt);
      const timeZone = typeof body.timeZone === "string" ? body.timeZone.trim() : "";
      const reason = normalizeReason(body.reason);
      if (!startAt || !endAt || startAt >= endAt || !validTimeZone(timeZone) || reason === null) return response({ ok: false, error: "INVALID_UNAVAILABILITY" }, 400);
      let providerId = requestedProviderId;
      if (context.role === "PROVIDER") {
        const own = await ownProvider(env, context.userId, context.tenantId);
        if (!own) return response({ ok: false, error: "PROVIDER_PROFILE_REQUIRED" }, 403);
        if (requestedProviderId && requestedProviderId !== own.id) return response({ ok: false, error: "FORBIDDEN" }, 403);
        // Provider self-service binds the profile from authenticated identity;
        // the client may omit providerId and cannot select another profile.
        providerId = own.id;
      } else {
        if (!providerId) return response({ ok: false, error: "PROVIDER_ID_REQUIRED" }, 400);
        const provider = await providerForTenant(env, providerId, context.tenantId);
        if (!provider) return response({ ok: false, error: "PROVIDER_NOT_FOUND" }, 404);
      }
      const suppliedKey = (request.headers.get("idempotency-key") || "").trim();
      if (suppliedKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(suppliedKey)) return response({ ok: false, error: "INVALID_IDEMPOTENCY_KEY" }, 400);
      const id = suppliedKey || crypto.randomUUID();
      const insert = `INSERT INTO provider_unavailability
        (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, status, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        RETURNING id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, status, created_at, updated_at, created_by_user_id`;
      let created;
      try {
        created = await env.DB.prepare(insert).bind(id, context.tenantId, providerId, startAt, endAt, timeZone, reason, context.userId).first();
      } catch (error) {
        if (suppliedKey && (String(error?.message || error).includes("UNIQUE") || String(error?.message || error).includes("PROVIDER_UNAVAILABILITY_OVERLAP"))) {
          const existing = await env.DB.prepare("SELECT id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, status, created_at, updated_at, created_by_user_id FROM provider_unavailability WHERE id = ? AND tenant_id = ? LIMIT 1").bind(id, context.tenantId).first();
          if (existing && existing.created_by_user_id === context.userId && existing.intervenant_id === providerId && existing.start_at === startAt && existing.end_at === endAt && existing.timezone_name === timeZone && existing.reason === reason) return response({ ok: true, idempotent: true, unavailability: rowDto(existing) }, 200);
          if (existing) return response({ ok: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409);
        }
        throw error;
      }
      if (!created) return response({ ok: false, error: "CREATION_NOT_CONFIRMED" }, 503);
      return response({ ok: true, unavailability: rowDto(created) }, 201);
    }

    const id = path.slice(BASE.length + 1).trim();
    if (!id || id.includes("/")) return response({ ok: false, error: "INVALID_ID" }, 400);
    if (context.role === "PROVIDER") {
      const own = await ownProvider(env, context.userId, context.tenantId);
      if (!own) return response({ ok: false, error: "PROVIDER_PROFILE_REQUIRED" }, 403);
      const result = await env.DB.prepare("UPDATE provider_unavailability SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ? AND intervenant_id = ? AND status = 'ACTIVE'").bind(id, context.tenantId, own.id).run();
      if (!Number(result?.meta?.changes || 0)) return response({ ok: false, error: "UNAVAILABILITY_NOT_FOUND" }, 404);
    } else {
      const result = await env.DB.prepare("UPDATE provider_unavailability SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE'").bind(id, context.tenantId).run();
      if (!Number(result?.meta?.changes || 0)) return response({ ok: false, error: "UNAVAILABILITY_NOT_FOUND" }, 404);
    }
    const cancelled = await env.DB.prepare("SELECT id, intervenant_id, start_at, end_at, timezone_name, reason, status, created_at, updated_at FROM provider_unavailability WHERE id = ? AND tenant_id = ? LIMIT 1").bind(id, context.tenantId).first();
    return response({ ok: true, unavailability: cancelled ? rowDto(cancelled) : null });
  } catch (error) {
    return dbError(error);
  }
}
