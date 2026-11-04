import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cookie-authenticated mutating requests without Origin are rejected; PSP webhook exempt', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.lastIndexOf('handle = async function(request,env){');
  assert.notEqual(start, -1);
  const wrapper = source.slice(start);
  assert.match(wrapper, /const mutating = isMutatingMethod\(request\.method\)/);
  assert.match(wrapper, /hasSessionCookie && !isProviderWebhook && !origin/);
  assert.match(wrapper, /ORIGIN_REQUIRED_FOR_SESSION_WRITE/);
  assert.match(wrapper, /pathname === '\/api\/payments\/webhook'/);
});
