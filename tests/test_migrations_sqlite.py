import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"
DB = sqlite3.connect(":memory:")
DB.execute("PRAGMA foreign_keys = ON")

for path in sorted(MIGRATIONS.glob("*.sql")):
    DB.executescript(path.read_text(encoding="utf-8"))

# The baseline wallet invariant must remain present even when 0004 was
# already recorded as applied and a later repair migration is required.
triggers = {row[0] for row in DB.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
assert "trg_payment_wallet_ledger_guard_balances" in triggers, "Missing wallet balance invariant trigger"

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

print(f"PASS: {len(list(MIGRATIONS.glob('*.sql')))} migrations; payment schema, atomic ledger, immutability and idempotency verified.")

# The Preview migration workflow must persist an encrypted backup in the WEUR R2 bucket
# and verify a byte-for-byte download before applying any schema writes.
workflow = (ROOT / ".github" / "workflows" / "apply-preview-d1-migrations.yml").read_text(encoding="utf-8")
assert "prochelia-preview-backups-eu/" in workflow, "Missing EU R2 backup destination"
assert "r2 object put" in workflow and "r2 object get" in workflow, "R2 backup round-trip is not verified"
assert "cmp " in workflow, "R2 backup download is not compared byte-for-byte"
assert workflow.index("r2 object put") < workflow.index("Apply migrations to Preview D1 only"), "Backup must be persisted before migrations"
assert "--jurisdiction default" in workflow, "Preview backup must match the existing bucket jurisdiction"
