import assert from 'node:assert/strict';

const base = process.env.PROCHELIA_TEST_BASE_URL || 'http://127.0.0.1:8787';
async function request(path, options={}) {
  const response = await fetch(new URL(path, base), options);
  const body = await response.json();
  return { response, body };
}

const health = await request('/api/health');
assert.equal(health.response.status, 200, 'health should succeed against local D1');
assert.equal(health.body.ok, true);
assert.equal(health.body.database, true);
assert.equal(health.body.service, 'PROCHÉLIA API');

const core = await request('/api/core/schema');
assert.equal(core.response.status, 200);
assert.equal(core.body.ok, true);
assert.equal(core.body.source, 'D1');
for (const table of ['users','clients','intervenants','sessions','disponibilites']) {
  assert.equal(core.body.tables[table]?.exists, true, `expected core table ${table}`);
}

const missionSchema = await request('/api/missions/schema');
assert.equal(missionSchema.response.status, 200);
assert.equal(missionSchema.body.ok, true);
assert.equal(missionSchema.body.exists, true);
assert.equal(missionSchema.body.write_enabled, false);
assert.equal(missionSchema.body.post_missions, 'DISABLED');

const prestations = await request('/api/prestations');
assert.equal(prestations.response.status, 200);
assert.equal(prestations.body.ok, true);
assert.equal(prestations.body.source, 'D1');
assert.deepEqual(prestations.body.prestations, []);

const forbiddenValidation = await request('/api/missions/validate', {
  method: 'POST', headers: {'content-type':'application/json'},
  body: JSON.stringify({id:'test',client_id:'x',prestation_id:'x',start_at:'2026-11-04T12:00:00Z'})
});
assert.equal(forbiddenValidation.response.status, 403);
assert.equal(forbiddenValidation.body.error, 'AUTHENTICATED_VALIDATION_REQUIRED');
assert.equal(forbiddenValidation.body.write_enabled, false);

const failClosedMissionWrite = await request('/api/missions', {
  method: 'POST', headers: {'content-type':'application/json'},
  body: JSON.stringify({id:'test',client_id:'x',prestation_id:'x',start_at:'2026-11-04T12:00:00Z'})
});
assert.equal(failClosedMissionWrite.response.status, 503);
assert.equal(failClosedMissionWrite.body.write_enabled, false);

const wrongMethod = await request('/api/health', {method:'POST'});
assert.equal(wrongMethod.response.status, 405);
assert.equal(wrongMethod.body.error, 'METHOD_NOT_ALLOWED');

console.log('PASS: Workers runtime + local D1 health/schema/prestations endpoints');
console.log('PASS: unauthenticated mission validation and mission write remain fail-closed');
console.log('PASS: method restrictions are enforced through the actual Worker runtime');
