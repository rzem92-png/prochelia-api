import test from 'node:test';
import assert from 'node:assert/strict';
import procheliaV7 from '../src/v7.js';

const transitions = {
  requested: ['proposed','confirmed','cancelled','rejected'],
  proposed: ['confirmed','accepted','cancelled','rejected'],
  confirmed: ['accepted','in_progress','cancelled'],
  accepted: ['in_progress','cancelled'],
  in_progress: ['completed','cancelled'],
  completed: [], cancelled: [], rejected: []
};

test('V7 mission lifecycle allows only explicit transitions', () => {
  for (const [current, nexts] of Object.entries(transitions)) {
    for (const next of nexts) assert.equal(procheliaV7.checkMissionTransition(current,next).ok,true, current+' -> '+next);
  }
});

test('V7 lifecycle rejects every transition outside the explicit allowlist', () => {
  for (const current of Object.keys(transitions)) {
    for (const next of Object.keys(transitions)) {
      const expected = transitions[current].includes(next);
      assert.equal(procheliaV7.checkMissionTransition(current,next).ok,expected, current+' -> '+next);
    }
  }
});

test('V7 lifecycle normalizes statuses and rejects unknown values', () => {
  const normalized=procheliaV7.checkMissionTransition(' REQUESTED ',' Proposed ');
  assert.equal(normalized.ok,true);
  assert.equal(normalized.currentStatus,'requested');
  assert.equal(normalized.nextStatus,'proposed');
  assert.equal(procheliaV7.checkMissionTransition('not_a_status','confirmed').ok,false);
  assert.equal(procheliaV7.checkMissionTransition('requested','not_a_status').ok,false);
  assert.equal(procheliaV7.checkMissionTransition('', 'proposed').ok,false);
  assert.equal(procheliaV7.checkMissionTransition('requested', '').ok,false);
});
