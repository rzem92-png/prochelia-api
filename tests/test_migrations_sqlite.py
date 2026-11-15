import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"
DB = sqlite3.connect(":memory:")
DB.execute("PRAGMA foreign_keys = ON")

for path in sorted(MIGRATIONS.glob("*.sql")):
    DB.executescript(path.read_text(encoding="utf-8"))

# Expected payment schema objects exist.
expected = {
    "wallets", "payment_wallet_ledger", "payment_accounts",
    "payment_transactions", "payout_requests", "payment_webhook_events",
    "payment_disputes", "payment_reconciliation", "payment_audit",
}
actual = {row[0] for row in DB.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert expected <= actual, f"Missing payment tables: {sorted(expected - actual)}"

# Ledger writes atomically update wallet balances.
DB.execute("INSERT INTO wallets(id,user_id) VALUES('w1','u1')")
DB.execute("""
    INSERT INTO payment_wallet_ledger
      (id,idempotency_key,user_id,entry_type,available_delta_cents)
    VALUES('l1','idem-1','u1','TEST_CREDIT',2500)
""")
assert DB.execute("SELECT available_cents FROM wallets WHERE user_id='u1'").fetchone()[0] == 2500

# Idempotency and append-only protections.
try:
    DB.execute("""
        INSERT INTO payment_wallet_ledger
          (id,idempotency_key,user_id,entry_type,available_delta_cents)
        VALUES('l2','idem-1','u1','DUPLICATE',100)
    """)
    raise AssertionError("duplicate ledger idempotency key unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

try:
    DB.execute("UPDATE payment_wallet_ledger SET available_delta_cents=0 WHERE id='l1'")
    raise AssertionError("ledger update unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

try:
    DB.execute("DELETE FROM payment_wallet_ledger WHERE id='l1'")
    raise AssertionError("ledger delete unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

# Protected balances cannot go negative.
try:
    DB.execute("""
        INSERT INTO payment_wallet_ledger
          (id,idempotency_key,user_id,entry_type,reserved_delta_cents)
        VALUES('l3','idem-3','u1','INVALID_RELEASE',-1)
    """)
    raise AssertionError("negative reserved balance unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

# PSP event deduplication.
DB.execute("INSERT INTO payment_webhook_events(id,provider,event_id,event_type) VALUES('e1','psp','evt-1','payment.succeeded')")
try:
    DB.execute("INSERT INTO payment_webhook_events(id,provider,event_id,event_type) VALUES('e2','psp','evt-1','payment.succeeded')")
    raise AssertionError("duplicate PSP event unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

# DSA and AI Act compliance evidence schema.
compliance_expected = {
    "dsa_notices", "moderation_decisions", "moderation_appeals",
    "recommender_policy_versions", "ad_transparency_records",
    "trader_verification_records", "child_safety_cases",
    "ai_system_registry", "ai_transparency_events",
}
actual = {row[0] for row in DB.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert compliance_expected <= actual, f"Missing DSA/AI Act tables: {sorted(compliance_expected - actual)}"

# Ad targeting must fail closed for minor profiling and sensitive-data targeting.
DB.execute("""
    INSERT INTO ad_transparency_records
      (id,placement_id,advertiser_name,targeting_parameters_json,active_from)
    VALUES('ad-ok','home-feed','Example advertiser','{}','2026-11-15T00:00:00Z')
""")
for column in ("minor_profiling_used", "sensitive_data_targeting_used"):
    try:
        DB.execute(
            f"INSERT INTO ad_transparency_records "
            f"(id,placement_id,advertiser_name,targeting_parameters_json,active_from,{column}) "
            "VALUES('ad-blocked','home-feed','Example advertiser','{}','2026-11-15T00:00:00Z',1)"
        )
        raise AssertionError(f"prohibited ad targeting unexpectedly accepted: {column}")
    except sqlite3.IntegrityError:
        pass

# Append-only AI transparency and moderation decision evidence.
DB.execute("""
    INSERT INTO ai_transparency_events
      (id,system_id,system_version,output_modality,disclosure_type,disclosure_shown)
    VALUES('ai-event-1','nexus-supra','v1','TEXT','AI_INTERACTION',1)
""")
for statement, label in [
    ("UPDATE ai_transparency_events SET disclosure_shown=0 WHERE id='ai-event-1'", "AI event update"),
    ("DELETE FROM ai_transparency_events WHERE id='ai-event-1'", "AI event delete"),
]:
    try:
        DB.execute(statement)
        raise AssertionError(f"{label} unexpectedly accepted")
    except sqlite3.IntegrityError:
        pass

DB.execute("""
    INSERT INTO moderation_decisions
      (id,subject_type,subject_id,action,policy_code,statement_of_reasons)
    VALUES('mod-1','LISTING','listing-1','RESTRICT','POLICY_TEST','Test reason')
""")
try:
    DB.execute("UPDATE moderation_decisions SET action='REMOVE' WHERE id='mod-1'")
    raise AssertionError("moderation decision update unexpectedly accepted")
except sqlite3.IntegrityError:
    pass

# State and enum constraints reject invalid appeal, notice and AI registry values.
for statement, label in [
    ("INSERT INTO moderation_appeals(id,decision_id,appellant_user_id,grounds,status) VALUES('appeal-bad','mod-1','u1','test','INVALID')", "invalid appeal status"),
    ("INSERT INTO dsa_notices(id,subject_type,subject_id,notice_type,explanation,status) VALUES('notice-bad','LISTING','l1','ILLEGAL_CONTENT','test','INVALID')", "invalid notice status"),
    ("INSERT INTO ai_system_registry(id,system_key,version,provider_role,intended_purpose,modalities_json,risk_classification) VALUES('ai-bad','nexus','1','PROVIDER','assistant','[]','INVALID')", "invalid AI risk classification"),
]:
    try:
        DB.execute(statement)
        raise AssertionError(f"{label} unexpectedly accepted")
    except sqlite3.IntegrityError:
        pass

print(f"PASS: {len(list(MIGRATIONS.glob('*.sql')))} migrations; payment invariants and DSA/AI Act evidence constraints verified.")
