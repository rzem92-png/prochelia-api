import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const allowedOrigin = "https://prochelia.pages.dev";
const endpoint = "https://prochelia-api.rzem92.workers.dev/api/auth/login";

test("CORS preflight for JSON login succeeds without accessing D1", async () => {
  const env = new Proxy({}, {
    get(_target, property) {
      if (property === "DB") throw new Error("Preflight must not access D1");
      return undefined;
    }
  });
  const request = new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-idempotency-key"
    }
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /Content-Type/);
});

test("unapproved browser origin is rejected", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://attacker.example",
      "Access-Control-Request-Method": "POST"
    }
  }), {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("unapproved preflight header is rejected", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "x-evil-header"
    }
  }), {});
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("allowed browser request receives credentialed CORS headers even on a safe failure", async () => {
  const response = await worker.fetch(new Request(endpoint, {
    method: "POST",
    headers: {
      Origin: allowedOrigin,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "test@example.com", password: "not-a-real-password" })
  }), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});
test("login limits repeated failures by normalized email and Cloudflare client IP", async()=>{
  const attempts=[];
  const DB={prepare(sql){const stmt={args:[],bind(...args){this.args=args;return this;},async first(){
    if(sql.includes("COUNT(*) AS total FROM login_attempts")) return {total:attempts.filter(x=>x.keyHash===this.args[0]).length};
    if(sql.includes("FROM users WHERE email")) return null;
    return null;
  },async run(){
    if(sql.includes("INSERT INTO login_attempts")) attempts.push({keyHash:this.args[1]});
    return {meta:{changes:1}};
  }};return stmt;}};
  const env={DB};
  for(let n=1;n<=5;n++){
    const response=await worker.fetch(new Request(endpoint,{method:"POST",headers:{Origin:allowedOrigin,"CF-Connecting-IP":"203.0.113.8","Content-Type":"application/json"},body:JSON.stringify({email:"NoSuchUser@example.test",password:"not-a-valid-password"})}),env);
    assert.equal(response.status,n===5?429:401);
    if(n===5){const body=await response.json();assert.equal(body.error,"LOGIN_RATE_LIMITED");assert.equal(response.headers.get("retry-after"),"900");}
  }
});

