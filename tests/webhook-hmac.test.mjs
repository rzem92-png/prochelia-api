import test from 'node:test';
import assert from 'node:assert/strict';
import { signWebhook, verifyWebhook } from '../src/security/webhook-hmac.js';

const secret = 'test-only-secret-with-at-least-32-characters';
const rawBody = '{"event":"mission.updated","id":"evt_123"}';
const now = 1_800_000_000;

test('accepts valid timestamped HMAC for exact raw body', async () => {
  const signed = await signWebhook(secret, rawBody, now);
  assert.deepEqual(await verifyWebhook({
    secret, rawBody, timestamp: signed.timestamp, signature: signed.signature, now
  }), { ok: true });
});

test('rejects body tampering', async () => {
  const signed = await signWebhook(secret, rawBody, now);
  const result = await verifyWebhook({
    secret, rawBody: rawBody + ' ', timestamp: signed.timestamp, signature: signed.signature, now
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'SIGNATURE_MISMATCH');
});

test('rejects stale timestamp', async () => {
  const signed = await signWebhook(secret, rawBody, now - 301);
  const result = await verifyWebhook({
    secret, rawBody, timestamp: signed.timestamp, signature: signed.signature, now, toleranceSeconds: 300
  });
  assert.equal(result.reason, 'STALE_TIMESTAMP');
});

test('rejects malformed signature and timestamp', async () => {
  assert.equal((await verifyWebhook({
    secret, rawBody, timestamp: 'x', signature: 'v1=bad', now
  })).reason, 'INVALID_TIMESTAMP');
  assert.equal((await verifyWebhook({
    secret, rawBody, timestamp: String(now), signature: 'bad', now
  })).reason, 'INVALID_SIGNATURE_FORMAT');
});

test('rejects wrong secret', async () => {
  const signed = await signWebhook(secret, rawBody, now);
  const result = await verifyWebhook({
    secret: 'another-test-secret-with-at-least-32-chars',
    rawBody, timestamp: signed.timestamp, signature: signed.signature, now
  });
  assert.equal(result.reason, 'SIGNATURE_MISMATCH');
});

test('requires sufficiently long secret', async () => {
  await assert.rejects(() => signWebhook('short', rawBody, now), /WEBHOOK_SECRET_TOO_SHORT/);
});
