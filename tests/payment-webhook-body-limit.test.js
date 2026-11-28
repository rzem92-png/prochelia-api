import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedWebhookBody } from "../src/index.js";

const url = "https://example.test/api/payments/webhook";
const streamRequest = (chunks, headers = {}) => new Request(url, {
  method: "POST",
  headers,
  body: new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  }),
  duplex: "half"
});
const bytes = (text) => new TextEncoder().encode(text);

test("rejects declared webhook payloads above the cap before reading", async () => {
  const request = streamRequest([bytes("tiny")], { "content-length": "100" });
  assert.deepEqual(await readBoundedWebhookBody(request, 10), {
    ok: false, status: 413, error: "WEBHOOK_BODY_TOO_LARGE"
  });
});

test("rejects streamed webhook payloads above the cap without Content-Length", async () => {
  const request = streamRequest([bytes("1234"), bytes("567")]);
  assert.deepEqual(await readBoundedWebhookBody(request, 6), {
    ok: false, status: 413, error: "WEBHOOK_BODY_TOO_LARGE"
  });
});

test("accepts a body exactly at the configured byte cap", async () => {
  const request = streamRequest([bytes("he"), bytes("llo")], { "content-length": "5" });
  assert.deepEqual(await readBoundedWebhookBody(request, 5), {
    ok: true, body: "hello", byteLength: 5
  });
});

test("rejects malformed Content-Length values", async () => {
  for (const value of ["-1", "1.5", "1e2", "01", "abc"]) {
    const request = streamRequest([bytes("x")], { "content-length": value });
    assert.equal((await readBoundedWebhookBody(request, 10)).error, "INVALID_WEBHOOK_CONTENT_LENGTH");
  }
});

test("rejects mismatched Content-Length", async () => {
  const request = streamRequest([bytes("hello")], { "content-length": "4" });
  assert.equal((await readBoundedWebhookBody(request, 10)).error, "WEBHOOK_CONTENT_LENGTH_MISMATCH");
});

test("rejects invalid UTF-8", async () => {
  const request = streamRequest([new Uint8Array([0xff, 0xfe])]);
  assert.equal((await readBoundedWebhookBody(request, 10)).error, "INVALID_WEBHOOK_UTF8");
});

test("returns a bounded read error for a failing stream", async () => {
  const request = new Request(url, {
    method: "POST",
    body: new ReadableStream({ start(controller) { controller.error(new Error("stream failure")); } }),
    duplex: "half"
  });
  assert.equal((await readBoundedWebhookBody(request, 10)).error, "WEBHOOK_BODY_READ_FAILED");
});

test("rejects invalid byte-cap configuration", async () => {
  const request = streamRequest([bytes("x")]);
  await assert.rejects(readBoundedWebhookBody(request, 0), TypeError);
});
