import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('support resolution cannot trust client-supplied execution_verified', () => {
  assert.match(source, /supportAutoResolve\(env,id,a\.auth\.user\.id,a\.role,scenario,\{\}\)/);
  assert.match(source, /const verified=false;/);
  assert.doesNotMatch(source, /supportAutoResolve\(env,id,a\.auth\.user\.id,a\.role,scenario,b\)/);
});

test('support API distinguishes automation eligibility from actual resolution', () => {
  assert.match(source, /automatic_resolution:false,auto_eligible:!!auto/);
});
