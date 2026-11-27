import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations-preview-canonical" / "0026_nexus_task_audit_pair_store.sql"
DB = sqlite3.connect(":memory:")
DB.execute("PRAGMA foreign_keys = ON")
DB.executescript(MIGRATION.read_text(encoding="utf-8"))

tables = {row[0] for row in DB.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {
    "nexus_task_snapshots", "nexus_task_events", "nexus_audit_ledger_heads",
    "nexus_audit_ledger_events", "nexus_task_commit_guards"
}
assert required <= tables

task_json = '{"taskId":"task-1","tenantId":"tenant-a","environment":"preview","revision":1,"state":"PLANNED"}'
event_json = '{"eventId":"event-1","taskId":"task-1","tenantId":"tenant-a","environment":"preview","revision":1,"sequence":1,"to":"PLANNED"}'
audit_json = '{"eventId":"audit-1","taskId":"task-1","tenantId":"tenant-a","environment":"preview","executionAllowed":false,"sequence":1,"previousHash":"' + "0"*64 + '","hash":"' + "a"*64 + '"}'
DB.execute("INSERT INTO nexus_task_snapshots(task_id,tenant_id,scope_key,environment,revision,state,snapshot_json) VALUES(?,?,?,?,?,?,?)",
           ("task-1","tenant-a","tenant-a","preview",1,"PLANNED",task_json))
DB.execute("INSERT INTO nexus_task_events(event_id,task_id,tenant_id,scope_key,environment,revision,event_json) VALUES(?,?,?,?,?,?,?)",
           ("event-1","task-1","tenant-a","tenant-a","preview",1,event_json))
DB.execute("INSERT INTO nexus_audit_ledger_heads(scope_key,tenant_id,environment,revision,head_hash) VALUES(?,?,?,?,?)",
           ("tenant-a","tenant-a","preview",1,"a"*64))
DB.execute("INSERT INTO nexus_audit_ledger_events(event_id,scope_key,tenant_id,environment,sequence,previous_hash,hash,event_json) VALUES(?,?,?,?,?,?,?,?)",
           ("audit-1","tenant-a","tenant-a","preview",1,"0"*64,"a"*64,audit_json))

def must_fail(sql, params=()):
    try:
        DB.execute(sql, params)
        raise AssertionError("protected/invalid mutation unexpectedly succeeded")
    except sqlite3.IntegrityError:
        pass

must_fail("INSERT INTO nexus_task_commit_guards(commit_id,ok) VALUES('guard-bad',0)")
must_fail("UPDATE nexus_task_events SET event_json='{}' WHERE event_id='event-1'")
must_fail("DELETE FROM nexus_task_events WHERE event_id='event-1'")
must_fail("UPDATE nexus_audit_ledger_events SET hash=? WHERE event_id='audit-1'", ("b"*64,))
must_fail("DELETE FROM nexus_audit_ledger_events WHERE event_id='audit-1'")
must_fail("UPDATE nexus_task_snapshots SET revision=3 WHERE task_id='task-1'")
must_fail("UPDATE nexus_audit_ledger_heads SET revision=3 WHERE scope_key='tenant-a'")
must_fail("INSERT INTO nexus_audit_ledger_events(event_id,scope_key,tenant_id,environment,sequence,previous_hash,hash,event_json) VALUES('bad','tenant-a','tenant-a','preview',2,?,?,?)",
          ("a"*64,"b"*64,'{"executionAllowed":true}'))
must_fail("INSERT INTO nexus_task_snapshots(task_id,tenant_id,scope_key,environment,revision,state,snapshot_json) VALUES(?,?,?,?,?,?,?)",
          ("global-task",None,"wrong-scope","preview",1,"RECEIVED",'{"taskId":"global-task"}'))

print("PASS: Nexus D1 task/audit pair schema; append-only events, revision/scope guards, executionAllowed=false and commit guard enforced.")
