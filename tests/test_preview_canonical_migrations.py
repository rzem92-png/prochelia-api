import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations-preview-canonical"
EXPECTED = [
    "0000_auth_foundation.sql",
    "0001_core_business_schema.sql",
    "0002_server_pricing.sql",
    "0003_route_address_provenance.sql",
    "0004_atomic_wallet_ledger.sql",
    "0005_security_rate_limits.sql",
    "0006_copilot_schema.sql",
    "0007_trust_passport_schema.sql",
    "0008_commercial_recruitment_schema.sql",
    "0009_finance_workspace_schema.sql",
    "0010_strategic_schema.sql",
    "0011_final_hardening_schema.sql",
    "0012_national_continuity_schema.sql",
    "0013_master_complement_schema.sql",
    "0014_operational_schema.sql",
    "0015_production_security_events.sql",
    "0016_security_identity_schema.sql",
    "0017_document_security_scans.sql",
    "0018_consolidated_business_schema.sql",
    "0019_backup_verifications.sql",
    "0020_auth_login_rate_limits.sql",
    "0021_supra_audit_events.sql",
    "0022_supra_persisted_approvals.sql",
    "0023_tenant_isolation_foundation.sql",
    "0024_provider_unavailability.sql",
    "0025_provider_unavailability_idempotency.sql",
]

actual = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
assert actual == sorted(EXPECTED), (
    f"Canonical Preview migration chain mismatch. Missing={sorted(set(EXPECTED)-set(actual))}; "
    f"unexpected={sorted(set(actual)-set(EXPECTED))}"
)

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
# Start from a truly empty D1 database, matching the newly created EU Preview target.
for name in EXPECTED:
    db.executescript((MIGRATIONS / name).read_text(encoding="utf-8"))

violations = db.execute("PRAGMA foreign_key_check").fetchall()
assert not violations, f"Canonical migration chain creates foreign-key violations: {violations[:10]}"

tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    "users", "sessions", "clients", "intervenants", "missions",
    "auth_login_rate_limits", "supra_audit_events",
    "supra_approval_requests", "supra_approval_votes", "supra_approval_events",
}
assert required <= tables, f"Canonical migration chain missing tables: {sorted(required-tables)}"

print(f"PASS: all {len(EXPECTED)} canonical Preview migrations apply from an empty D1 database, creating users/sessions first; foreign_key_check=0.")

# Tenant foundation: constrained roles/statuses, membership uniqueness, pending invite uniqueness,
# FK integrity and tenant scope indexes must be present in the canonical Preview chain.
tenant_columns = {
    table: {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    for table in ("clients", "intervenants", "missions")
}
assert all("tenant_id" in cols for cols in tenant_columns.values()), (
    f"Tenant scope columns missing: {tenant_columns}"
)
tenant_tables = {"tenants", "tenant_memberships", "tenant_invitations"}
assert tenant_tables <= tables, f"Tenant foundation missing: {sorted(tenant_tables-tables)}"
tenant_indexes = {row[1] for row in db.execute("PRAGMA index_list(tenant_memberships)")}
assert {"idx_tenant_memberships_user_status", "idx_tenant_memberships_tenant_role_status"} <= tenant_indexes
invite_indexes = {row[1] for row in db.execute("PRAGMA index_list(tenant_invitations)")}
assert {"idx_tenant_invitations_tenant_status_expiry", "idx_tenant_invitation_pending_email"} <= invite_indexes

db.execute("INSERT INTO users (id, role, email, first_name, last_name, password_hash, status) VALUES ('tenant-test-user', 'client', 'tenant-test@example.test', 'Tenant', 'Test', 'hash', 'active')")
db.execute("INSERT INTO tenants (id, slug, display_name) VALUES ('tenant-a', 'tenant-a', 'Tenant A')")
db.execute("INSERT INTO tenant_memberships (id, tenant_id, user_id, role, status) VALUES ('membership-a', 'tenant-a', 'tenant-test-user', 'CLIENT', 'ACTIVE')")
try:
    db.execute("INSERT INTO tenant_memberships (id, tenant_id, user_id, role) VALUES ('membership-duplicate', 'tenant-a', 'tenant-test-user', 'ADMIN')")
    raise AssertionError("Duplicate tenant membership unexpectedly accepted")
except sqlite3.IntegrityError:
    pass
try:
    db.execute("INSERT INTO tenant_memberships (id, tenant_id, user_id, role) VALUES ('membership-invalid-role', 'tenant-a', 'tenant-test-user', 'ROOT')")
    raise AssertionError("Invalid tenant role unexpectedly accepted")
except sqlite3.IntegrityError:
    pass
db.execute("INSERT INTO tenant_invitations (id, tenant_id, email_normalized, role, token_hash, invited_by_user_id, expires_at) VALUES ('invite-a', 'tenant-a', 'invite@example.test', 'PROVIDER', 'hash-a', 'tenant-test-user', '2099-01-01')")
try:
    db.execute("INSERT INTO tenant_invitations (id, tenant_id, email_normalized, role, token_hash, invited_by_user_id, expires_at) VALUES ('invite-b', 'tenant-a', 'invite@example.test', 'PROVIDER', 'hash-b', 'tenant-test-user', '2099-01-01')")
    raise AssertionError("Duplicate pending tenant invitation unexpectedly accepted")
except sqlite3.IntegrityError:
    pass
print("PASS: tenant membership, invitation, role/status constraints and tenant indexes validated.")

# Provider unavailability is persisted with tenant/provider scoping, timestamps,
# bounded reason and server-side tenant/overlap guards.
assert "provider_unavailability" in tables
provider_indexes = {row[1] for row in db.execute("PRAGMA index_list(provider_unavailability)")}
assert {"idx_provider_unavailability_tenant_provider_time", "idx_provider_unavailability_tenant_range"} <= provider_indexes
provider_columns = {row[1] for row in db.execute("PRAGMA table_info(provider_unavailability)")}
assert "idempotency_key" in provider_columns
provider_idempotency_indexes = {row[1] for row in db.execute("PRAGMA index_list(provider_unavailability)")}
assert "idx_provider_unavailability_idempotency" in provider_idempotency_indexes
db.execute("INSERT INTO tenants (id, slug, display_name) VALUES ('tenant-b', 'tenant-b', 'Tenant B')")
db.execute("INSERT INTO users (id, role, email, first_name, last_name, password_hash, status) VALUES ('tenant-test-user-b', 'provider', 'tenant-test-b@example.test', 'Tenant', 'Provider', 'hash', 'active')")
db.execute("INSERT INTO intervenants (id, user_id, tenant_id) VALUES ('provider-a', 'tenant-test-user', 'tenant-a')")
db.execute("INSERT INTO intervenants (id, user_id, tenant_id) VALUES ('provider-b', 'tenant-test-user-b', 'tenant-b')")
db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, created_by_user_id) VALUES ('block-a', 'tenant-a', 'provider-a', '2026-11-26T09:00:00Z', '2026-11-26T10:00:00Z', 'Europe/Paris', 'Test', 'tenant-test-user', 'block-a-key-0001')")
try:
    db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, created_by_user_id, idempotency_key) VALUES ('block-duplicate-key', 'tenant-a', 'provider-a', '2026-11-26T12:00:00Z', '2026-11-26T13:00:00Z', 'Europe/Paris', 'tenant-test-user', 'block-a-key-0001')")
    raise AssertionError("Duplicate provider idempotency key unexpectedly accepted")
except sqlite3.IntegrityError:
    pass
try:
    db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, created_by_user_id) VALUES ('block-cross-tenant', 'tenant-b', 'provider-a', '2026-11-26T10:00:00Z', '2026-11-26T11:00:00Z', 'Europe/Paris', 'tenant-test-user')")
    raise AssertionError("Cross-tenant provider unavailability unexpectedly accepted")
except sqlite3.IntegrityError as e:
    assert "PROVIDER_TENANT_MISMATCH" in str(e)
try:
    db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, created_by_user_id) VALUES ('block-overlap', 'tenant-a', 'provider-a', '2026-11-26T09:30:00Z', '2026-11-26T10:30:00Z', 'Europe/Paris', 'tenant-test-user')")
    raise AssertionError("Overlapping provider block unexpectedly accepted")
except sqlite3.IntegrityError as e:
    assert "PROVIDER_UNAVAILABILITY_OVERLAP" in str(e)
db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, created_by_user_id) VALUES ('block-adjacent', 'tenant-a', 'provider-a', '2026-11-26T10:00:00Z', '2026-11-26T11:00:00Z', 'Europe/Paris', 'tenant-test-user')")
try:
    db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, reason, created_by_user_id) VALUES ('block-long-reason', 'tenant-a', 'provider-a', '2026-11-26T11:00:00Z', '2026-11-26T12:00:00Z', 'Europe/Paris', 'x' || substr(printf('%200s',''),1,121), 'tenant-test-user')")
    raise AssertionError("Overlong reason unexpectedly accepted")
except sqlite3.IntegrityError:
    pass
db.execute("UPDATE provider_unavailability SET status='CANCELLED' WHERE id='block-a'")
db.execute("INSERT INTO provider_unavailability (id, tenant_id, intervenant_id, start_at, end_at, timezone_name, created_by_user_id) VALUES ('block-reuse', 'tenant-a', 'provider-a', '2026-11-26T09:15:00Z', '2026-11-26T09:45:00Z', 'Europe/Paris', 'tenant-test-user')")
print("PASS: provider unavailability tenant binding, overlap guards, adjacent interval, cancellation and reason constraints validated.")
