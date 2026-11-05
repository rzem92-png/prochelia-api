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
