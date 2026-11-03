import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

function sourceOf(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source block exists: ${startMarker}`);
  return source.slice(start, end);
}

const originGuard = sourceOf('function securityOriginAllowed(request,env){', '\n\n// ================================================================');
const corsWrapper = sourceOf('const __procheliaCorsHandle = handle;', '\n};');

test('mutating browser requests reject untrusted Origin before D1/rate-limit access', () => {
  assert.match(originGuard, /if\(!origin\) return true/);
  assert.match(originGuard, /allowed\.includes\(origin\)/);
  assert.match(source, /isMutatingMethod\(preflightMethod\).*securityOriginAllowed\(request,env\).*ORIGIN_NOT_ALLOWED/);
  assert.ok(source.indexOf('securityOriginAllowed(request,env)) {') < source.indexOf('const rate=await productionRateLimit(request,env);'));
});

test('credentialed CORS never reflects arbitrary origins and preflight rejects unknown methods/headers', () => {
  assert.match(corsWrapper, /!origin \|\| !securityOriginAllowed\(request,env\)/);
  assert.match(corsWrapper, /allowedMethods\.has\(requestedMethod\)/);
  assert.match(corsWrapper, /requestedHeaders\.some\(x=>!allowedHeaders\.has\(x\)\)/);
  assert.match(corsWrapper, /'access-control-allow-credentials':'true'/);
  assert.match(corsWrapper, /'vary':'Origin'/);
  assert.doesNotMatch(corsWrapper, /access-control-allow-origin'\s*:\s*['"]\*['"]/);
});

test('browser mutating routes except the signed payment webhook use Origin guard', () => {
  assert.match(source, /isMutatingMethod\(request\.method\).*pathname!=='\/api\/payments\/webhook'.*securityOriginAllowed/);
  assert.match(source, /Native provider webhook has no browser Origin; its Stripe signature is the authority/);
  assert.match(source, /verifyStripeSignature/);
});
