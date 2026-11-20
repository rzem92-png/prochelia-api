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
    "0024_tenant_membership_authority.sql",
    "0025_session_revocation.sql",
    "0026_accounting_currency_consistency.sql",
    "0027_tenant_membership_identity_immutable.sql",
    "0028_tenant_accounting_entity_delete_guard.sql",
    "0029_supra_append_only_audit_guards.sql",
    "0030_supra_audit_tenant_scope.sql",
    "0031_operational_marketplace_tenant_scope.sql",
    "0032_privacy_safe_cross_tenant_mission_marketplace.sql",
]

# Keep the manual Preview migration gate synchronized with the canonical chain.
WORKFLOW = ROOT / ".github" / "workflows" / "apply-preview-d1-migrations.yml"
workflow_text = WORKFLOW.read_text(encoding="utf-8")
assert '"0029_supra_append_only_audit_guards.sql"' in workflow_text, (
    "Preview migration workflow omits the latest canonical migration 0029/0030"
)
assert '"0030_supra_audit_tenant_scope.sql"' in workflow_text, (
    "Preview migration workflow omits tenant-scoped SUPRA audit migration 0030"
)
assert "if len(local) != 33:" in workflow_text, (
    "Preview migration workflow must require exactly 31 canonical migrations"
)
assert "exact 33-entry registry" in workflow_text, (
    "Preview migration workflow target registry count is stale"
)
assert "all 33 canonical migrations are pending" in workflow_text, (
    "Preview migration workflow empty-database inventory message is stale"
)
assert "only migrations 0023-0032 are pending" in workflow_text, (
    "Preview migration workflow baseline-to-target range is stale"
)

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
# Tenant authority and membership lifecycle fixtures.
tenant_tables = {"tenants", "tenant_memberships", "tenant_membership_events"}
assert tenant_tables <= tables, f"Missing tenant authority tables: {sorted(tenant_tables-tables)}"
for user_id, email in [("user-a", "user-a@example.test"), ("user-b", "user-b@example.test"), ("user-admin", "admin@example.test")]:
    db.execute("INSERT INTO users(id, role, email, first_name, last_name, password_hash) VALUES (?, 'client', ?, 'Synthetic', 'User', 'not-a-real-password-hash')", (user_id, email))
db.execute("INSERT INTO tenants(id, slug, display_name) VALUES ('tenant-a', 'tenant-a', 'Tenant A')")
db.execute("INSERT INTO tenants(id, slug, display_name) VALUES ('tenant-b', 'tenant-b', 'Tenant B')")
db.execute("INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id) VALUES ('membership-a', 'tenant-a', 'user-a', 'OWNER', 'INVITED', 'user-admin')")
db.execute("UPDATE tenant_memberships SET status='ACTIVE', accepted_at=CURRENT_TIMESTAMP WHERE id='membership-a'")
for sql in [
    "UPDATE tenant_memberships SET id='membership-a-mutated' WHERE id='membership-a'",
    "UPDATE tenant_memberships SET tenant_id='tenant-b' WHERE id='membership-a'",
    "UPDATE tenant_memberships SET user_id='user-b' WHERE id='membership-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Tenant membership identity was mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "IDENTITY_IMMUTABLE" in str(exc), str(exc)
db.execute("INSERT INTO tenant_membership_events(id, tenant_id, membership_id, actor_user_id, event_type, previous_status, new_status, reason_code) VALUES ('membership-event-a', 'tenant-a', 'membership-a', 'user-admin', 'ACCEPTED', 'INVITED', 'ACTIVE', 'INVITATION_ACCEPTED')")
try:
    db.execute("INSERT INTO tenant_membership_events(id, tenant_id, membership_id, actor_user_id, event_type, previous_status, new_status, reason_code) VALUES ('membership-event-cross-tenant', 'tenant-b', 'membership-a', 'user-admin', 'ACCEPTED', 'INVITED', 'ACTIVE', 'CROSS_TENANT_TEST')")
    raise AssertionError("Cross-tenant membership event was incorrectly accepted")
except sqlite3.IntegrityError:
    pass
for sql in ["UPDATE tenant_membership_events SET reason_code='tampered' WHERE id='membership-event-a'", "DELETE FROM tenant_membership_events WHERE id='membership-event-a'"]:
    try:
        db.execute(sql)
        raise AssertionError(f"Append-only membership history was mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "APPEND_ONLY" in str(exc), str(exc)
db.execute("UPDATE tenant_memberships SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP WHERE id='membership-a'")
try:
    db.execute("UPDATE tenant_memberships SET status='ACTIVE' WHERE id='membership-a'")
    raise AssertionError("Revoked membership was incorrectly reactivated")
except sqlite3.IntegrityError as exc:
    assert "REVOKED_TERMINAL" in str(exc), str(exc)

# Re-invitation is a new membership record; only one non-revoked membership per user/tenant.
db.execute("""
    INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id)
    VALUES ('membership-a-reinvite', 'tenant-a', 'user-a', 'MEMBER', 'INVITED', 'user-admin')
""")
db.execute("""
    INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id)
    VALUES ('membership-owner-a2', 'tenant-a', 'user-b', 'OWNER', 'INVITED', 'user-admin')
""")
try:
    db.execute("""
        INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id)
        VALUES ('membership-owner-a3', 'tenant-a', 'user-admin', 'OWNER', 'INVITED', 'user-a')
    """)
    raise AssertionError("A second non-revoked tenant owner was incorrectly accepted")
except sqlite3.IntegrityError:
    pass

db.execute("""
    INSERT INTO accounting_entities(id, tenant_id, legal_name, country_code, base_currency)
    VALUES ('entity-a', 'tenant-a', 'PROCHÉLIA France', 'FR', 'EUR')
""")
db.execute("""
    INSERT INTO accounting_entities(id, tenant_id, legal_name, country_code, base_currency)
    VALUES ('entity-b', 'tenant-b', 'Other Tenant', 'FR', 'EUR')
""")
try:
    db.execute("""
        INSERT INTO accounting_journals(
          id, tenant_id, entity_id, journal_code, journal_date, currency,
          source_type, source_id, idempotency_key, status, created_by, posted_by, posted_at
        ) VALUES ('journal-direct-posted', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
                  'TEST', 'direct-post', 'tenant-a:direct-post:1', 'POSTED', 'user-a', 'user-a', CURRENT_TIMESTAMP)
    """)
    raise AssertionError("Journal inserted directly as POSTED was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "MUST_START_AS_DRAFT" in str(exc), str(exc)
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
    db.execute("UPDATE accounting_journals SET status='DRAFT' WHERE id='journal-a'")
    raise AssertionError("Posted journal header was incorrectly unposted")
except sqlite3.IntegrityError as exc:
    assert "IMMUTABLE" in str(exc), str(exc)
try:
    db.execute("UPDATE accounting_journals SET journal_date='2026-11-19' WHERE id='journal-a'")
    raise AssertionError("Posted journal metadata was incorrectly mutable")
except sqlite3.IntegrityError as exc:
    assert "IMMUTABLE" in str(exc), str(exc)
try:
    db.execute("DELETE FROM accounting_journals WHERE id='journal-a'")
    raise AssertionError("Posted journal was incorrectly deletable")
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
# A second draft reversal is allowed, but only one may ever be posted.
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by, reversal_of_journal_id
    ) VALUES ('journal-second-reversal', 'tenant-a', 'entity-a', 'OD', '2026-11-18', 'EUR',
              'REVERSAL', 'journal-a', 'tenant-a:reversal:2', 'user-a', 'journal-a')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('line-r2a', 'tenant-a', 'entity-a', 'journal-second-reversal', 'cash-a', 1, 'CREDIT', 10000, 'EUR')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('line-r2b', 'tenant-a', 'entity-a', 'journal-second-reversal', 'revenue-a', 2, 'DEBIT', 10000, 'EUR')
""")
try:
    db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-second-reversal'")
    raise AssertionError("Second posted reversal was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "UNIQUE" in str(exc), str(exc)

# Reversal matching must compare line multiplicities, not merely find one matching
# line for each original row (which would allow duplicated source lines to reuse one match).
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by
    ) VALUES ('journal-duplicate-original', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
              'TEST', 'duplicate-source', 'tenant-a:duplicate-original:1', 'user-a')
""")
for line_id, account_id, line_number, side in [
    ("dup-o1", "cash-a", 1, "DEBIT"),
    ("dup-o2", "cash-a", 2, "DEBIT"),
    ("dup-o3", "revenue-a", 3, "CREDIT"),
    ("dup-o4", "revenue-a", 4, "CREDIT"),
]:
    db.execute("""
        INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
        VALUES (?, 'tenant-a', 'entity-a', 'journal-duplicate-original', ?, ?, ?, 1000, 'EUR')
    """, (line_id, account_id, line_number, side))
db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-duplicate-original'")
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by, reversal_of_journal_id
    ) VALUES ('journal-duplicate-reversal', 'tenant-a', 'entity-a', 'OD', '2026-11-18', 'EUR',
              'REVERSAL', 'journal-duplicate-original', 'tenant-a:duplicate-reversal:1',
              'user-a', 'journal-duplicate-original')
""")
for line_id, account_id, line_number, side, amount in [
    ("dup-r1", "cash-a", 1, "CREDIT", 1000),
    ("dup-r2", "cash-a", 2, "CREDIT", 500),
    ("dup-r3", "revenue-a", 3, "DEBIT", 1000),
    ("dup-r4", "revenue-a", 4, "DEBIT", 500),
]:
    db.execute("""
        INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
        VALUES (?, 'tenant-a', 'entity-a', 'journal-duplicate-reversal', ?, ?, ?, ?, 'EUR')
    """, (line_id, account_id, line_number, side, amount))
try:
    db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-duplicate-reversal'")
    raise AssertionError("Non-exact duplicate-line reversal was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "EXACTLY_MIRROR" in str(exc), str(exc)
print("PASS: tenant-scoped double-entry posting, idempotency, immutable posts and exact reversal constraints.")


# Posted history must retain stable legal-entity and account classification metadata.
for sql in [
    "UPDATE accounting_entities SET base_currency='USD' WHERE id='entity-a'",
    "UPDATE accounting_entities SET legal_name='Renamed entity' WHERE id='entity-a'",
    "UPDATE accounting_accounts SET account_code='999999' WHERE id='cash-a'",
    "UPDATE accounting_accounts SET account_type='LIABILITY' WHERE id='cash-a'",
    "UPDATE accounting_accounts SET normal_balance='CREDIT' WHERE id='cash-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Posted ledger identity/classification mutation was incorrectly accepted: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "IMMUTABLE" in str(exc), str(exc)

# Operational deactivation is permitted without rewriting historical classification.
db.execute("UPDATE accounting_accounts SET is_active=0 WHERE id='cash-a'")
assert db.execute("SELECT is_active FROM accounting_accounts WHERE id='cash-a'").fetchone()[0] == 0

# Line currency must use the same uppercase ISO-like three-letter contract as the journal.
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by
    ) VALUES ('journal-currency-test', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
              'TEST', 'currency-test', 'tenant-a:currency-test:1', 'user-a')
""")
try:
    db.execute("""
        INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
        VALUES ('line-lowercase-currency', 'tenant-a', 'entity-a', 'journal-currency-test', 'revenue-a', 1, 'CREDIT', 100, 'eur')
    """)
    raise AssertionError("Lowercase journal-line currency was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "ACCOUNTING_LINE_CURRENCY_INVALID" in str(exc), str(exc)

print("PASS: posted legal-entity and account classification metadata are immutable; account deactivation remains available; line currency is normalized.")
# Entity tenancy is enforced by the database, not merely by caller-supplied IDs.
db.execute("INSERT INTO tenants(id, slug, display_name) VALUES ('tenant-inactive', 'tenant-inactive', 'Inactive tenant')")
db.execute("UPDATE tenants SET status='SUSPENDED' WHERE id='tenant-inactive'")
try:
    db.execute("INSERT INTO accounting_entities(id, tenant_id, legal_name, country_code, base_currency) VALUES ('entity-inactive-tenant', 'tenant-inactive', 'Inactive', 'FR', 'EUR')")
    raise AssertionError("Accounting entity for inactive tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "TENANT_NOT_ACTIVE" in str(exc), str(exc)
print("PASS: tenant membership lifecycle, cross-tenant event isolation, append-only audit and terminal revocation.")

# A selected tenant must be authorized at both session creation and later selection.
db.execute("UPDATE tenant_memberships SET status='ACTIVE', accepted_at=CURRENT_TIMESTAMP WHERE id='membership-a-reinvite'")
db.execute("""
    INSERT INTO sessions(id, user_id, token_hash, expires_at, active_tenant_id)
    VALUES ('session-a', 'user-a', 'synthetic-token-hash-a', '2027-01-01T00:00:00Z', 'tenant-a')
""")
try:
    db.execute("""
        INSERT INTO sessions(id, user_id, token_hash, expires_at, active_tenant_id)
        VALUES ('session-cross-tenant', 'user-a', 'synthetic-token-hash-cross', '2027-01-01T00:00:00Z', 'tenant-b')
    """)
    raise AssertionError("Session insert with a non-member tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "SESSION_ACTIVE_TENANT_MEMBERSHIP_REQUIRED" in str(exc), str(exc)
try:
    db.execute("UPDATE sessions SET active_tenant_id='tenant-b' WHERE id='session-a'")
    raise AssertionError("Session tenant switch without membership was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "SESSION_ACTIVE_TENANT_MEMBERSHIP_REQUIRED" in str(exc), str(exc)

# Explicit session revocation is reasoned, immutable and cannot be reversed.
try:
    db.execute("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id='session-a'")
    raise AssertionError("Session revocation without a reason was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "REVOCATION_REASON_REQUIRED" in str(exc), str(exc)
db.execute("""
    UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP, revoked_reason='USER_LOGOUT',
      revoked_by_user_id='user-a' WHERE id='session-a'
""")
for sql in [
    "UPDATE sessions SET revoked_at=NULL WHERE id='session-a'",
    "UPDATE sessions SET revoked_reason='ADMIN_REVOKED' WHERE id='session-a'",
    "UPDATE sessions SET token_hash='replacement-hash' WHERE id='session-a'",
    "UPDATE sessions SET user_id='user-b' WHERE id='session-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Revoked session was mutable or reactivatable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "IMMUTABLE" in str(exc) or "TERMINAL" in str(exc), str(exc)
print("PASS: explicit session revocation requires a reason and is terminal; session identity is immutable.")

# Journal currency must remain consistent from line creation through posting.
db.execute("UPDATE accounting_accounts SET is_active=1 WHERE id='cash-a'")
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by
    ) VALUES ('journal-currency-guard', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
              'TEST', 'currency-guard', 'tenant-a:currency-guard:1', 'user-a')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('currency-guard-debit', 'tenant-a', 'entity-a', 'journal-currency-guard', 'cash-a', 1, 'DEBIT', 2500, 'EUR')
""")
db.execute("""
    INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
    VALUES ('currency-guard-credit', 'tenant-a', 'entity-a', 'journal-currency-guard', 'revenue-a', 2, 'CREDIT', 2500, 'EUR')
""")
try:
    db.execute("UPDATE accounting_journals SET currency='USD' WHERE id='journal-currency-guard'")
    raise AssertionError("Draft journal currency changed after lines existed")
except sqlite3.IntegrityError as exc:
    assert "CURRENCY_IMMUTABLE_WITH_LINES" in str(exc), str(exc)
# Simulate legacy/corrupt data bypassing the currency immutability trigger, then
# prove the posting guard independently rejects the inconsistent header/lines.
db.execute("DROP TRIGGER trg_accounting_journal_currency_immutable_with_lines")
db.execute("UPDATE accounting_journals SET currency='USD' WHERE id='journal-currency-guard'")
try:
    db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-currency-guard'")
    raise AssertionError("Journal with line/header currency mismatch was posted")
except sqlite3.IntegrityError as exc:
    assert "LINE_CURRENCY_MISMATCH" in str(exc), str(exc)
db.execute("DROP TRIGGER trg_accounting_journal_post_currency_match")
db.execute("UPDATE accounting_journals SET currency='EUR' WHERE id='journal-currency-guard'")
db.executescript("""
CREATE TRIGGER trg_accounting_journal_currency_immutable_with_lines
BEFORE UPDATE OF currency ON accounting_journals
WHEN NEW.currency <> OLD.currency
  AND EXISTS (SELECT 1 FROM accounting_journal_lines WHERE journal_id=OLD.id AND tenant_id=OLD.tenant_id AND entity_id=OLD.entity_id)
BEGIN SELECT RAISE(ABORT, 'ACCOUNTING_JOURNAL_CURRENCY_IMMUTABLE_WITH_LINES'); END;
CREATE TRIGGER trg_accounting_journal_post_currency_match
BEFORE UPDATE OF status ON accounting_journals
WHEN OLD.status='DRAFT' AND NEW.status='POSTED'
  AND EXISTS (SELECT 1 FROM accounting_journal_lines WHERE journal_id=NEW.id AND (tenant_id<>NEW.tenant_id OR entity_id<>NEW.entity_id OR currency<>NEW.currency))
BEGIN SELECT RAISE(ABORT, 'ACCOUNTING_JOURNAL_LINE_CURRENCY_MISMATCH'); END;
""")
db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-currency-guard'")
assert db.execute("SELECT status FROM accounting_journals WHERE id='journal-currency-guard'").fetchone()[0] == "POSTED"
print("PASS: journal currency cannot change after lines exist; posting rejects any header/line currency mismatch.")


# Tenant deletion must not orphan accounting entities, even without memberships.
db.execute("INSERT INTO tenants(id, slug, display_name) VALUES ('tenant-orphan-guard', 'tenant-orphan-guard', 'Orphan Guard')")
db.execute("INSERT INTO accounting_entities(id, tenant_id, legal_name, country_code, base_currency) VALUES ('entity-orphan-guard', 'tenant-orphan-guard', 'Guard Entity', 'FR', 'EUR')")
try:
    db.execute("DELETE FROM tenants WHERE id='tenant-orphan-guard'")
    raise AssertionError("Tenant with an accounting entity and no memberships was incorrectly deletable")
except sqlite3.IntegrityError as exc:
    assert "TENANT_HAS_ACCOUNTING_ENTITIES" in str(exc), str(exc)
assert db.execute("SELECT tenant_id FROM accounting_entities WHERE id='entity-orphan-guard'").fetchone()[0] == "tenant-orphan-guard"
print("PASS: tenant deletion cannot orphan accounting entities even when no membership rows exist.")


# SUPRA audit and approval records remain append-only after additive migration 0029.
supra_triggers = {
    row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
}
required_supra_guards = {
    "trg_supra_audit_events_no_update",
    "trg_supra_audit_events_no_delete",
    "trg_supra_approval_requests_no_delete",
}
assert required_supra_guards <= supra_triggers, (
    f"Missing SUPRA append-only guards: {sorted(required_supra_guards-supra_triggers)}"
)

db.execute("""
    INSERT INTO supra_audit_events(
      id, tenant_id, actor_user_id, actor_role, event_type, domain, action, risk,
      approval_required, execution_allowed
    ) VALUES (
      'supra-audit-synthetic', 'tenant-a', 'user-a', 'gerante', 'PLAN_CREATED',
      'GOVERNANCE', 'RECOMMEND_ONLY', 'LOW', 0, 0
    )
""")
db.execute("""
    INSERT INTO supra_approval_requests(
      id, requester_user_id, tenant_id, action, resource_id, payload_hash,
      payload_json, reason, risk, required_approvals, expires_at
    ) VALUES (
      'supra-approval-synthetic', 'user-a', 'tenant-a', 'SIMULATE_ONLY',
      'synthetic-resource', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '{}', 'synthetic migration test', 'LOW', 1, '2026-11-20T12:00:00Z'
    )
""")
for sql in [
    "UPDATE supra_audit_events SET action='TAMPERED' WHERE id='supra-audit-synthetic'",
    "DELETE FROM supra_audit_events WHERE id='supra-audit-synthetic'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"SUPRA audit history was mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "SUPRA_AUDIT_EVENTS_ARE_APPEND_ONLY" in str(exc), str(exc)
try:
    db.execute("DELETE FROM supra_approval_requests WHERE id='supra-approval-synthetic'")
    raise AssertionError("SUPRA approval request was deletable")
except sqlite3.IntegrityError as exc:
    assert "APPROVAL_REQUESTS_ARE_APPEND_ONLY" in str(exc), str(exc)
print("PASS: SUPRA audit events and approval requests reject UPDATE/DELETE under migration 0029.")


# Nexus Supra audit events are attributed to an active tenant at the database boundary.
audit_columns = {row[1] for row in db.execute("PRAGMA table_info(supra_audit_events)")}
assert "tenant_id" in audit_columns, "SUPRA audit table must include tenant_id"
try:
    db.execute("INSERT INTO supra_audit_events(id, actor_user_id, actor_role, event_type, domain, action, risk, approval_required) VALUES ('bad-audit', 'user-a', 'GERANTE', 'TEST', 'security', 'TEST', 'LOW', 0)")
    raise AssertionError("SUPRA audit event without tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "SUPRA_AUDIT_ACTIVE_TENANT_REQUIRED" in str(exc), str(exc)
db.execute("INSERT INTO supra_audit_events(id, tenant_id, actor_user_id, actor_role, event_type, domain, action, risk, approval_required) VALUES ('good-audit', 'tenant-a', 'user-a', 'GERANTE', 'TEST', 'security', 'TEST', 'LOW', 0)")
try:
    db.execute("INSERT INTO supra_audit_events(id, tenant_id, actor_user_id, actor_role, event_type, domain, action, risk, approval_required) VALUES ('inactive-audit', 'unknown-tenant', 'user-a', 'GERANTE', 'TEST', 'security', 'TEST', 'LOW', 0)")
    raise AssertionError("SUPRA audit event for an unknown tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "SUPRA_AUDIT_ACTIVE_TENANT_REQUIRED" in str(exc), str(exc)

# Operational marketplace rows are tenant-scoped at the database boundary.
marketplace_columns = {
    "clients", "intervenants", "prestations", "missions", "tarifs", "paiements",
    "disponibilites", "evaluations", "documents", "conflits", "journal", "wallets",
}
for table in sorted(marketplace_columns):
    columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    assert "tenant_id" in columns, f"{table} is missing tenant_id"
marketplace_triggers = {
    row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
}
required_marketplace_triggers = {
    "trg_clients_require_active_tenant", "trg_intervenants_require_active_tenant",
    "trg_prestations_require_active_tenant", "trg_missions_require_active_tenant",
    "trg_tarifs_require_active_tenant", "trg_paiements_require_active_tenant",
    "trg_disponibilites_require_active_tenant", "trg_evaluations_require_active_tenant",
    "trg_documents_require_active_tenant", "trg_conflits_require_active_tenant",
    "trg_journal_require_active_tenant", "trg_wallets_require_active_tenant",
    "trg_clients_membership_scope", "trg_intervenants_membership_scope",
    "trg_wallets_membership_scope", "trg_documents_membership_scope",
    "trg_missions_relationship_scope_insert", "trg_missions_relationship_scope_update",
    "trg_availability_intervenant_scope", "trg_availability_intervenant_scope_update",
    "trg_tarif_prestation_scope", "trg_tarif_prestation_scope_update",
    "trg_payment_mission_scope", "trg_payment_mission_scope_update",
    "trg_evaluation_mission_scope", "trg_evaluation_mission_scope_update",
    "trg_conflict_mission_scope", "trg_conflict_mission_scope_update",
}
required_marketplace_indexes = {"idx_clients_id_tenant", "idx_intervenants_id_tenant", "idx_prestations_id_tenant", "idx_missions_id_tenant", "idx_disponibilites_id_tenant"}
marketplace_indexes = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='index'")}
assert required_marketplace_indexes <= marketplace_indexes, f"Missing composite tenant indexes: {sorted(required_marketplace_indexes-marketplace_indexes)}"
required_marketplace_triggers |= {
    f"trg_{table}_tenant_immutable" for table in marketplace_columns
}
assert required_marketplace_triggers <= marketplace_triggers, (
    f"Missing operational marketplace tenant guards: {sorted(required_marketplace_triggers-marketplace_triggers)}"
)

# Create two isolated tenants and active memberships for synthetic users.
for user_id, email, role in [
    ("market-client-a", "market-client-a@example.test", "client"),
    ("market-worker-a", "market-worker-a@example.test", "intervenant"),
    ("market-client-b", "market-client-b@example.test", "client"),
    ("market-worker-b", "market-worker-b@example.test", "intervenant"),
    ("market-manager-a", "market-manager-a@example.test", "gerante"),
    ("market-manager-b", "market-manager-b@example.test", "gerante"),
]:
    db.execute(
        "INSERT INTO users(id, role, email, first_name, last_name, password_hash) VALUES (?, ?, ?, 'Synthetic', 'Marketplace', 'synthetic')",
        (user_id, role, email),
    )
for tenant_id, slug in [("market-tenant-a", "market-tenant-a"), ("market-tenant-b", "market-tenant-b")]:
    db.execute("INSERT INTO tenants(id, slug, display_name) VALUES (?, ?, ?)", (tenant_id, slug, slug))
for suffix, tenant_id, user_id in [
    ("client-a", "market-tenant-a", "market-client-a"),
    ("worker-a", "market-tenant-a", "market-worker-a"),
    ("client-b", "market-tenant-b", "market-client-b"),
    ("worker-b", "market-tenant-b", "market-worker-b"),
]:
    membership_id = f"membership-{suffix}"
    db.execute(
        "INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id) VALUES (?, ?, ?, 'MEMBER', 'INVITED', 'user-admin')",
        (membership_id, tenant_id, user_id),
    )
    db.execute(
        "UPDATE tenant_memberships SET status='ACTIVE', accepted_at=CURRENT_TIMESTAMP WHERE id=?",
        (membership_id,),
    )

# Missing tenant, inactive tenant, or non-member owner must be rejected.
try:
    db.execute("INSERT INTO clients(id, user_id, tenant_id) VALUES ('market-client-no-tenant', 'market-client-a', NULL)")
    raise AssertionError("Client without tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert any(code in str(exc) for code in ("CLIENT_ACTIVE_TENANT_REQUIRED", "CLIENT_TENANT_MEMBERSHIP_REQUIRED")), str(exc)
try:
    db.execute("INSERT INTO intervenants(id, user_id, tenant_id) VALUES ('market-worker-cross', 'market-worker-a', 'tenant-b')")
    raise AssertionError("Intervenant assigned to a non-member tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "INTERVENANT_TENANT_MEMBERSHIP_REQUIRED" in str(exc), str(exc)

db.execute("INSERT INTO clients(id, user_id, tenant_id) VALUES ('market-client-a-row', 'market-client-a', 'market-tenant-a')")
db.execute("INSERT INTO intervenants(id, user_id, tenant_id) VALUES ('market-worker-a-row', 'market-worker-a', 'market-tenant-a')")
db.execute("INSERT INTO clients(id, user_id, tenant_id) VALUES ('market-client-b-row', 'market-client-b', 'market-tenant-b')")
db.execute("INSERT INTO intervenants(id, user_id, tenant_id, validation_status) VALUES ('market-worker-b-row', 'market-worker-b', 'market-tenant-b', 'approved')")
db.execute("INSERT INTO prestations(id, name, tenant_id) VALUES ('market-service-a', 'Synthetic service A', 'market-tenant-a')")
db.execute("INSERT INTO prestations(id, name, tenant_id) VALUES ('market-service-b', 'Synthetic service B', 'market-tenant-b')")
db.execute("""
    INSERT INTO missions(id, client_id, intervenant_id, prestation_id, start_at, tenant_id)
    VALUES ('market-mission-a', 'market-client-a-row', 'market-worker-a-row', 'market-service-a', '2026-11-21T09:00:00Z', 'market-tenant-a')
""")
try:
    db.execute("""
        INSERT INTO missions(id, client_id, intervenant_id, prestation_id, start_at, tenant_id)
        VALUES ('market-mission-cross', 'market-client-a-row', 'market-worker-b-row', 'market-service-a', '2026-11-21T09:00:00Z', 'market-tenant-a')
    """)
    raise AssertionError("Cross-tenant mission assignment was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "MISSION_RELATIONSHIP_TENANT_MISMATCH" in str(exc), str(exc)
try:
    db.execute("""
        INSERT INTO disponibilites(id, intervenant_id, start_at, end_at, tenant_id)
        VALUES ('market-availability-cross', 'market-worker-b-row', '2026-11-21T09:00:00Z', '2026-11-21T12:00:00Z', 'market-tenant-a')
    """)
    raise AssertionError("Cross-tenant availability was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "AVAILABILITY_INTERVENANT_TENANT_MISMATCH" in str(exc), str(exc)
db.execute("""
    INSERT INTO disponibilites(id, intervenant_id, start_at, end_at, tenant_id)
    VALUES ('market-availability-a', 'market-worker-a-row', '2026-11-21T09:00:00Z', '2026-11-21T12:00:00Z', 'market-tenant-a')
""")
db.execute("""
    INSERT INTO wallets(id, user_id, tenant_id, currency) VALUES ('market-wallet-a', 'market-worker-a', 'market-tenant-a', 'EUR')
""")
db.execute("""
    INSERT INTO documents(id, user_id, document_type, file_reference, tenant_id)
    VALUES ('market-document-a', 'market-worker-a', 'IDENTITY', 'synthetic://document', 'market-tenant-a')
""")
try:
    db.execute("UPDATE missions SET tenant_id='market-tenant-b' WHERE id='market-mission-a'")
    raise AssertionError("Mission tenant reassignment was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "TENANT_IMMUTABLE" in str(exc) or "MISSION_RELATIONSHIP_TENANT_MISMATCH" in str(exc), str(exc)
print("PASS: operational marketplace tables require active tenant membership, tenant-consistent mission relations and immutable tenant ownership.")

db.execute("""
    INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id, accepted_at)
    VALUES ('membership-manager-b', 'market-tenant-b', 'market-manager-b', 'MANAGER', 'ACTIVE', 'user-admin', CURRENT_TIMESTAMP)
""")
db.execute("""
    INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id, accepted_at)
    VALUES ('membership-manager-a', 'market-tenant-a', 'market-manager-a', 'MANAGER', 'ACTIVE', 'user-admin', CURRENT_TIMESTAMP)
""")
# Privacy-safe cross-tenant opportunity publication, application and atomic assignment.
marketplace_tables = {
    row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")
}
required_marketplace_tables = {
    "mission_opportunity_consents", "mission_opportunities", "mission_applications", "mission_assignments", "intervenant_skills",
}
assert required_marketplace_tables <= marketplace_tables, (
    f"Missing cross-tenant marketplace tables: {sorted(required_marketplace_tables-marketplace_tables)}"
)
for table in required_marketplace_tables:
    columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    assert "owner_tenant_id" in columns or "tenant_id" in columns, f"{table} missing tenant scope"
opportunity_columns = {row[1] for row in db.execute("PRAGMA table_info(mission_opportunities)")}
assert "address" not in opportunity_columns and "client_user_id" not in opportunity_columns, (
    "Public opportunity read model must not contain client address or client identity"
)

db.execute("""
    INSERT INTO missions(
      id, client_id, intervenant_id, prestation_id, start_at, end_at,
      price_client, price_intervenant, commission, status, tenant_id
    ) VALUES (
      'market-mission-opportunity', 'market-client-a-row', NULL, 'market-service-a',
      '2026-11-23T09:00:00Z', '2026-11-23T11:00:00Z',
      60, 40, 20, 'requested', 'market-tenant-a'
    )
""")
db.execute("""
    INSERT INTO mission_opportunity_consents(
      id, owner_tenant_id, mission_id, client_user_id, consent_version, evidence_sha256
    ) VALUES (
      'market-consent-a', 'market-tenant-a', 'market-mission-opportunity',
      'market-client-a', 'privacy-v1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
""")
db.execute("""
    INSERT INTO mission_opportunities(
      id, owner_tenant_id, mission_id, consent_id, category_code, public_summary,
      city, postal_prefix, start_at, end_at, provider_pay_cents, currency,
      required_skills_json, published_by_user_id, expires_at
    ) VALUES (
      'market-opportunity-a', 'market-tenant-a', 'market-mission-opportunity',
      'market-consent-a', 'CLEANING', 'Nettoyage ponctuel d’un logement',
      'Aubergenville', '78', '2026-11-23T09:00:00Z', '2026-11-23T11:00:00Z',
      4000, 'EUR', '["cleaning"]', 'market-client-a', '2026-11-22T23:00:00Z'
    )
""")
db.execute("""
    INSERT INTO disponibilites(id, intervenant_id, start_at, end_at, status, tenant_id)
    VALUES (
      'market-availability-b-opportunity', 'market-worker-b-row',
      '2026-11-23T08:00:00Z', '2026-11-23T12:00:00Z', 'available', 'market-tenant-b'
    )
""")
try:
    db.execute("""
        INSERT INTO mission_applications(
          id, opportunity_id, owner_tenant_id, applicant_tenant_id,
          intervenant_id, applicant_user_id, provider_pay_cents, currency, idempotency_key
        ) VALUES (
          'market-application-without-skill', 'market-opportunity-a', 'market-tenant-a',
          'market-tenant-b', 'market-worker-b-row', 'market-worker-b',
          4000, 'EUR', 'market-apply-no-skill-0001'
        )
    """)
    raise AssertionError("Application without verified required skill was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "MISSION_APPLICATION_ELIGIBILITY_GUARD_FAILED" in str(exc), str(exc)
try:
    db.execute("""
        INSERT INTO intervenant_skills(
          id, tenant_id, intervenant_id, skill_code, verification_status,
          evidence_sha256, verified_by_user_id, verified_at
        ) VALUES (
          'market-skill-unverified-reviewer', 'market-tenant-b', 'market-worker-b-row',
          'cleaning', 'VERIFIED', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          'market-worker-b', CURRENT_TIMESTAMP
        )
    """)
    raise AssertionError("Provider self-verification of a required skill was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "INTERVENANT_SKILL_VERIFIER_NOT_AUTHORIZED" in str(exc), str(exc)
db.execute("""
    INSERT INTO intervenant_skills(
      id, tenant_id, intervenant_id, skill_code, verification_status,
      evidence_sha256, verified_by_user_id, verified_at
    ) VALUES (
      'market-skill-b-cleaning', 'market-tenant-b', 'market-worker-b-row',
      'cleaning', 'VERIFIED', 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'market-manager-b', CURRENT_TIMESTAMP
    )
""")
db.execute("""
    INSERT INTO mission_applications(
      id, opportunity_id, owner_tenant_id, applicant_tenant_id,
      intervenant_id, applicant_user_id, provider_pay_cents, currency, idempotency_key, public_note
    ) VALUES (
      'market-application-b', 'market-opportunity-a', 'market-tenant-a',
      'market-tenant-b', 'market-worker-b-row', 'market-worker-b',
      4000, 'EUR', 'market-apply-worker-b-0001', 'Disponible pour cette mission.'
    )
""")
db.execute("""
    UPDATE mission_applications
       SET status='ACCEPTED', decided_at=CURRENT_TIMESTAMP,
           decided_by_user_id='market-manager-a', version=version+1
     WHERE id='market-application-b'
""")
assignment = db.execute("""
    SELECT provider_tenant_id, intervenant_id, status
      FROM mission_assignments WHERE opportunity_id='market-opportunity-a'
""").fetchone()
assert assignment == ("market-tenant-b", "market-worker-b-row", "ASSIGNED"), assignment
assert db.execute("SELECT status FROM mission_opportunities WHERE id='market-opportunity-a'").fetchone()[0] == "FILLED"
assert db.execute("SELECT intervenant_id FROM missions WHERE id='market-mission-opportunity'").fetchone()[0] is None, (
    "Cross-tenant assignment must not be written into the legacy same-tenant mission.intervenant_id field"
)

# A second provider cannot apply after the opportunity is atomically filled.
db.execute("UPDATE intervenants SET validation_status='approved' WHERE id='market-worker-a-row'")
db.execute("""
    INSERT INTO disponibilites(id, intervenant_id, start_at, end_at, status, tenant_id)
    VALUES (
      'market-availability-a-opportunity', 'market-worker-a-row',
      '2026-11-23T08:00:00Z', '2026-11-23T12:00:00Z', 'available', 'market-tenant-a'
    )
""")
try:
    db.execute("""
        INSERT INTO mission_applications(
          id, opportunity_id, owner_tenant_id, applicant_tenant_id,
          intervenant_id, applicant_user_id, provider_pay_cents, currency, idempotency_key
        ) VALUES (
          'market-application-second', 'market-opportunity-a', 'market-tenant-a',
          'market-tenant-a', 'market-worker-a-row', 'market-worker-a',
          4000, 'EUR', 'market-apply-worker-a-0001'
        )
    """)
    raise AssertionError("Application was accepted after opportunity was filled")
except sqlite3.IntegrityError as exc:
    assert "MISSION_APPLICATION_ELIGIBILITY_GUARD_FAILED" in str(exc), str(exc)

# A revoked consent cancels an open listing and permanently prevents new applications.
db.execute("""
    INSERT INTO missions(
      id, client_id, intervenant_id, prestation_id, start_at, end_at,
      price_client, price_intervenant, commission, status, tenant_id
    ) VALUES (
      'market-mission-revoke', 'market-client-a-row', NULL, 'market-service-a',
      '2026-11-24T09:00:00Z', '2026-11-24T11:00:00Z',
      60, 40, 20, 'requested', 'market-tenant-a'
    )
""")
db.execute("""
    INSERT INTO mission_opportunity_consents(
      id, owner_tenant_id, mission_id, client_user_id, consent_version, evidence_sha256
    ) VALUES (
      'market-consent-revoke', 'market-tenant-a', 'market-mission-revoke',
      'market-client-a', 'privacy-v1', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    )
""")
db.execute("""
    INSERT INTO mission_opportunities(
      id, owner_tenant_id, mission_id, consent_id, category_code, public_summary,
      city, start_at, end_at, provider_pay_cents, currency, published_by_user_id, expires_at
    ) VALUES (
      'market-opportunity-revoke', 'market-tenant-a', 'market-mission-revoke',
      'market-consent-revoke', 'CLEANING', 'Nettoyage ponctuel d’un logement',
      'Aubergenville', '2026-11-24T09:00:00Z', '2026-11-24T11:00:00Z',
      4000, 'EUR', 'market-client-a', '2026-11-23T23:00:00Z'
    )
""")
db.execute("UPDATE mission_opportunity_consents SET revoked_at=CURRENT_TIMESTAMP WHERE id='market-consent-revoke'")
assert db.execute("SELECT status FROM mission_opportunities WHERE id='market-opportunity-revoke'").fetchone()[0] == "CANCELLED"
for table in ["mission_opportunity_consents", "mission_opportunities", "mission_applications", "mission_assignments"]:
    try:
        db.execute(f"DELETE FROM {table} WHERE id=(SELECT id FROM {table} LIMIT 1)")
        raise AssertionError(f"{table} history was deletable")
    except sqlite3.IntegrityError:
        pass
print("PASS: privacy-safe cross-tenant marketplace consent, publication, eligibility, atomic acceptance, one-provider assignment, cancellation and append-only history.")
