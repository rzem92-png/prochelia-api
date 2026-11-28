/* Selected workspace is request context only; business routes must enforce tenant ownership independently. */
const LIST_SQL = `
  SELECT t.id, t.kind, t.display_name, t.country_code, m.role,
         c.selected_at
    FROM tenant_memberships m
    JOIN tenants t ON t.id = m.tenant_id
    LEFT JOIN tenant_session_context c
      ON c.session_id = ? AND c.tenant_id = t.id
   WHERE m.user_id = ?
     AND m.status = 'ACTIVE'
     AND t.status = 'ACTIVE'
   ORDER BY CASE m.role
      WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 WHEN 'MANAGER' THEN 2
      WHEN 'BILLING' THEN 3 WHEN 'MEMBER' THEN 4 ELSE 5 END,
      t.display_name, t.id
`;

const SELECT_SQL = `
  INSERT INTO tenant_session_context (session_id, tenant_id, selected_at)
  SELECT ?, ?, CURRENT_TIMESTAMP
   WHERE EXISTS (
     SELECT 1
       FROM sessions s
       JOIN tenant_memberships m
         ON m.user_id = s.user_id AND m.tenant_id = ?
       JOIN tenants t ON t.id = m.tenant_id
      WHERE s.id = ? AND s.user_id = ?
        AND m.status = 'ACTIVE' AND t.status = 'ACTIVE'
   )
  ON CONFLICT(session_id) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    selected_at = CURRENT_TIMESTAMP
`;

function requireDb(db) {
  if (!db || typeof db.prepare !== 'function') throw new Error('TENANT_CONTEXT_DB_REQUIRED');
}

export async function listTenantContexts(db, sessionId, userId) {
  requireDb(db);
  if (typeof sessionId !== 'string' || !sessionId || typeof userId !== 'string' || !userId) {
    throw new Error('TENANT_CONTEXT_IDENTITY_REQUIRED');
  }
  const result = await db.prepare(LIST_SQL).bind(sessionId, userId).all();
  if (!Array.isArray(result?.results)) throw new Error('TENANT_CONTEXT_QUERY_INVALID');
  const tenants = result.results.map(row => ({
    id: String(row.id),
    kind: String(row.kind),
    name: String(row.display_name),
    countryCode: row.country_code ?? null,
    role: String(row.role),
    selected: row.selected_at != null
  }));
  return {
    selectedTenantId: tenants.find(tenant => tenant.selected)?.id ?? null,
    tenants
  };
}

export async function selectTenantContext(db, sessionId, userId, tenantId) {
  requireDb(db);
  if ([sessionId, userId, tenantId].some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('TENANT_CONTEXT_IDENTITY_REQUIRED');
  }
  const result = await db.prepare(SELECT_SQL)
    .bind(sessionId, tenantId, tenantId, sessionId, userId)
    .run();
  return Number(result?.meta?.changes) === 1;
}
