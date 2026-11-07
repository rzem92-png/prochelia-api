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

test("public health is minimal and does not expose binding/token configuration", async()=>{
 const env=envWithR2(); const res=await worker.fetch(req("GET","/api/health"),env); const data=await res.json();
 assert.equal(res.status,200); assert.equal(data.ok,true); assert.equal(data.status,"available");
 assert.equal("r2_binding" in data,false); assert.equal("token_configured" in data,false);
 assert.equal(JSON.stringify(data).includes(token),false);
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
test("storage provider exceptions are sanitized into 503",async()=>{
 const env=envWithR2();
 env.R2_STAGING.put=async()=>{throw new Error("secret provider detail should not leak");};
 const res=await worker.fetch(req("POST","/api/r2/smoke",token,"PROCHELIA-R2-PREPROD-TEST"),env);
 const body=await res.text();
 assert.equal(res.status,503);
 assert.equal(body.includes("secret provider detail"),false);
 assert.equal(body.includes("R2_OPERATION_FAILED"),true);
});
test("unknown route/method are denied",async()=>{
 const env=envWithR2();
 assert.equal((await worker.fetch(req("GET","/api/r2/objects",token),env)).status,404);
 assert.equal((await worker.fetch(req("PUT","/api/r2/smoke",token),env)).status,404);
});

test("invalid UTF-8 body is rejected as a 400 without reaching R2",async()=>{
 const env=envWithR2(); let puts=0; const original=env.R2_STAGING.put;
 env.R2_STAGING.put=async(...args)=>{puts++; return original(...args);};
 const request=new Request("https://preprod.invalid/api/r2/smoke",{method:"POST",headers:{authorization:"Bearer "+token},body:new Uint8Array([0xc3,0x28])});
 const res=await worker.fetch(request,env); const data=await res.json();
 assert.equal(res.status,400); assert.equal(data.error,"INVALID_UTF8"); assert.equal(puts,0);
});

test("binding diagnostics are not exposed to unauthenticated callers",async()=>{
 const env={R2_TEST_TOKEN:token};
 let res=await worker.fetch(req("POST","/api/r2/smoke","bad","PROCHELIA-R2-PREPROD-TEST"),env);
 assert.equal(res.status,401); assert.equal((await res.json()).error,"UNAUTHORIZED");
 res=await worker.fetch(req("POST","/api/r2/smoke",token,"PROCHELIA-R2-PREPROD-TEST"),env);
 assert.equal(res.status,503); assert.equal((await res.json()).error,"R2_BINDING_MISSING");
});

test("JSON responses include baseline browser security headers",async()=>{
 const res=await worker.fetch(req("GET","/api/health"),envWithR2());
 assert.equal(res.headers.get("cache-control"),"no-store");
 assert.equal(res.headers.get("x-content-type-options"),"nosniff");
 assert.equal(res.headers.get("x-frame-options"),"DENY");
 assert.equal(res.headers.get("referrer-policy"),"no-referrer");
 assert.equal(res.headers.get("permissions-policy"),"camera=(), microphone=(), geolocation=()");
});

test("unauthorized requests never call R2",async()=>{
 const env=envWithR2(); let calls=0;
 for (const method of ["put","get","delete","head"]) {
   const original=env.R2_STAGING[method];
   env.R2_STAGING[method]=async(...args)=>{calls++; return original(...args);};
 }
 const res=await worker.fetch(req("POST","/api/r2/smoke","invalid","PROCHELIA-R2-PREPROD-TEST"),env);
 assert.equal(res.status,401); assert.equal(calls,0);
});
