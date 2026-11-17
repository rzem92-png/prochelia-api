import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations-preview-canonical"
EXPECTED = [
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
]

actual = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
assert actual == sorted(EXPECTED), (
    f"Canonical Preview migration chain mismatch. Missing={sorted(set(EXPECTED)-set(actual))}; "
    f"unexpected={sorted(set(actual)-set(EXPECTED))}"
)

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
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

print(f"PASS: all {len(EXPECTED)} canonical Preview migrations apply to an empty SQLite database; foreign_key_check=0.")
