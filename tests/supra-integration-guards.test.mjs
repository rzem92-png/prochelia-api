import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("les dossiers Copilote ne se résolvent plus automatiquement à la création", () => {
  assert.match(source, /const requiresManager=1;/);
  assert.match(source, /const status='OPEN';/);
  assert.match(source, /status:'WAITING_MANAGER'/);
  assert.doesNotMatch(source, /if\(rec\.action==='AUTO_RESOLVE'\) await executeOperationalCase/);
});

test("l'exécution automatique est neutralisée par défaut", () => {
  assert.match(source, /AUTOMATION_DISABLED_PENDING_SUPRA_GOVERNANCE/);
});

test("les réaffectations et reports sont placés en file d'attente, sans UPDATE direct", () => {
  assert.match(source, /SUPRA_VALIDATION_REQUIRED/);
  assert.doesNotMatch(source, /UPDATE missions SET intervenant_id=\?/);
  assert.doesNotMatch(source, /UPDATE missions SET \\?=.*WHERE id=\?/);
});

test("une action en attente ne ferme pas prématurément le dossier", () => {
  assert.match(source, /finalCaseStatus=hasPendingActions\?'ACTION_PENDING':'RESOLVED'/);
});
