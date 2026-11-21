// Resolve tenant exclusively from the authenticated server-side session.
// Caller-controlled tenant headers, query parameters and JSON bodies are never authority.
export async function resolveTenantContext(_request, env, auth) {
  const userId = auth?.user?.id;
  const sessionId = auth?.session_id;
  if (!userId || !sessionId) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  if (!env?.DB) return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };

  try {
    const activeTenantId = auth.session_active_tenant_id || null;
    if (activeTenantId) {
      const row = await env.DB.prepare(`
        SELECT t.id AS tenant_id, t.slug AS tenant_slug, t.display_name AS tenant_name,
               m.id AS membership_id, m.role AS membership_role
          FROM sessions s
          JOIN tenant_memberships m ON m.user_id = s.user_id AND m.tenant_id = s.active_tenant_id
          JOIN tenants t ON t.id = m.tenant_id
         WHERE s.id = ?
           AND s.user_id = ?
           AND s.active_tenant_id = ?
           AND s.expires_at > CURRENT_TIMESTAMP
           AND s.revoked_at IS NULL
           AND m.status = 'ACTIVE'
           AND t.status = 'ACTIVE'
         LIMIT 1
      `).bind(sessionId, userId, activeTenantId).first();
      if (!row) return { ok: false, status: 403, error: "TENANT_MEMBERSHIP_REQUIRED" };
      return { ok: true, tenant: {
        id: row.tenant_id, slug: row.tenant_slug, name: row.tenant_name,
        membership_id: row.membership_id, role: row.membership_role
      }};
    }

    const result = await env.DB.prepare(`
      SELECT t.id AS tenant_id, t.slug AS tenant_slug, t.display_name AS tenant_name,
             m.id AS membership_id, m.role AS membership_role
        FROM sessions s
        JOIN tenant_memberships m ON m.user_id = s.user_id
        JOIN tenants t ON t.id = m.tenant_id
       WHERE s.id = ?
         AND s.user_id = ?
         AND s.expires_at > CURRENT_TIMESTAMP
         AND s.revoked_at IS NULL
         AND m.status = 'ACTIVE'
         AND t.status = 'ACTIVE'
       ORDER BY t.id
       LIMIT 2
    `).bind(sessionId, userId).all();

    // D1 may return partial rows alongside an unsuccessful response.
    // Never authorize a tenant unless the database explicitly confirms success.
    if (result?.success !== true || !Array.isArray(result.results)) {
      return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };
    }
    const rows = result.results;
    if (rows.length === 0) return { ok: false, status: 403, error: "TENANT_MEMBERSHIP_REQUIRED" };
    if (rows.length > 1) return { ok: false, status: 409, error: "TENANT_SELECTION_REQUIRED" };
    const row = rows[0];
    return { ok: true, tenant: {
      id: row.tenant_id, slug: row.tenant_slug, name: row.tenant_name,
      membership_id: row.membership_id, role: row.membership_role
    }};
  } catch {
    return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };
  }
}

export function tenantRoleAllowed(context, allowedRoles) {
  return Boolean(context?.ok && Array.isArray(allowedRoles) && allowedRoles.includes(context.tenant?.role));
}
