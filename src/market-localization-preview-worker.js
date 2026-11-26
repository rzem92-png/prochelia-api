import { handleMarketReadinessRoute } from "./market-readiness.js";

function withPublicReadCors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "Accept");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function notFound() {
  return withPublicReadCors(new Response(JSON.stringify({ ok: false, error: "NOT_FOUND" }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8" },
  }));
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return withPublicReadCors(new Response(null, { status: 204, headers: { allow: "GET, OPTIONS" } }));
    }
    const response = handleMarketReadinessRoute(request);
    return response ? withPublicReadCors(response) : notFound();
  },
};
