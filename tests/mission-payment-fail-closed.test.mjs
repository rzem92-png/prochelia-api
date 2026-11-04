import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('legacy mission payment creation remains fail-closed even if env flag is enabled', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf("if (url.pathname === '/api/payments/mission/create')");
  assert.notEqual(start, -1, 'mission create route exists');
  const end = source.indexOf("\n  if (url.pathname === '/api/payments/mission/finalize')", start);
  assert.notEqual(end, -1, 'route block boundary exists');
  const route = source.slice(start, end);
  assert.match(route, /MISSION_PAYMENT_FLOW_NOT_IMPLEMENTED/);
  assert.match(route, /write_enabled:false/);
  assert.doesNotMatch(route, /createMissionPayment\(request,env\)/);
  assert.doesNotMatch(route, /MISSION_API_ENABLED/);
});
