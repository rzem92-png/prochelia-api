import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function copilotRecommend(');
const end = source.indexOf('async function createOperationalCase(', start);
const implementation = source.slice(start, end);

test('legacy Copilot recommendation is wired to the central fail-closed policy', () => {
  assert.ok(start >= 0 && end > start, 'copilotRecommend implementation must exist');
  assert.match(implementation, /canAutoResolveSupportScenario\\(caseType, impact, false\\)/);
  assert.doesNotMatch(implementation, /SIMPLE_CASES\\.has\\(caseType\\)/);
});
