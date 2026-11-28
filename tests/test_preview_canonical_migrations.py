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
    "0023_tenant_workspace_foundation.sql",
]

actual = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
assert actual == sorted(EXPECTED), (
    f"Canonical Preview migration chain mismatch. Missing={sorted(set(EXPECTED)-set(actual))}; "
    f"unexpected={sorted(set(actual)-set(EXPECTED))}"
)

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
# Start from an empty SQLite database, matching a new isolated EU Preview target.
for name in EXPECTED:
    db.executescript((MIGRATIONS / name).read_text(encoding="utf-8"))

violations = db.execute("PRAGMA foreign_key_check").fetchall()
assert not violations, f"Canonical migration chain creates foreign-key violations: {violations[:10]}"

tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    "users", "sessions", "clients", "intervenants", "missions",
    "auth_login_rate_limits", "supra_audit_events",
    "supra_approval_requests", "supra_approval_votes", "supra_approval_events",
    "tenants", "tenant_memberships", "tenant_invitations", "tenant_session_context", "tenant_audit_events",
}
assert required <= tables, f"Canonical migration chain missing tables: {sorted(required-tables)}"

# Tenant foundation invariants are tested against SQLite without any remote D1 writes.
# Tenant audit events are append-only.

db.execute(
    "INSERT INTO users(id,role,email,first_name,last_name,password_hash) VALUES(?,?,?,?,?,?)",
    ("u1", "client", "a@example.test", "A", "Test", "fixture"),
)
db.execute(
    "INSERT INTO users(id,role,email,first_name,last_name,password_hash) VALUES(?,?,?,?,?,?)",
    ("u2", "client", "b@example.test", "B", "Test", "fixture"),
)
db.execute(
    "INSERT INTO tenants(id,kind,display_name,created_by_user_id,country_code) VALUES(?,?,?,?,?)",
    ("t1", "PERSONAL", "A workspace", "u1", "FR"),
)
db.execute(
    "INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,accepted_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)",
    ("m1", "t1", "u1", "OWNER", "ACTIVE"),
)
db.execute(
    "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)",
    ("s1", "u1", "session-hash-1", "2099-01-01"),
)
db.execute("INSERT INTO tenant_session_context(session_id,tenant_id) VALUES(?,?)", ("s1", "t1"))

# A session cannot select a tenant without an active membership.
db.execute(
    "INSERT INTO tenants(id,kind,display_name,created_by_user_id) VALUES(?,?,?,?)",
    ("t2", "ORGANIZATION", "Other workspace", "u2"),
)
try:
    db.execute("INSERT INTO tenant_session_context(session_id,tenant_id) VALUES(?,?)", ("s1", "t2"))
    raise AssertionError("cross-tenant session context unexpectedly allowed")
except sqlite3.IntegrityError as error:
    assert "ACTIVE_TENANT_MEMBERSHIP_REQUIRED" in str(error)

# Personal workspaces are unique per creator; active membership needs acceptance evidence.
try:
    db.execute(
        "INSERT INTO tenants(id,kind,display_name,created_by_user_id) VALUES(?,?,?,?)",
        ("t-personal-duplicate", "PERSONAL", "Duplicate", "u1"),
    )
    raise AssertionError("duplicate personal workspace unexpectedly allowed")
except sqlite3.IntegrityError:
    pass
try:
    db.execute(
        "INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status) VALUES(?,?,?,?,?)",
        ("m2", "t2", "u2", "OWNER", "ACTIVE"),
    )
    raise AssertionError("active membership without accepted_at unexpectedly allowed")
except sqlite3.IntegrityError:
    pass

# Invitations store a token hash, forbid OWNER grants, normalize email, and are single-pending per tenant/email.
try:
    db.execute(
        "INSERT INTO tenant_invitations(id,tenant_id,invitee_email,token_hash,role,invited_by_user_id,expires_at) VALUES(?,?,?,?,?,?,?)",
        ("bad-owner-invite", "t2", "b@example.test", "a" * 64, "OWNER", "u2", "2099-01-01"),
    )
    raise AssertionError("OWNER invitation unexpectedly allowed")
except sqlite3.IntegrityError:
    pass
db.execute(
    "INSERT INTO tenant_invitations(id,tenant_id,invitee_email,token_hash,role,invited_by_user_id,expires_at) VALUES(?,?,?,?,?,?,?)",
    ("i1", "t2", "b@example.test", "b" * 64, "MEMBER", "u2", "2099-01-01"),
)
try:
    db.execute(
        "INSERT INTO tenant_invitations(id,tenant_id,invitee_email,token_hash,role,invited_by_user_id,expires_at) VALUES(?,?,?,?,?,?,?)",
        ("i2", "t2", "b@example.test", "c" * 64, "VIEWER", "u2", "2099-01-01"),
    )
    raise AssertionError("duplicate pending invitation unexpectedly allowed")
except sqlite3.IntegrityError:
    pass
db.execute(
    "UPDATE tenant_invitations SET status='ACCEPTED',accepted_by_user_id='u2',accepted_at=CURRENT_TIMESTAMP WHERE id='i1'"
)
try:
    db.execute("UPDATE tenant_invitations SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP WHERE id='i1'")
    raise AssertionError("accepted invitation status transition unexpectedly allowed")
except sqlite3.IntegrityError:
    pass
try:
    db.execute("UPDATE tenant_invitations SET token_hash=? WHERE id='i1'", ("d" * 64,))
    raise AssertionError("invitation token hash unexpectedly mutable")
except sqlite3.IntegrityError:
    pass

# Revocation and tenant suspension invalidate any selected context for affected sessions.
db.execute(
    "UPDATE tenant_memberships SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP WHERE id='m1'"
)
assert db.execute("SELECT COUNT(*) FROM tenant_session_context WHERE session_id='s1'").fetchone()[0] == 0
db.execute(
    "INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,accepted_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)",
    ("m3", "t2", "u2", "OWNER", "ACTIVE"),
)
db.execute(
    "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)",
    ("s2", "u2", "session-hash-2", "2099-01-01"),
)
db.execute("INSERT INTO tenant_session_context(session_id,tenant_id) VALUES(?,?)", ("s2", "t2"))
db.execute("UPDATE tenants SET status='SUSPENDED' WHERE id='t2'")
assert db.execute("SELECT COUNT(*) FROM tenant_session_context WHERE session_id='s2'").fetchone()[0] == 0

violations = db.execute("PRAGMA foreign_key_check").fetchall()
assert not violations, f"Tenant fixtures create foreign-key violations: {violations[:10]}"

print(f"PASS: all {len(EXPECTED)} canonical Preview migrations apply from an empty database; tenant membership/session/invitation guards pass; foreign_key_check=0.")
