import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMissionCode } from '../src/security/mission-code.js';

test('mission codes are six decimal digits including leading zeroes', () => {
  for (let i = 0; i < 1000; i++) {
    const code = generateMissionCode();
    assert.match(code, /^\d{6}$/);
  }
});

test('mission code generator does not return a constant in repeated samples', () => {
  const values = new Set(Array.from({ length: 100 }, generateMissionCode));
  assert.ok(values.size > 1);
});
