import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";
import { stripePost, verifyStripeSignature } from "../src/stripe.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("Stripe API helper sends a server-side secret and idempotency key", async()=>{
  let captured;
  const result=await stripePost(
    {STRIPE_SECRET_KEY:"sk_test_unit"},
    "accounts",
    {type:"express",country:"FR",email:"provider@example.test"},
    "prochelia-test-idem",
    async(url,init)=>{
      captured={url,init,body:String(init.body)};
      return new Response(JSON.stringify({id:"acct_test_123"}),{status:200,headers:{"content-type":"application/json"}});
    }
  );
  assert.equal(result.id,"acct_test_123");
  assert.equal(captured.url,"https://api.stripe.com/v1/accounts");
  assert.equal(captured.init.headers.Authorization,"Bearer sk_test_unit");
  assert.equal(captured.init.headers["Idempotency-Key"],"prochelia-test-idem");
  assert.match(captured.body,/type=express/);
  assert.match(captured.body,/country=FR/);
});

async function stripeSignature(secret,timestamp,body){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+body)));
  return Array.from(mac,x=>x.toString(16).padStart(2,"0")).join("");
}

test("Stripe webhook signature accepts a valid recent v1 signature", async()=>{
  const secret="whsec_unit_test";
  const timestamp=Math.floor(Date.now()/1000);
  const body='{"id":"evt_test_1","type":"account.updated","data":{"object":{"id":"acct_test_1"}}}';
  const signature=await stripeSignature(secret,timestamp,body);
  assert.equal(await verifyStripeSignature("t="+timestamp+",v1="+signature,secret,body,timestamp),true);
});

test("Stripe webhook signature rejects invalid and stale signatures", async()=>{
  const secret="whsec_unit_test";
  const timestamp=Math.floor(Date.now()/1000);
  const body='{"id":"evt_test_2","type":"account.updated"}';
  const signature=await stripeSignature(secret,timestamp,body);
  assert.equal(await verifyStripeSignature("t="+timestamp+",v1="+signature,"wrong-secret",body,timestamp),false);
  assert.equal(await verifyStripeSignature("t="+(timestamp-601)+",v1="+signature,secret,body,timestamp),false);
});

function fakeDb(role="intervenant"){
  const calls=[];
  const user={id:"user-test-1",role,email:"provider@example.test",first_name:"Alex",last_name:"Provider",phone:"0600000000",status:"active",created_at:"2026-10-31",updated_at:"2026-10-31",session_id:"session-test"};
  return {
    calls,
    DB:{
      prepare(sql){
        const statement={
          args:[],
          bind(...args){this.args=args;return this;},
          async first(){
            if(sql.includes("FROM sessions s")) return user;
            return null;
          },
          async all(){return {results:[]};},
          async run(){
            calls.push({sql,args:this.args});
            return {meta:{changes:1}};
          }
        };
        return statement;
      }
    }
  };
}

test("Stripe Connect onboarding creates the account and a fresh onboarding link server-side", async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,init)=>{
    calls.push({url,init,body:String(init.body)});
    if(String(url).endsWith("/accounts")) return new Response(JSON.stringify({id:"acct_test_123"}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/account_links")) return new Response(JSON.stringify({url:"https://connect.stripe.com/setup/test",expires_at:1799999999}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("Unexpected Stripe endpoint");
  };
  try{
    const fake=fakeDb("intervenant");
    const env={DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",APP_BASE_URL:"https://prochelia.pages.dev"};
    const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
      method:"POST",
      headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
      body:JSON.stringify({provider_account_id:"acct_attacker_controlled"})
    }),env);
    const body=await response.json();
    assert.equal(response.status,201,JSON.stringify(body));
    assert.equal(body.account_id,"acct_test_123");
    assert.equal(body.onboarding_url,"https://connect.stripe.com/setup/test");
    assert.equal(response.headers.get("access-control-allow-origin"),"https://prochelia.pages.dev");
    assert.equal(calls.length,2);
    assert.equal(calls[0].init.headers.Authorization,"Bearer sk_test_unit");
    assert.match(calls[0].body,/email=provider%40example.test/);
    assert.doesNotMatch(calls[0].body,/acct_attacker_controlled/);
    assert.match(calls[1].body,/account=acct_test_123/);
    assert.match(calls[1].body,/type=account_onboarding/);
    assert.ok(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_accounts") && x.args.includes("acct_test_123")));
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test("real charges and payouts fail closed until the transaction adapters are implemented", async()=>{
  const fake=fakeDb("gerante");
  const env={...fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/mission/create",{
    method:"POST",
    headers:{Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json","Idempotency-Key":"test-charge-1"},
    body:JSON.stringify({mission_id:"m1",client_id:"c1",intervenant_id:"i1",gross_eur:100,commission_eur:10})
  }),env);
  const body=await response.json();
  assert.equal(response.status,503,JSON.stringify(body));
  assert.equal(body.error,"REAL_PAYMENT_ADAPTER_NOT_READY");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_transactions")),false);
});
