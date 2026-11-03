import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const subjectStart = source.indexOf('async function productionSubjectHash');
const limiterStart = source.indexOf('async function productionRateLimit');
const limiterEnd = source.indexOf('\nasync function ', limiterStart + 10);
assert.notEqual(subjectStart, -1, 'productionSubjectHash must exist');
assert.notEqual(limiterStart, -1, 'productionRateLimit must exist');
assert.notEqual(limiterEnd, -1, 'productionRateLimit must have a following function');
const subjectHash = source.slice(subjectStart, limiterStart);
const limiter = source.slice(limiterStart, limiterEnd);

test('rate-limit identity uses Cloudflare edge IP and never trusts X-Forwarded-For', () => {
  assert.match(subjectHash, /CF-Connecting-IP/);
  assert.doesNotMatch(subjectHash, /X-Forwarded-For/i);
  assert.match(subjectHash, /TRUSTED_CLIENT_IP_REQUIRED/);
  assert.doesNotMatch(subjectHash, /\|unknown/);
});

test('counter uses atomic D1 UPSERT with RETURNING instead of read-modify-write', () => {
  assert.match(limiter, /ON CONFLICT\(bucket,subject_hash,window_start\)/);
  assert.match(limiter, /request_count=security_rate_limits\.request_count\+1/);
  assert.match(limiter, /RETURNING request_count/);
  assert.doesNotMatch(limiter, /SELECT request_count FROM security_rate_limits/);
  assert.doesNotMatch(limiter, /UPDATE security_rate_limits SET request_count/);
});

test('missing D1 or limiter storage error fails closed with 503', () => {
  assert.match(limiter, /if\(!env\?\.DB\)/);
  assert.match(limiter, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(limiter, /catch\s*\{[^}]*RATE_LIMIT_UNAVAILABLE/s);
});

test('rate threshold produces 429 and Retry-After', () => {
  assert.match(limiter, /count>limit/);
  assert.match(limiter, /RATE_LIMITED/);
  assert.match(limiter, /'retry-after':String\(retryAfter\)/);
});

test('audit log failure cannot turn a blocked request into an allowed request', () => {
  const block = limiter.slice(limiter.indexOf('if(count>limit)'), limiter.indexOf('return {ok:true};', limiter.indexOf('if(count>limit)')));
  assert.match(block, /catch\s*\{[^}]*keep the block/s);
  assert.match(block, /return \{ok:false,response:json\(\{ok:false,error:'RATE_LIMITED'/);
});

const verifyStart = source.indexOf('async function securityVerifyCode');
const verifyEnd = source.indexOf('\nasync function securityResendCodes', verifyStart);
assert.notEqual(verifyStart, -1, 'securityVerifyCode must exist');
assert.notEqual(verifyEnd, -1, 'securityVerifyCode must have a following function');
const verify = source.slice(verifyStart, verifyEnd);

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
