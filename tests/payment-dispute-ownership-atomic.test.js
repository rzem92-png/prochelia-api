import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
const start=source.indexOf('async function openPaymentDispute');
const end=source.indexOf('async function handleBase',start);
const block=source.slice(start,end);

test('dispute requires client ownership and paid status',()=>{
  assert.match(block,/tx\.client_id!==auth\.user\.id/);
  assert.match(block,/tx\.status!=='paid'/);
  assert.match(block,/amount>Number\(tx\.gross_cents\|\|0\)/);
});

test('dispute creation atomically holds transaction and inserts dispute',()=>{
  assert.match(block,/UPDATE payment_transactions SET status='held'.*status='paid'/);
  assert.match(block,/INSERT INTO payment_disputes .*SELECT .*WHERE changes\(\)=1/);
  assert.match(block,/env\.DB\.batch\(\[/);
});

test('resolution is conditional and requires both state changes',()=>{
  assert.match(block,/UPDATE payment_disputes SET status='resolved'.*WHERE id=\? AND status='open'/);
  assert.match(block,/UPDATE payment_transactions SET status=.*status='held' AND changes\(\)=1/);
  assert.match(block,/DISPUTE_RESOLUTION_CONFLICT/);
});
