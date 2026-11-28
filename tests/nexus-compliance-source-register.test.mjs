import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../src/nexus-compliance-source-register.js";
const sourceRegisterApi=globalThis.ProcheliaNexusComplianceSourceRegister;
const {evaluate,trustedUrl}=sourceRegisterApi;
const register=JSON.parse(await readFile(new URL("../docs/compliance/official-source-register-2026-11-27.json",import.meta.url),"utf8"));
const now="2026-11-28";
test("source register validates reference metadata but never opens a market",()=>{const r=evaluate(register,now);assert.equal(r.ok,true);assert.equal(r.status,"REFERENCE_REGISTER_METADATA_VALID");assert.equal(r.sourceCount,14);assert.equal(r.marketActivationAllowed,false);assert.equal(r.legalReviewRequired,true);assert.equal(r.controlImplementationVerified,false);assert.equal(r.mode,"SOURCE_METADATA_ONLY");});
test("all sources are unique, scoped, date-stamped and owned",()=>{const ids=register.sources.map(s=>s.sourceId);assert.equal(new Set(ids).size,ids.length);for(const s of register.sources){assert.ok(s.jurisdiction);assert.ok(s.activityCode);assert.ok(s.scope.length>=20);assert.ok(s.checkedAt);assert.ok(s.reviewDueAt);assert.ok(s.owner);assert.ok(s.reviewer);assert.ok(s.controlIds.length);assert.ok(s.evidenceNote);}});
test("only curated official HTTPS domains are accepted",()=>{assert.equal(trustedUrl("https://economie.gouv.fr/page"),true);assert.equal(trustedUrl("https://digital-strategy.ec.europa.eu/en/policies/dsa-impact-platforms"),true);assert.equal(trustedUrl("https://taxation-customs.ec.europa.eu/dac7"),true);assert.equal(trustedUrl("https://www.joradp.dz/FTP/JO-FRANCAIS/2018/F2018028.pdf"),true);assert.equal(trustedUrl("https://sub.economie.gouv.fr/page"),true);assert.equal(trustedUrl("https://economie.gouv.fr.evil.example/page"),false);assert.equal(trustedUrl("http://economie.gouv.fr/page"),false);assert.equal(trustedUrl("https://user:pass@cnil.fr/page"),false);});
test("duplicate source IDs block the register",()=>{const x=structuredClone(register);x.sources[1].sourceId=x.sources[0].sourceId;assert.equal(evaluate(x,now).ok,false);});
test("untrusted URL or legal-review status cannot be presented as validated",()=>{const x=structuredClone(register);x.sources[0].officialUrl="https://example.com/law";assert.equal(evaluate(x,now).ok,false);const y=structuredClone(register);y.sources[0].legalReviewStatus="APPROVED";assert.equal(evaluate(y,now).ok,false);const z=structuredClone(register);z.reviewerType="LEGAL_REVIEW";assert.equal(evaluate(z,now).ok,false);});
test("stale or future source register fails closed",()=>{const x=structuredClone(register);x.reviewDueAt="2026-11-26";assert.equal(evaluate(x,now).reason,"REGISTER_STALE_OR_FUTURE");const y=structuredClone(register);y.checkedAt="2026-11-29";assert.equal(evaluate(y,now).reason,"REGISTER_STALE_OR_FUTURE");assert.equal(evaluate(register).reason,"REGISTER_SCHEMA_INVALID");assert.equal(evaluate(register,"2027-02-26").reason,"REGISTER_STALE_OR_FUTURE");});
test("unresearched countries remain explicitly blocked and are not silently promoted",()=>{assert.ok(register.territoriesNotResearched.includes("BE"));assert.ok(register.territoriesNotResearched.includes("CH"));assert.ok(register.territoriesNotResearched.includes("US"));assert.equal(register.marketActivationAllowed,false);for(const s of register.sources)assert.equal(s.launchImpact,"BLOCKED_PENDING_HUMAN_REVIEW");});

test("fresh official-source additions remain reference-only and block market activation",()=>{
 const ids=new Set(register.sources.map(s=>s.sourceId));
 for(const id of ["FR_DGCCRF_PRICE_INFO_2026","EU_DSA_MARKETPLACE_GUIDANCE","EU_DAC7_COMMISSION","CNIL_AIPD_HIGH_RISK","CNIL_TRANSFER_REVIEW","DZ_ECOMMERCE_LAW_18_05"])assert.ok(ids.has(id),`missing source ${id}`);
 for(const id of ["FR_DGCCRF_PRICE_INFO_2026","EU_DSA_MARKETPLACE_GUIDANCE","EU_DAC7_COMMISSION","CNIL_AIPD_HIGH_RISK","CNIL_TRANSFER_REVIEW","DZ_ECOMMERCE_LAW_18_05"]){const s=register.sources.find(x=>x.sourceId===id);assert.equal(s.accessLevel,"PAGE_OPENED");assert.equal(s.sourceStatus,"REFERENCE_CHECKED");assert.equal(s.legalReviewStatus,id==="DZ_ECOMMERCE_LAW_18_05"?"PENDING_LOCAL_COUNSEL":"PENDING_COUNSEL");assert.equal(s.controlImplementationStatus,"UNVERIFIED");assert.equal(s.launchImpact,"BLOCKED_PENDING_HUMAN_REVIEW");}
 assert.equal(register.marketActivationAllowed,false);
});
