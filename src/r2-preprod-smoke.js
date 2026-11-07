/**
 * PROCHÉLIA R2 preproduction smoke Worker.
 * Separate Worker entrypoint: no D1 access, no payment processing, no production routes.
 * Requires secret R2_TEST_TOKEN before deployment.
 */
const VERSION = "R2-PREPROD-SMOKE-1";

function response(body, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
  });
}

function authorized(request, env) {
  const expected = env.R2_TEST_TOKEN;
  const supplied = request.headers.get("authorization") || "";
  return typeof expected === "string" && expected.length >= 32 &&
    supplied.startsWith("Bearer ") && supplied.slice(7) === expected;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return response({ok:true, service:"PROCHÉLIA R2 preproduction smoke", version:VERSION,
        r2_binding:!!env.R2_STAGING, token_configured:typeof env.R2_TEST_TOKEN==="string" && env.R2_TEST_TOKEN.length>=32,
        public_access:"not enabled by this Worker"});
    }
    if (!env.R2_STAGING) return response({ok:false,error:"R2_BINDING_MISSING"},503);
    if (!authorized(request, env)) return response({ok:false,error:"UNAUTHORIZED"},401);
    if (url.pathname !== "/api/r2/smoke" || !["POST","GET","DELETE"].includes(request.method)) {
      return response({ok:false,error:"NOT_FOUND"},404);
    }

    const key = "preprod-smoke/health-check.txt";
    if (request.method === "POST") {
      const payload = await request.text();
      if (payload !== "PROCHELIA-R2-PREPROD-TEST") return response({ok:false,error:"INVALID_TEST_PAYLOAD"},400);
      await env.R2_STAGING.put(key, payload, { httpMetadata:{contentType:"text/plain; charset=utf-8"} });
      return response({ok:true,operation:"put",key});
    }
    if (request.method === "GET") {
      const object = await env.R2_STAGING.get(key);
      if (!object) return response({ok:false,error:"OBJECT_NOT_FOUND"},404);
      const body = await object.text();
      return response({ok:true,operation:"get",key,body,etag:object.etag,
        verified:body==="PROCHELIA-R2-PREPROD-TEST"});
    }
    await env.R2_STAGING.delete(key);
    const remaining = await env.R2_STAGING.head(key);
    return response({ok:true,operation:"delete",key,deleted:!remaining});
  }
};
