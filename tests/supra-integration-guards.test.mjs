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

test("la file d'attente ne déclare jamais une action terminée sans exécuteur vérifié", () => {
  assert.match(source, /WAITING_EXECUTOR/);
  assert.match(source, /execution_verified:false/);
  assert.doesNotMatch(source, /status='COMPLETED',processed_at=CURRENT_TIMESTAMP/);
});

test("les routes SUPRA sont authentifiées et le plan stratégique est réservé à la Gérante", () => {
  assert.match(source, /async function supraDomains\(request, env\)/);
  assert.match(source, /requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(source, /async function supraPlan\(request, env\)\s*\{\s*\/\/ Le plan de pilotage transversal expose des informations stratégiques : Gérante uniquement\.\s*\/\/ Des vues filtrées par rôle seront ajoutées séparément avec leurs tests de propriété\.\s*const gate=await requireAuthRole\(request,env,\['gerante'\]\)/);
  assert.match(source, /\/api\/supra\/domains/);
  assert.match(source, /\/api\/supra\/plan/);
});

test("les routes SUPRA ne déclenchent aucune préparation automatique du schéma D1", () => {
  const match = source.match(/const consolidatedPath = \[([^\]]+)\]/);
  assert.ok(match, "consolidated schema path list must be present");
  assert.doesNotMatch(match[1], /\/api\/supra\/(domains|plan)/);
});


test("SUPRA plan route validates input and forwards evidence to governance", () => {
  const route = source.slice(source.indexOf("async function supraPlan"), source.indexOf("async function handleConsolidated"));
  assert.match(route, /REQUEST_TOO_LARGE/);
  assert.match(route, /INVALID_JSON_OBJECT/);
  assert.match(route, /INVALID_SUPRA_PLAN_INPUT/);
  assert.match(route, /actorRole:gate\.auth\.user\.role,context,evidence/);
  assert.match(route, /executionAllowed:false/);
  assert.match(route, /\['LOW','MEDIUM','HIGH','CRITICAL'\]/);
});

test("SUPRA planning does not accept arbitrary object arrays as context or evidence", () => {
  const route = source.slice(source.indexOf("async function supraPlan"), source.indexOf("async function handleConsolidated"));
  assert.match(route, /!isPlainRecord\(body\.context\)/);
  assert.match(route, /!isPlainRecord\(body\.evidence\)/);
});
