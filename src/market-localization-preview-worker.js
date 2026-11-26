import { handleMarketReadinessRoute } from "./market-readiness.js";

function notFound() {
  return new Response(JSON.stringify({ ok: false, error: "NOT_FOUND" }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request) {
    const response = handleMarketReadinessRoute(request);
    return response || notFound();
  },
};
