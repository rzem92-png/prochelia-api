const CREATE_PERSONAL_TENANT_SQL = `
  INSERT OR IGNORE INTO tenants (id, kind, display_name, created_by_user_id)
  VALUES (?, 'PERSONAL', ?, ?)
`;

const CREATE_OWNER_MEMBERSHIP_SQL = `
  INSERT OR IGNORE INTO tenant_memberships
    (id, tenant_id, user_id, role, status, accepted_at)
  SELECT ?, t.id, ?, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
    FROM tenants t
   WHERE t.kind = 'PERSONAL'
     AND t.created_by_user_id = ?
     AND t.status = 'ACTIVE'
`;

const AUDIT_BOOTSTRAP_SQL = `
  INSERT INTO tenant_audit_events (id, tenant_id, actor_user_id, event_type, details_json)
  SELECT ?, t.id, ?, 'PERSONAL_TENANT_BOOTSTRAP_REQUESTED', ?
    FROM tenants t
   WHERE t.kind = 'PERSONAL'
     AND t.created_by_user_id = ?
`;

const READ_PERSONAL_TENANT_SQL = `
  SELECT t.id, t.display_name, t.status AS tenant_status,
         m.role, m.status AS membership_status
    FROM tenants t
    LEFT JOIN tenant_memberships m
      ON m.tenant_id = t.id AND m.user_id = ?
   WHERE t.kind = 'PERSONAL'
     AND t.created_by_user_id = ?
   LIMIT 1
`;

function requireD1(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') {
    throw new Error('TENANT_BOOTSTRAP_D1_REQUIRED');
  }
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return 'Espace personnel';
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length ? name.slice(0, 160) : 'Espace personnel';
}

export async function bootstrapPersonalTenant(db, userId, displayName) {
  requireD1(db);
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 128) {
    throw new Error('TENANT_BOOTSTRAP_USER_REQUIRED');
  }

  const tenantId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const statements = [
    db.prepare(CREATE_PERSONAL_TENANT_SQL).bind(tenantId, normalizeDisplayName(displayName), userId),
    db.prepare(CREATE_OWNER_MEMBERSHIP_SQL).bind(membershipId, userId, userId),
    db.prepare(AUDIT_BOOTSTRAP_SQL).bind(auditId, userId, JSON.stringify({ source: 'tenant-bootstrap-api' }), userId)
  ];

  const batchResult = await db.batch(statements);
  const row = await db.prepare(READ_PERSONAL_TENANT_SQL).bind(userId, userId).first();
  if (!row) return { ok: false, error: 'PERSONAL_TENANT_NOT_PROVISIONED' };

  const active = row.tenant_status === 'ACTIVE'
    && row.membership_status === 'ACTIVE'
    && row.role === 'OWNER';

  return {
    ok: active,
    error: active ? null : 'PERSONAL_TENANT_ACCESS_REQUIRES_RECOVERY',
    created: Number(batchResult?.[0]?.meta?.changes || 0) === 1,
    tenant: {
      id: String(row.id),
      name: String(row.display_name),
      kind: 'PERSONAL',
      role: row.role == null ? null : String(row.role),
      status: String(row.tenant_status),
      membershipStatus: row.membership_status == null ? null : String(row.membership_status)
    }
  };
}
