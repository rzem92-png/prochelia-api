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
    "0033_intervenant_availability_overlap_guard.sql",
    "0034_timezone_safe_availability_overlap.sql",
    "0035_validate_availability_intervals.sql",
    "0036_intervenant_availability_idempotency.sql",
    "0037_support_cases_tenant_isolation.sql",
    "0038_identity_verification_tenant_scope.sql",
    "0039_cryptographic_device_enrollment.sql",
    "0040_accounting_active_state_at_posting.sql",
    "0041_tenant_invitation_onboarding.sql",
    "0042_financial_tenant_scope.sql",
    "0043_finance_workspace_tenant_scope.sql",
    "0044_security_records_tenant_scope.sql",
    "0045_wallet_tenant_currency_scope.sql",
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
assert "if len(local) != 46:" in workflow_text, (
    "Preview migration workflow must require exactly 46 canonical migrations"
)
assert "exact 46-entry registry" in workflow_text, (
    "Preview migration workflow target registry count is stale"
)
assert "all 46 canonical migrations are pending" in workflow_text, (
    "Preview migration workflow empty-database inventory message is stale"
)
assert "only migrations 0023-0045 are pending" in workflow_text, (
    "Preview migration workflow baseline-to-target range is stale"
)
assert '"0045_wallet_tenant_currency_scope.sql"' in workflow_text, (
    "Preview migration workflow omits tenant/currency-scoped wallet migration 0045"
)
assert '"0044_security_records_tenant_scope.sql"' in workflow_text, (
    "Preview migration workflow omits tenant-scoped security migration 0044"
)
assert '"0038_identity_verification_tenant_scope.sql"' in workflow_text, (
    "Preview migration workflow omits tenant-scoped identity migration 0038"
)
assert '"0036_intervenant_availability_idempotency.sql"' in workflow_text, (
    "Preview migration workflow omits availability idempotency migration 0036"
)
assert '"0035_validate_availability_intervals.sql"' in workflow_text, (
    "Preview migration workflow omits availability interval validation migration 0035"
)

actual = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
assert actual == sorted(EXPECTED), (
    f"Canonical Preview migration chain mismatch. Missing={sorted(set(EXPECTED)-set(actual))}; "
    f"unexpected={sorted(set(actual)-set(EXPECTED))}"
)

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")
# Start from a truly empty D1 database, matching the newly created EU Preview target.
# Apply the reviewed baseline and candidate migrations through 0043 first.
for name in EXPECTED[:-2]:
    if name == "0031_operational_marketplace_tenant_scope.sql":
        # Preserve a pre-tenant wallet without guessing its legal-entity attribution.
        db.execute(
            """INSERT INTO wallets(
                 id,user_id,currency,available_cents,pending_cents,paid_cents,reserved_cents
               ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("legacy-wallet-1", "legacy-user-1", "EUR", 4200, 50, 10, 0),
        )
    db.executescript((MIGRATIONS / name).read_text(encoding="utf-8"))

# Simulate pre-existing legacy security records before 0044. The migration must
# preserve them without inventing a tenant attribution or making them writable.
db.execute(
    "INSERT INTO mission_security(id, mission_id, client_id, intervenant_id) VALUES (?, ?, ?, ?)",
    ("legacy-security-1", "legacy-mission-1", "legacy-client-1", "legacy-intervenant-1"),
)
db.execute(
    "INSERT INTO mission_security_attempts(id, security_id, purpose, result) VALUES (?, ?, ?, ?)",
    ("legacy-security-attempt-1", "legacy-security-1", "ARRIVAL", "BLOCKED"),
)
db.execute(
    "INSERT INTO security_audit(id, event_type, result) VALUES (?, ?, ?)",
    ("legacy-security-audit-1", "LEGACY_EVENT", "BLOCKED"),
)

db.executescript((MIGRATIONS / EXPECTED[-2]).read_text(encoding="utf-8"))
db.executescript((MIGRATIONS / EXPECTED[-1]).read_text(encoding="utf-8"))
legacy_wallet = db.execute(
    "SELECT tenant_id, available_cents, pending_cents, paid_cents, reserved_cents FROM wallets WHERE id=?",
    ("legacy-wallet-1",),
).fetchone()
assert legacy_wallet == (None, 4200, 50, 10, 0), "Legacy wallet balances and NULL tenant attribution must be preserved"

violations = db.execute("PRAGMA foreign_key_check").fetchall()
assert not violations, f"Canonical migration chain creates foreign-key violations: {violations[:10]}"

tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
indexes = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='index'")}
wallet_unique_indexes = []
for index in db.execute("PRAGMA index_list(wallets)").fetchall():
    if index[2]:
        columns = [row[2] for row in db.execute(f'PRAGMA index_info("{index[1]}")').fetchall()]
        wallet_unique_indexes.append(columns)
assert ["tenant_id", "user_id", "currency"] in wallet_unique_indexes, "Wallet uniqueness must be scoped to tenant and currency"
assert ["user_id"] not in wallet_unique_indexes, "Global user-only wallet uniqueness blocks multi-tenant providers"
assert "idx_wallets_tenant_user_currency" in indexes, "Missing named tenant/currency wallet unique index"
assert db.execute("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='trg_wallets_currency_immutable'").fetchone(), "Wallet currency must be immutable after tenant/currency identity is established"
assert "idx_disponibilites_tenant_intervenant_idempotency" in indexes, "Missing durable availability idempotency index"
assert "idx_support_cases_tenant_status_created" in indexes, "Missing tenant-scoped support status index"
assert "idx_support_cases_tenant_requester_created" in indexes, "Missing tenant-scoped support requester index"
assert "support_cases" in tables, "Missing tenant-scoped support case table"
assert {"trusted_device_credentials", "device_auth_challenges"} <= tables, "Missing cryptographic device enrollment tables"
assert {"idx_trusted_device_credentials_tenant_user_status", "idx_device_auth_challenges_session_expiry", "idx_device_auth_challenges_pending"} <= indexes, "Missing cryptographic device enrollment indexes"
required = {
    "users", "sessions", "clients", "intervenants", "missions",
    "auth_login_rate_limits", "supra_audit_events",
    "supra_approval_requests", "supra_approval_votes", "supra_approval_events",
}
assert required <= tables, f"Canonical migration chain missing tables: {sorted(required-tables)}"


invitation_indexes = {
    "idx_tenant_invitations_one_pending_email",
    "idx_tenant_invitations_expiry",
    "idx_tenant_invitations_membership",
    "idx_tenant_invitation_events_tenant_time",
}
assert invitation_indexes <= indexes, f"Missing tenant invitation indexes: {sorted(invitation_indexes-indexes)}"
invitation_triggers = {
    "trg_tenant_invitation_requires_pending_member",
    "trg_tenant_invitation_initial_pending",
    "trg_tenant_invitation_identity_immutable",
    "trg_tenant_invitation_terminal",
    "trg_tenant_invitation_events_no_update",
    "trg_tenant_invitation_events_no_delete",
    "trg_tenant_invitation_authorized_inviter",
    "trg_tenant_invitation_event_actor_tenant",
    "trg_tenant_invitation_email_matches_member",
}
triggers = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
assert invitation_triggers <= triggers, f"Missing tenant invitation triggers: {sorted(invitation_triggers-triggers)}"
invitation_fk_targets = {row[2] for row in db.execute("PRAGMA foreign_key_list(tenant_invitations)")}
assert {"tenants", "tenant_memberships", "users"} <= invitation_fk_targets, "Tenant invitations must reference canonical tenant, membership and user identities"
invitation_columns = {row[1] for row in db.execute("PRAGMA table_info(tenant_invitations)")}
assert "token_sha256" in invitation_columns and "token" not in invitation_columns, "Only token digests may be persisted"

print(f"PASS: all {len(EXPECTED)} canonical Preview migrations apply from an empty D1 database; legacy security records remain unassigned; foreign_key_check=0.")


# Double-entry accounting invariants: tenant scoping, idempotency, balanced posting,
# immutable posted records and exact mirror reversals.
accounting_tables = {
    "accounting_entities", "accounting_accounts",
    "accounting_journals", "accounting_journal_lines",
}
assert accounting_tables <= tables, f"Missing accounting tables: {sorted(accounting_tables-tables)}"
accounting_entity_fk_targets = {row[2] for row in db.execute("PRAGMA foreign_key_list(accounting_entities)")}
assert "tenants" in accounting_entity_fk_targets, "Accounting entities must reference the canonical tenants registry"
# Tenant authority and membership lifecycle fixtures.
tenant_tables = {"tenants", "tenant_memberships", "tenant_membership_events", "tenant_invitations", "tenant_invitation_events"}
assert tenant_tables <= tables, f"Missing tenant authority tables: {sorted(tenant_tables-tables)}"
for user_id, email in [("user-a", "user-a@example.test"), ("user-b", "user-b@example.test"), ("user-admin", "admin@example.test"), ("user-multi", "multi@example.test")]:
    db.execute("INSERT INTO users(id, role, email, first_name, last_name, password_hash) VALUES (?, 'client', ?, 'Synthetic', 'User', 'not-a-real-password-hash')", (user_id, email))
db.execute("INSERT INTO tenants(id, slug, display_name) VALUES ('tenant-a', 'tenant-a', 'Tenant A')")
db.execute("INSERT INTO tenants(id, slug, display_name) VALUES ('tenant-b', 'tenant-b', 'Tenant B')")
db.execute("INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, invited_by_user_id) VALUES ('membership-a', 'tenant-a', 'user-a', 'OWNER', 'INVITED', 'user-admin')")

db.execute("UPDATE tenant_memberships SET status='ACTIVE', accepted_at=CURRENT_TIMESTAMP WHERE id='membership-a'")

# One synthetic user may legitimately hold active memberships in multiple companies.
# PSP accounts are scoped to each company, not globally unique by user.
db.execute("""
    INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, accepted_at)
    VALUES ('membership-multi-a', 'tenant-a', 'user-multi', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
""")
db.execute("""
    INSERT INTO tenant_memberships(id, tenant_id, user_id, role, status, accepted_at)
    VALUES ('membership-multi-b', 'tenant-b', 'user-multi', 'MEMBER', 'ACTIVE', CURRENT_TIMESTAMP)
""")
db.execute("""
    INSERT INTO payment_accounts(id, user_id, provider, tenant_id)
    VALUES ('payment-account-multi-a', 'user-multi', 'stripe', 'tenant-a')
""")
db.execute("""
    INSERT INTO payment_accounts(id, user_id, provider, tenant_id)
    VALUES ('payment-account-multi-b', 'user-multi', 'stripe', 'tenant-b')
""")
account_unique_indexes = []
for index in db.execute("PRAGMA index_list(payment_accounts)").fetchall():
    if index[2]:
        columns = [row[2] for row in db.execute(f'PRAGMA index_info("{index[1]}")').fetchall()]
        account_unique_indexes.append(columns)
assert ["tenant_id", "user_id"] in account_unique_indexes, "PSP account uniqueness must be scoped to tenant and user"
assert ["user_id"] not in account_unique_indexes, "Global user-only PSP account uniqueness breaks multi-tenant companies"
try:
    db.execute("""
        INSERT INTO payment_accounts(id, user_id, provider, tenant_id)
        VALUES ('payment-account-multi-a-duplicate', 'user-multi', 'stripe', 'tenant-a')
    """)
    raise AssertionError("Duplicate PSP account for the same user and tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "payment_accounts.tenant_id" in str(exc) and "payment_accounts.user_id" in str(exc), str(exc)
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

# Tenant invitation invariants: only an active tenant manager may invite a pre-provisioned pending member.
db.execute("UPDATE tenant_memberships SET status='ACTIVE', accepted_at=CURRENT_TIMESTAMP WHERE id='membership-owner-a2'")
db.execute("""
    INSERT INTO tenant_invitations(
      id, tenant_id, membership_id, email_normalized, token_sha256,
      idempotency_key, invited_by_user_id, expires_at
    ) VALUES (
      'invitation-a', 'tenant-a', 'membership-a-reinvite', 'user-a@example.test',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'invite-idem-1', 'user-b', datetime('now', '+1 day')
    )
""")
try:
    db.execute("""
        INSERT INTO tenant_invitations(
          id, tenant_id, membership_id, email_normalized, token_sha256,
          idempotency_key, invited_by_user_id, expires_at
        ) VALUES (
          'invitation-a-duplicate', 'tenant-a', 'membership-a-reinvite', 'user-a@example.test',
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          'invite-idem-2', 'user-b', datetime('now', '+1 day')
        )
    """)
    raise AssertionError("Duplicate pending tenant invitation was incorrectly accepted")
except sqlite3.IntegrityError:
    pass
try:
    db.execute("UPDATE tenant_invitations SET email_normalized='other@example.test' WHERE id='invitation-a'")
    raise AssertionError("Tenant invitation identity was mutable")
except sqlite3.IntegrityError as exc:
    assert "TENANT_INVITATION_IDENTITY_IMMUTABLE" in str(exc), str(exc)
try:
    db.execute("""
        INSERT INTO tenant_invitation_events(id, invitation_id, tenant_id, actor_user_id, event_type, reason_code)
        VALUES ('invitation-event-cross-tenant', 'invitation-a', 'tenant-a', 'user-admin', 'CREATED', 'CROSS_TENANT')
    """)
    raise AssertionError("Cross-tenant invitation event actor was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "TENANT_INVITATION_EVENT_ACTOR_TENANT_MISMATCH" in str(exc), str(exc)
db.execute("""
    INSERT INTO tenant_invitation_events(id, invitation_id, tenant_id, actor_user_id, event_type, reason_code)
    VALUES ('invitation-event-a', 'invitation-a', 'tenant-a', 'user-b', 'CREATED', 'TEST_CREATED')
""")
for sql in [
    "UPDATE tenant_invitation_events SET reason_code='tampered' WHERE id='invitation-event-a'",
    "DELETE FROM tenant_invitation_events WHERE id='invitation-event-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Tenant invitation event history was mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "APPEND_ONLY" in str(exc), str(exc)
db.execute("UPDATE tenant_invitations SET status='ACCEPTED', accepted_at=CURRENT_TIMESTAMP WHERE id='invitation-a'")
try:
    db.execute("UPDATE tenant_invitations SET status='REVOKED', accepted_at=NULL, revoked_at=CURRENT_TIMESTAMP WHERE id='invitation-a'")
    raise AssertionError("Terminal tenant invitation was incorrectly changed")
except sqlite3.IntegrityError as exc:
    assert "TENANT_INVITATION_TERMINAL" in str(exc), str(exc)

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

# Posting must re-check the current state, not rely only on account state
# when draft lines were inserted.
db.execute("""
    INSERT INTO accounting_journals(
      id, tenant_id, entity_id, journal_code, journal_date, currency,
      source_type, source_id, idempotency_key, created_by
    ) VALUES ('journal-account-state', 'tenant-a', 'entity-a', 'VE', '2026-11-18', 'EUR',
              'TEST', 'account-state', 'tenant-a:account-state:1', 'user-a')
""")
for line_id, account_id, line_number, side in [
    ("state-line-1", "cash-a", 1, "DEBIT"),
    ("state-line-2", "revenue-a", 2, "CREDIT"),
]:
    db.execute("""
        INSERT INTO accounting_journal_lines(id, tenant_id, entity_id, journal_id, account_id, line_number, side, amount_cents, currency)
        VALUES (?, 'tenant-a', 'entity-a', 'journal-account-state', ?, ?, ?, 2500, 'EUR')
    """, (line_id, account_id, line_number, side))
db.execute("UPDATE accounting_accounts SET is_active=0 WHERE id='revenue-a'")
try:
    db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-account-state'")
    raise AssertionError("Journal posted with an account deactivated after draft-line insertion")
except sqlite3.IntegrityError as exc:
    assert "ACCOUNT_INACTIVE_AT_POSTING" in str(exc), str(exc)
db.execute("UPDATE accounting_accounts SET is_active=1 WHERE id='revenue-a'")
db.execute("UPDATE accounting_entities SET status='SUSPENDED' WHERE id='entity-a'")
try:
    db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-account-state'")
    raise AssertionError("Journal posted for a suspended accounting entity")
except sqlite3.IntegrityError as exc:
    assert "ACCOUNTING_ENTITY_INACTIVE_AT_POSTING" in str(exc), str(exc)
db.execute("UPDATE accounting_entities SET status='ACTIVE' WHERE id='entity-a'")
db.execute("UPDATE accounting_journals SET status='POSTED', posted_by='user-a', posted_at=CURRENT_TIMESTAMP WHERE id='journal-account-state'")

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

# Offsets are compared as instants: 08:00Z-09:00Z ends exactly when the
# existing 09:00Z-12:00Z slot begins and must not be rejected as overlapping.
db.execute("""
    INSERT INTO disponibilites(id, intervenant_id, start_at, end_at, status, tenant_id)
    VALUES ('market-availability-offset-adjacent', 'market-worker-a-row',
            '2026-11-21T10:00:00+02:00', '2026-11-21T11:00:00+02:00',
            'available', 'market-tenant-a')
""")
try:
    db.execute("""
        INSERT INTO disponibilites(id, intervenant_id, start_at, end_at, status, tenant_id)
        VALUES ('market-availability-offset-overlap', 'market-worker-a-row',
                '2026-11-21T11:30:00+02:00', '2026-11-21T12:30:00+02:00',
                'available', 'market-tenant-a')
    """)
    raise AssertionError("Timezone-offset overlapping availability was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "AVAILABILITY_OVERLAP" in str(exc), str(exc)
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
      4000, 'EUR', '["cleaning"]', 'market-client-a', datetime('now','+7 days')
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
      4000, 'EUR', 'market-client-a', datetime('now','+7 days')
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


# Financial runtime schema must be tenant-bound before any PSP activation.
financial_tenant_tables = {
    "payment_accounts", "payment_transactions", "payout_requests",
    "payment_disputes", "payment_wallet_ledger", "payment_reconciliation",
    "payment_audit", "payment_webhook_events", "wallets",
}
for table in financial_tenant_tables:
    columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    assert "tenant_id" in columns, f"{table} missing tenant_id"
financial_tenant_triggers = {
    "trg_payment_account_tenant_insert",
    "trg_payment_transaction_tenant_insert",
    "trg_payout_request_tenant_insert",
    "trg_payment_dispute_tenant_insert",
    "trg_payment_dispute_tenant_update",
    "trg_wallet_ledger_tenant_insert",
    "trg_payment_reconciliation_tenant_insert",
    "trg_payment_reconciliation_tenant_update",
    "trg_payment_account_tenant_immutable",
    "trg_payment_transaction_identity_immutable",
    "trg_payout_request_identity_immutable",
    "trg_payment_dispute_identity_immutable",
    "trg_payment_reconciliation_identity_immutable",
    "trg_payment_webhook_tenant_immutable",
    "trg_payment_webhook_identity_immutable",
    "trg_payment_audit_no_update",
    "trg_payment_audit_no_delete",
    "trg_wallets_user_identity_immutable",
    "trg_payment_wallet_ledger_require_wallet",
    "trg_payment_wallet_ledger_guard_balances",
    "trg_payment_wallet_ledger_apply",
}
triggers = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
assert financial_tenant_triggers <= triggers, (
    f"Missing financial tenant guards: {sorted(financial_tenant_triggers-triggers)}"
)

# Payment and payout idempotency is tenant-scoped; NULL legacy tenant rows are
# deliberately not attributed to a guessed company.
for table in ("payment_transactions", "payout_requests"):
    unique_sets = []
    for index in db.execute(f"PRAGMA index_list({table})").fetchall():
        if index[2]:
            columns = [
                row[2] for row in db.execute(f'PRAGMA index_info("{index[1]}")').fetchall()
            ]
            unique_sets.append(columns)
    assert ["tenant_id", "idempotency_key"] in unique_sets, (
        f"{table} must have tenant-scoped idempotency uniqueness"
    )
    assert ["idempotency_key"] not in unique_sets, (
        f"{table} must not enforce global idempotency uniqueness"
    )


# Runtime routes and the production readiness gate must use the same tenant boundary.
source = (ROOT / "src" / "index.js").read_text(encoding="utf-8")
assert "code:'FINANCIAL_TENANT_SCOPE'" in source
assert "code:'FINANCIAL_AUXILIARY_TENANT_COLUMNS'" in source
assert "tenant_id=? AND status IN ('requested','processing')" in source
assert "WHERE mission_id=? AND tenant_id=?" in source
assert "payment_wallet_ledger','payment_reconciliation" in source


# Two-tenant financial isolation: valid tenant-A links work; forged tenant-B links fail.
db.execute("""
    INSERT INTO users(id, role, email, first_name, last_name, password_hash)
    VALUES ('finance-user-a', 'intervenant', 'finance-a@example.test', 'Finance', 'A', 'synthetic-test-hash')
""")
for tenant_id, suffix in [("tenant-a", "a"), ("tenant-b", "b")]:
    membership_id = f"finance-membership-{suffix}"
    db.execute("""
        INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,invited_by_user_id)
        VALUES (?,?,'finance-user-a','MEMBER','INVITED','user-admin')
    """, (membership_id, tenant_id))
    db.execute("""
        UPDATE tenant_memberships
           SET status='ACTIVE', accepted_at=CURRENT_TIMESTAMP
         WHERE id=?
    """, (membership_id,))

# The marketplace fixture uses its own tenant identifier; grant the synthetic finance user
# a real membership there so the transaction-to-mission relation is valid.
db.execute("""
    INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,invited_by_user_id)
    VALUES ('finance-membership-market-a','market-tenant-a','finance-user-a','MEMBER','INVITED','user-admin')
""")
db.execute("""
    UPDATE tenant_memberships SET status='ACTIVE',accepted_at=CURRENT_TIMESTAMP
     WHERE id='finance-membership-market-a'
""")
db.execute("""
    INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,invited_by_user_id)
    VALUES ('finance-membership-market-b','market-tenant-b','finance-user-a','MEMBER','INVITED','user-admin')
""")
db.execute("""
    UPDATE tenant_memberships SET status='ACTIVE',accepted_at=CURRENT_TIMESTAMP
     WHERE id='finance-membership-market-b'
""")
db.execute("""
    INSERT INTO missions(id,client_id,intervenant_id,prestation_id,start_at,tenant_id)
    VALUES ('finance-mission-idem-b','market-client-b-row','market-worker-b-row',
            'market-service-b','2026-11-22T10:00:00Z','market-tenant-b')
""")

db.execute("""
    INSERT INTO wallets(id,user_id,tenant_id,currency)
    VALUES ('finance-wallet-a','finance-user-a','market-tenant-a','EUR')
""")
db.execute("""
    INSERT INTO wallets(id,user_id,tenant_id,currency)
    VALUES ('finance-wallet-b','finance-user-a','tenant-b','EUR')
""")
db.execute("""
    INSERT INTO wallets(id,user_id,tenant_id,currency)
    VALUES ('finance-wallet-a-usd','finance-user-a','market-tenant-a','USD')
""")
try:
    db.execute("""
        INSERT INTO wallets(id,user_id,tenant_id,currency)
        VALUES ('finance-wallet-a-duplicate','finance-user-a','market-tenant-a','EUR')
    """)
    raise AssertionError("Duplicate wallet for one tenant/user/currency was incorrectly accepted")
except sqlite3.IntegrityError:
    pass

# Wallet currency is part of the immutable economic identity, not a mutable profile field.
for target_currency in ["USD"]:
    try:
        db.execute("UPDATE wallets SET currency=? WHERE id='finance-wallet-a'", (target_currency,))
        raise AssertionError("Wallet currency reassignment was incorrectly accepted")
    except sqlite3.IntegrityError as exc:
        assert "WALLETS_CURRENCY_IMMUTABLE" in str(exc), str(exc)
db.execute("UPDATE wallets SET currency='EUR' WHERE id='finance-wallet-a'")
assert db.execute("SELECT currency FROM wallets WHERE id='finance-wallet-a'").fetchone()[0] == "EUR"

db.execute("""
    INSERT INTO payment_accounts(id,user_id,provider,tenant_id)
    VALUES ('finance-account-a','finance-user-a','sandbox','market-tenant-a')
""")
db.execute("""
    INSERT INTO payment_transactions(
      id,idempotency_key,mission_id,client_id,intervenant_id,type,status,
      gross_cents,commission_cents,net_intervenant_cents,currency,tenant_id
    ) VALUES (
      'finance-tx-a','finance-idem-a','market-mission-opportunity','market-client-a-row',
      NULL,'MISSION_CHARGE','paid',10000,1000,9000,'EUR','market-tenant-a'
    )
""")
db.execute("""
    INSERT INTO payout_requests(
      id,idempotency_key,wallet_id,user_id,amount_cents,tenant_id
    ) VALUES ('finance-payout-a','finance-payout-idem-a','finance-wallet-a','finance-user-a',2500,'market-tenant-a')
""")

# The same idempotency key is valid in another tenant, but remains unique
# inside each tenant for both mission charges and payouts.
db.execute("""
    INSERT INTO payment_transactions(
      id,idempotency_key,mission_id,client_id,intervenant_id,type,status,
      gross_cents,commission_cents,net_intervenant_cents,currency,tenant_id
    ) VALUES (
      'finance-tx-b-idem','finance-idem-a','finance-mission-idem-b','market-client-b-row',
      'market-worker-b-row','MISSION_CHARGE','pending',10000,1000,9000,'EUR','market-tenant-b'
    )
""")
try:
    db.execute("""
        INSERT INTO payment_transactions(
          id,idempotency_key,mission_id,client_id,intervenant_id,type,status,
          gross_cents,commission_cents,net_intervenant_cents,currency,tenant_id
        ) VALUES (
          'finance-tx-a-duplicate','finance-idem-a','market-mission-opportunity',
          'market-client-a-row',NULL,'MISSION_CHARGE','pending',10000,1000,9000,'EUR','market-tenant-a'
        )
    """)
    raise AssertionError("Duplicate payment idempotency key inside one tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "payment_transactions.tenant_id" in str(exc) and "payment_transactions.idempotency_key" in str(exc), str(exc)

try:
    db.execute("UPDATE payment_transactions SET idempotency_key='finance-idem-mutated' WHERE id='finance-tx-a'")
    raise AssertionError("Payment transaction idempotency key was mutable")
except sqlite3.IntegrityError as exc:
    assert "PAYMENT_TRANSACTION_IDENTITY_IMMUTABLE" in str(exc), str(exc)

db.execute("""
    INSERT INTO payout_requests(
      id,idempotency_key,wallet_id,user_id,amount_cents,tenant_id
    ) VALUES ('finance-payout-b','finance-payout-idem-a','finance-wallet-b','finance-user-a',2500,'tenant-b')
""")
try:
    db.execute("""
        INSERT INTO payout_requests(
          id,idempotency_key,wallet_id,user_id,amount_cents,tenant_id
        ) VALUES ('finance-payout-a-duplicate','finance-payout-idem-a','finance-wallet-a','finance-user-a',2500,'market-tenant-a')
    """)
    raise AssertionError("Duplicate payout idempotency key inside one tenant was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "payout_requests.tenant_id" in str(exc) and "payout_requests.idempotency_key" in str(exc), str(exc)

try:
    db.execute("UPDATE payout_requests SET idempotency_key='finance-payout-idem-mutated' WHERE id='finance-payout-a'")
    raise AssertionError("Payout idempotency key was mutable")
except sqlite3.IntegrityError as exc:
    assert "PAYOUT_REQUEST_IDENTITY_IMMUTABLE" in str(exc), str(exc)

try:
    db.execute("""
        INSERT INTO payout_requests(
          id,idempotency_key,wallet_id,user_id,amount_cents,currency,tenant_id
        ) VALUES (
          'finance-payout-currency-mismatch','finance-payout-currency-mismatch',
          'finance-wallet-a','finance-user-a',1000,'USD','market-tenant-a'
        )
    """)
    raise AssertionError("Payout in a currency different from its wallet was incorrectly accepted")
except sqlite3.IntegrityError:
    pass
try:
    db.execute("UPDATE payout_requests SET currency='USD' WHERE id='finance-payout-a'")
    raise AssertionError("Payout currency identity was incorrectly mutable")
except sqlite3.IntegrityError:
    pass
db.execute("""
    INSERT INTO payment_disputes(
      id,mission_id,transaction_id,client_id,intervenant_id,reason,amount_cents,tenant_id
    ) VALUES (
      'finance-dispute-a','market-mission-opportunity','finance-tx-a','market-client-a-row',
      NULL,'synthetic test dispute',1000,'market-tenant-a'
    )
""")
db.execute("""
    INSERT INTO payment_wallet_ledger(
      id,idempotency_key,user_id,entry_type,currency,tenant_id
    ) VALUES ('finance-ledger-a','finance-ledger-idem-a','finance-user-a','TEST_NOOP','EUR','market-tenant-a')
""")
db.execute("""
    INSERT INTO payment_reconciliation(
      id,provider,external_id,internal_transaction_id,tenant_id
    ) VALUES ('finance-recon-a','sandbox','external-a','finance-tx-a','market-tenant-a')
""")
assert db.execute("SELECT available_cents FROM wallets WHERE id='finance-wallet-a'").fetchone()[0] == 0

# Ledger balance checks and application must select exactly one tenant+currency wallet.
db.execute("UPDATE wallets SET pending_cents=10 WHERE id='finance-wallet-a'")
db.execute("""
    INSERT INTO payment_wallet_ledger(
      id,idempotency_key,user_id,entry_type,available_delta_cents,currency,tenant_id
    ) VALUES (
      'finance-ledger-credit-a','finance-ledger-credit-a','finance-user-a',
      'TEST_CREDIT',1250,'EUR','market-tenant-a'
    )
""")
assert db.execute("SELECT available_cents FROM wallets WHERE id='finance-wallet-a'").fetchone()[0] == 1250
assert db.execute("SELECT available_cents FROM wallets WHERE id='finance-wallet-b'").fetchone()[0] == 0
assert db.execute("SELECT available_cents FROM wallets WHERE id='finance-wallet-a-usd'").fetchone()[0] == 0
try:
    db.execute("""
        INSERT INTO payment_wallet_ledger(
          id,idempotency_key,user_id,entry_type,pending_delta_cents,currency,tenant_id
        ) VALUES (
          'finance-ledger-negative-b','finance-ledger-negative-b','finance-user-a',
          'TEST_NEGATIVE_PENDING',-1,'EUR','tenant-b'
        )
    """)
    raise AssertionError("Tenant-B negative pending balance was incorrectly accepted using tenant-A funds")
except sqlite3.IntegrityError as exc:
    assert "PAYMENT_WALLET_NEGATIVE_PROTECTED_BALANCE" in str(exc), str(exc)
assert db.execute("SELECT pending_cents FROM wallets WHERE id='finance-wallet-b'").fetchone()[0] == 0
assert db.execute("SELECT pending_cents FROM wallets WHERE id='finance-wallet-a'").fetchone()[0] == 10

cross_tenant_financial_writes = [
    """INSERT INTO payment_transactions(
         id,idempotency_key,mission_id,client_id,type,status,tenant_id
       ) VALUES ('finance-tx-cross','finance-idem-cross','market-mission-opportunity',
         'market-client-a-row','MISSION_CHARGE','pending','tenant-b')""",
    """INSERT INTO payout_requests(
         id,idempotency_key,wallet_id,user_id,amount_cents,tenant_id
       ) VALUES ('finance-payout-cross','finance-payout-idem-cross',
         'finance-wallet-a','finance-user-a',1000,'tenant-b')""",
    """INSERT INTO payment_disputes(
         id,mission_id,transaction_id,client_id,reason,amount_cents,tenant_id
       ) VALUES ('finance-dispute-cross','market-mission-opportunity','finance-tx-a',
         'market-client-a-row','cross tenant',1000,'tenant-b')""",
    """INSERT INTO payment_wallet_ledger(
         id,idempotency_key,user_id,entry_type,currency,tenant_id
       ) VALUES ('finance-ledger-cross','finance-ledger-idem-cross',
         'user-b','TEST_NOOP','EUR','tenant-b')""",
    """INSERT INTO payment_reconciliation(
         id,provider,external_id,internal_transaction_id,tenant_id
       ) VALUES ('finance-recon-cross','sandbox','external-cross','finance-tx-a','tenant-b')""",
]
for sql in cross_tenant_financial_writes:
    try:
        db.execute(sql)
        raise AssertionError(f"Cross-tenant financial write was incorrectly accepted: {sql}")
    except sqlite3.IntegrityError:
        pass

# A user with active memberships in both tenants still cannot move an existing PSP account.
try:
    db.execute("UPDATE payment_accounts SET tenant_id='tenant-b' WHERE id='finance-account-a'")
    raise AssertionError("Financial account tenant reassignment was incorrectly accepted")
except sqlite3.IntegrityError as exc:
    assert "PAYMENT_ACCOUNT_TENANT_IMMUTABLE" in str(exc), str(exc)

# Account ownership and PSP provider identity cannot be reassigned to another active
# member of the same legal entity after the account has been created.
db.execute("""
    INSERT INTO users(id,role,email,first_name,last_name,password_hash)
    VALUES ('finance-owner-alt','intervenant','finance-owner-alt@example.test',
            'Finance','Alt','synthetic-test-hash')
""")
db.execute("""
    INSERT INTO tenant_memberships(id,tenant_id,user_id,role,status,invited_by_user_id)
    VALUES ('finance-membership-owner-alt','market-tenant-a','finance-owner-alt',
            'MEMBER','INVITED','user-admin')
""")
db.execute("""
    UPDATE tenant_memberships SET status='ACTIVE',accepted_at=CURRENT_TIMESTAMP
    WHERE id='finance-membership-owner-alt'
""")
try:
    db.execute("UPDATE wallets SET user_id='finance-owner-alt' WHERE id='finance-wallet-a'")
    raise AssertionError("Wallet owner identity was incorrectly mutable")
except sqlite3.IntegrityError as exc:
    assert "WALLETS_USER_IDENTITY_IMMUTABLE" in str(exc), str(exc)
for sql, expected in [
    ("UPDATE payment_accounts SET user_id='finance-owner-alt' WHERE id='finance-account-a'",
     "PAYMENT_ACCOUNT_TENANT_IMMUTABLE"),
    ("UPDATE payment_accounts SET provider='other_psp' WHERE id='finance-account-a'",
     "PAYMENT_ACCOUNT_TENANT_IMMUTABLE"),
]:
    try:
        db.execute(sql)
        raise AssertionError(f"PSP account identity was mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert expected in str(exc), str(exc)

# The transaction's beneficiary and dispute parties are immutable even when the
# original value is NULL. Dispute insertions must match the source transaction exactly.
try:
    db.execute("UPDATE payment_transactions SET intervenant_id='market-worker-a-row' WHERE id='finance-tx-a'")
    raise AssertionError("Payment transaction beneficiary was mutable")
except sqlite3.IntegrityError as exc:
    assert "PAYMENT_TRANSACTION_IDENTITY_IMMUTABLE" in str(exc), str(exc)

for sql in [
    "UPDATE payment_disputes SET client_id=NULL WHERE id='finance-dispute-a'",
    "UPDATE payment_disputes SET intervenant_id='market-worker-a-row' WHERE id='finance-dispute-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Payment dispute parties were mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "PAYMENT_DISPUTE_IDENTITY_IMMUTABLE" in str(exc), str(exc)

for sql in [
    """INSERT INTO payment_disputes(
         id,mission_id,transaction_id,client_id,intervenant_id,reason,amount_cents,tenant_id
       ) VALUES ('finance-dispute-client-mismatch','market-mission-opportunity','finance-tx-a',
         'market-client-b-row',NULL,'mismatched client',1000,'market-tenant-a')""",
    """INSERT INTO payment_disputes(
         id,mission_id,transaction_id,client_id,intervenant_id,reason,amount_cents,tenant_id
       ) VALUES ('finance-dispute-provider-mismatch','market-mission-opportunity','finance-tx-a',
         'market-client-a-row','market-worker-b-row','mismatched provider',1000,'market-tenant-a')""",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Dispute with mismatched source identities was accepted: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "PAYMENT_DISPUTE_TRANSACTION_TENANT_MISMATCH" in str(exc), str(exc)

# Legacy dispute rows may be attributed only when both parties still match the source transaction.
# Temporarily omit the INSERT guard to model rows that predate this migration; restore it before testing UPDATE.
db.execute("DROP TRIGGER trg_payment_dispute_tenant_insert")
for dispute_id, client_id, intervenant_id in [
    ("finance-dispute-legacy-valid", "market-client-a-row", None),
    ("finance-dispute-legacy-client-mismatch", "market-client-b-row", None),
    ("finance-dispute-legacy-provider-mismatch", "market-client-a-row", "market-worker-b-row"),
]:
    db.execute("""
        INSERT INTO payment_disputes(
          id,mission_id,transaction_id,client_id,intervenant_id,reason,amount_cents,tenant_id
        ) VALUES (?,?,?,?,?,'legacy attribution fixture',1000,NULL)
    """, (dispute_id, "market-mission-opportunity", "finance-tx-a", client_id, intervenant_id))
db.execute("""
    CREATE TRIGGER trg_payment_dispute_tenant_insert
    BEFORE INSERT ON payment_disputes
    WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM payment_transactions tx
      WHERE tx.id=NEW.transaction_id AND tx.tenant_id=NEW.tenant_id
        AND tx.mission_id=NEW.mission_id
        AND tx.client_id IS NEW.client_id
        AND tx.intervenant_id IS NEW.intervenant_id
    )
    BEGIN SELECT RAISE(ABORT,'PAYMENT_DISPUTE_TRANSACTION_TENANT_MISMATCH'); END;
""")
db.execute("""
    UPDATE payment_disputes SET tenant_id='market-tenant-a'
    WHERE id='finance-dispute-legacy-valid'
""")
for dispute_id in ("finance-dispute-legacy-client-mismatch", "finance-dispute-legacy-provider-mismatch"):
    try:
        db.execute(
            "UPDATE payment_disputes SET tenant_id='market-tenant-a' WHERE id=?",
            (dispute_id,),
        )
        raise AssertionError(f"Legacy dispute with mismatched parties was attributed: {dispute_id}")
    except sqlite3.IntegrityError as exc:
        assert "PAYMENT_DISPUTE_TRANSACTION_TENANT_MISMATCH" in str(exc), str(exc)

# A signed webhook inbox event remains globally keyed until it is matched
# to a transaction. Tenant attribution and the matched transaction are atomic.
db.execute("""
    INSERT INTO payment_webhook_events(id,provider,event_id,event_type)
    VALUES ('finance-webhook-unmatched','sandbox','evt-unmatched','payment_succeeded')
""")
try:
    db.execute("""
        UPDATE payment_webhook_events SET tenant_id='market-tenant-a'
        WHERE id='finance-webhook-unmatched'
    """)
    raise AssertionError("Webhook was tenant-bound without a matched transaction")
except sqlite3.IntegrityError as exc:
    assert "PAYMENT_WEBHOOK_TENANT_BINDING_INVALID" in str(exc), str(exc)

db.execute("""
    INSERT INTO payment_webhook_events(id,provider,event_id,event_type)
    VALUES ('finance-webhook-a','sandbox','evt-finance-a','payment_succeeded')
""")
db.execute("""
    UPDATE payment_webhook_events
       SET tenant_id='market-tenant-a',matched_transaction_id='finance-tx-a'
     WHERE id='finance-webhook-a'
""")
db.execute("""
    INSERT INTO payment_webhook_events(id,provider,event_id,event_type)
    VALUES ('finance-webhook-cross','sandbox','evt-cross','payment_succeeded')
""")
try:
    db.execute("""
        UPDATE payment_webhook_events
           SET tenant_id='tenant-b',matched_transaction_id='finance-tx-a'
         WHERE id='finance-webhook-cross'
    """)
    raise AssertionError("Webhook was attributed to a tenant different from its matched transaction")
except sqlite3.IntegrityError as exc:
    assert "PAYMENT_WEBHOOK_TENANT_BINDING_INVALID" in str(exc), str(exc)

for sql, expected in [
    ("UPDATE payment_webhook_events SET tenant_id=NULL WHERE id='finance-webhook-a'",
     "PAYMENT_WEBHOOK_TENANT_BINDING_INVALID"),
    ("UPDATE payment_webhook_events SET tenant_id='tenant-b' WHERE id='finance-webhook-a'",
     "PAYMENT_WEBHOOK_TENANT_BINDING_INVALID"),
    ("UPDATE payment_webhook_events SET matched_transaction_id=NULL WHERE id='finance-webhook-a'",
     "PAYMENT_WEBHOOK_TENANT_BINDING_INVALID"),
    ("UPDATE payment_webhook_events SET provider='other_psp' WHERE id='finance-webhook-a'",
     "PAYMENT_WEBHOOK_IDENTITY_IMMUTABLE"),
    ("UPDATE payment_webhook_events SET event_id='evt-mutated' WHERE id='finance-webhook-a'",
     "PAYMENT_WEBHOOK_IDENTITY_IMMUTABLE"),
    ("UPDATE payment_webhook_events SET event_type='payment_failed' WHERE id='finance-webhook-a'",
     "PAYMENT_WEBHOOK_IDENTITY_IMMUTABLE"),
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Webhook identity was mutable: {sql}")
    except sqlite3.IntegrityError as exc:
        assert expected in str(exc), str(exc)

# Financial audit is tenant-bound on INSERT and append-only afterwards.
db.execute("""
    INSERT INTO payment_audit(
      id,event_type,transaction_id,payout_id,mission_id,user_id,result,metadata_json,tenant_id
    ) VALUES (
      'finance-audit-a','FINANCE_TEST','finance-tx-a','finance-payout-a',
      'market-mission-opportunity','finance-user-a','OK','{}','market-tenant-a'
    )
""")
for sql in [
    """INSERT INTO payment_audit(id,event_type,result,tenant_id)
       VALUES ('finance-audit-no-tenant','FINANCE_TEST','OK',NULL)""",
    """INSERT INTO payment_audit(id,event_type,user_id,result,tenant_id)
       VALUES ('finance-audit-wrong-user','FINANCE_TEST','user-a','OK','market-tenant-a')""",
    """INSERT INTO payment_audit(id,event_type,transaction_id,result,tenant_id)
       VALUES ('finance-audit-wrong-transaction','FINANCE_TEST','finance-tx-a','OK','tenant-b')""",
    """INSERT INTO payment_audit(id,event_type,payout_id,result,tenant_id)
       VALUES ('finance-audit-wrong-payout','FINANCE_TEST','finance-payout-a','OK','tenant-b')""",
    """INSERT INTO payment_audit(id,event_type,mission_id,result,tenant_id)
       VALUES ('finance-audit-wrong-mission','FINANCE_TEST','market-mission-opportunity','OK','tenant-b')""",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Cross-tenant or unscoped financial audit insert was accepted: {sql}")
    except sqlite3.IntegrityError as exc:
        assert "PAYMENT_AUDIT_TENANT_MISMATCH" in str(exc), str(exc)

for sql in [
    "UPDATE payment_audit SET result='TAMPERED' WHERE id='finance-audit-a'",
    "DELETE FROM payment_audit WHERE id='finance-audit-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError("Financial audit history was mutable")
    except sqlite3.IntegrityError as exc:
        assert "PAYMENT_AUDIT_APPEND_ONLY" in str(exc), str(exc)

print("PASS: financial tenant isolation, wallet/mission linkage, cross-tenant write rejection, immutable attribution and append-only audit.")


# Finance workspace tables are tenant-bound and cannot be used as a cross-company ledger.
finance_workspace_tables = {
    "finance_workspace_entries", "finance_export_log", "finance_resolution_cases",
}
for table in finance_workspace_tables:
    columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    assert "tenant_id" in columns, f"{table} missing tenant_id"
finance_workspace_triggers = {
    "trg_finance_workspace_entry_tenant_insert",
    "trg_finance_workspace_entry_tenant_update",
    "trg_finance_workspace_entry_no_update",
    "trg_finance_workspace_entry_no_delete",
    "trg_finance_export_tenant_insert",
    "trg_finance_export_tenant_update",
    "trg_finance_export_no_update",
    "trg_finance_export_no_delete",
    "trg_finance_resolution_tenant_insert",
    "trg_finance_resolution_tenant_update",
    "trg_finance_resolution_identity_immutable",
    "trg_finance_resolution_no_delete",
}
triggers = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
assert finance_workspace_triggers <= triggers, (
    f"Missing finance workspace tenant guards: {sorted(finance_workspace_triggers-triggers)}"
)

db.execute("""
    INSERT INTO finance_workspace_entries(
      id,user_id,role,entry_type,direction,amount_cents,currency,tenant_id
    ) VALUES ('finance-entry-a','finance-user-a','intervenant','ADJUSTMENT','IN',1200,'EUR','tenant-a')
""")
db.execute("""
    INSERT INTO finance_export_log(
      id,user_id,role,format,row_count,tenant_id
    ) VALUES ('finance-export-a','finance-user-a','intervenant','csv',1,'tenant-a')
""")
db.execute("""
    INSERT INTO finance_resolution_cases(
      id,user_id,role,issue_type,status,severity,description,tenant_id
    ) VALUES ('finance-case-a','finance-user-a','intervenant','UNKNOWN','OPEN','LOW','synthetic test','tenant-a')
""")
for sql in [
    "UPDATE finance_workspace_entries SET amount_cents=9999 WHERE id='finance-entry-a'",
    "DELETE FROM finance_workspace_entries WHERE id='finance-entry-a'",
    "UPDATE finance_export_log SET row_count=999 WHERE id='finance-export-a'",
    "DELETE FROM finance_export_log WHERE id='finance-export-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError("Finance ledger/export history was mutable")
    except sqlite3.IntegrityError:
        pass
try:
    db.execute("UPDATE finance_resolution_cases SET tenant_id='tenant-b' WHERE id='finance-case-a'")
    raise AssertionError("Finance resolution case tenant reassignment was accepted")
except sqlite3.IntegrityError as exc:
    assert "FINANCE_CASE_IDENTITY_IMMUTABLE" in str(exc), str(exc)
db.execute("UPDATE finance_resolution_cases SET status='RESOLVED',resolved_at=CURRENT_TIMESTAMP WHERE id='finance-case-a'")
try:
    db.execute("DELETE FROM finance_resolution_cases WHERE id='finance-case-a'")
    raise AssertionError("Finance resolution case history was deletable")
except sqlite3.IntegrityError:
    pass

# The API's finance read model must bind every domain query to the server-derived tenant.
assert "FINANCE_WORKSPACE_TENANT_SCOPE_REQUIRED" in source
assert "WHERE tenant_id=? ORDER BY created_at DESC LIMIT 5000" in source
assert "WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC LIMIT 5000" in source
assert "intervenants WHERE user_id=? AND tenant_id=?" in source
assert "clients WHERE user_id=? AND tenant_id=?" in source
assert "WHERE id=? AND tenant_id=? LIMIT 1" in source
print("PASS: finance dashboard/export/ledger/cases are tenant-scoped, legacy unassigned rows fail closed, ledger/export append-only and resolution identity immutable.")

assert "finance_workspace_entries','finance_export_log','finance_resolution_cases" in source
assert "FINANCIAL_TENANT_SCOPE" in source
assert "FINANCIAL_AUXILIARY_TENANT_COLUMNS" in source


# Security records are tenant-scoped, append-only where they are audit evidence,
# and legacy rows remain unassigned rather than being guessed into a tenant.
security_columns = {
    table: {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    for table in ("identity_verifications", "mission_security", "mission_security_attempts", "security_audit")
}
for table, columns in security_columns.items():
    assert "tenant_id" in columns, f"{table} missing tenant_id"

for table, row_id in [
    ("mission_security", "legacy-security-1"),
    ("mission_security_attempts", "legacy-security-attempt-1"),
    ("security_audit", "legacy-security-audit-1"),
]:
    tenant = db.execute(f"SELECT tenant_id FROM {table} WHERE id=?", (row_id,)).fetchone()[0]
    assert tenant is None, f"{table} legacy row received an invented tenant attribution"

for sql in [
    "UPDATE mission_security SET status='completed' WHERE id='legacy-security-1'",
    "DELETE FROM mission_security WHERE id='legacy-security-1'",
    "UPDATE mission_security_attempts SET result='TAMPERED' WHERE id='legacy-security-attempt-1'",
    "DELETE FROM mission_security_attempts WHERE id='legacy-security-attempt-1'",
    "UPDATE security_audit SET result='TAMPERED' WHERE id='legacy-security-audit-1'",
    "DELETE FROM security_audit WHERE id='legacy-security-audit-1'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Unassigned security evidence was mutable: {sql}")
    except sqlite3.IntegrityError:
        pass

security_indexes = {
    "idx_mission_security_tenant_mission",
    "idx_mission_security_attempts_tenant_security",
    "idx_security_audit_tenant_created",
}
security_triggers = {
    "trg_mission_security_tenant_insert",
    "trg_mission_security_tenant_update",
    "trg_mission_security_unscoped_no_update",
    "trg_mission_security_unscoped_no_delete",
    "trg_mission_security_attempts_tenant_insert",
    "trg_mission_security_attempts_no_update",
    "trg_mission_security_attempts_no_delete",
    "trg_security_audit_tenant_insert",
    "trg_security_audit_no_update",
    "trg_security_audit_no_delete",
}
indexes = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='index'")}
triggers = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
assert security_indexes <= indexes, f"Missing security tenant indexes: {sorted(security_indexes-indexes)}"
assert security_triggers <= triggers, f"Missing security tenant/append-only guards: {sorted(security_triggers-triggers)}"

# The existing two-tenant marketplace fixtures below are used to prove that
# mission security and security audit writes cannot cross tenant boundaries.
db.execute("""
    INSERT INTO mission_security(
      id,mission_id,client_id,intervenant_id,tenant_id
    ) VALUES (
      'security-market-a','market-mission-a','market-client-a-row','market-worker-a-row','market-tenant-a'
    )
""")
db.execute("""
    INSERT INTO mission_security_attempts(
      id,security_id,tenant_id,purpose,actor_user_id,result
    ) VALUES (
      'security-attempt-market-a','security-market-a','market-tenant-a','ARRIVAL','market-manager-a','BLOCKED'
    )
""")
db.execute("""
    INSERT INTO security_audit(
      id,event_type,mission_id,user_id,actor_role,result,metadata_json,tenant_id
    ) VALUES (
      'security-audit-market-a','MISSION_SECURITY_TEST','market-mission-a','market-manager-a','MANAGER','OK','{}','market-tenant-a'
    )
""")
for sql, marker in [
    ("""
      INSERT INTO mission_security(id,mission_id,client_id,intervenant_id,tenant_id)
      VALUES ('security-cross-tenant','market-mission-a','market-client-a-row','market-worker-a-row','market-tenant-b')
    """, "MISSION_SECURITY_TENANT_MISMATCH"),
    ("""
      INSERT INTO mission_security_attempts(id,security_id,tenant_id,purpose,actor_user_id,result)
      VALUES ('security-attempt-cross','security-market-a','market-tenant-b','ARRIVAL','market-manager-b','BLOCKED')
    """, "MISSION_SECURITY_ATTEMPT_TENANT_MISMATCH"),
    ("""
      INSERT INTO security_audit(id,event_type,user_id,actor_role,result,metadata_json,tenant_id)
      VALUES ('security-audit-cross','CROSS_TENANT','market-manager-b','MANAGER','OK','{}','market-tenant-a')
    """, "SECURITY_AUDIT_TENANT_MISMATCH"),
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Cross-tenant security write was accepted: {marker}")
    except sqlite3.IntegrityError as exc:
        assert marker in str(exc), str(exc)

try:
    db.execute("UPDATE mission_security SET tenant_id='market-tenant-b' WHERE id='security-market-a'")
    raise AssertionError("Mission security tenant reassignment was accepted")
except sqlite3.IntegrityError as exc:
    assert "MISSION_SECURITY_TENANT_MISMATCH" in str(exc), str(exc)

for sql in [
    "UPDATE mission_security_attempts SET result='TAMPERED' WHERE id='security-attempt-market-a'",
    "DELETE FROM mission_security_attempts WHERE id='security-attempt-market-a'",
    "UPDATE security_audit SET result='TAMPERED' WHERE id='security-audit-market-a'",
    "DELETE FROM security_audit WHERE id='security-audit-market-a'",
]:
    try:
        db.execute(sql)
        raise AssertionError(f"Security audit/attempt history was mutable: {sql}")
    except sqlite3.IntegrityError:
        pass

print("PASS: security records are tenant-scoped; legacy records remain unassigned; cross-tenant writes and audit tampering are rejected.")
