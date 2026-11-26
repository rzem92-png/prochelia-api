import { handleGlobalCountryRoute } from "./global-country-routes.js";
import { buildCountryReadinessMatrix } from "./country-readiness-matrix.js";

const MATRIX_PATH = "/api/global/countries/readiness-matrix";
const SUMMARY_PATH = "/api/global/countries/launch-summary";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== MATRIX_PATH) {
      return json({ ok: false, error: "NOT_FOUND" }, 404);
    }
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "allow": "GET", "x-content-type-options": "nosniff" },
      });
    }
    const summaryRequest = new Request(new URL(SUMMARY_PATH, url.origin), { method: "GET" });
    const summaryResponse = handleGlobalCountryRoute(summaryRequest, SUMMARY_PATH);
    if (!summaryResponse || !summaryResponse.ok) return json({ ok: false, error: "COUNTRY_SUMMARY_UNAVAILABLE" }, 503);
    let summary;
    try { summary = await summaryResponse.json(); } catch { return json({ ok: false, error: "COUNTRY_SUMMARY_UNAVAILABLE" }, 503); }
    const result = buildCountryReadinessMatrix(summary, url.searchParams);
    return json(result, result.ok ? 200 : result.status || 400);
  },
};
