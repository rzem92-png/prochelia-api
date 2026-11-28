import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  normalizeComplaintIdempotencyKey,
  buildComplaintIdempotencyIdentity,
  reserveComplaintIntake,
  persistComplaintCaseLink
} from "../src/complaint-idempotency.js";

const actor={id:"user-7",role:"client"};
const scope={client_type:"B2C",client_id:"client-7",company_id:null,mission_id:"mission-9",severity:"MEDIUM"};
const draft={category:"service_quality",description:"La prestation n'a pas correspondu à la description initiale.",incidentDate:"2026-11-27",requestReference:"REQ-42",desiredOutcome:"clarification",desiredOutcomeDetails:null,clientId:"client-7",companyId:null,missionId:"mission-9"};
const complaint={client_type:"B2C",client_id:"client-7",company_id:null,mission_id:"mission-9",category:"service_quality",severity:"MEDIUM",description:draft.description};

class FakeStatement {
  constructor(db,sql){this.db=db;this.sql=sql;this.params=[];}
  bind(...params){this.params=params;return this;}
  first(){return this.db.first(this.sql,this.params);}
  run(){return this.db.run(this.sql,this.params);}
}
class FakeD1 {
  records=new Map();
  complaints=new Map();
  prepare(sql){return new FakeStatement(this,sql);}
  key(scope,idemKey){return scope+"|"+idemKey;}
  first(sql,params){
    if(sql.includes("FROM idempotency_records")){
      return this.records.get(this.key(params[0],params[1]))||null;
    }
    if(sql.includes("FROM complaints")){
      const row=this.complaints.get(params[0]);
      return row?{id:row.id,resolution_case_id:row.resolution_case_id}:null;
    }
    throw new Error("Unexpected SELECT: "+sql);
  }
  run(sql,params){
    if(sql.startsWith("UPDATE complaints SET resolution_case_id")){
      const row=this.complaints.get(params[1]);
      if(row)row.resolution_case_id=params[0];
      return {meta:{changes:row?1:0}};
    }
    if(sql.startsWith("UPDATE idempotency_records SET response_json")){
      const row=this.records.get(this.key(params[1],params[2]));
      if(row&&row.request_hash===params[3]){row.response_json=params[0];row.status_code=201;return {meta:{changes:1}};}
      return {meta:{changes:0}};
    }
    throw new Error("Unexpected UPDATE: "+sql);
  }
  async batch(statements){
    const recordsBefore=new Map([...this.records].map(([k,v])=>[k,{...v}]));
    const complaintsBefore=new Map([...this.complaints].map(([k,v])=>[k,{...v}]));
    try{
      for(const statement of statements){
        const sql=statement.sql, p=statement.params;
        if(sql.startsWith("INSERT INTO idempotency_records")){
          const key=this.key(p[1],p[2]);
          if(!this.records.has(key))this.records.set(key,{id:p[0],scope:p[1],idem_key:p[2],request_hash:p[3],response_json:p[4],status_code:202});
        }else if(sql.startsWith("INSERT INTO complaints")){
          const record=this.records.get(this.key(p[8],p[9]));
          if(record&&record.request_hash===p[10]&&record.response_json===p[11]){
            if(this.complaints.has(p[0]))throw new Error("UNIQUE_COMPLAINT_ID");
            this.complaints.set(p[0],{id:p[0],client_type:p[1],client_id:p[2],company_id:p[3],mission_id:p[4],category:p[5],severity:p[6],description:p[7],resolution_case_id:null});
          }
        }else{
          throw new Error("Unexpected batch statement: "+sql);
        }
      }
      return statements.map(()=>({meta:{changes:1}}));
    }catch(error){
      this.records=recordsBefore;this.complaints=complaintsBefore;throw error;
    }
  }
}

test("requires a UUID v4 idempotency key and normalizes case",()=>{
  const key=randomUUID();
  assert.equal(normalizeComplaintIdempotencyKey(key.toUpperCase()),key.toLowerCase());
  assert.equal(normalizeComplaintIdempotencyKey("not-a-key"),null);
  assert.equal(normalizeComplaintIdempotencyKey(null),null);
  assert.equal(normalizeComplaintIdempotencyKey(" "+key),null);
});

test("request hash is stable across object-key order and changes with payload",async()=>{
  const key=randomUUID();
  const identity=await buildComplaintIdempotencyIdentity(actor,key,draft,scope);
  const reordered=await buildComplaintIdempotencyIdentity(actor,key,{missionId:draft.missionId,clientId:draft.clientId,companyId:null,desiredOutcomeDetails:null,desiredOutcome:draft.desiredOutcome,requestReference:draft.requestReference,incidentDate:draft.incidentDate,description:draft.description,category:draft.category},scope);
  assert.equal(identity.scope,reordered.scope);
  assert.equal(identity.keyHash,reordered.keyHash);
  assert.equal(identity.requestHash,reordered.requestHash);
  const changed=await buildComplaintIdempotencyIdentity(actor,key,{...draft,description:"Une autre description complète de la réclamation."},scope);
  assert.notEqual(identity.requestHash,changed.requestHash);
});

test("concurrent duplicate key claims create one complaint and replay the same ID",async()=>{
  const db=new FakeD1(), key=randomUUID(), identity=await buildComplaintIdempotencyIdentity(actor,key,draft,scope);
  const [a,b]=await Promise.all([
    reserveComplaintIntake(db,identity,"complaint-a",complaint),
    reserveComplaintIntake(db,identity,"complaint-b",complaint)
  ]);
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  assert.equal([a.created,b.created].filter(Boolean).length,1);
  assert.equal(a.complaintId,b.complaintId);
  assert.equal(db.complaints.size,1);
});

test("same key with a changed payload is a conflict and creates no second complaint",async()=>{
  const db=new FakeD1(), key=randomUUID(), first=await buildComplaintIdempotencyIdentity(actor,key,draft,scope);
  const second=await buildComplaintIdempotencyIdentity(actor,key,{...draft,desiredOutcome:"review"},scope);
  const a=await reserveComplaintIntake(db,first,"complaint-a",complaint);
  const b=await reserveComplaintIntake(db,second,"complaint-b",{...complaint,description:"changed"});
  assert.equal(a.ok,true);assert.equal(a.created,true);
  assert.deepEqual(b,{ok:false,error:"IDEMPOTENCY_KEY_REUSED"});
  assert.equal(db.complaints.size,1);
});

test("different keys create separate complaints",async()=>{
  const db=new FakeD1(), identityA=await buildComplaintIdempotencyIdentity(actor,randomUUID(),draft,scope);
  const identityB=await buildComplaintIdempotencyIdentity(actor,randomUUID(),draft,scope);
  const a=await reserveComplaintIntake(db,identityA,"complaint-a",complaint);
  const b=await reserveComplaintIntake(db,identityB,"complaint-b",complaint);
  assert.equal(a.created,true);assert.equal(b.created,true);
  assert.equal(db.complaints.size,2);
});

test("case link is persisted and later retries return the linked complaint without creating another",async()=>{
  const db=new FakeD1(), key=randomUUID(), identity=await buildComplaintIdempotencyIdentity(actor,key,draft,scope);
  const first=await reserveComplaintIntake(db,identity,"complaint-a",complaint);
  assert.equal(first.created,true);
  assert.equal(await persistComplaintCaseLink(db,identity,"complaint-a","case-1"),true);
  const replay=await reserveComplaintIntake(db,identity,"complaint-b",complaint);
  assert.equal(replay.ok,true);assert.equal(replay.created,false);
  assert.equal(replay.complaintId,"complaint-a");
  assert.equal(replay.resolutionCaseId,"case-1");
  assert.equal(db.complaints.size,1);
});

test("missing idempotency storage fails closed",async()=>{
  const identity=await buildComplaintIdempotencyIdentity(actor,randomUUID(),draft,scope);
  assert.deepEqual(await reserveComplaintIntake({},identity,"complaint-a",complaint),{ok:false,error:"IDEMPOTENCY_STORAGE_UNAVAILABLE"});
});
