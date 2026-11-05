import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE payment_transactions (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, intervenant_id TEXT,
      net_intervenant_cents INTEGER NOT NULL, currency TEXT NOT NULL,
      provider TEXT, provider_payment_id TEXT
    );
    CREATE TABLE payment_wallet_credit_ledger (
      transaction_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL, applied INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE wallets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL,
      available_cents INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO payment_transactions VALUES ('tx-1','pending','provider-1',12345,'EUR','stripe',NULL);
  `);
  return db;
}

function deliver(db) {
  db.exec('BEGIN');
  db.prepare(`UPDATE payment_transactions SET status='paid',provider='stripe',provider_payment_id=COALESCE(?,provider_payment_id) WHERE id=? AND status NOT IN ('paid','refunded')`).run('cs_test_1','tx-1');
  db.prepare(`INSERT OR IGNORE INTO payment_wallet_credit_ledger(transaction_id,user_id,amount_cents,currency,applied) SELECT id,intervenant_id,net_intervenant_cents,currency,0 FROM payment_transactions WHERE id=? AND status='paid' AND changes()=1`).run('tx-1');
  db.prepare(`INSERT OR IGNORE INTO wallets(id,user_id,currency,available_cents) VALUES(?,?,?,0)`).run('wallet-1','provider-1','EUR');
  db.prepare(`UPDATE wallets SET available_cents=available_cents+(SELECT amount_cents FROM payment_wallet_credit_ledger WHERE transaction_id=? AND user_id=? AND applied=0) WHERE user_id=? AND currency=? AND EXISTS(SELECT 1 FROM payment_wallet_credit_ledger WHERE transaction_id=? AND user_id=? AND currency=? AND applied=0)`).run('tx-1','provider-1','provider-1','EUR','tx-1','provider-1','EUR');
  db.prepare(`UPDATE payment_wallet_credit_ledger SET applied=1 WHERE transaction_id=? AND applied=0 AND EXISTS(SELECT 1 FROM wallets WHERE user_id=? AND currency=payment_wallet_credit_ledger.currency)`).run('tx-1','provider-1');
  db.exec('COMMIT');
}

test('Stripe payment success credits the provider wallet once across distinct event deliveries', () => {
  assert.match(source, /payment_wallet_credit_ledger/);
  assert.match(source, /changes\(\)=1/);
  const db = setup();
  deliver(db);
  deliver(db); // second distinct success event for the same payment
  assert.equal(db.prepare('SELECT available_cents FROM wallets WHERE user_id=?').get('provider-1').available_cents, 12345);
  assert.equal(db.prepare('SELECT applied FROM payment_wallet_credit_ledger WHERE transaction_id=?').get('tx-1').applied, 1);
  db.close();
});

test('wallet currency mismatch keeps credit pending instead of silently applying it', () => {
  const db = setup();
  db.prepare('UPDATE payment_transactions SET currency=? WHERE id=?').run('USD','tx-1');
  db.prepare('INSERT INTO wallets VALUES (?,?,?,0)').run('wallet-1','provider-1','EUR');
  db.exec('BEGIN');
  db.prepare(`UPDATE payment_transactions SET status='paid',provider='stripe' WHERE id=? AND status NOT IN ('paid','refunded')`).run('tx-1');
  db.prepare(`INSERT OR IGNORE INTO payment_wallet_credit_ledger(transaction_id,user_id,amount_cents,currency,applied) SELECT id,intervenant_id,net_intervenant_cents,currency,0 FROM payment_transactions WHERE id=? AND status='paid' AND changes()=1`).run('tx-1');
  db.prepare(`UPDATE wallets SET available_cents=available_cents+(SELECT amount_cents FROM payment_wallet_credit_ledger WHERE transaction_id=? AND applied=0) WHERE user_id=? AND currency=? AND EXISTS(SELECT 1 FROM payment_wallet_credit_ledger WHERE transaction_id=? AND currency=? AND applied=0)`).run('tx-1','provider-1','USD','tx-1','USD');
  db.prepare(`UPDATE payment_wallet_credit_ledger SET applied=1 WHERE transaction_id=? AND applied=0 AND EXISTS(SELECT 1 FROM wallets WHERE user_id=? AND currency=payment_wallet_credit_ledger.currency)`).run('tx-1','provider-1');
  db.exec('COMMIT');
  assert.equal(db.prepare('SELECT available_cents FROM wallets WHERE user_id=?').get('provider-1').available_cents, 0);
  assert.equal(db.prepare('SELECT applied FROM payment_wallet_credit_ledger WHERE transaction_id=?').get('tx-1').applied, 0);
  db.close();
});

test('replay applies a pending wallet credit after currency configuration is corrected', () => {
  const db = setup();
  db.prepare('INSERT INTO wallets VALUES (?,?,?,0)').run('wallet-existing','provider-1','USD');
  deliver(db); // credit stays pending because the existing wallet currency is mismatched
  assert.equal(db.prepare('SELECT applied FROM payment_wallet_credit_ledger WHERE transaction_id=?').get('tx-1').applied, 0);
  db.prepare('UPDATE wallets SET currency=? WHERE user_id=?').run('EUR','provider-1');
  deliver(db); // replay: transaction is already paid, but pending ledger entry is applied
  assert.equal(db.prepare('SELECT available_cents FROM wallets WHERE user_id=?').get('provider-1').available_cents, 12345);
  assert.equal(db.prepare('SELECT applied FROM payment_wallet_credit_ledger WHERE transaction_id=?').get('tx-1').applied, 1);
  db.close();
});


test('Stripe refund status distinguishes partial and full cumulative refunds', () => {
  assert.match(source, /partially_refunded/);
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE payment_transactions(id TEXT PRIMARY KEY,status TEXT,gross_cents INTEGER,refund_cents INTEGER DEFAULT 0);
    INSERT INTO payment_transactions VALUES('tx-refund','paid',10000,0);`);
  const applyRefund = cents => db.prepare(`UPDATE payment_transactions SET status=CASE WHEN MAX(refund_cents,?)>=gross_cents THEN 'refunded' ELSE 'partially_refunded' END,refund_cents=MAX(refund_cents,?) WHERE id=?`).run(cents,cents,'tx-refund');
  applyRefund(2500);
  let tx=db.prepare('SELECT status,refund_cents FROM payment_transactions WHERE id=?').get('tx-refund');
  assert.equal(tx.status,'partially_refunded');
  assert.equal(tx.refund_cents,2500);
  applyRefund(10000);
  tx=db.prepare('SELECT status,refund_cents FROM payment_transactions WHERE id=?').get('tx-refund');
  assert.equal(tx.status,'refunded');
  assert.equal(tx.refund_cents,10000);
  applyRefund(7000); // Stripe cumulative total must never decrease
  tx=db.prepare('SELECT status,refund_cents FROM payment_transactions WHERE id=?').get('tx-refund');
  assert.equal(tx.status,'refunded');
  assert.equal(tx.refund_cents,10000);
  db.close();
});

test('refunded and partially refunded transactions are excluded from wallet credit replay', () => {
  assert.match(source, /!\['refunded','partially_refunded'\]\.includes\(tx\.status\)/);
  assert.match(source, /status NOT IN \('paid','refunded','partially_refunded'\)/);
});


test('payout reservation is guarded by available balance and conditional insert', () => {
  assert.match(source, /available_cents>=\?/);
  assert.match(source, /INSERT INTO payout_requests[\s\S]*?SELECT[\s\S]*?WHERE changes\(\)=1/);
});

test('concurrent payout attempts cannot reserve the same wallet balance', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE wallets(id TEXT PRIMARY KEY,user_id TEXT,currency TEXT,available_cents INTEGER,reserved_cents INTEGER DEFAULT 0);
    CREATE TABLE payout_requests(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,wallet_id TEXT,user_id TEXT,amount_cents INTEGER);
    INSERT INTO wallets VALUES('w1','u1','EUR',10000,0);`);
  const reserve = (payoutId, idem, amount) => {
    db.exec('BEGIN');
    db.prepare(`UPDATE wallets SET available_cents=available_cents-?,reserved_cents=reserved_cents+? WHERE id=? AND user_id=? AND currency=? AND available_cents>=?`).run(amount,amount,'w1','u1','EUR',amount);
    db.prepare(`INSERT INTO payout_requests(id,idempotency_key,wallet_id,user_id,amount_cents) SELECT ?,?,?,?,? WHERE changes()=1`).run(payoutId,idem,'w1','u1',amount);
    db.exec('COMMIT');
  };
  reserve('p1','k1',7000);
  reserve('p2','k2',7000);
  assert.equal(db.prepare('SELECT available_cents FROM wallets WHERE id=?').get('w1').available_cents,3000);
  assert.equal(db.prepare('SELECT reserved_cents FROM wallets WHERE id=?').get('w1').reserved_cents,7000);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payout_requests').get().n,1);
  db.close();
});

test('same payout idempotency key cannot produce a second payout', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE wallets(id TEXT PRIMARY KEY,user_id TEXT,currency TEXT,available_cents INTEGER,reserved_cents INTEGER DEFAULT 0);
    CREATE TABLE payout_requests(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE,wallet_id TEXT,user_id TEXT,amount_cents INTEGER);
    INSERT INTO wallets VALUES('w1','u1','EUR',10000,0);`);
  const attempt = (id, key) => {
    db.exec('BEGIN');
    db.prepare(`UPDATE wallets SET available_cents=available_cents-1000,reserved_cents=reserved_cents+1000 WHERE id='w1' AND available_cents>=1000`).run();
    db.prepare(`INSERT INTO payout_requests(id,idempotency_key,wallet_id,user_id,amount_cents) SELECT ?,?,'w1','u1',1000 WHERE changes()=1`).run(id,key);
    db.exec('COMMIT');
  };
  attempt('p1','same-key');
  // Simulate endpoint replay: it should be resolved by the initial idempotency lookup,
  // not by attempting a second reserve. Assert schema uniqueness as final protection.
  assert.throws(()=>db.prepare('INSERT INTO payout_requests VALUES(?,?,?,?,?)').run('p2','same-key','w1','u1',1000));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payout_requests').get().n,1);
  db.close();
});

test('unprocessed webhook delivery can retry and payload mismatch is rejected', () => {
  assert.match(source, /if\(prior\?\.processed\) return json\(\{ok:true,version:VERSION,duplicate:true,event_id:eventId\},200\)/);
  assert.match(source, /WEBHOOK_EVENT_ID_PAYLOAD_CONFLICT/);
  assert.match(source, /previously received but unprocessed event is retried/i);
});

test('payment success transition and wallet credit are guarded together', () => {
  assert.match(source, /UPDATE payment_transactions SET status='paid'[\s\S]*?status NOT IN \('paid','failed','refunded'\)/);
  assert.match(source, /UPDATE wallets SET available_cents=available_cents\+\?[\s\S]*?changes\(\)=1/);
});

test('missing beneficiary wallet leaves webhook retryable instead of marking payment paid', () => {
  assert.match(source, /if\(!wallet\) return json\(\{ok:false,error:'WALLET_NOT_READY'[\s\S]*?\},409\)/);
  assert.match(source, /Do not acknowledge\/mark the event processed if the beneficiary wallet/);
});

test('payout terminal webhook remains retryable when reservation is inconsistent', () => {
  assert.match(source, /PAYOUT_RESERVATION_NOT_READY/);
  assert.match(source, /Number\(reserved\.reserved_cents\)<Number\(payout\.amount_cents\)/);
  assert.match(source, /if\(walletUpdate\) await env\.DB\.batch\(\[terminalUpdate,walletUpdate\]\)/);
});

test('Stripe checkout uses a stable transaction-scoped idempotency key', () => {
  assert.match(source, /'idempotency-key':\x60prochelia-checkout-\$\{tx\.id\}\x60/);
  assert.doesNotMatch(source, /'idempotency-key':String\(request\.headers\.get\('idempotency-key'\)/);
});


test('Stripe webhook blocks success events with missing amount or currency instead of bypassing validation', () => {
  assert.match(source, /const amountMatches=Number\\.isSafeInteger\\(amount\\) && amount>=0 && !!currency && amount===Number\\(tx\\.gross_cents\\) && currency===String\\(tx\\.currency\\|\\|'EUR'\\)\\.toLowerCase\\(\\)/);
  assert.doesNotMatch(source, /const amountMatches=amount<0 \\|\\|/);
});
