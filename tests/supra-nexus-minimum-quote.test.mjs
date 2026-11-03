import test from "node:test";
import assert from "node:assert/strict";
import { rankNexusProviders } from "../src/supra-nexus-ranking.js";

const candidate = (overrides = {}) => ({
  id:"provider-1", skills:["companionship"], available:true, verified:true,
  reliability:90, quality:90, distanceKm:2, quoteCents:5000,
  minimumViableQuoteCents:4000, smallLocalProvider:false, recentExposure:20,
  ...overrides
});
const request = (providerCandidates = [candidate()], overrides = {}) => ({
  requiredSkills:["companionship"], maxDistanceKm:20, budgetCents:8000,
  providerCandidates, ...overrides
});

test("rejects missing or invalid server minimum viable quote", () => {
  assert.equal(rankNexusProviders(request([candidate({minimumViableQuoteCents:undefined})])).error,
    "INVALID_CANDIDATE_FIELDS");
  assert.equal(rankNexusProviders(request([candidate({minimumViableQuoteCents:0})])).error,
    "INVALID_CANDIDATE_FIELDS");
  assert.equal(rankNexusProviders(request([candidate({minimumViableQuoteCents:1.5})])).error,
    "INVALID_CANDIDATE_FIELDS");
});

test("excludes quote below server minimum viable floor", () => {
  const result = rankNexusProviders(request([candidate({quoteCents:3999, minimumViableQuoteCents:4000})]));
  assert.equal(result.ok,true);
  assert.equal(result.eligibleCount,0);
  assert.equal(result.executionAllowed,false);
  assert.equal(result.assignmentAllowed,false);
});

test("allows quote exactly at the server minimum viable floor", () => {
  const result = rankNexusProviders(request([candidate({quoteCents:4000, minimumViableQuoteCents:4000})]));
  assert.equal(result.ok,true);
  assert.equal(result.eligibleCount,1);
  assert.equal(result.rankings[0].quoteCents,4000);
  assert.equal(result.executionAllowed,false);
  assert.equal(result.assignmentAllowed,false);
});

test("rejects quote above client budget even if above server floor", () => {
  const result = rankNexusProviders(request([candidate({quoteCents:8001, minimumViableQuoteCents:4000})]));
  assert.equal(result.ok,true);
  assert.equal(result.eligibleCount,0);
});

test("fails closed on malformed request and duplicate provider IDs", () => {
  assert.equal(rankNexusProviders(null).ok,false);
  assert.equal(rankNexusProviders(request([candidate(), candidate()])).error,"INVALID_CANDIDATE");
});
