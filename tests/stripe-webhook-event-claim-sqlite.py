#!/usr/bin/env python3
"""SQLite model tests for Stripe webhook event identity/claim lifecycle.

These are deterministic database invariants, NOT Cloudflare Workers/D1 runtime
or distributed concurrency certification. Keep that distinction in CI output.
"""
import sqlite3

db = sqlite3.connect(":memory:")
db.execute("""CREATE TABLE payment_webhook_events(
 id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_id TEXT NOT NULL,
 event_type TEXT NOT NULL, signature_valid INTEGER NOT NULL,
 processed INTEGER NOT NULL DEFAULT 0, payload_hash TEXT,
 processed_at TEXT, UNIQUE(provider,event_id)
)""")

def seed(event_id="evt_1", digest="sha256:aaa"):
    db.execute("""INSERT OR IGNORE INTO payment_webhook_events
      (id,provider,event_id,event_type,signature_valid,processed,payload_hash)
      VALUES(?,?,?,?,1,0,?)""", ("row-"+event_id,"stripe",event_id,"charge.refunded",digest))
    return db.execute("""SELECT processed,payload_hash FROM payment_webhook_events
      WHERE provider='stripe' AND event_id=?""",(event_id,)).fetchone()

def claim(event_id, stale_minutes=5):
    cur=db.execute("""UPDATE payment_webhook_events
      SET processed=2,processed_at=CURRENT_TIMESTAMP
      WHERE provider='stripe' AND event_id=?
        AND (processed=0 OR (processed=2 AND processed_at < datetime('now', ?)))""",
      (event_id, f"-{stale_minutes} minutes"))
    return cur.rowcount

# New event is claimed once; a second delivery cannot take an active claim.
assert seed()==(0,"sha256:aaa")
assert claim("evt_1")==1
assert claim("evt_1")==0
assert db.execute("SELECT processed FROM payment_webhook_events WHERE event_id='evt_1'").fetchone()[0]==2

# Same provider/event ID with altered payload must never replace original hash.
db.execute("""INSERT OR IGNORE INTO payment_webhook_events
  (id,provider,event_id,event_type,signature_valid,processed,payload_hash)
  VALUES('row-evt_1-replay','stripe','evt_1','charge.refunded',1,0,'sha256:bbb')""")
assert db.execute("SELECT payload_hash FROM payment_webhook_events WHERE event_id='evt_1'").fetchone()[0]=="sha256:aaa"

# Mark complete: replay is recognized as duplicate, not re-claimed.
db.execute("""UPDATE payment_webhook_events SET processed=1,processed_at=CURRENT_TIMESTAMP
  WHERE provider='stripe' AND event_id='evt_1'""")
assert claim("evt_1")==0
assert db.execute("SELECT processed FROM payment_webhook_events WHERE event_id='evt_1'").fetchone()[0]==1

# A different event ID is independent; failed processing can release claim to retry.
seed("evt_2","sha256:ccc")
assert claim("evt_2")==1
db.execute("""UPDATE payment_webhook_events SET processed=0,processed_at=NULL
  WHERE provider='stripe' AND event_id='evt_2'""")
assert claim("evt_2")==1

# Stale in-flight claim may be reclaimed after lease expiry; fresh one may not.
seed("evt_3","sha256:ddd")
db.execute("""UPDATE payment_webhook_events SET processed=2,
  processed_at=datetime('now','-6 minutes') WHERE event_id='evt_3'""")
assert claim("evt_3")==1
db.execute("""UPDATE payment_webhook_events SET processed=2,
  processed_at=CURRENT_TIMESTAMP WHERE event_id='evt_3'""")
assert claim("evt_3")==0

# Provider-scoped uniqueness allows same event ID from another provider.
db.execute("""INSERT INTO payment_webhook_events
  (id,provider,event_id,event_type,signature_valid,processed,payload_hash)
  VALUES('row-other','other','evt_1','test',1,0,'sha256:other')""")
assert db.execute("SELECT COUNT(*) FROM payment_webhook_events WHERE event_id='evt_1'").fetchone()[0]==2

print("PASS: event uniqueness, payload hash immutability, claim exclusion, duplicate handling, retry release, stale lease recovery")
print("LIMIT: SQLite model only; Cloudflare D1/Workers live concurrency still requires isolated integration tests.")
