import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function between(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('mission security preparation requires manager auth and exact persisted assignment', () => {
  const fn = between('async function securityPrepareMission(request, env)', '\nasync function securityPresence');
  assert.match(fn, /getSessionUser\(request,env\)/);
  assert.match(fn, /requireRole\(auth,\['gerante'\]\)/);
  assert.match(fn, /SELECT id,client_id,intervenant_id,prestation_id,start_at,end_at FROM missions WHERE id=\? LIMIT 1/);
  assert.match(fn, /MISSION_ASSIGNMENT_MISMATCH/);
  assert.match(fn, /INTERVENANT_PROFILE_NOT_LINKED/);
  assert.match(fn, /requireVerifiedIntervenant/);
  assert.match(fn, /trustPassportCheckMission/);
});

test('presence endpoint is bound to authenticated intervenant profile and prepared mission', () => {
  const fn = between('async function securityPresence(request, env)', '\nasync function securityVerifyCode');
  assert.match(fn, /requireRole\(auth,\['intervenant'\]\)/);
  assert.match(fn, /getIntervenantProfileByUser\(env,auth.user.id\)/);
  assert.match(fn, /requireVerifiedIntervenant\(env, auth.user.id\)/);
  assert.match(fn, /mission_security WHERE mission_id=\? AND intervenant_id=\? LIMIT 1/);
  assert.match(fn, /MISSION_NOT_ASSIGNED_OR_NOT_PREPARED/);
  assert.match(fn, /trusted_devices/);
});

test('mission security code verification is scoped to the logged-in provider and requires presence/device controls', () => {
  const fn = between('async function securityVerifyCode(request, env)', '\nasync function securityResendCodes');
  assert.match(fn, /requireRole\(auth,\['intervenant'\]\)/);
  assert.match(fn, /mission_security WHERE mission_id=\? AND intervenant_id=\? LIMIT 1/);
  assert.match(fn, /PRESENCE_CHECK_REQUIRED/);
  assert.match(fn, /trusted_devices/);
  assert.match(fn, /SECURITY_MAX_ATTEMPTS/);
  assert.match(fn, /SECURITY_CODE_EXPIRED/);
  assert.match(fn, /SECURITY_LOCK_SECONDS/);
  assert.match(fn, /securityAudit/);
});

test('mission security status requires an authenticated session', () => {
  const fn = between('async function securityStatus(request, env)', '\n/* ============================================================');
  assert.match(fn, /getSessionUser\(request,env\)/);
  assert.match(fn, /if\(!auth\).*UNAUTHENTICATED/);
  assert.match(fn, /security_audit/);
});
