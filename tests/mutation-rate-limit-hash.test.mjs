import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";

function makeD1() {
  const sqlite=new DatabaseSync(":memory:");
  return {
    sqlite,
    DB:{
      prepare(sql) {
        let params=[];
        return {
          bind(...values){params=values;return this;},
          first(){return sqlite.prepare(sql).get(...params)??null;},
          all(){return {results:sqlite.prepare(sql).all(...params)};},
          run(){const result=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};}
        };
      }
    }
  };
}

function mutation(ip="203.0.113.8",origin) {
  const headers={"content-type":"application/json","cf-connecting-ip":ip};
  if(origin) headers.origin=origin;
  return new Request("https://preview.example/api/unknown-write",{method:"POST",headers,body:JSON.stringify({probe:true})});
}

test("mutation rate limiter computes and stores a SHA-256 hex subject hash instead of failing closed with 500",async()=>{
  const {sqlite,DB}=makeD1();
  const first=await worker.fetch(mutation(),{DB});
  assert.notEqual(first.status,500);
  assert.notEqual((await first.json()).error,"PRODUCTION_SAFETY_ERROR");
  const second=await worker.fetch(mutation(),{DB});
  assert.notEqual(second.status,500);
  const row=sqlite.prepare("SELECT bucket,subject_hash,request_count FROM security_rate_limits LIMIT 1").get();
  assert.equal(row.bucket,"GENERAL:/api/unknown-write");
  assert.match(row.subject_hash,/^[a-f0-9]{64}$/);
  assert.equal(row.request_count,2);
});

test("untrusted Origin is denied before rate-limit schema or counters are touched",async()=>{
  const {sqlite,DB}=makeD1();
  const response=await worker.fetch(mutation("203.0.113.9","https://attacker.invalid"),{DB});
  assert.equal(response.status,403);
  const schema=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='security_rate_limits'").get();
  assert.equal(schema,undefined);
});
