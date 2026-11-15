import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedRequestBody } from "../src/request-body.js";

function streamOf(chunks, onCancel = () => {}) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel(reason) {
      onCancel(reason);
    }
  });
}

test("bounded reader accepts an empty body and exact byte limit", async () => {
  assert.deepEqual(await readBoundedRequestBody({ body: null }, 0), {
    ok: true, text: "", bytes: 0
  });
  const body = new TextEncoder().encode("12345");
  assert.deepEqual(await readBoundedRequestBody({ body: streamOf([body]) }, 5), {
    ok: true, text: "12345", bytes: 5
  });
});

test("bounded reader counts UTF-8 bytes, not JavaScript characters", async () => {
  const encoded = new TextEncoder().encode("é🙂");
  const result = await readBoundedRequestBody({
    body: streamOf([encoded.slice(0, 1), encoded.slice(1, 3), encoded.slice(3)])
  }, encoded.byteLength);
  assert.equal(result.ok, true);
  assert.equal(result.text, "é🙂");
  assert.equal(result.bytes, 6);
});

test("bounded reader cancels immediately when the byte limit is exceeded", async () => {
  let cancelled = false;
  const body = streamOf([
    new TextEncoder().encode("1234"),
    new TextEncoder().encode("5678"),
    new TextEncoder().encode("should-not-be-read")
  ], () => { cancelled = true; });
  const result = await readBoundedRequestBody({ body }, 6);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "TOO_LARGE");
  assert.equal(result.bytes, 8);
  assert.equal(cancelled, true);
});

test("bounded reader rejects invalid UTF-8 instead of silently replacing bytes", async () => {
  const result = await readBoundedRequestBody({
    body: streamOf([new Uint8Array([0xc3, 0x28])])
  }, 10);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "INVALID_UTF8");
});

test("bounded reader propagates stream failures and releases the reader lock", async () => {
  const failure = new Error("stream failed");
  const body = new ReadableStream({
    start(controller) { controller.error(failure); }
  });
  await assert.rejects(readBoundedRequestBody({ body }, 10), error => error === failure);
  assert.equal(body.locked, false);
});

test("bounded reader rejects invalid limits and request objects", async () => {
  await assert.rejects(readBoundedRequestBody(null, 10), TypeError);
  await assert.rejects(readBoundedRequestBody({ body: null }, -1), TypeError);
  await assert.rejects(readBoundedRequestBody({ body: null }, 1.5), TypeError);
});
