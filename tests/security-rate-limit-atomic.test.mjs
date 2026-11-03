import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';

test('disabled mission creation endpoint returns 503 for malformed JSON without needing D1', async () => {
  const origin = 'https://feat-supra-control-center-v1.prochelia.pages.dev';
  const response = await worker.fetch(new Request('https://prochelia-api-preview.rzem92.workers.dev/api/missions', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{ malformed-json'
  }), { CORS_ORIGIN: origin });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.write_enabled, false);
  assert.match(body.error, /MISSION_API_NOT_ACTIVATED|WRITE_GATE_NOT_ACTIVATED/);
});


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
  assert.ok(verify.includes("WHERE id=? AND status='prepared' AND arrival_used_at IS NULL"));
  assert.ok(verify.includes("WHERE id=? AND status='in_progress' AND end_used_at IS NULL"));
  assert.ok(verify.includes("locked_until IS NULL OR locked_until<=?"));
  assert.ok(verify.includes("Number(consumed?.meta?.changes||0)!==1"));
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

test('mission security code can be consumed again after the lockout timestamp expires', () => {
  assert.match(verify, /locked_until IS NULL OR locked_until<=\?/);
  assert.match(verify, /\.bind\(sec\.id,now\)\.run\(\)/);
});

const postMissionStart = source.indexOf('async function postMissions(');
const postMissionEnd = source.indexOf('\nasync function ', postMissionStart + 10);
assert.notEqual(postMissionStart, -1, 'postMissions must exist');
assert.notEqual(postMissionEnd, -1, 'postMissions must have a following function');
const postMission = source.slice(postMissionStart, postMissionEnd);

test('disabled mission writes fail closed without parsing or consuming attacker-controlled request bodies', () => {
  assert.match(postMission, /async function postMissions\(_request, env\)/);
  assert.doesNotMatch(postMission, /readJson\(|readBoundedRequestBody\(|request\.json\(/);
  assert.match(postMission, /write_enabled: false/);
  assert.match(postMission, /}, 503\)/);
  assert.match(postMission, /MISSION_API_ENABLED === 'true' \? 'WRITE_GATE_NOT_ACTIVATED'/);
});


test('browser mutations reject unapproved Origin before touching D1', async () => {
  const response = await worker.fetch(new Request('https://prochelia-api-preview.rzem92.workers.dev/api/auth/logout', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: '{}'
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'ORIGIN_NOT_ALLOWED');
});

test('cookie-authenticated mutation requires Origin to prevent CSRF', async () => {
  const response = await worker.fetch(new Request('https://prochelia-api-preview.rzem92.workers.dev/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: 'prochelia_session=attacker-controlled', 'Content-Type': 'application/json' },
    body: '{}'
  }), { CORS_ORIGIN: 'https://feat-supra-control-center-v1.prochelia.pages.dev' });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'CSRF_ORIGIN_REQUIRED');
});

test('CORS preflight rejects unapproved request headers', async () => {
  const origin = 'https://feat-supra-control-center-v1.prochelia.pages.dev';
  const response = await worker.fetch(new Request('https://prochelia-api-preview.rzem92.workers.dev/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type, x-evil-header'
    }
  }), { CORS_ORIGIN: origin });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'CORS_HEADER_NOT_ALLOWED');
});


test('approved CORS preflight is answered without requiring D1', async () => {
  const origin = 'https://feat-supra-control-center-v1.prochelia.pages.dev';
  const response = await worker.fetch(new Request('https://prochelia-api-preview.rzem92.workers.dev/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type, x-idempotency-key'
    }
  }), { CORS_ORIGIN: origin });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('vary') || '', /Origin/);
});

test('diagnostic endpoints reject unsupported methods before database access', async () => {
  for (const path of ['/api/health', '/api/readiness', '/api/info']) {
    const response = await worker.fetch(new Request('https://prochelia-api-preview.rzem92.workers.dev' + path, {
      method: 'POST',
      headers: { Origin: 'https://feat-supra-control-center-v1.prochelia.pages.dev' }
    }), { CORS_ORIGIN: 'https://feat-supra-control-center-v1.prochelia.pages.dev' });
    assert.equal(response.status, 405, path);
    assert.equal(response.headers.get('allow'), 'GET, HEAD', path);
  }
});
