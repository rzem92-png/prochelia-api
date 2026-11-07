/**
 * PROCHÉLIA R2 preproduction smoke Worker.
 * Separate Worker entrypoint: no D1 access, no payment processing, no production routes.
 * Requires secret R2_TEST_TOKEN before deployment.
 */
const VERSION = "R2-PREPROD-SMOKE-1";
const TEST_KEY = "preprod-smoke/health-check.txt";
const TEST_PAYLOAD = "PROCHELIA-R2-PREPROD-TEST";
const MAX_BODY_BYTES = 64;

function response(body, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "x-content-type-options":"nosniff", "x-frame-options":"DENY", "referrer-policy":"no-referrer", "permissions-policy":"camera=(), microphone=(), geolocation=()" }
  });
}

async function authorized(request, env) {
  const expected = env.R2_TEST_TOKEN;
  const supplied = request.headers.get("authorization") || "";
  if (typeof expected !== "string" || expected.length < 32 || !supplied.startsWith("Bearer ")) return false;
  const candidate = supplied.slice(7);
  const encoder = new TextEncoder();
  const [a,b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(candidate))
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i=0;i<x.length;i++) diff |= x[i] ^ y[i];
  return diff === 0 && candidate.length === expected.length;
}

async function readLimited(request, limit) {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset=0;
  for (const chunk of chunks) { merged.set(chunk,offset); offset+=chunk.byteLength; }
  return new TextDecoder("utf-8", {fatal:true}).decode(merged);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return response({ok:true, service:"PROCHÉLIA R2 preproduction smoke", version:VERSION,
        status:"available", public_access:"not enabled by this Worker"});
    }
    // Authenticate before revealing operational configuration details.
    if (!await authorized(request, env)) return response({ok:false,error:"UNAUTHORIZED"},401);
    if (!env.R2_STAGING) return response({ok:false,error:"R2_BINDING_MISSING"},503);
    if (url.pathname !== "/api/r2/smoke" || !["POST","GET","DELETE"].includes(request.method)) {
      return response({ok:false,error:"NOT_FOUND"},404);
    }

    try {
      if (request.method === "POST") {
        let payload;
        try {
          payload = await readLimited(request, MAX_BODY_BYTES);
        } catch {
          // Invalid UTF-8 is a client input error, not an R2 provider failure.
          return response({ok:false,error:"INVALID_UTF8"},400);
        }
        if (payload === null) return response({ok:false,error:"PAYLOAD_TOO_LARGE"},413);
        if (payload !== TEST_PAYLOAD) return response({ok:false,error:"INVALID_TEST_PAYLOAD"},400);
        await env.R2_STAGING.put(TEST_KEY, payload, { httpMetadata:{contentType:"text/plain; charset=utf-8"} });
        return response({ok:true,operation:"put",key:TEST_KEY});
      }
      if (request.method === "GET") {
        const object = await env.R2_STAGING.get(TEST_KEY);
        if (!object) return response({ok:false,error:"OBJECT_NOT_FOUND"},404);
        const body = await object.text();
        return response({ok:true,operation:"get",key:TEST_KEY,body,etag:object.etag,
          verified:body===TEST_PAYLOAD});
      }
      await env.R2_STAGING.delete(TEST_KEY);
      const remaining = await env.R2_STAGING.head(TEST_KEY);
      return response({ok:true,operation:"delete",key:TEST_KEY,deleted:!remaining});
    } catch {
      // Avoid returning provider internals, credentials, or raw exception details to callers.
      return response({ok:false,error:"R2_OPERATION_FAILED"},503);
    }
  }
};
