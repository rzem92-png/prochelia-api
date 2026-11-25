import { getCountryConfig, listCountryConfigs, isCountryLaunchEligible } from "./global-country-registry.js";

function publicCountry(config) {
  return {
    code: config.code,
    name: config.name,
    defaultLocale: config.defaultLocale,
    locales: [...config.locales],
    currency: config.currency,
    timezone: config.timezone,
    callingCode: config.callingCode,
    available: isCountryLaunchEligible(config.code),
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function handleGlobalCountryRoute(request, pathname) {
  if (pathname !== "/api/global/countries" && !/^\/api\/global\/countries\/[A-Za-z]{2}$/.test(pathname)) return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET" });

  if (pathname === "/api/global/countries") {
    const countries = listCountryConfigs()
      .map(publicCountry)
      .sort((a, b) => a.code.localeCompare(b.code));
    return json({ ok: true, count: countries.length, countries });
  }

  const code = pathname.slice("/api/global/countries/".length).toUpperCase();
  const config = getCountryConfig(code);
  if (!config) return json({ ok: false, error: "COUNTRY_NOT_FOUND" }, 404);
  return json({ ok: true, country: publicCountry(config) });
}
