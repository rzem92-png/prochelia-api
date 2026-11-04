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

test('V7 lifecycle forbids self-transition and terminal-state reopening', () => {
  for (const current of Object.keys(transitions)) {
    assert.equal(procheliaV7.checkMissionTransition(current,current).ok,false);
  }
  for (const terminal of ['completed','cancelled','rejected']) {
    for (const next of Object.keys(transitions)) assert.equal(procheliaV7.checkMissionTransition(terminal,next).ok,false, terminal+' -> '+next);
  }
});

test('V7 lifecycle normalizes statuses and rejects unknown values', () => {
  assert.equal(procheliaV7.checkMissionTransition(' REQUESTED ',' Proposed ').ok,true);
  assert.equal(procheliaV7.checkMissionTransition('not_a_status','confirmed').ok,false);
  assert.equal(procheliaV7.checkMissionTransition('requested','not_a_status').ok,false);
});
