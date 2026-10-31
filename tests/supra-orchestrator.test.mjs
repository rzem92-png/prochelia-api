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
