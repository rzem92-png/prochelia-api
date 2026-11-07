import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/r2-preprod-smoke.js";

const token = "x".repeat(40);
function envWithR2() {
  const map = new Map();
  return {
    R2_TEST_TOKEN: token,
    R2_STAGING: {
      async put(key, value, options) { map.set(key, {value, options, etag:"mock-etag"}); },
      async get(key) {
        const item=map.get(key);
        return item ? {etag:item.etag, async text(){return item.value;}} : null;
      },
      async delete(key) { map.delete(key); },
      async head(key) { return map.has(key) ? {key} : null; }
    }
  };
}
const req=(method,path,auth=token,body="")=>new Request("https://preprod.invalid"+path,{method,headers:auth?{authorization:"Bearer "+auth}: {},body:method==="GET"?undefined:body});

test("health reports R2 binding and configured token without revealing secret", async()=>{
 const env=envWithR2(); const res=await worker.fetch(req("GET","/api/health"),env); const data=await res.json();
 assert.equal(res.status,200); assert.equal(data.r2_binding,true); assert.equal(data.token_configured,true); assert.equal(JSON.stringify(data).includes(token),false);
});
test("health works without R2 but reports missing binding",async()=>{
 const res=await worker.fetch(req("GET","/api/health"),{R2_TEST_TOKEN:token});
 const data=await res.json(); assert.equal(res.status,200); assert.equal(data.r2_binding,false);
});
test("rejects missing/incorrect token",async()=>{
 const env=envWithR2();
 assert.equal((await worker.fetch(req("POST","/api/r2/smoke",""),env)).status,401);
 assert.equal((await worker.fetch(req("POST","/api/r2/smoke","bad","PROCHELIA-R2-PREPROD-TEST"),env)).status,401);
});
test("rejects unexpected payload",async()=>{
 const res=await worker.fetch(req("POST","/api/r2/smoke",token,"not-approved"),envWithR2());
 assert.equal(res.status,400);
});
test("rejects oversized body before storage operation",async()=>{
 const res=await worker.fetch(req("POST","/api/r2/smoke",token,"Z".repeat(1024)),envWithR2());
 assert.equal(res.status,413);
});
test("put get delete lifecycle works for fixed synthetic object",async()=>{
 const env=envWithR2();
 let res=await worker.fetch(req("POST","/api/r2/smoke",token,"PROCHELIA-R2-PREPROD-TEST"),env);
 assert.equal(res.status,200); assert.equal((await res.json()).operation,"put");
 res=await worker.fetch(req("GET","/api/r2/smoke",token),env); let data=await res.json();
 assert.equal(data.verified,true); assert.equal(data.body,"PROCHELIA-R2-PREPROD-TEST");
 res=await worker.fetch(req("DELETE","/api/r2/smoke",token),env); data=await res.json();
 assert.equal(data.deleted,true);
 res=await worker.fetch(req("GET","/api/r2/smoke",token),env);
 assert.equal(res.status,404);
});
test("unknown route/method are denied",async()=>{
 const env=envWithR2();
 assert.equal((await worker.fetch(req("GET","/api/r2/objects",token),env)).status,404);
 assert.equal((await worker.fetch(req("PUT","/api/r2/smoke",token),env)).status,404);
});
