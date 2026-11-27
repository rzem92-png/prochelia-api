import sqlite3
import re
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
DB.execute("INSERT INTO nexus_task_commit_guards(commit_id,task_id,scope_key,environment,task_revision,audit_revision,ok) VALUES(?,?,?,?,?,?,?)",
           ("commit-1","task-1","tenant-a","preview",1,1,1))
DB.execute("INSERT INTO nexus_task_snapshots(task_id,tenant_id,scope_key,environment,revision,state,snapshot_json) VALUES(?,?,?,?,?,?,?)",
           ("task-1","tenant-a","tenant-a","preview",1,"PLANNED",task_json))
DB.execute("INSERT INTO nexus_task_events(event_id,task_id,tenant_id,scope_key,environment,revision,event_json) VALUES(?,?,?,?,?,?,?)",
           ("event-1","task-1","tenant-a","tenant-a","preview",1,event_json))
DB.execute("INSERT INTO nexus_audit_ledger_events(event_id,scope_key,tenant_id,environment,sequence,previous_hash,hash,event_json) VALUES(?,?,?,?,?,?,?,?)",
           ("audit-1","tenant-a","tenant-a","preview",1,"0"*64,"a"*64,audit_json))
DB.execute("INSERT INTO nexus_audit_ledger_heads(scope_key,tenant_id,environment,revision,head_hash) VALUES(?,?,?,?,?)",
           ("tenant-a","tenant-a","preview",1,"a"*64))
DB.execute("DELETE FROM nexus_task_commit_guards WHERE commit_id='commit-1'")


# Execute the actual optimistic guard SQL from the JavaScript store against SQLite.
STORE_SOURCE = (ROOT / "src" / "nexus-d1-task-audit-store.js").read_text(encoding="utf-8")
match = re.search(r"const guardSql = `([\\s\\S]*?)`;", STORE_SOURCE)
assert match, "D1 optimistic guard SQL not found in store module"
guard_sql = match.group(1)
guard_bindings = [
    "sql-guard-1", "dummy-task", "__GLOBAL__", "preview", 1, 1,
    0, "dummy-task", "dummy-task",
    0, "dummy-task", "__GLOBAL__", "preview", 0, "{}",
    "dummy-task", 0,
    0, "__GLOBAL__", "preview", "__GLOBAL__", "preview",
    0, "__GLOBAL__", "preview", 0, "0"*64, "__GLOBAL__", "preview", 0,
    "task-event", "dummy-task", 1, "audit-event", "__GLOBAL__", "preview", 1
]
assert guard_sql.count("?") == len(guard_bindings), f"guard bind mismatch: {guard_sql.count('?')} vs {len(guard_bindings)}"
DB.execute(guard_sql, guard_bindings)
DB.execute("DELETE FROM nexus_task_commit_guards WHERE commit_id='sql-guard-1'")

def must_fail(sql, params=()):
    try:
        DB.execute(sql, params)
        raise AssertionError("protected/invalid mutation unexpectedly succeeded")
    except sqlite3.IntegrityError:
        pass

must_fail("INSERT INTO nexus_task_commit_guards(commit_id,task_id,scope_key,environment,task_revision,audit_revision,ok) VALUES('guard-bad','task-1','tenant-a','preview',2,2,0)")
must_fail("UPDATE nexus_task_events SET event_json='{}' WHERE event_id='event-1'")
must_fail("DELETE FROM nexus_task_events WHERE event_id='event-1'")
must_fail("UPDATE nexus_audit_ledger_events SET hash=? WHERE event_id='audit-1'", ("b"*64,))
must_fail("DELETE FROM nexus_audit_ledger_events WHERE event_id='audit-1'")
must_fail("UPDATE nexus_task_snapshots SET revision=3 WHERE task_id='task-1'")
must_fail("UPDATE nexus_audit_ledger_heads SET revision=3 WHERE scope_key='tenant-a'")

# A valid scoped guard is not enough to permit an audit event with executionAllowed=true.
DB.execute("INSERT INTO nexus_task_commit_guards(commit_id,task_id,scope_key,environment,task_revision,audit_revision,ok) VALUES(?,?,?,?,?,?,?)",
           ("commit-2","task-1","tenant-a","preview",2,2,1))
bad_audit = '{"eventId":"audit-bad","taskId":"task-1","tenantId":"tenant-a","environment":"preview","executionAllowed":true,"sequence":2,"previousHash":"' + "a"*64 + '","hash":"' + "b"*64 + '"}'
must_fail("INSERT INTO nexus_audit_ledger_events(event_id,scope_key,tenant_id,environment,sequence,previous_hash,hash,event_json) VALUES(?,?,?,?,?,?,?,?)",
          ("audit-bad","tenant-a","tenant-a","preview",2,"a"*64,"b"*64,bad_audit))
DB.execute("DELETE FROM nexus_task_commit_guards WHERE commit_id='commit-2'")

must_fail("INSERT INTO nexus_task_snapshots(task_id,tenant_id,scope_key,environment,revision,state,snapshot_json) VALUES(?,?,?,?,?,?,?)",
          ("global-task",None,"wrong-scope","preview",1,"RECEIVED",'{"taskId":"global-task"}'))

print("PASS: Nexus D1 pair-store schema; scoped guard, revision, event/head chain and append-only invariants enforced.")
