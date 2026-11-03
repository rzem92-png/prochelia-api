import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function securityVerifyCode');
const end = source.indexOf('\nasync function securityResendCodes', start);
assert.notEqual(start, -1, 'securityVerifyCode must exist');
assert.notEqual(end, -1, 'securityVerifyCode must have a following function');
const verify = source.slice(start, end);

test('mission security code consumption is conditional and atomic in D1', () => {
  assert.match(verify, /UPDATE mission_security[\s\S]*WHERE id=\? AND status='prepared' AND arrival_used_at IS NULL AND locked_until IS NULL/);
  assert.match(verify, /UPDATE mission_security[\s\S]*WHERE id=\? AND status='in_progress' AND end_used_at IS NULL AND locked_until IS NULL/);
  assert.match(verify, /Number\(consumed\?\.meta\?\.changes\|\|0\)!==1/);
});

test('losing a concurrent single-use code race returns 409 and is audited', () => {
  const race = verify.slice(verify.indexOf('if(Number(consumed?.meta?.changes||0)!==1)'), verify.indexOf('return json({ok:true,version:VERSION,mission_id:missionId,purpose'));
  assert.match(race, /SECURITY_CODE_CONSUME_RACE/);
  assert.match(race, /SECURITY_CODE_ALREADY_CONSUMED_OR_STATE_CHANGED/);
  assert.match(race, /},409\)/);
});

test('mission security code transition never trusts the earlier SELECT as the final lock', () => {
  const transition = verify.slice(verify.indexOf('// Atomic single-use transition'));
  assert.match(transition, /UPDATE mission_security/);
  assert.match(transition, /arrival_used_at IS NULL/);
  assert.match(transition, /end_used_at IS NULL/);
  assert.doesNotMatch(transition, /UPDATE mission_security SET status=\?/);
});
