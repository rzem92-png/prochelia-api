// Server-side tenant context resolver. Never trust tenant IDs from JSON bodies.
const TENANT_HEADER = "x-prochelia-tenant-id";

export async function resolveTenantContext(request, env, auth) {
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  if (!env?.DB) return { ok: false, status: 503, error: "TENANT_CONTEXT_UNAVAILABLE" };

  const requestedTenantId = (request.headers.get(TENANT_HEADER) || "").trim();
  try {
    if (requestedTenantId) {
      const row = await env.DB.prepare(`
        SELECT t.id AS tenant_id, t.slug AS tenant_slug, t.display_name AS tenant_name,
               m.id AS membership_id, m.role AS membership_role
          FROM tenant_memberships m
          JOIN tenants t ON t.id = m.tenant_id
         WHERE m.user_id = ?
           AND m.tenant_id = ?
           AND m.status = 'ACTIVE'
           AND t.status = 'ACTIVE'
         LIMIT 1
      `).bind(userId, requestedTenantId).first();
      if (!row) return { ok: false, status: 403, error: "TENANT_MEMBERSHIP_REQUIRED" };
      return { ok: true, tenant: {
        id: row.tenant_id, slug: row.tenant_slug, name: row.tenant_name,
        membership_id: row.membership_id, role: row.membership_role
      }};
    }

    const result = await env.DB.prepare(`
      SELECT t.id AS tenant_id, t.slug AS tenant_slug, t.display_name AS tenant_name,
             m.id AS membership_id, m.role AS membership_role
        FROM tenant_memberships m
        JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = ?
         AND m.status = 'ACTIVE'
         AND t.status = 'ACTIVE'
       ORDER BY t.id
       LIMIT 2
    `).bind(userId).all();
    const rows = result?.results || [];
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
