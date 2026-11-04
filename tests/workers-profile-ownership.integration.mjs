import assert from 'node:assert/strict';

const base = process.env.PROCHELIA_TEST_BASE_URL || 'http://127.0.0.1:8787';
async function request(path, options={}) {
 const response=await fetch(new URL(path,base),options);const body=await response.json();return {response,body};
}
async function login(email){
 const r=await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'LocalTestPassword-Only'})});
 assert.equal(r.response.status,200,JSON.stringify(r.body));return r.response.headers.get('set-cookie').split(';')[0];
}
const anonymousClients=await request('/api/clients');
assert.equal(anonymousClients.response.status,401);
const anonymousProviders=await request('/api/intervenants');
assert.equal(anonymousProviders.response.status,401);

// Client can list clients, but receives only its own profile; it cannot access intervenant list.
const clientCookie=await login('ci.auth@prochelia.test');
const clientProfiles=await request('/api/clients?limit=100',{headers:{cookie:clientCookie}});
assert.equal(clientProfiles.response.status,200);
assert.equal(clientProfiles.body.pagination.total,1);
assert.deepEqual(clientProfiles.body.items.map(x=>x.id),['ci-client-profile-1']);
assert.equal(clientProfiles.body.items.some(x=>x.id==='ci-client-profile-2'),false);
const clientToProviders=await request('/api/intervenants',{headers:{cookie:clientCookie}});
assert.equal(clientToProviders.response.status,403);
assert.equal(clientToProviders.body.error,'FORBIDDEN');

// Provider can access only their own provider profile, not the clients directory.
const providerCookie=await login('ci.provider@prochelia.test');
const providerProfiles=await request('/api/intervenants?limit=100',{headers:{cookie:providerCookie}});
assert.equal(providerProfiles.response.status,200);
assert.equal(providerProfiles.body.pagination.total,1);
assert.deepEqual(providerProfiles.body.items.map(x=>x.id),['ci-provider-profile-1']);
assert.equal(providerProfiles.body.items.some(x=>x.id==='ci-provider-profile-2'),false);
const providerToClients=await request('/api/clients',{headers:{cookie:providerCookie}});
assert.equal(providerToClients.response.status,403);
assert.equal(providerToClients.body.error,'FORBIDDEN');

// Manager role can see both profiles in these lists, while output must not leak password hashes.
const managerCookie=await login('ci.manager@prochelia.test');
for(const path of ['/api/clients','/api/intervenants']){
 const r=await request(path,{headers:{cookie:managerCookie}});
 assert.equal(r.response.status,200);
 assert.equal(r.body.pagination.total,2);
 assert.equal(JSON.stringify(r.body).includes('password_hash'),false);
}
console.log('PASS: Worker+D1 profile access control, role boundaries, per-user profile isolation, manager list access, no credential leakage.');
