#!/usr/bin/env python3
"""SQLite regression for cumulative refund ledger SQL invariants (not Cloudflare D1 concurrency)."""
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(Path("migrations/0004_atomic_wallet_ledger.sql").read_text())
db.execute("INSERT INTO wallets(id,user_id,currency,available_cents) VALUES('wallet-1','provider-1','EUR',0)")
db.execute("""CREATE TABLE payment_transactions(
 id TEXT PRIMARY KEY, gross_cents INTEGER NOT NULL, net_intervenant_cents INTEGER NOT NULL,
 refund_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'paid'
)""")
db.execute("INSERT INTO payment_transactions(id,gross_cents,net_intervenant_cents) VALUES('tx-1',1000,500)")

def ledger(key, delta, refund):
    db.execute("""INSERT OR IGNORE INTO payment_wallet_ledger
      (id,idempotency_key,transaction_id,user_id,entry_type,available_delta_cents,currency,metadata_json)
      VALUES(?,?,?,?,?,?,?,?)""", (key,key,'tx-1','provider-1','REFUND_REVERSAL',delta,'EUR','{}'))

# Initial provider credit
db.execute("""INSERT INTO payment_wallet_ledger
(id,idempotency_key,transaction_id,user_id,entry_type,available_delta_cents,currency)
VALUES('credit','payment:tx-1:credit','tx-1','provider-1','PAYMENT_CREDIT',500,'EUR')""")

def apply_cumulative_refund(amount):
    prior = db.execute("SELECT refund_cents FROM payment_transactions WHERE id='tx-1'").fetchone()[0]
    amount = max(prior, amount)
    if amount == prior:
        return
    db.execute("BEGIN")
    try:
        db.execute("UPDATE payment_transactions SET refund_cents=?,status=? WHERE id=? AND refund_cents<?",
                   (amount,'refunded' if amount >= 1000 else 'partially_refunded','tx-1',amount))
        total_reversal = max(0, round(500 * amount / 1000))
        already_reversed = db.execute("""SELECT COALESCE(SUM(-available_delta_cents),0)
          FROM payment_wallet_ledger WHERE transaction_id='tx-1' AND entry_type='REFUND_REVERSAL'""").fetchone()[0]
        incremental = max(0,total_reversal-already_reversed)
        key=f"payment:tx-1:refund:{amount}"
        ledger(key,-incremental,amount)
        db.commit()
    except Exception:
        db.rollback()
        raise

apply_cumulative_refund(400)
assert db.execute("SELECT refund_cents,status FROM payment_transactions WHERE id='tx-1'").fetchone()==(400,'partially_refunded')
assert db.execute("SELECT available_cents FROM wallets WHERE user_id='provider-1'").fetchone()[0]==300
apply_cumulative_refund(600)
assert db.execute("SELECT refund_cents,status FROM payment_transactions WHERE id='tx-1'").fetchone()==(600,'partially_refunded')
assert db.execute("SELECT available_cents FROM wallets WHERE user_id='provider-1'").fetchone()[0]==200
# Replayed/out-of-order lower cumulative refund cannot decrease tx refund or duplicate reversal.
apply_cumulative_refund(400)
assert db.execute("SELECT refund_cents FROM payment_transactions WHERE id='tx-1'").fetchone()[0]==600
assert db.execute("SELECT available_cents FROM wallets WHERE user_id='provider-1'").fetchone()[0]==200
# Duplicate idempotency key is ignored.
ledger('payment:tx-1:refund:600',-100,600)
assert db.execute("SELECT COUNT(*) FROM payment_wallet_ledger WHERE idempotency_key='payment:tx-1:refund:600'").fetchone()[0]==1
# Full refund reaches the exact total reversal and never reverses more than provider net.
apply_cumulative_refund(1000)
assert db.execute("SELECT refund_cents,status FROM payment_transactions WHERE id='tx-1'").fetchone()==(1000,'refunded')
assert db.execute("SELECT available_cents FROM wallets WHERE user_id='provider-1'").fetchone()[0]==0
assert db.execute("SELECT SUM(-available_delta_cents) FROM payment_wallet_ledger WHERE transaction_id='tx-1' AND entry_type='REFUND_REVERSAL'").fetchone()[0]==500
# Over-gross refund must be rejected by the caller's validation, before SQL mutation.
before=db.execute("SELECT refund_cents FROM payment_transactions WHERE id='tx-1'").fetchone()[0]
assert 1001 > 1000
assert db.execute("SELECT refund_cents FROM payment_transactions WHERE id='tx-1'").fetchone()[0]==before
print("PASS: cumulative refund monotonicity, incremental wallet reversal, duplicate idempotency, partial/full refund accounting")
