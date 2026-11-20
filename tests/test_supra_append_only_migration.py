import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0030_supra_append_only_audit_guards.sql"
CANONICAL_MIGRATION = ROOT / "migrations-preview-canonical" / "0030_supra_append_only_audit_guards.sql"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")

# Reproduce the already-existing Preview tables when their historical guard
# triggers are absent. This proves migration 0030 itself installs the guards.
db.executescript("""
CREATE TABLE supra_audit_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL);
CREATE TABLE supra_approval_requests (id TEXT PRIMARY KEY, status TEXT NOT NULL);
INSERT INTO supra_audit_events(id, event_type) VALUES ('audit-1', 'PLAN_CREATED');
INSERT INTO supra_approval_requests(id, status) VALUES ('approval-1', 'PENDING');
""")

sql = MIGRATION.read_text(encoding="utf-8")
canonical_sql = CANONICAL_MIGRATION.read_text(encoding="utf-8")
assert canonical_sql == sql, "canonical Preview migration 0030 must match the independently tested migration"
db.executescript(sql)

# Reapplying is safe and must not fail.
db.executescript(sql)

def must_be_rejected(statement: str, description: str) -> None:
    try:
        db.execute(statement)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"{description} unexpectedly succeeded")

must_be_rejected(
    "UPDATE supra_audit_events SET event_type='TAMPERED' WHERE id='audit-1'",
    "SUPRA audit UPDATE",
)
must_be_rejected(
    "DELETE FROM supra_audit_events WHERE id='audit-1'",
    "SUPRA audit DELETE",
)
must_be_rejected(
    "DELETE FROM supra_approval_requests WHERE id='approval-1'",
    "SUPRA approval request DELETE",
)

# Append-only means new evidence remains insertable.
db.execute(
    "INSERT INTO supra_audit_events(id, event_type) VALUES ('audit-2', 'PLAN_CREATED')"
)
assert db.execute("SELECT COUNT(*) FROM supra_audit_events").fetchone()[0] == 2
assert db.execute("SELECT event_type FROM supra_audit_events WHERE id='audit-1'").fetchone()[0] == "PLAN_CREATED"

print("PASS: migration 0030 installs all three append-only guards, rejects UPDATE/DELETE, permits INSERT, and is idempotent.")
