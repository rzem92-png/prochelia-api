#!/usr/bin/env python3
"""SQLite transaction-level race model for cumulative refund events.

This exercises serialized SQLite transactions and the ledger trigger. It is NOT
Cloudflare D1/Workers concurrency proof; use it as a deterministic CI guard.
"""
import sqlite3, tempfile, threading
from pathlib import Path

migration = Path("migrations/0004_atomic_wallet_ledger.sql").read_text()
tmp = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
path = tmp.name
tmp.close()

def connect():
    db=sqlite3.connect(path,timeout=10,isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=10000")
    return db

db=connect()
db.executescript(migration)
db.execute("""CREATE TABLE payment_transactions(
 id TEXT PRIMARY KEY, gross_cents INTEGER NOT NULL,
 net_intervenant_cents INTEGER NOT NULL, refund_cents INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'paid', intervenant_id TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'EUR')""")
db.execute("INSERT INTO wallets(id,user_id,currency,available_cents) VALUES('w','provider','EUR',0)")
db.execute("""INSERT INTO payment_wallet_ledger
 (id,idempotency_key,transaction_id,user_id,entry_type,available_delta_cents,currency)
 VALUES('credit','payment:tx:credit','tx','provider','PAYMENT_CREDIT',500,'EUR')""")
db.execute("""INSERT INTO payment_transactions
 (id,gross_cents,net_intervenant_cents,intervenant_id,currency)
 VALUES('tx',1000,500,'provider','EUR')""")
db.close()

def refund(target):
    c=connect()
    try:
        c.execute("BEGIN IMMEDIATE")
        cur=c.execute("""UPDATE payment_transactions SET refund_cents=?,
          status=CASE WHEN ?>=gross_cents THEN 'refunded' ELSE 'partially_refunded' END
          WHERE id='tx' AND COALESCE(refund_cents,0) < ?""",(target,target,target))
        if cur.rowcount:
            c.execute("""INSERT OR IGNORE INTO payment_wallet_ledger
              (id,idempotency_key,transaction_id,user_id,entry_type,
               available_delta_cents,currency,metadata_json)
              SELECT ?,?,t.id,t.intervenant_id,'REFUND_REVERSAL',
                -MAX(0,ROUND(t.net_intervenant_cents*1.0*t.refund_cents/NULLIF(t.gross_cents,0))-
                  COALESCE((SELECT SUM(-available_delta_cents) FROM payment_wallet_ledger l
                    WHERE l.transaction_id=t.id AND l.entry_type='REFUND_REVERSAL'),0)),
                t.currency,?
              FROM payment_transactions t
              WHERE t.id='tx' AND t.refund_cents=? AND t.gross_cents>0
                AND EXISTS(SELECT 1 FROM payment_wallet_ledger c
                  WHERE c.transaction_id=t.id AND c.entry_type='PAYMENT_CREDIT')
                AND NOT EXISTS(SELECT 1 FROM payment_wallet_ledger l WHERE l.idempotency_key=?)""",
              ("ledger-"+str(target),"payment:tx:refund:"+str(target),
               '{"model":"sqlite-concurrency"}',target,"payment:tx:refund:"+str(target)))
        c.commit()
        return cur.rowcount
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()

# Two different cumulative events race. The transaction lock serializes updates;
# regardless of order, the final total must be 700 and ledger reversal exactly 350.
barrier=threading.Barrier(2)
errors=[]
def worker(amount):
    try:
        barrier.wait()
        refund(amount)
    except Exception as e: errors.append(e)
threads=[threading.Thread(target=worker,args=(n,)) for n in (400,700)]
for t in threads:t.start()
for t in threads:t.join()
assert not errors, errors

db=connect()
assert db.execute("SELECT refund_cents,status FROM payment_transactions WHERE id='tx'").fetchone()==(700,'partially_refunded')
assert db.execute("SELECT available_cents FROM wallets WHERE user_id='provider'").fetchone()[0]==150
assert db.execute("""SELECT COALESCE(SUM(-available_delta_cents),0)
 FROM payment_wallet_ledger WHERE transaction_id='tx' AND entry_type='REFUND_REVERSAL'""").fetchone()[0]==350

# Replay same total through a different event/idempotency path and lower late event.
refund(700)
refund(400)
assert db.execute("SELECT refund_cents FROM payment_transactions WHERE id='tx'").fetchone()[0]==700
assert db.execute("SELECT available_cents FROM wallets WHERE user_id='provider'").fetchone()[0]==150
assert db.execute("""SELECT COUNT(*) FROM payment_wallet_ledger
 WHERE transaction_id='tx' AND entry_type='REFUND_REVERSAL'""").fetchone()[0]==1
db.close()
Path(path).unlink(missing_ok=True)
print("PASS: concurrent cumulative refund race, monotonic total, exact net reversal, duplicate and stale lower refund")
print("LIMIT: SQLite concurrency model only; Cloudflare D1 runtime behavior still requires isolated Worker/D1 integration.")
