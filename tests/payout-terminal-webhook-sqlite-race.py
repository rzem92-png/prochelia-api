#!/usr/bin/env python3
"""SQLite transaction model for payout terminal webhook races.

This is a CI regression model of the payout SQL, not Cloudflare D1 runtime proof.
The actual Worker/D1 behavior still needs isolated integration testing.
"""
import sqlite3, tempfile, threading
from pathlib import Path

migration = Path("migrations/0004_atomic_wallet_ledger.sql").read_text()
tmp = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
db_path = tmp.name
tmp.close()

def connect():
    c = sqlite3.connect(db_path, timeout=10, isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=10000")
    return c

db=connect()
db.executescript(migration)
db.execute("""CREATE TABLE payout_requests(
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
 currency TEXT NOT NULL DEFAULT 'EUR', status TEXT NOT NULL DEFAULT 'requested',
 provider_payout_id TEXT, completed_at TEXT)""")
db.execute("INSERT INTO wallets(id,user_id,currency,available_cents) VALUES('wallet','provider','EUR',1000)")
db.execute("""INSERT INTO payout_requests(id,user_id,amount_cents,currency,status)
 VALUES('payout-1','provider',700,'EUR','requested')""")
# Reserve once before PSP processing.
db.execute("""INSERT INTO payment_wallet_ledger
 (id,idempotency_key,payout_id,user_id,entry_type,available_delta_cents,reserved_delta_cents,currency)
 VALUES('reserve','payout:payout-1:reserved','payout-1','provider','PAYOUT_RESERVED',-700,700,'EUR')""")
assert db.execute("SELECT available_cents,reserved_cents FROM wallets WHERE user_id='provider'").fetchone()==(300,700)
db.close()

def terminal(event_status):
    c=connect()
    try:
        c.execute("BEGIN IMMEDIATE")
        cur=c.execute("""UPDATE payout_requests SET status=?,
          completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
          WHERE id='payout-1' AND status IN ('requested','processing')""",(event_status,event_status))
        if cur.rowcount == 1:
            key="payout:payout-1:"+event_status
            c.execute("""INSERT OR IGNORE INTO payment_wallet_ledger
              (id,idempotency_key,payout_id,user_id,entry_type,available_delta_cents,
               reserved_delta_cents,paid_delta_cents,currency)
              SELECT ?,?,p.id,p.user_id,?,
                CASE WHEN ? IN ('failed','canceled') THEN p.amount_cents ELSE 0 END,
                -p.amount_cents,
                CASE WHEN ?='completed' THEN p.amount_cents ELSE 0 END,
                p.currency
              FROM payout_requests p WHERE p.id='payout-1' AND p.status=?
                AND NOT EXISTS(SELECT 1 FROM payment_wallet_ledger WHERE idempotency_key=?)""",
              ("ledger-"+event_status,key,"PAYOUT_"+event_status.upper(),
               event_status,event_status,event_status,key))
        c.commit()
        return cur.rowcount
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()

# Race completed vs failed: only one terminal state may release the reservation.
barrier=threading.Barrier(2)
errors=[]
def worker(status):
    try:
        barrier.wait()
        terminal(status)
    except Exception as exc: errors.append(exc)
threads=[threading.Thread(target=worker,args=(status,)) for status in ("completed","failed")]
for t in threads:t.start()
for t in threads:t.join()
assert not errors, errors

db=connect()
status=db.execute("SELECT status FROM payout_requests WHERE id='payout-1'").fetchone()[0]
wallet=db.execute("SELECT available_cents,reserved_cents,paid_cents FROM wallets WHERE user_id='provider'").fetchone()
entries=db.execute("""SELECT entry_type,available_delta_cents,reserved_delta_cents,paid_delta_cents
 FROM payment_wallet_ledger WHERE payout_id='payout-1' AND entry_type IN ('PAYOUT_COMPLETED','PAYOUT_FAILED','PAYOUT_CANCELED')""").fetchall()
assert status in ("completed","failed"), status
assert len(entries)==1, entries
if status=="completed":
    assert wallet==(300,0,700), wallet
    assert entries[0][3]==700, entries
else:
    assert wallet==(1000,0,0), wallet
    assert entries[0][1]==700, entries

# Replays and stale competing terminal event cannot produce another ledger move.
terminal(status)
terminal("failed" if status=="completed" else "completed")
assert db.execute("SELECT COUNT(*) FROM payment_wallet_ledger WHERE payout_id='payout-1' AND entry_type IN ('PAYOUT_COMPLETED','PAYOUT_FAILED','PAYOUT_CANCELED')").fetchone()[0]==1
assert db.execute("SELECT available_cents,reserved_cents,paid_cents FROM wallets WHERE user_id='provider'").fetchone()==wallet
db.close()
Path(db_path).unlink(missing_ok=True)
print("PASS: payout terminal webhook race; one terminal winner, one ledger posting, no double release")
print("PASS: duplicate terminal event and stale opposite terminal event are idempotent")
print("LIMIT: serialized SQLite model only; not Cloudflare D1/Workers integration proof.")
