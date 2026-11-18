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
    "0023_tenant_double_entry_accounting.sql",
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


# Double-entry accounting invariants: tenant scoping, idempotency, balanced posting,
# immutable posted records and exact mirror reversals.
accounting_tables = {
    "accounting_entities", "accounting_accounts",
    "accounting_journals", "accounting_journal_lines",
}
assert accounting_tables <= tables, f"Missing accounting tables: {sorted(accounting_tables-tables)}"

db.execute("""
    INSERT INTO accounting_entities(id, tenant_id, legal_name, country_code, base_currency)
    VALUES ('entity-a', 'tenant-a', 'PROCHÉLIA France', 'FR', 'EUR')
""")
db.execute("""
    INSERT INTO accounting_entities(id, tenant_id, legal_name, country_code, base_currency)
    VALUES ('entity-b', 'tenant-b', 'Other Tenant', 'FR', 'EUR')
""")
for account_id, code, name, typ, normal in [
    ("cash-a", "512000", "Banque", "ASSET", "DEBIT"),
    ("revenue-a", "706000", "Prestations", "REVENUE", "CREDIT"),
]:
    db.execute("""
        INSERT INTO accounting_accounts(id, tenant_id, entity_id, account_code, account_name, account_type, normal_balance)
        VALUES (?, 'tenant-a', 'entity-a', ?, ?, ?, ?)
    """, (account_id, code, name, typ, normal))
db.execute("""
    INSERT INTO accounting_accounts(id, tenant_id, entity_id, account_code, account_name, account_type, normal_balance)
    VALUES ('cash-b', 'tenant-b', 'entity-b', '512000', 'Other tenant bank', 'ASSET', 'DEBIT')
""")
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by
    ) VALUES ('journal-a', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
              'TEST', 'source-a', 'tenant-a:test:1', 'user-a')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('line-a1', 'tenant-a', 'entity-a', 'journal-a', 'cash-a', 1, 'DEBIT', 10000, 'EUR')
""")
try:
    db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-a'")
    raise AssertionError("Unbalanced journal was incorrectly posted")
except sqlite3.IntegrityError as exc:
    assert "AT_LEAST_TWO_LINES" in str(exc) or "NOT_BALANCED" in str(exc), str(exc)
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('line-a2', 'tenant-a', 'entity-a', 'journal-a', 'revenue-a', 2, 'CREDIT', 10000, 'EUR')
""")
try:
    db.execute("""
        INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
        VALUES ('line-cross-tenant', 'tenant-a', 'entity-a', 'journal-a', 'cash-b', 3, 'DEBIT', 1, 'EUR')
    """)
    raise AssertionError("Cross-tenant accounting line was incorrectly accepted")
except sqlite3.IntegrityError:
    pass
db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-a'")
try:
    db.execute("UPDATE accounting_journal_lines SET amount_cents=9999 WHERE id='line-a1'")
    raise AssertionError("Posted journal line was incorrectly mutable")
except sqlite3.IntegrityError as exc:
    assert "IMMUTABLE" in str(exc), str(exc)
try:
    db.execute("""
        INSERT INTO accounting_journals(
          id, tenant_id, entity_id, journal_code, journal_date, currency,
          source_type, source_id, idempotency_key, created_by
        ) VALUES ('journal-duplicate', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
                  'TEST', 'source-b', 'tenant-a:test:1', 'user-a')
    """)
    raise AssertionError("Duplicate tenant idempotency key was incorrectly accepted")
except sqlite3.IntegrityError:
    pass

db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by, reversal_of_journal_id
    ) VALUES ('journal-reversal', 'tenant-a', 'entity-a', 'OD', '2026-11-18', 'EUR',
              'REVERSAL', 'journal-a', 'tenant-a:reversal:1', 'user-a', 'journal-a')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('line-r1', 'tenant-a', 'entity-a', 'journal-reversal', 'cash-a', 1, 'CREDIT', 10000, 'EUR')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('line-r2', 'tenant-a', 'entity-a', 'journal-reversal', 'revenue-a', 2, 'DEBIT', 10000, 'EUR')
""")
db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-reversal'")
try:
    db.execute("""
        INSERT INTO accounting_journals(
          id, tenant_id, entity_id, journal_code, journal_date, currency,
          source_type, source_id, idempotency_key, created_by, reversal_of_journal_id
        ) VALUES ('journal-second-reversal', 'tenant-a', 'entity-a', 'OD', '2026-11-18', 'EUR',
                  'REVERSAL', 'journal-a', 'tenant-a:reversal:2', 'user-a', 'journal-a')
    """)
    raise AssertionError("Second reversal was incorrectly accepted")
except sqlite3.IntegrityError:
    pass
print("PASS: tenant-scoped double-entry posting, idempotency, immutable posts and exact reversal constraints.")
