import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";
import { stripePost, verifyStripeSignature } from "../src/stripe.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("V7 permission check explicitly identifies caller-provided permissions as non-authoritative", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,PAYMENT_PROVIDER:"disabled",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/v7/check/permissions",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({role:"admin",permission:"manage_payments",permissions:{manage_payments:true}})
  }),env);
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.ok,true,"legacy checker remains a validator only");
  assert.equal(body.authoritative,false);
  assert.equal(body.source,"caller_supplied_input");
  assert.match(body.warning,/not an authorization grant/i);
});

test("client cannot open a dispute for a mission owned by another account", async()=>{
  const fake=fakeDb("client");
  const response=await worker.fetch(new Request("https://api.test/api/payments/disputes/open",{method:"POST",headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},body:JSON.stringify({mission_id:"mission-other-user",reason:"Contestation",amount_eur:10})}),{DB:fake.DB});
  const body=await response.json();
  assert.equal(response.status,404,JSON.stringify(body));
  assert.equal(body.error,"PAYMENT_NOT_FOUND_FOR_MISSION");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_disputes")),false);
  assert.equal(fake.calls.some(x=>x.sql.includes("UPDATE payment_transactions SET status='held'")),false);
});

test("Stripe API helper sends a server-side secret and idempotency key", async()=>{
  let captured;
  const result=await stripePost(
    {STRIPE_SECRET_KEY:"sk_test_unit"},
    "v2/core/accounts",
    {dashboard:"express",contact_email:"provider@example.test"},
    "prochelia-test-idem",
    async(url,init)=>{
      captured={url,init,body:JSON.parse(String(init.body))};
      return new Response(JSON.stringify({id:"acct_test123"}),{status:200,headers:{"content-type":"application/json"}});
    }
  );
  assert.equal(result.id,"acct_test123");
  assert.equal(captured.url,"https://api.stripe.com/v2/core/accounts");
  assert.equal(captured.init.headers.Authorization,"Bearer sk_test_unit");
  assert.equal(captured.init.headers["Idempotency-Key"],"prochelia-test-idem");
  assert.equal(captured.init.headers["Stripe-Version"],"2026-10-28.endive");
  assert.equal(captured.init.headers["Content-Type"],"application/json");
  assert.equal(captured.body.dashboard,"express");
});

async function stripeSignature(secret,timestamp,body){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+body)));
  return Array.from(mac,x=>x.toString(16).padStart(2,"0")).join("");
}

test("duplicate webhook in processing state is not falsely acknowledged as completed", async()=>{
  const raw=JSON.stringify({id:"evt_processing_test",type:"test.event",data:{object:{id:"obj_test"}}});
  const timestamp=Math.floor(Date.now()/1000);
  const signature=await stripeSignature("whsec_processing_test",timestamp,raw);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));
  let binary=""; for(const byte of digest) binary+=String.fromCharCode(byte);
  const payloadHash=btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  const DB={prepare(sql){const stmt={args:[],bind(...args){this.args=args;return this;},async first(){
    if(sql.includes("SELECT processed,payload_hash,received_at")) return {processed:2,payload_hash:payloadHash,received_at:new Date().toISOString().replace("T"," ").slice(0,19)};
    return null;
  },async run(){
    if(sql.includes("INSERT OR IGNORE INTO payment_webhook_events")) return {meta:{changes:0}};
    if(sql.includes("SET processed=2")) return {meta:{changes:0}};
    return {meta:{changes:1}};
  }};return stmt;}};
  const response=await worker.fetch(new Request("https://api.test/api/payments/webhook",{method:"POST",headers:{"stripe-signature":"t="+timestamp+",v1="+signature,"Content-Type":"application/json"},body:raw}),{DB,PAYMENT_PROVIDER:"stripe",STRIPE_WEBHOOK_SECRET:"whsec_processing_test"});
  const body=await response.json();
  assert.equal(response.status,409);
  assert.equal(body.error,"WEBHOOK_EVENT_PROCESSING");
  assert.equal(body.duplicate,undefined);
});

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

function fakeDb(role="intervenant", options={}){
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
            if(sql.includes("FROM payment_transactions")) return options.transaction || null;
            if(sql.includes("FROM payout_requests")) return options.payout || null;
            if(sql.includes("FROM payment_accounts")) return options.paymentAccount || null;
            if(sql.includes("FROM wallets")) return options.wallet || null;
            return null;
          },
          async all(){return {results:[]};},
          async run(){
            calls.push({sql,args:this.args});
            return {meta:{changes:1}};
          }
        };
        return statement;
      },
      async batch(statements){
        // D1 batch mock: execute each statement and return its result in order.
        return Promise.all(statements.map(statement=>statement.run()));
      }
    }
  };
}

test("Stripe Connect onboarding fails closed unless explicit feature flag is enabled", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_PUBLISHABLE_KEY:"pk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",STRIPE_DASHBOARD:"express",STRIPE_FEES_COLLECTOR:"application",STRIPE_LOSSES_COLLECTOR:"application",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
    method:"POST",headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},body:JSON.stringify({account_token:"acctok_test123",stripe_terms_accepted:true})
  }),env);
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.error,"STRIPE_CONNECT_ONBOARDING_DISABLED");
});

test("live Stripe key cannot enable Connect onboarding without separate live opt-in", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,STRIPE_CONNECT_ONBOARDING_ENABLED:"true",PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_live_testguard",STRIPE_PUBLISHABLE_KEY:"pk_live_testguard",STRIPE_WEBHOOK_SECRET:"whsec_unit",STRIPE_DASHBOARD:"express",STRIPE_FEES_COLLECTOR:"application",STRIPE_LOSSES_COLLECTOR:"application",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{method:"POST",headers:{Origin:"https://prochelia.pages.dev","Content-Type":"application/json"},body:"{}"}),env);
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.error,"STRIPE_CONNECT_LIVE_DISABLED");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_accounts")),false);
});

test("Stripe Connect onboarding creates the account and a fresh onboarding link server-side", async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,init)=>{
    calls.push({url,init,body:JSON.parse(String(init.body))});
    if(String(url).endsWith("/v2/core/accounts")) return new Response(JSON.stringify({id:"acct_test123"}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/v2/core/account_links")) return new Response(JSON.stringify({url:"https://connect.stripe.com/setup/test",expires_at:1799999999}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("Unexpected Stripe endpoint");
  };
  try{
    const fake=fakeDb("intervenant");
    const env={DB:fake.DB,STRIPE_CONNECT_ONBOARDING_ENABLED:"true",PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_PUBLISHABLE_KEY:"pk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",STRIPE_DASHBOARD:"express",STRIPE_FEES_COLLECTOR:"application",STRIPE_LOSSES_COLLECTOR:"application",APP_BASE_URL:"https://prochelia.pages.dev"};
    const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
      method:"POST",
      headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
      body:JSON.stringify({account_token:"acctok_test123",stripe_terms_accepted:true,provider_account_id:"acct_attacker_controlled"})
    }),env);
    const body=await response.json();
    assert.equal(response.status,201,JSON.stringify(body));
    assert.equal(body.account_id,"acct_test123");
    assert.equal(body.onboarding_url,"https://connect.stripe.com/setup/test");
    assert.equal(response.headers.get("access-control-allow-origin"),"https://prochelia.pages.dev");
    assert.equal(calls.length,2);
    assert.equal(calls[0].init.headers.Authorization,"Bearer sk_test_unit");
    assert.equal(calls[0].init.headers["Stripe-Version"],"2026-10-28.endive");
    assert.equal(calls[0].body.account_token,"acctok_test123");
    assert.equal(calls[0].body.dashboard,"express");
    assert.equal(calls[0].body.defaults.responsibilities.fees_collector,"application");
    assert.equal(calls[0].body.defaults.responsibilities.losses_collector,"application");
    assert.equal(calls[0].body.metadata.prochelia_user_id,"user-test-1");
    assert.equal(JSON.stringify(calls[0].body).includes("acct_attacker_controlled"),false);
    assert.equal(calls[1].body.account,"acct_test123");
    assert.equal(calls[1].body.use_case.type,"account_onboarding");
    assert.deepEqual(calls[1].body.use_case.account_onboarding.configurations,["recipient"]);
    assert.ok(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_accounts") && x.sql.includes("'creating'") && x.args.includes("user-test-1")));
    assert.ok(fake.calls.some(x=>x.sql.includes("UPDATE payment_accounts SET provider='stripe',provider_account_id=?") && x.args.includes("acct_test123")));
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test("Stripe Connect ambiguous account creation is locked for reconciliation instead of retrying", async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error("simulated network timeout after Stripe request");};
  try {
    const fake=fakeDb("intervenant");
    const env={DB:fake.DB,STRIPE_CONNECT_ONBOARDING_ENABLED:"true",PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_PUBLISHABLE_KEY:"pk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",STRIPE_DASHBOARD:"express",STRIPE_FEES_COLLECTOR:"application",STRIPE_LOSSES_COLLECTOR:"application",APP_BASE_URL:"https://prochelia.pages.dev"};
    const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
      method:"POST",headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
      body:JSON.stringify({account_token:"acctok_test123",stripe_terms_accepted:true})
    }),env);
    const body=await response.json();
    assert.equal(response.status,502);
    assert.equal(body.error,"STRIPE_ONBOARDING_FAILED");
    assert.ok(fake.calls.some(x=>x.sql.includes("status='reconciliation_required'") && x.args.length===1));
    assert.equal(fake.calls.some(x=>x.sql.includes("status='creation_failed'")),false);
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test("legacy creation_failed Connect row cannot trigger a second Stripe account", async()=>{
  const originalFetch=globalThis.fetch;
  let stripeCalls=0;
  globalThis.fetch=async()=>{stripeCalls++;throw new Error("must not call Stripe");};
  try {
    const fake=fakeDb("intervenant",{paymentAccount:{id:"legacy-reservation",user_id:"user-test-1",provider:"stripe",provider_account_id:null,status:"creation_failed",onboarding_status:"required",payouts_enabled:0}});
    const env={DB:fake.DB,STRIPE_CONNECT_ONBOARDING_ENABLED:"true",PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_PUBLISHABLE_KEY:"pk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",STRIPE_DASHBOARD:"express",STRIPE_FEES_COLLECTOR:"application",STRIPE_LOSSES_COLLECTOR:"application",APP_BASE_URL:"https://prochelia.pages.dev"};
    const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
      method:"POST",headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
      body:JSON.stringify({account_token:"acctok_test123",stripe_terms_accepted:true})
    }),env);
    const body=await response.json();
    assert.equal(response.status,409);
    assert.equal(body.error,"STRIPE_CONNECT_ACCOUNT_STATE_CONFLICT");
    assert.equal(stripeCalls,0);
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test("real charges and payouts fail closed until the transaction adapters are implemented", async()=>{
  const fake=fakeDb("gerante");
  const env={DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",APP_BASE_URL:"https://prochelia.pages.dev"};
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

test("refund webhook remains blocked until reversal ledger is implemented", async()=>{
  const fake=fakeDb("gerante",{transaction:{id:"tx-refund-1",status:"paid",intervenant_id:"provider-user-1",net_intervenant_cents:700,gross_cents:1000,refund_cents:0}});
  const raw=JSON.stringify({id:"evt_refund_blocked",type:"charge.refunded",data:{object:{id:"ch_test_1",metadata:{prochelia_transaction_id:"tx-refund-1"}}}});
  const timestamp=Math.floor(Date.now()/1000),signature=await stripeSignature("whsec_refund",timestamp,raw);
  const response=await worker.fetch(new Request("https://api.test/api/payments/webhook",{method:"POST",headers:{"Stripe-Signature":"t="+timestamp+",v1="+signature,"Content-Type":"application/json"},body:raw}),{DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_WEBHOOK_SECRET:"whsec_refund"});
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.error,"REFUND_LEDGER_NOT_IMPLEMENTED");
  assert.equal(fake.calls.some(x=>x.sql.includes("SET status='refunded'")),false);
});

test("paid payment webhook applies transaction and wallet credit through D1 batch", async()=>{
  const fake=fakeDb("gerante",{transaction:{id:"tx-local-1",status:"pending",intervenant_id:"provider-user-1",net_intervenant_cents:750}});
  const raw=JSON.stringify({id:"evt_paid_atomic",type:"payment_intent.succeeded",data:{object:{id:"pi_test_1",metadata:{prochelia_transaction_id:"tx-local-1"}}}});
  const timestamp=Math.floor(Date.now()/1000),signature=await stripeSignature("whsec_atomic",timestamp,raw);
  const response=await worker.fetch(new Request("https://api.test/api/payments/webhook",{method:"POST",headers:{"Stripe-Signature":"t="+timestamp+",v1="+signature,"Content-Type":"application/json"},body:raw}),{DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_WEBHOOK_SECRET:"whsec_atomic"});
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.ok(fake.calls.some(x=>x.sql.includes("UPDATE payment_transactions SET status='paid'")));
  assert.ok(fake.calls.some(x=>x.sql.includes("UPDATE wallets SET available_cents=available_cents+?")));
});

test("payout paid webhook uses atomic reserved-to-paid wallet settlement", async()=>{
  const fake=fakeDb("gerante",{payout:{id:"payout-local-1",status:"processing",amount_cents:900,wallet_id:"wallet-provider-1"}});
  const raw=JSON.stringify({id:"evt_payout_atomic",type:"payout.paid",data:{object:{id:"po_test_1",metadata:{prochelia_payout_id:"payout-local-1"}}}});
  const timestamp=Math.floor(Date.now()/1000),signature=await stripeSignature("whsec_atomic",timestamp,raw);
  const response=await worker.fetch(new Request("https://api.test/api/payments/webhook",{method:"POST",headers:{"Stripe-Signature":"t="+timestamp+",v1="+signature,"Content-Type":"application/json"},body:raw}),{DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_WEBHOOK_SECRET:"whsec_atomic"});
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.ok(fake.calls.some(x=>x.sql.includes("UPDATE payout_requests SET status=?")));
  assert.ok(fake.calls.some(x=>x.sql.includes("reserved_cents=reserved_cents-?,paid_cents=paid_cents+?")));
});

test("Stripe v2 account requirements webhook updates Connect readiness only after valid signature", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",APP_BASE_URL:"https://prochelia.pages.dev"};
  const timestamp=Math.floor(Date.now()/1000);
  const body=JSON.stringify({id:"evt_account_updated_1",type:"v2.core.account[requirements].updated",data:{object:{id:"acct_test123"}}});
  const signature=await stripeSignature("whsec_unit",timestamp,body);
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({id:"acct_test123",configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:"active"}}}}}}),{status:200,headers:{"content-type":"application/json"}});
  try {
  const response=await worker.fetch(new Request("https://api.test/api/payments/webhook",{
    method:"POST",
    headers:{"Content-Type":"application/json","Stripe-Signature":"t="+timestamp+",v1="+signature},
    body
  }),env);
  const result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  const update=fake.calls.find(x=>x.sql.includes("UPDATE payment_accounts SET charges_enabled"));
  assert.ok(update);
  assert.equal(update.args[0],1);
  assert.equal(update.args[1],"active");
  assert.equal(update.args[2],"submitted");
  assert.equal(update.args[3],"acct_test123");
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test("invalid Stripe webhook is rejected before payment schema DDL", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_WEBHOOK_SECRET:"whsec_unit"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/webhook",{
    method:"POST",
    headers:{"Content-Type":"application/json","Stripe-Signature":"t=1,v1=invalid"},
    body:'{"id":"evt_bad","type":"account.updated"}'
  }),env);
  const body=await response.json();
  assert.equal(response.status,401,JSON.stringify(body));
  assert.equal(fake.calls.some(x=>x.sql.includes("CREATE TABLE IF NOT EXISTS payment_accounts")),false);
});

test("payout requests remain blocked until a real payout adapter exists", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/payout",{
    method:"POST",
    headers:{Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
    body:JSON.stringify({amount_eur:100})
  }),env);
  const body=await response.json();
  assert.equal(response.status,503,JSON.stringify(body));
  assert.equal(body.error,"REAL_PAYOUT_ADAPTER_NOT_READY");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO payout_requests")),false);
});

test("Stripe onboarding refuses to choose dashboard and financial responsibility silently", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,STRIPE_CONNECT_ONBOARDING_ENABLED:"true",PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
    method:"POST",
    headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
    body:"{}"
  }),env);
  const body=await response.json();
  assert.equal(response.status,503,JSON.stringify(body));
  assert.equal(body.error,"STRIPE_CONNECT_NOT_CONFIGURED");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_accounts")),false);
});

test("public payment configuration exposes only the Stripe publishable key", async()=>{
  const response=await worker.fetch(new Request("https://api.test/api/payments/config"),{
    PAYMENT_PROVIDER:"stripe",
    STRIPE_PUBLISHABLE_KEY:"pk_test_public",
    STRIPE_SECRET_KEY:"sk_live_must_never_be_returned"
  });
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.stripe_publishable_key,"pk_test_public");
  assert.equal(JSON.stringify(body).includes("sk_live_must_never_be_returned"),false);
});

test("public Connect readiness remains false while onboarding feature flag is disabled", async()=>{
  const response=await worker.fetch(new Request("https://api.test/api/payments/config"),{
    PAYMENT_PROVIDER:"stripe",
    STRIPE_PUBLISHABLE_KEY:"pk_test_public",
    STRIPE_SECRET_KEY:"sk_test_private",
    STRIPE_WEBHOOK_SECRET:"whsec_test",
    APP_BASE_URL:"https://prochelia.pages.dev",
    STRIPE_DASHBOARD:"express",
    STRIPE_FEES_COLLECTOR:"application",
    STRIPE_LOSSES_COLLECTOR:"application"
  });
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.connect_onboarding_ready,false);
});

test("Stripe onboarding requires an account token and explicit terms acceptance", async()=>{
  const fake=fakeDb("intervenant");
  const env={DB:fake.DB,STRIPE_CONNECT_ONBOARDING_ENABLED:"true",PAYMENT_PROVIDER:"stripe",STRIPE_SECRET_KEY:"sk_test_unit",STRIPE_PUBLISHABLE_KEY:"pk_test_unit",STRIPE_WEBHOOK_SECRET:"whsec_unit",STRIPE_DASHBOARD:"express",STRIPE_FEES_COLLECTOR:"application",STRIPE_LOSSES_COLLECTOR:"application",APP_BASE_URL:"https://prochelia.pages.dev"};
  const response=await worker.fetch(new Request("https://api.test/api/payments/onboard",{
    method:"POST",
    headers:{Origin:"https://prochelia.pages.dev",Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
    body:"{}"
  }),env);
  const body=await response.json();
  assert.equal(response.status,400,JSON.stringify(body));
  assert.equal(body.error,"STRIPE_ACCOUNT_TOKEN_AND_TERMS_REQUIRED");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO payment_accounts")),false);
});

test("server quote endpoint refuses client-controlled prices until a tariff policy is configured", async()=>{
  const fake=fakeDb("gerante");
  const env={DB:fake.DB};
  const response=await worker.fetch(new Request("https://api.test/api/pricing/quote",{
    method:"POST",
    headers:{Cookie:"prochelia_session=synthetic-token","Content-Type":"application/json"},
    body:JSON.stringify({base_price_cents:1,platform_fee_percent:0,discount_cents:999999,holiday:true})
  }),env);
  const body=await response.json();
  assert.equal(response.status,503,JSON.stringify(body));
  assert.equal(body.error,"SERVER_PRICING_POLICY_NOT_CONFIGURED");
  assert.equal(fake.calls.some(x=>x.sql.includes("INSERT INTO pricing_quotes")),false);
});
