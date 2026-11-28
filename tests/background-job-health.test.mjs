import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { getBackgroundJobHealth } from "../src/background-job-health.js";

class SQLiteD1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`CREATE TABLE background_jobs(
      id TEXT PRIMARY KEY, job_type TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5, run_after TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at TEXT, last_error TEXT, result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
    )`);
  }
  prepare(sql) {
    const db=this.db;
    return { bind(...args) { return { async first() { return db.prepare(sql).get(...args); } }; } };
  }
  insert(id,status,options={}) {
    this.db.prepare(`INSERT INTO background_jobs(id,job_type,payload_json,status,attempts,max_attempts,run_after,locked_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,"TEST",JSON.stringify({secret:"never expose"}),status,options.attempts??0,options.maxAttempts??5,
      options.runAfter??"2000-01-01 00:00:00",options.lockedAt??null,options.createdAt??"2000-01-01 00:00:00",options.updatedAt??"2000-01-01 00:00:00");
  }
}

test("summarizes queue counts and flags stale, failed, exhausted and due work without exposing records",async()=>{
  const db=new SQLiteD1();
  db.insert("due","PENDING");
  db.insert("future","PENDING",{runAfter:"2099-01-01 00:00:00"});
  db.insert("exhausted","PENDING",{attempts:5,maxAttempts:5});
  db.insert("stale","RUNNING",{lockedAt:"2000-01-01 00:00:00"});
  db.insert("unlocked","RUNNING");
  db.insert("provider","WAITING_PROVIDER");
  db.insert("failed","FAILED");
  db.insert("done","DONE");
  const r=await getBackgroundJobHealth(db);
  assert.equal(r.ok,true);
  assert.equal(r.readOnly,true);
  assert.equal(r.counts.total,8);
  assert.equal(r.counts.pending,3);
  assert.equal(r.counts.pendingDue,2);
  assert.equal(r.counts.pendingFuture,1);
  assert.equal(r.counts.running,2);
  assert.equal(r.counts.staleRunning,1);
  assert.equal(r.counts.runningUnlocked,1);
  assert.equal(r.counts.waitingProvider,1);
  assert.equal(r.counts.failed,1);
  assert.equal(r.counts.done,1);
  assert.equal(r.counts.exhaustedPending,1);
  assert.equal(r.status,"NEEDS_REVIEW");
  assert.ok(r.attention.includes("STALE_RUNNING_JOBS"));
  assert.ok(r.attention.includes("FAILED_JOBS"));
  const serialized=JSON.stringify(r);
  for(const secret of ["due","future","stale","unlocked","provider","failed","done","secret","payload_json","last_error"]) assert.equal(serialized.includes(secret),false);
});

test("future pending work and completed jobs do not create backlog flags",async()=>{
  const db=new SQLiteD1();
  db.insert("future","PENDING",{runAfter:"2099-01-01 00:00:00"});
  db.insert("done","DONE");
  const r=await getBackgroundJobHealth(db);
  assert.equal(r.status,"CLEAR");
  assert.deepEqual(r.attention,[]);
  assert.equal(r.counts.pendingDue,0);
});

test("running jobs newer than the stale threshold are not flagged",async()=>{
  const db=new SQLiteD1();
  db.insert("recent","RUNNING",{lockedAt:"2000-01-01 00:00:00"});
  db.db.prepare("UPDATE background_jobs SET locked_at=datetime('now','-14 minutes') WHERE id='recent'").run();
  const r=await getBackgroundJobHealth(db,15);
  assert.equal(r.counts.staleRunning,0);
  assert.equal(r.status,"CLEAR");
});

test("invalid arguments fail closed",async()=>{
  assert.equal((await getBackgroundJobHealth(null)).ok,false);
  assert.equal((await getBackgroundJobHealth({},15)).ok,false);
  assert.equal((await getBackgroundJobHealth(new SQLiteD1(),0)).ok,false);
  assert.equal((await getBackgroundJobHealth(new SQLiteD1(),1441)).ok,false);
});

test("database errors return a generic unavailable state",async()=>{
  const broken={prepare(){throw new Error("private storage error");}};
  assert.deepEqual(await getBackgroundJobHealth(broken),{ok:false,error:"QUEUE_HEALTH_UNAVAILABLE"});
});
