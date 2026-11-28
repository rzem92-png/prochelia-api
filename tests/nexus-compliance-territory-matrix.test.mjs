import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../src/nexus-compliance-territory-matrix.js";
const api=globalThis.ProcheliaNexusTerritoryActivityMatrix;
const matrix=JSON.parse(await readFile(new URL("../docs/compliance/territory-activity-matrix-2026-11-28.json",import.meta.url),"utf8"));
const register=JSON.parse(await readFile(new URL("../docs/compliance/official-source-register-2026-11-27.json",import.meta.url),"utf8"));
const now="2026-11-28";
const expected=["FR","EU","DZ","BE","CH","LU","CA","MA","TN","ES","IT","DE","GB","US","AE","OTHER"];
const categories=matrix.requiredCategories;
const activities=matrix.activityModels;

test("territory/activity matrix validates as metadata only and keeps every market closed",()=>{
 const result=api.evaluate(matrix,register,now);
 assert.equal(result.ok,true);
 assert.equal(result.status,"MATRIX_METADATA_VALID");
 assert.equal(result.marketActivationAllowed,false);
 assert.equal(result.legalReviewRequired,true);
 assert.equal(result.controlImplementationVerified,false);
 assert.equal(result.territoryCount,16);
 assert.equal(result.notResearchedTerritories.length,13);
 assert.equal(result.categoryCount,20);
 assert.equal(result.activityModelCount,5);
});

test("matrix covers all required territories, categories and business models",()=>{
 assert.deepEqual(matrix.territories.map(t=>t.code),expected);
 for(const territory of matrix.territories){
  assert.deepEqual(Object.keys(territory.categories).sort(),categories.slice().sort());
  assert.deepEqual(Object.keys(territory.activityAssessments).sort(),activities.slice().sort());
  assert.equal(territory.marketActivationAllowed,false);
  for(const category of categories)assert.equal(territory.categories[category].controlImplementationStatus,"UNVERIFIED");
  for(const activity of activities){assert.equal(territory.activityAssessments[activity].status,"UNVERIFIED");assert.equal(territory.activityAssessments[activity].marketActivationAllowed,false);}
 }
});

test("France, EU and Algeria reference only source-register entries and remain pending legal review",()=>{
 const sourceIds=new Set(register.sources.map(s=>s.sourceId));
 for(const code of ["FR","EU","DZ"]){
  const t=matrix.territories.find(x=>x.code===code);
  assert.equal(t.coverageStatus,"PARTIAL_SOURCE_REGISTER");
  assert.ok(t.sourceIds.length>0);
  assert.ok(t.sourceIds.every(id=>sourceIds.has(id)));
  assert.ok(["PENDING_COUNSEL","PENDING_LOCAL_COUNSEL"].includes(t.legalReviewStatus));
 }
 assert.equal(matrix.territories.find(x=>x.code==="FR").categories.pricing_fees.status,"SOURCE_REGISTERED");
 assert.equal(matrix.territories.find(x=>x.code==="EU").categories.DSA.status,"SOURCE_REGISTERED");
 assert.equal(matrix.territories.find(x=>x.code==="DZ").categories.local_licensing.status,"SOURCE_REGISTERED");
});

test("future markets are explicitly NOT_RESEARCHED with no source or control claim",()=>{
 for(const code of matrix.territoriesNotResearched){
  const t=matrix.territories.find(x=>x.code===code);
  assert.equal(t.coverageStatus,"NOT_RESEARCHED");
  assert.equal(t.legalReviewStatus,"NOT_RESEARCHED");
  assert.deepEqual(t.sourceIds,[]);
  for(const category of categories)assert.equal(t.categories[category].status,"NOT_RESEARCHED");
 }
});

test("matrix fails closed if a territory is activated or claims compliance",()=>{
 const opened=structuredClone(matrix);
 opened.territories[0].marketActivationAllowed=true;
 assert.equal(api.evaluate(opened,register,now).ok,false);
 const claimed=structuredClone(matrix);
 claimed.territories[0].categories.pricing_fees.status="COMPLIANT";
 assert.equal(api.evaluate(claimed,register,now).ok,false);
});

test("matrix fails closed when review date expires or a source reference is invented",()=>{
 const stale=structuredClone(matrix);
 stale.reviewDueAt="2026-11-27";
 assert.equal(api.evaluate(stale,register,now).ok,false);
 const invalid=structuredClone(matrix);
 invalid.territories[0].categories.pricing_fees.sourceIds=["FAKE_SOURCE"];
 invalid.territories[0].sourceIds.push("FAKE_SOURCE");
 assert.equal(api.evaluate(invalid,register,now).ok,false);
});
