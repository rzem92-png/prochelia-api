import { handleGlobalCountryRoute } from "./global-country-routes.js";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const response = handleGlobalCountryRoute(request, url.pathname);
    if (response) return response;
    return new Response(JSON.stringify({ ok: false, error: "NOT_FOUND" }), {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
