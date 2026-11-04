import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function routeBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `route marker missing: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `route boundary missing: ${endMarker}`);
  return source.slice(start, end);
}

test('mission POST remains disabled even when the legacy env flag is set', () => {
  const block = routeBlock('async function postMissions(request, env)', '\nasync function login(request, env)');
  assert.match(block, /write_enabled:\s*false/);
  assert.match(block, /503/);
  assert.match(block, /MISSION_API_ENABLED\s*===\s*'true'/);
  assert.match(block, /WRITE_GATE_NOT_ACTIVATED/);
  assert.doesNotMatch(block, /INSERT INTO missions|UPDATE missions|\.prepare\([^\n]*missions|createMission/);
});

test('mission validation endpoint remains fail-closed pending actor and participant binding', () => {
  const block = routeBlock("if (url.pathname === '/api/missions/validate')", "\n  if (url.pathname === '/api/missions')");
  assert.match(block, /AUTHENTICATED_VALIDATION_REQUIRED/);
  assert.match(block, /write_enabled:\s*false/);
  assert.match(block, /403/);
  assert.doesNotMatch(block, /validateMission\(|INSERT INTO missions|UPDATE missions/);
});

test('mission write gate is documented as not enabled in schema and readiness', () => {
  const schemaStart = source.indexOf('async function missionsSchema');
  assert.notEqual(schemaStart, -1);
  const schema = source.slice(schemaStart, schemaStart + 2200);
  assert.match(schema, /write_enabled:\s*false/);
  assert.match(schema, /post_missions:\s*'DISABLED'/);

  const readinessStart = source.indexOf("if (url.pathname === '/api/readiness')");
  assert.notEqual(readinessStart, -1);
  const readiness = source.slice(readinessStart, readinessStart + 1800);
  assert.match(readiness, /writes:\s*false/);
});
