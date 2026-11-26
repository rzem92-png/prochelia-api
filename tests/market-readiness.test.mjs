import test from "node:test";
import assert from "node:assert/strict";
import {GATES,MARKETS,handleMarketReadinessRoute,marketReadinessPayload,marketLocalizationPayload} from "../src/market-readiness.js";
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
test("market localization formatting is generated for every configured locale and currency",()=>{
 for(const m of MARKETS){const result=marketLocalizationPayload(m.code);assert.ok(result,m.code);assert.equal(result.countryCode,m.code);assert.equal(result.currency,m.currency);assert.ok(result.examples.number.length>0);assert.ok(result.examples.currency.length>0);assert.ok(result.examples.date.length>0);assert.ok(result.examples.time.length>0);assert.ok(Number.isInteger(result.currencyFractionDigits));assert.ok(result.currencyFractionDigits>=0&&result.currencyFractionDigits<=3);assert.equal(result.launchEnabled,false);assert.equal(result.readiness,"NOT_ASSESSED");assert.equal(result.taxConfiguration.status,"NOT_CONFIGURED");assert.equal(result.taxConfiguration.requiresLocalExpertValidation,true);}
});
test("localization never invents a service timezone and labels UTC as sample only",()=>{
 for(const m of MARKETS){const l=marketLocalizationPayload(m.code);assert.deepEqual(l.timeZone,{required:true,policy:"IANA_TIME_ZONE_REQUIRED_PER_SERVICE_LOCATION",default:null});assert.equal(l.examples.sampleTimeZone,"UTC");}
});
test("measurement preferences are explicit and country readiness remains human-gated",()=>{
 assert.equal(marketLocalizationPayload("US").measurementSystem,"us_customary");assert.equal(marketLocalizationPayload("GB").measurementSystem,"mixed");assert.equal(marketLocalizationPayload("FR").measurementSystem,"metric");
});
test("localization endpoint normalizes country code and returns no-store",async()=>{
 const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test/api/platform/markets/fr/localization"));assert.equal(r.status,200);const b=await r.json();assert.equal(b.ok,true);assert.equal(b.localization.countryCode,"FR");assert.equal(b.localization.preferredLocale,"fr-FR");assert.equal(r.headers.get("cache-control"),"no-store");assert.equal(r.headers.get("x-content-type-options"),"nosniff");
});
test("localization endpoint unknown country returns 404",async()=>{
 const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test/api/platform/markets/zz/localization"));assert.equal(r.status,404);assert.deepEqual(await r.json(),{ok:false,error:"MARKET_NOT_FOUND",country:"ZZ"});
});
test("both market routes are read-only and reject non-GET",async()=>{
 for(const path of ["/api/platform/markets","/api/platform/markets/FR/localization"]){const r=handleMarketReadinessRoute(new Request("https://api.prochelia.test"+path,{method:"POST"}));assert.equal(r.status,405);assert.equal(r.headers.get("allow"),"GET");assert.equal((await r.json()).error,"METHOD_NOT_ALLOWED");}
});
test("Worker routes market catalogue before any database dependency",async()=>{
 const response=await worker.fetch(new Request("https://api.prochelia.test/api/platform/markets"),{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.ok,true);
 assert.equal(body.markets.length,14);
 assert.equal(body.launchEnabled,false);
});
