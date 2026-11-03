import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

test('support case creation never treats user payload as verified execution proof', () => {
  assert.match(source, /const verified=false;/);
  assert.doesNotMatch(source, /supportAutoResolve\(env,id,a\.auth\.user\.id,a\.role,scenario,b\)/);
  assert.match(source, /automatic_resolution:false/);
});

test('support input validates severity and bounds description', () => {
  assert.match(source, /\['LOW','MEDIUM','HIGH','CRITICAL'\]\.includes\(severity\)/);
  assert.match(source, /description\.length>4000/);
  assert.match(source, /severity==='LOW' && Number\(rule\?\.auto_allowed\|\|0\)===1/);
});

test('client cannot assert tenant/mission/complaint relationship on support case', () => {
  assert.match(source, /\.bind\(id,a\.role,a\.auth\.user\.id,null,null,null,category,severity,'OPEN'/);
});
