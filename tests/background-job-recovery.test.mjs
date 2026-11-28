import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { quarantineStaleBackgroundJobs } from "../src/background-job-recovery.js";

class SQLiteD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`CREATE TABLE background_jobs(
      id TEXT PRIMARY KEY, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5, run_after TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at TEXT, last_error TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE activity_journal(
      id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL,
      entity_type TEXT, entity_id TEXT, result TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    this.beforeBatch = null;
    this.failBatch = false;
    this.batchCalls = 0;
  }
  prepare(sql) {
    const db = this.db;
    return {
      sql,
      params: [],
      bind(...params) { this.params = params; return this; },
      async all() { return db.prepare(sql).all(...this.params); },
      async run() {
        const result = db.prepare(sql).run(...this.params);
        return { meta: { changes: Number(result.changes) } };
      }
    };
  }
  async batch(statements) {
    this.batchCalls++;
    if (this.beforeBatch) this.beforeBatch();
    if (this.failBatch) throw new Error("private batch failure");
    this.db.exec("BEGIN");
    try {
      const results = statements.map(statement => {
        const result = this.db.prepare(statement.sql).run(...statement.params);
        return { meta: { changes: Number(result.changes) } };
      });
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  insert(id, status, options = {}) {
    this.db.prepare(`INSERT INTO background_jobs(id,status,attempts,max_attempts,run_after,locked_at,updated_at)
      VALUES(?,?,?,?,?,?,?)`).run(
        id, status, options.attempts ?? 0, options.maxAttempts ?? 5,
        options.runAfter ?? "2000-01-01 00:00:00",
        options.lockedAt ?? null, options.updatedAt ?? "2000-01-01 00:00:00"
      );
  }
  row(id) { return this.db.prepare("SELECT * FROM background_jobs WHERE id=?").get(id); }
  journal() { return this.db.prepare("SELECT * FROM activity_journal").all(); }
}
const audit = { actorType: "gerante", actorId: "manager-1" };

test("quarantines stale locked and unlocked RUNNING jobs, never replays them, and journals atomically", async () => {
  const db = new SQLiteD1();
  db.insert("stale-locked", "RUNNING", { attempts: 1, lockedAt: "2000-01-01 00:00:00" });
  db.insert("stale-unlocked", "RUNNING", { attempts: 5, maxAttempts: 5, updatedAt: "2000-01-01 00:00:00" });
  db.insert("recent-running", "RUNNING", { lockedAt: new Date().toISOString().replace("T", " ").slice(0, 19) });
  db.insert("pending", "PENDING");
  db.insert("done", "DONE");
  const result = await quarantineStaleBackgroundJobs(db, { staleMinutes: 120, limit: 25, audit });
  assert.equal(result.ok, true);
  assert.equal(result.scanned, 2);
  assert.equal(result.quarantined, 2);
  assert.equal(result.skipped, 0);
  assert.equal(result.automaticRetry, false);
  assert.equal(db.row("stale-locked").status, "FAILED");
  assert.equal(db.row("stale-locked").attempts, 2);
  assert.equal(db.row("stale-locked").locked_at, null);
  assert.equal(db.row("stale-locked").last_error, "LEASE_EXPIRED_REQUIRES_MANUAL_RECONCILIATION");
  assert.equal(db.row("stale-unlocked").status, "FAILED");
  assert.equal(db.row("stale-unlocked").attempts, 5);
  assert.equal(db.row("recent-running").status, "RUNNING");
  assert.equal(db.row("pending").status, "PENDING");
  assert.equal(db.row("done").status, "DONE");
  assert.equal(db.journal().length, 1);
  const serialized = JSON.stringify(result) + JSON.stringify(db.journal());
  for (const privateId of ["stale-locked", "stale-unlocked", "recent-running", "pending", "done"]) {
    assert.equal(serialized.includes(privateId), false);
  }
});

test("zero stale jobs produces a journal entry without mutation", async () => {
  const db = new SQLiteD1();
  db.insert("recent", "RUNNING", { lockedAt: new Date().toISOString().replace("T", " ").slice(0, 19) });
  const result = await quarantineStaleBackgroundJobs(db, { audit });
  assert.equal(result.ok, true);
  assert.equal(result.scanned, 0);
  assert.equal(result.quarantined, 0);
  assert.equal(result.skipped, 0);
  assert.equal(db.batchCalls, 1);
  assert.equal(db.journal().length, 1);
  assert.equal(db.row("recent").status, "RUNNING");
});

test("conditional update skips a job whose status changed after selection", async () => {
  const db = new SQLiteD1();
  db.insert("race", "RUNNING", { lockedAt: "2000-01-01 00:00:00" });
  db.beforeBatch = () => db.db.prepare("UPDATE background_jobs SET status='DONE' WHERE id='race'").run();
  const result = await quarantineStaleBackgroundJobs(db, { audit });
  assert.equal(result.ok, true);
  assert.equal(result.scanned, 1);
  assert.equal(result.quarantined, 0);
  assert.equal(result.skipped, 1);
  assert.equal(db.row("race").status, "DONE");
});

test("invalid limits and missing audit/batch fail closed", async () => {
  const db = new SQLiteD1();
  assert.equal((await quarantineStaleBackgroundJobs(null, { audit })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs({}, { audit })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs(db, { staleMinutes: 59, audit })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs(db, { staleMinutes: 1441, audit })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs(db, { limit: 0, audit })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs(db, { limit: 26, audit })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs(db, { staleMinutes: 120 })).ok, false);
  assert.equal((await quarantineStaleBackgroundJobs({ prepare() {} }, { audit })).ok, false);
});

test("batch failure rolls back and returns a generic failure", async () => {
  const db = new SQLiteD1();
  db.insert("stale", "RUNNING", { lockedAt: "2000-01-01 00:00:00" });
  db.failBatch = true;
  const result = await quarantineStaleBackgroundJobs(db, { audit });
  assert.deepEqual(result, { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" });
  assert.equal(db.row("stale").status, "RUNNING");
  assert.equal(db.journal().length, 0);
});
