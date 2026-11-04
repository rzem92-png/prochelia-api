import assert from 'node:assert/strict';

const base = process.env.PROCHELIA_TEST_BASE_URL || 'http://127.0.0.1:8787';
async function request(path, options={}) {
  const response = await fetch(new URL(path, base), options);
  const body = await response.json();
  return { response, body };
}

const status0 = await request('/api/auth/status');
assert.equal(status0.response.status, 200);
assert.equal(status0.body.ok, true);
assert.equal(status0.body.authenticated, false);
assert.equal(status0.body.bootstrap_required, false);

const unauthMe = await request('/api/auth/me');
assert.equal(unauthMe.response.status, 401);
assert.equal(unauthMe.body.error, 'UNAUTHENTICATED');

const badLogin = await request('/api/auth/login', {
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:'ci.auth@prochelia.test',password:'wrong-password-000'})
});
assert.equal(badLogin.response.status,401);
assert.equal(badLogin.body.error,'INVALID_CREDENTIALS');

const login = await request('/api/auth/login', {
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:' CI.AUTH@PROCHELIA.TEST ',password:'LocalTestPassword-Only'})
});
assert.equal(login.response.status,200,JSON.stringify(login.body));
assert.equal(login.body.authenticated, undefined);
assert.equal(login.body.session.authenticated,true);
assert.equal(login.body.user.email,'ci.auth@prochelia.test');
assert.equal(login.body.user.password_hash,undefined);
const cookie = login.response.headers.get('set-cookie');
assert.ok(cookie?.startsWith('prochelia_session='));
assert.match(cookie,/HttpOnly/);
assert.match(cookie,/Secure/);
assert.match(cookie,/SameSite=None/);
const tokenCookie = cookie.split(';')[0];

const me = await request('/api/auth/me',{headers:{cookie:tokenCookie}});
assert.equal(me.response.status,200);
assert.equal(me.body.authenticated,true);
assert.equal(me.body.user.id,'ci-auth-user');
assert.equal(me.body.user.password_hash,undefined);

const status1 = await request('/api/auth/status',{headers:{cookie:tokenCookie}});
assert.equal(status1.body.authenticated,true);
assert.equal(status1.body.user.id,'ci-auth-user');

const logout = await request('/api/auth/logout',{method:'POST',headers:{cookie:tokenCookie}});
assert.equal(logout.response.status,200);
assert.equal(logout.body.authenticated,false);
assert.match(logout.response.headers.get('set-cookie')||'',/Max-Age=0/);

const afterLogout = await request('/api/auth/me',{headers:{cookie:tokenCookie}});
assert.equal(afterLogout.response.status,401);
assert.equal(afterLogout.body.error,'UNAUTHENTICATED');

const loginMethod = await request('/api/auth/login',{method:'GET'});
assert.equal(loginMethod.response.status,405);
const logoutMethod = await request('/api/auth/logout',{method:'GET'});
assert.equal(logoutMethod.response.status,405);

console.log('PASS: Worker+D1 authentication: invalid login, normalized email, valid login, cookie session, /me, status, logout invalidation, method guards.');
