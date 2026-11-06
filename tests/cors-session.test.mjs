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
  }};return stmt;},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
  const env={DB};
  for(let n=1;n<=5;n++){
    const response=await worker.fetch(new Request(endpoint,{method:"POST",headers:{Origin:allowedOrigin,"CF-Connecting-IP":"203.0.113.8","Content-Type":"application/json"},body:JSON.stringify({email:"NoSuchUser@example.test",password:"not-a-valid-password"})}),env);
    assert.equal(response.status,n===5?429:401);
    if(n===5){const body=await response.json();assert.equal(body.error,"LOGIN_RATE_LIMITED");assert.equal(response.headers.get("retry-after"),"900");}
  }
});

test("bootstrap permits only one concurrent initial manager creation", async()=>{
  const state={used:false,users:[]};
  const DB={prepare(sql){const stmt={args:[],bind(...args){this.args=args;return this;},async first(){
    if(sql.includes("SELECT COUNT(*) AS total FROM users")) return {total:state.users.length};
    return null;
  },async run(){return {meta:{changes:1}};}};return stmt;},
  async batch(statements){
    if(state.used||state.users.length){return [{meta:{changes:0}},{meta:{changes:0}}];}
    state.used=true;
    const args=statements[1].args;
    state.users.push({id:args[0],email:args[1],role:"gerante"});
    return [{meta:{changes:1}},{meta:{changes:1}}];
  }};
  const env={DB,BOOTSTRAP_TOKEN:"bootstrap-test-token"};
  const makeRequest=email=>new Request("https://prochelia-api.rzem92.workers.dev/api/auth/bootstrap",{method:"POST",headers:{Origin:allowedOrigin,Authorization:"Bearer bootstrap-test-token","Content-Type":"application/json"},body:JSON.stringify({email,first_name:"Test",last_name:"Manager",password:"StrongTestPass123"})});
  const responses=await Promise.all([worker.fetch(makeRequest("manager1@example.test"),env),worker.fetch(makeRequest("manager2@example.test"),env)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  assert.equal(state.users.length,1);
});

test("login IP bucket blocks password spraying across many account names", async()=>{
  const attempts=[];
  const DB={prepare(sql){const stmt={args:[],bind(...args){this.args=args;return this;},async first(){
    if(sql.includes("COUNT(*) AS total FROM login_attempts")) return {total:attempts.filter(x=>x.keyHash===this.args[0]).length};
    if(sql.includes("FROM users WHERE email")) return null;
    return null;
  },async run(){if(sql.includes("INSERT INTO login_attempts"))attempts.push({keyHash:this.args[1]});return {meta:{changes:1}};}};return stmt;},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
  const env={DB};
  for(let n=1;n<=25;n++){
    const response=await worker.fetch(new Request(endpoint,{method:"POST",headers:{Origin:allowedOrigin,"CF-Connecting-IP":"203.0.113.9","Content-Type":"application/json"},body:JSON.stringify({email:"spray"+n+"@example.test",password:"not-a-real-password"})}),env);
    assert.equal(response.status,n===25?429:401);
  }
});


test("malformed percent-encoded session cookie is rejected without crashing auth", async()=>{
  const response=await worker.fetch(new Request("https://prochelia-api.rzem92.workers.dev/api/auth/me",{
    method:"GET",headers:{Origin:allowedOrigin,Cookie:"prochelia_session=%E0%A4%A"}
  }),{});
  const body=await response.json();
  assert.equal(response.status,401);
  assert.equal(body.error,"UNAUTHENTICATED");
});
