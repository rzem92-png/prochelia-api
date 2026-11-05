import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('payout idempotency replay is scoped to authenticated user in both initial and race paths', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = source.slice(start, end);
  const scoped = /SELECT \* FROM payout_requests WHERE idempotency_key=\? AND user_id=\? LIMIT 1/g;
  assert.equal([...fn.matchAll(scoped)].length, 2);
  assert.equal([...fn.matchAll(/SELECT \* FROM payout_requests WHERE idempotency_key=\? LIMIT 1/g)].length, 0);
  assert.match(fn, /\.bind\(idem,auth\.user\.id\)\.first\(\)/g);
});

test('payout idempotency collision without same-owner replay fails closed', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = source.slice(start, end);
  assert.match(fn, /PAYOUT_RESERVATION_RACE_OR_INSUFFICIENT_BALANCE/);
  assert.match(fn, /if\(replay\)return json\(\{ok:true,version:VERSION,idempotent_replay:true,payout:replay\},200\);/);
  assert.match(fn, /return json\(\{ok:false,error:'PAYOUT_RESERVATION_RACE_OR_INSUFFICIENT_BALANCE',version:VERSION\},409\);/);
});

test('payout ownership regression test is included exactly once in prelaunch suite', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const script = pkg.scripts?.['test:prelaunch'] || '';
  const occurrences = script.split('tests/payout-idempotency-owner.test.mjs').length - 1;
  assert.equal(occurrences, 1);
  assert.match(script, /tests\/payment-dispute-ownership\.test\.mjs/);
  assert.match(script, /tests\/mission-security-ownership-contracts\.test\.mjs/);
  assert.match(script, /tests\/refund-webhook-monotonic-ledger\.test\.mjs/);
});

test('payout idempotency key remains globally unique at the D1 schema layer', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('CREATE TABLE IF NOT EXISTS payout_requests');
  const end = source.indexOf('`)', start);
  assert.notEqual(start, -1, 'payout_requests schema must be declared');
  assert.notEqual(end, -1, 'payout_requests schema block must be closed');
  const schema = source.slice(start, end);
  assert.match(schema, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(schema, /user_id TEXT NOT NULL/);
  assert.match(schema, /wallet_id TEXT NOT NULL/);
});

test('wallet schema enforces one wallet per user', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('CREATE TABLE IF NOT EXISTS wallets');
  const end = source.indexOf('`)', start);
  assert.notEqual(start, -1, 'wallet schema must be declared');
  assert.notEqual(end, -1, 'wallet schema block must be closed');
  const schema = source.slice(start, end);
  assert.match(schema, /user_id TEXT NOT NULL UNIQUE/);
});


test('payout route authenticates and enforces intervenant role before schema access', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  const fn = source.slice(start, end);
  const auth = fn.indexOf('const auth=await getSessionUser(request,env)');
  const role = fn.indexOf("requireRole(auth,['intervenant'])");
  const schema = fn.indexOf('await ensurePaymentSchema(env)');
  assert.ok(auth >= 0 && role > auth && schema > role,
    'authentication and role checks must precede payment schema/database setup');
});

test('payout feature gate is fail-closed before any payout database setup', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  const fn = source.slice(start, end);
  const gate = fn.indexOf("PAYOUTS_ENABLED).toLowerCase()!=='true'");
  const schema = fn.indexOf('await ensurePaymentSchema(env)');
  assert.ok(gate >= 0 && schema > gate);
  assert.match(fn, /PAYOUTS_DISABLED_UNTIL_CONNECT_ACCEPTANCE/);
  assert.match(fn, /\},423\)/);
});

test('payout validates positive amount, supported mode, and idempotency key before wallet queries', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  const fn = source.slice(start, end);
  const validation = fn.indexOf('amount===null||amount<=0');
  const replayLookup = fn.indexOf('SELECT * FROM payout_requests WHERE idempotency_key=? AND user_id=?');
  const walletLookup = fn.indexOf("SELECT * FROM wallets WHERE user_id=?");
  assert.ok(validation >= 0 && replayLookup > validation && walletLookup > replayLookup);
  assert.match(fn, /!\['standard','express'\]\.includes\(mode\)/);
  assert.match(fn, /!idem/);
});

test('payout response uses stable non-sensitive error codes on balance and account readiness failures', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  const fn = source.slice(start, end);
  assert.match(fn, /PAYOUT_ACCOUNT_NOT_READY/);
  assert.match(fn, /INSUFFICIENT_AVAILABLE_BALANCE/);
  assert.match(fn, /PAYOUT_RESERVATION_RACE_OR_INSUFFICIENT_BALANCE/);
  assert.doesNotMatch(fn, /stack|SQLITE_ERROR|exception\.message/i);
});


test('payout reservation is conditional, ledger posting follows successful insert, and wallet ownership is bound', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = source.slice(start, end);
  const batchStart = fn.indexOf('const batch=await env.DB.batch([');
  const batchEnd = fn.indexOf(']);', batchStart);
  assert.ok(batchStart >= 0 && batchEnd > batchStart, 'payout + ledger should use one D1 batch');
  const batch = fn.slice(batchStart, batchEnd);
  assert.match(batch, /FROM wallets WHERE id=\? AND available_cents>=\?/);
  assert.match(batch, /NOT EXISTS\(SELECT 1 FROM payout_requests WHERE idempotency_key=\?\)/);
  assert.match(batch, /FROM payout_requests WHERE idempotency_key=\? AND status='requested' AND changes\(\)=1/);
  assert.match(batch, /NOT EXISTS\(SELECT 1 FROM payment_wallet_ledger WHERE idempotency_key=\?\)/);
  assert.match(batch, /\.bind\(payoutId,idem,wallet\.id,auth\.user\.id,amount,mode/);
  assert.ok(fn.includes("prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(auth.user.id)"), 'wallet lookup must bind the authenticated user');
  assert.ok(fn.includes('if(Number(batch?.[0]?.meta?.changes||0)!==1){'), 'reservation failure must be handled before payout success');
});

test('payout success response is emitted only after reservation batch and audit succeed', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function payoutRequest');
  const end = source.indexOf('\nasync function verifyWebhookSignature', start);
  const fn = source.slice(start, end);
  const batch = fn.indexOf('const batch=await env.DB.batch([');
  const audit = fn.indexOf("await paymentAudit(env,'PAYOUT_REQUESTED'");
  const success = fn.indexOf("status:'requested',amount_cents:amount");
  assert.ok(batch >= 0 && audit > batch && success > audit,
    'do not return payout success before database reservation and audit');
  assert.match(fn, /PAYOUT_RESERVATION_RACE_OR_INSUFFICIENT_BALANCE/);
});
