import { handleGlobalCountryRoute } from "./global-country-routes.js";
import { buildCountryReadinessMatrix } from "./country-readiness-matrix.js";

const MATRIX_PATH = "/api/global/countries/readiness-matrix";
const SUMMARY_PATH = "/api/global/countries/launch-summary";
const ALLOWED_PAGES_ORIGIN = /^https:\/\/(?:[a-z0-9-]+\.)?prochelia\.pages\.dev$/i;

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const headers = { "vary": "Origin" };
  if (ALLOWED_PAGES_ORIGIN.test(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...corsHeaders(request),
    },
  });
}

function preflight(request) {
  const headers = {
    ...corsHeaders(request),
    "cache-control": "no-store",
    "allow": "GET, OPTIONS",
  };
  if (headers["access-control-allow-origin"]) {
    headers["access-control-allow-methods"] = "GET, OPTIONS";
    headers["access-control-allow-headers"] = "Accept";
    headers["access-control-max-age"] = "600";
  }
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== MATRIX_PATH) {
      return json({ ok: false, error: "NOT_FOUND" }, 404, request);
    }
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "allow": "GET, OPTIONS",
          "x-content-type-options": "nosniff",
          ...corsHeaders(request),
        },
      });
    }
    const summaryRequest = new Request(new URL(SUMMARY_PATH, url.origin), { method: "GET" });
    const summaryResponse = handleGlobalCountryRoute(summaryRequest, SUMMARY_PATH);
    if (!summaryResponse || !summaryResponse.ok) return json({ ok: false, error: "COUNTRY_SUMMARY_UNAVAILABLE" }, 503, request);
    let summary;
    try { summary = await summaryResponse.json(); } catch { return json({ ok: false, error: "COUNTRY_SUMMARY_UNAVAILABLE" }, 503, request); }
    const result = buildCountryReadinessMatrix(summary, url.searchParams);
    return json(result, result.ok ? 200 : result.status || 400, request);
  },
};
