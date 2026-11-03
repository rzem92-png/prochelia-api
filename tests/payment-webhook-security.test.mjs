import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const url="https://prochelia-api-preview.rzem92.workers.dev/api/payments/webhook";

function dbMustNotBeTouched(){
  let calls=0;
  return {db:{prepare(){calls++;throw new Error("D1 must not be accessed before webhook authentication");}},calls:()=>calls};
}

test("PSP webhook route rejects invalid signature before D1/schema operations",async()=>{
  const guard=dbMustNotBeTouched();
  const response=await worker.fetch(new Request(url,{method:"POST",headers:{"content-type":"application/json","x-prochelia-signature":"invalid"},body:JSON.stringify({id:"evt_test",type:"payment_succeeded"})}),{...guard.db,PAYMENT_WEBHOOK_SECRET:"test-secret",PAYMENT_PROVIDER:"test"});
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,"INVALID_WEBHOOK_SIGNATURE");
  assert.equal(guard.calls(),0);
});

test("PSP webhook route fails closed when secret is absent and never touches D1",async()=>{
  const guard=dbMustNotBeTouched();
  const response=await worker.fetch(new Request(url,{method:"POST",body:"{}"}),guard.db);
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,"INVALID_WEBHOOK_SIGNATURE");
  assert.equal(guard.calls(),0);
});

test("PSP webhook rejects oversized payload before signature verification or D1",async()=>{
  const guard=dbMustNotBeTouched();
  const body="x".repeat(1_048_577);
  const response=await worker.fetch(new Request(url,{method:"POST",body}),{...guard.db,PAYMENT_WEBHOOK_SECRET:"test-secret",PAYMENT_PROVIDER:"test"});
  assert.equal(response.status,413);
  assert.equal((await response.json()).error,"WEBHOOK_PAYLOAD_TOO_LARGE");
  assert.equal(guard.calls(),0);
});

test("PSP webhook route rejects non-POST method",async()=>{
  const guard=dbMustNotBeTouched();
  const response=await worker.fetch(new Request(url,{method:"GET"}),guard.db);
  assert.equal(response.status,405);
  assert.equal(guard.calls(),0);
});
