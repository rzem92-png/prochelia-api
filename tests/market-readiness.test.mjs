import test from "node:test";
import assert from "node:assert/strict";
import {GATES,MARKETS,handleMarketReadinessRoute,marketReadinessPayload} from "../src/market-readiness.js";
import worker from "../src/index.js";
test("catalogue includes the initial and planned expansion markets",()=>{
 const expected=["FR","DZ","BE","CH","LU","CA","MA","TN","ES","IT","DE","GB","US","AE"];
 assert.deepEqual(MARKETS.map(m=>m.code),expected);
 assert.equal(new Set(MARKETS.map(m=>m.code)).size,expected.length);
});
test("no market is enabled and all gates await human validation",()=>{
 for(const m of MARKETS){assert.equal(m.launchEnabled,false,m.code);assert.equal(m.readiness,"NOT_ASSESSED",m.code);assert.equal(m.lastReviewedAt,null,m.code);assert.equal(m.timeZonePolicy,"IANA_TIME_ZONE_REQUIRED_PER_SERVICE_LOCATION");assert.deepEqual(m.gates.map(g=>g.key),GATES);assert.ok(m.gates.every(g=>g.status==="PENDING_HUMAN_VALIDATION"),m.code);}
 assert.equal(marketReadinessPayload().requiredHumanApproval,true);assert.equal(marketReadinessPayload().launchEnabled,false);
});
test("GET catalogue returns safe candidate metadata without launch claims",async()=>{
 const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test/api/platform/markets"));assert.equal(r.status,200);const body=await r.json();assert.equal(body.ok,true);assert.equal(body.catalogueType,"CANDIDATE_MARKETS_NOT_LAUNCH_APPROVAL");assert.equal(body.markets.length,14);assert.equal(body.markets[0].code,"FR");assert.equal(body.markets[1].code,"DZ");assert.equal(body.markets.every(m=>!m.launchEnabled),true);assert.equal(r.headers.get("cache-control"),"no-store");
});
test("country query is normalized and returns one market",async()=>{
 const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test/api/platform/markets?country=dz"));assert.equal(r.status,200);const b=await r.json();assert.equal(b.markets.length,1);assert.equal(b.markets[0].code,"DZ");assert.deepEqual(b.markets[0].locales,["ar-DZ","fr-DZ"]);
});
test("unknown country returns 404 and remains disabled",async()=>{
 const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test/api/platform/markets?country=ZZ"));assert.equal(r.status,404);assert.deepEqual(await r.json(),{ok:false,error:"MARKET_NOT_FOUND",country:"ZZ"});
});
test("route is read-only and rejects non-GET",async()=>{
 const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test/api/platform/markets",{method:"POST"}));assert.equal(r.status,405);assert.equal(r.headers.get("allow"),"GET");assert.equal((await r.json()).error,"METHOD_NOT_ALLOWED");
});

test("Worker routes market catalogue before any database dependency",async()=>{
 const response=await worker.fetch(new Request("https://api.prochelia.test/api/platform/markets"),{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.ok,true);
 assert.equal(body.markets.length,14);
 assert.equal(body.launchEnabled,false);
});
