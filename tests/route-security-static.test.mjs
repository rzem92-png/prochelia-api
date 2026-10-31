import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function section(start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `missing source anchor: ${start}`);
  const b = source.indexOf(end, a);
  assert.notEqual(b, -1, `missing source end anchor: ${end}`);
  return source.slice(a, b);
}

test('catalogue and schema inspection routes enforce roles before reading D1', () => {
  const routes = section("if (url.pathname === '/api/prestations')", "if (url.pathname === '/api/auth/status')");
  assert.ok(routes.indexOf('requireAuthRole') < routes.indexOf('return getPrestations(env)'));
  assert.ok(routes.indexOf("'/api/core/schema'") < 0 || routes.includes("requireAuthRole(request,env,['gerante'])"));
  assert.ok(routes.includes("requireAuthRole(request,env,['gerante'])"));
  assert.ok(routes.indexOf('requireAuthRole') < routes.indexOf('return coreAccountsSchema(env)'));
  assert.ok(routes.indexOf('requireAuthRole') < routes.indexOf('return missionsSchema(env)'));
});

test('consolidated DDL router preflights mapped roles before schema initialization', () => {
  const router = section('async function handleConsolidated(request, env)', '/* ============================================================');
  assert.ok(router.indexOf('requireAuthRole') < router.indexOf('ensureConsolidatedSchema(env)'));
});

test('operational DDL router preflights mapped roles before schema initialization', () => {
  const router = section('async function handleV139(request, env)', '// ================================================================\n// PROCHÉLIA V14.0.0');
  assert.ok(router.indexOf('requireAuthRole') < router.indexOf('ensureOperationalSchema(env)'));
});
