import test from "node:test";
import assert from "node:assert/strict";
import {rankNexusProviders} from "../src/supra-nexus-ranking.js";
const request={requiredSkills:["accompagnement"],maxDistanceKm:20,budgetCents:5000,
 providerCandidates:[
  {id:"local-low-exposure",skills:["accompagnement"],available:true,verified:true,reliability:80,quality:80,distanceKm:5,quoteCents:3000,smallLocalProvider:true,recentExposure:10},
  {id:"popular",skills:["accompagnement"],available:true,verified:true,reliability:90,quality:90,distanceKm:3,quoteCents:3000,smallLocalProvider:false,recentExposure:90},
  {id:"unverified",skills:["accompagnement"],available:true,verified:false,reliability:100,quality:100,distanceKm:1,quoteCents:1000,smallLocalProvider:true,recentExposure:0}
 ]};
test("Nexus ranks only verified, available, qualified, in-budget candidates",()=>{
 const r=rankNexusProviders(request); assert.equal(r.ok,true); assert.equal(r.eligibleCount,2);
 assert.ok(!r.rankings.some(x=>x.providerId==="unverified")); assert.equal(r.assignmentAllowed,false);
});
test("local provider visibility is a modest transparent signal, not an eligibility bypass",()=>{
 const r=rankNexusProviders(request); assert.ok(r.rankings.some(x=>x.providerId==="local-low-exposure"));
 const bad={...request,providerCandidates:[{...request.providerCandidates[0],skills:[]}]};
 assert.equal(rankNexusProviders(bad).eligibleCount,0);
});
test("rejects malformed requests, duplicate IDs, and unsafe numeric input",()=>{
 assert.equal(rankNexusProviders({...request,budgetCents:1.2}).ok,false);
 assert.equal(rankNexusProviders({...request,providerCandidates:[request.providerCandidates[0],request.providerCandidates[0]]}).ok,false);
 assert.equal(rankNexusProviders({...request,maxDistanceKm:Infinity}).ok,false);
});
test("does not allow high score to override verification, availability, budget or skills gates",()=>{
 const candidates=request.providerCandidates.map(c=>({...c,reliability:100,quality:100}));
 candidates.push({...request.providerCandidates[0],id:"over-budget",quoteCents:9999});
 candidates.push({...request.providerCandidates[0],id:"unavailable",available:false});
 const r=rankNexusProviders({...request,providerCandidates:candidates});
 assert.ok(!r.rankings.some(c=>["unverified","over-budget","unavailable"].includes(c.providerId)));
});
test("ranking is deterministic for equal scores",()=>{
 const a={...request,providerCandidates:[{...request.providerCandidates[0],id:"b"},{...request.providerCandidates[0],id:"a"}]};
 assert.deepEqual(rankNexusProviders(a).rankings.map(x=>x.providerId),["a","b"]);
});
