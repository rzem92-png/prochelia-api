import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { claimBackgroundJob } from "../src/background-job-claim.js";

class D1TestAdapter {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`CREATE TABLE background_jobs(
      id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'PENDING',
      run_after TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 5,
      locked_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  }
  prepare(sql) {
    const db = this.db;
    return { bind(...params) { return { async run() {
      const result = db.prepare(sql).run(...params);
      return { meta: { changes: Number(result.changes) } };
    }}};
  }
  add(id, options={}) {
    if (options.runAfter) {
      this.db.prepare(`INSERT INTO background_jobs(id,status,run_after,attempts,max_attempts)
        VALUES(?,?,?,?,?)`).run(id,options.status||"PENDING",options.runAfter,options.attempts||0,options.maxAttempts||5);
    } else {
      this.db.prepare(`INSERT INTO background_jobs(id,status,attempts,max_attempts)
        VALUES(?,?,?,?)`).run(id,options.status||"PENDING",options.attempts||0,options.maxAttempts||5);
    }
  }
  status(id) { return this.db.prepare("SELECT status FROM background_jobs WHERE id=?").get(id)?.status; }
}

test("two concurrent processors cannot both claim the same pending job", async () => {
  const db = new D1TestAdapter();
  db.add("job-1");
  const claims = await Promise.all([claimBackgroundJob(db,"job-1"),claimBackgroundJob(db,"job-1")]);
  assert.equal(claims.filter(Boolean).length,1);
  assert.equal(db.status("job-1"),"RUNNING");
});

test("only eligible pending jobs can be claimed", async () => {
  const db = new D1TestAdapter();
  db.add("future",{runAfter:"2099-01-01 00:00:00"});
  db.add("exhausted",{attempts:5,maxAttempts:5});
  db.add("running",{status:"RUNNING"});
  assert.equal(await claimBackgroundJob(db,"future"),false);
  assert.equal(await claimBackgroundJob(db,"exhausted"),false);
  assert.equal(await claimBackgroundJob(db,"running"),false);
  assert.equal(db.status("future"),"PENDING");
  assert.equal(db.status("exhausted"),"PENDING");
});

test("invalid arguments and unavailable storage fail closed", async () => {
  assert.equal(await claimBackgroundJob(null,"job-1"),false);
  assert.equal(await claimBackgroundJob({}, "job-1"),false);
  assert.equal(await claimBackgroundJob(new D1TestAdapter(),""),false);
});

test("a database error does not authorize execution", async () => {
  const broken = { prepare(){ throw new Error("storage unavailable"); } };
  assert.equal(await claimBackgroundJob(broken,"job-1"),false);
});
