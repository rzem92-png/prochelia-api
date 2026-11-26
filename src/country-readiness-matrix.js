import { COUNTRY_LAUNCH_GATES } from "./country-launch-gates.js";

const MARKET_STATUSES = new Set(["pilot_candidate", "planned", "enabled"]);
const GATE_STATUSES = new Set(["not_assessed", "in_progress", "approved", "blocked"]);
const SORTS = new Set(["code", "name", "status", "readiness"]);
const MAX_PAGE_SIZE = 14;

function normalizeSearch(value) {
  return String(value || "").trim().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("fr");
}

function integerParam(value, fallback, max) {
  if (value == null || value === "") return fallback;
  if (!/^(0|[1-9]\\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

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

export function buildCountryReadinessMatrix(summary, params = new URLSearchParams()) {
  if (!summary || summary.ok !== true || !Array.isArray(summary.countries)) {
    return { ok: false, status: 503, error: "COUNTRY_SUMMARY_UNAVAILABLE" };
  }
  const q = normalizeSearch(params.get("q"));
  const marketStatus = params.get("marketStatus") || "";
  const gate = params.get("gate") || "";
  const gateStatus = params.get("gateStatus") || "";
  const sort = params.get("sort") || "code";
  const limit = integerParam(params.get("limit"), MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = integerParam(params.get("offset"), 0, 1000);

  if (marketStatus && !MARKET_STATUSES.has(marketStatus)) return { ok: false, status: 400, error: "INVALID_MARKET_STATUS" };
  if (gate && !COUNTRY_LAUNCH_GATES.includes(gate)) return { ok: false, status: 400, error: "INVALID_LAUNCH_GATE" };
  if (gateStatus && !GATE_STATUSES.has(gateStatus)) return { ok: false, status: 400, error: "INVALID_GATE_STATUS" };
  if (!SORTS.has(sort)) return { ok: false, status: 400, error: "INVALID_SORT" };
  if (limit == null || limit < 1) return { ok: false, status: 400, error: "INVALID_LIMIT" };
  if (offset == null) return { ok: false, status: 400, error: "INVALID_OFFSET" };

  const filtered = summary.countries.filter(country => {
    const matchesSearch = !q || normalizeSearch(country.code + " " + country.name).includes(q);
    const matchesMarket = !marketStatus || country.marketStatus === marketStatus;
    const matchesGate = !gate || country.gates?.some(item => item.id === gate);
    const matchesGateStatus = !gateStatus || country.gates?.some(item => item.status === gateStatus);
    return matchesSearch && matchesMarket && matchesGate && matchesGateStatus;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "fr") || a.code.localeCompare(b.code);
    if (sort === "status") return a.marketStatus.localeCompare(b.marketStatus) || a.code.localeCompare(b.code);
    if (sort === "readiness") return Number(b.assessedCount || 0) - Number(a.assessedCount || 0) || a.code.localeCompare(b.code);
    return a.code.localeCompare(b.code);
  });
  const page = sorted.slice(offset, offset + limit);
  const requiredGateCount = sorted.reduce((sum, country) => sum + Number(country.requiredCount || 0), 0);
  const assessedGateCount = sorted.reduce((sum, country) => sum + Number(country.assessedCount || 0), 0);
  const approvedGateCount = sorted.reduce((sum, country) => sum + Number(country.approvedCount || 0), 0;

  return {
    ok: true,
    filters: { q: params.get("q") || "", marketStatus, gate, gateStatus, sort },
    pagination: {
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + page.length < sorted.length,
      nextOffset: offset + page.length < sorted.length ? offset + page.length : null,
    },
    summary: {
      countryCount: sorted.length,
      requiredGateCount,
      assessedGateCount,
      approvedGateCount,
      launchEligibleCount: sorted.filter(country => country.launchEligible === true).length,
      activationAllowedCount: sorted.filter(country => country.activationAllowed === true).length,
    },
    countries: page,
    note: "Matrice de consultation uniquement. Aucun pays n'est activé et aucune preuve, réponse ou approbation n'est enregistrée.",
  };
}

export function handleCountryReadinessMatrixRoute(request, pathname) {
  if (pathname !== "/api/global/countries/readiness-matrix") return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  return null;
}
