/// =====================================================
// PROCHÉLIA V7 - ROUTES ADDITIVES
// =====================================================
// Ces routes sont isolées.
// Elles ne remplacent aucune route existante.
// =====================================================

import { procheliaV7 } from "./v7.js";
import { MARKET_LOCALES } from "./market-localization.js";

export async function handleV7Route(
  request,
  env,
  path,
  auth = null
) {

  try {

    const method =
      request.method.toUpperCase();

    // =================================================
    // PUBLIC MARKET REGISTRY — LAUNCH STATES FAIL-CLOSED
    // =================================================
    if (path === "/api/v7/markets") {
      if (method !== "GET") {
        return Response.json(
          { ok: false, error: "METHOD_NOT_ALLOWED", allowed: ["GET"] },
          { status: 405, headers: { allow: "GET" } }
        );
      }
      const markets = Object.entries(MARKET_LOCALES)
        .map(([countryCode, market]) => ({
          countryCode,
          name: market.name,
          languages: [...market.languages],
          locales: [...market.locales],
          currency: market.currency,
          timeZones: [...market.timeZones],
          defaultTimeZone: market.timeZones.length === 1 ? market.timeZones[0] : null,
          timeZoneRequired: market.timeZones.length > 1,
          marketStatus: market.marketStatus,
          launchEnabled: market.launchEnabled === true && market.marketStatus === "validated"
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return Response.json(
        { ok: true, count: markets.length, markets },
        { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=60" } }
      );
    }



    // =================================================
    // STATUT V7
    // =================================================

    if (
      path === "/api/v7/status" &&
      method === "GET"
    ) {

      return Response.json({

        ok: true,

        version:
          procheliaV7.version,

        module:
          "PROCHÉLIA V7",

        mode:
          "additif",

        destructif:
          false,

        status:
          "ready"

      });
    }


    // =================================================
    // CONTRÔLE E-MAIL
    // =================================================

    if (
      path === "/api/v7/check/email" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const valid =
        procheliaV7.isValidEmail(
          body.email
        );

      return Response.json({

        ok: true,

        email:
          body.email,

        valid

      });
    }


    // =================================================
    // ROUTES V7
    // =================================================

    if (
      path.startsWith("/api/v7/")
    ) {

      return Response.json({

        ok: true,

        version:
          procheliaV7.version,

        message:
          "PROCHÉLIA V7 API active"

      });
    }

    return null;

  } catch (error) {

    return Response.json({

      ok: false,

      error:
        error.message

    }, { status: 500 });

  }

}
