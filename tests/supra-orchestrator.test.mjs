import test from "node:test";
import assert from "node:assert/strict";
import { buildSupraPlan, getSupraDomainRegistry } from "../src/supra-orchestrator.js";

test("transversal domain coverage", () => {
 const domains=getSupraDomainRegistry().map(x=>x.domain);
 for (const d of ["direction","services","talents","live_createurs","opportunites","rentabilite","croissance","finance","comptabilite","tarification","missions","matching","intervenants","clients","entreprises","reclamations","commercial","marketing","securite","rgpd","juridique","international","innovation","crise"]) assert.ok(domains.includes(d),d);
});
test("routine read-only work is autonomous but audited", () => {
 const p=buildSupraPlan({caseType:"analyse_generale",impact:"LOW",requestedAction:"GENERATE_SUMMARY"});
 assert.equal(p.autonomy.routineReadOnlyAutonomy,true);
 assert.equal(p.autonomy.approvalRequired,false);
 assert.equal(p.executionAllowed,false);
 assert.equal(p.auditRequired,true);
});
test("refund requires manager approval", () => {
 const p=buildSupraPlan({caseType:"remboursement",impact:"LOW",requestedAction:"REFUND"});
 assert.equal(p.autonomy.approvalRequired,true);
 assert.equal(p.decisionOwner,"GERANTE");
});
test("immediate danger escalates to a human", () => {
 const p=buildSupraPlan({caseType:"danger_personne",impact:"CRITICAL",context:{immediateDanger:true}});
 assert.equal(p.autonomy.level,"URGENT_HUMAN_ESCALATION");
 assert.equal(p.autonomy.professionalEscalationRequired,true);
});
test("international market launch requires local adaptation and review", () => {
 const p=buildSupraPlan({caseType:"expansion",market:"ma",impact:"HIGH"});
 assert.equal(p.marketPack.market,"ma");
 assert.equal(p.marketPack.launchAllowed,false);
 assert.equal(p.autonomy.approvalRequired,true);
});

test("malformed planner inputs fail closed without throwing", () => {
 for (const value of [null, "invalid", 42, [], {context:[]}, {context:"invalid"}]) {
  const p=buildSupraPlan(value);
  assert.equal(p.executionAllowed,false);
  assert.equal(p.auditRequired,true);
  assert.equal(p.autonomy.approvalRequired,true);
 }
});
test("explicit domain aliases cannot select inherited object properties", () => {
 const p=buildSupraPlan({caseType:"analyse_generale",domain:"__proto__",impact:"LOW"});
 assert.equal(p.domain,"direction");
 assert.equal(p.executionAllowed,false);
});

test("prototype-like case names do not resolve to inherited aliases", () => {
 for (const caseType of ["toString", "constructor", "__proto__"]) {
  assert.equal(buildSupraPlan({caseType}).domain,"direction");
 }
});

test("planner rejects invalid impact, action, market and unexpected fields", () => {
 for (const input of [
  {impact:"SEVERE"},
  {requestedAction:"SEND MONEY"},
  {market:"fr-FR"},
  {unexpected:"client supplied evidence"}
 ]) {
  const p=buildSupraPlan(input);
  assert.equal(p.executionAllowed,false);
  assert.equal(p.autonomy.approvalRequired,true);
  assert.equal(p.decisionOwner,"GERANTE");
  assert.ok(p.rejectionReason);
 }
});

test("caller-controlled verification flags never satisfy server evidence", () => {
 const p=buildSupraPlan({
  caseType:"paiement",
  requestedAction:"REFUND",
  impact:"LOW",
  context:{
   mission_id:"m-1", missionOwnershipVerified:true,
   provider_id:"p-1", providerEligibilityVerified:true,
   providerAvailabilityVerified:true,
   client_id:"c-1", clientOwnershipVerified:true,
   pspConfirmed:true
  }
 });
 assert.ok(p.missingEvidence.includes("verify_mission_ownership_server_side"));
 assert.ok(p.missingEvidence.includes("verify_provider_eligibility_server_side"));
 assert.ok(p.missingEvidence.includes("verify_provider_availability_server_side"));
 assert.ok(p.missingEvidence.includes("verify_client_ownership_server_side"));
 assert.ok(p.missingEvidence.includes("verify_psp_event_and_ledger"));
 assert.equal(p.executionAllowed,false);
});

test("planner rejects non-plain objects and malformed context types", () => {
 for (const input of [null, "bad", 12, [], {context:[]}, {context:"bad"}, {market:12}]) {
  const p=buildSupraPlan(input);
  assert.equal(p.executionAllowed,false);
  assert.equal(p.autonomy.approvalRequired,true);
  assert.equal(p.auditRequired,true);
 }
});

test("planner rejects unexpected context keys and incorrectly typed identifiers", () => {
 for (const input of [
  {context:{adminOverride:true}},
  {context:{mission_id:42}},
  {context:{immediateDanger:"true"}},
  {context:{provider_id:"p-1",providerEligibilityVerified:"true"}}
 ]) {
  const p=buildSupraPlan(input);
  assert.equal(p.executionAllowed,false);
  assert.equal(p.autonomy.approvalRequired,true);
  assert.ok(p.rejectionReason);
 }
});

test("read-only requests with unverified resource ownership are not autonomous", () => {
 const p=buildSupraPlan({
  caseType:"analyse_generale",
  impact:"LOW",
  requestedAction:"GENERATE_SUMMARY",
  context:{mission_id:"mission-123",missionOwnershipVerified:true}
 });
 assert.equal(p.autonomy.routineReadOnlyAutonomy,false);
 assert.equal(p.autonomy.approvalRequired,true);
 assert.ok(p.missingEvidence.includes("verify_mission_ownership_server_side"));
 assert.equal(p.executionAllowed,false);
});
