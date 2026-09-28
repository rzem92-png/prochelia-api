// PROCHÉLIA V7 - ROUTES ADDITIVES
// Ces routes sont isolées et ne remplacent aucune route existante.

import { procheliaV7 } from "./v7.js";

export async function handleV7Route(request, env, path) {
  try {
    const method = request.method.toUpperCase();

    // Vérification du module V7
    if (path === "/api/v7/status" && method === "GET") {
      return Response.json({
        ok: true,
        version: procheliaV7.version,
        module: "PROCHÉLIA V7",
        mode: "additif",
        destructif: false,
        status: "ready"
      });
    }

    // Vérification d'un e-mail
    if (path === "/api/v7/check/email" && method === "POST") {
      const body = await request.json();

      return Response.json(
        procheliaV7.isValidEmail(body.email)
          ? {
              ok: true,
              email: procheliaV7.normalizeEmail(body.email)
            }
          : {
              ok: false,
              error: "E-mail invalide"
            },
        {
          status: procheliaV7.isValidEmail(body.email)
            ? 200
            : 400
        }
      );
    }

    // Vérification d'un compte
    if (path === "/api/v7/check/account" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkAccount(body.account);

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Vérification d'un document
    if (path === "/api/v7/check/document" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkDocument(body.document);

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Vérification de mobilité
    if (path === "/api/v7/check/transport" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkTransport(body.profile);

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Vérification d'une mission
    if (path === "/api/v7/check/mission" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkMission(body.mission);

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Vérification QR
    if (path === "/api/v7/check/qr" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkQr(
          body.mission,
          body.qr
        );

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Vérification paiement
    if (path === "/api/v7/check/payment" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkPayment(
          body.payment
        );

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Calcul financier
    if (path === "/api/v7/finance/calculate" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.calculateFinance(body);

      return Response.json(result);
    }

    // Indicateurs stratégiques
    if (path === "/api/v7/strategy/indicators" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.strategicIndicators(body);

      return Response.json({
        ok: true,
        version: procheliaV7.version,
        ...result
      });
    }

    // Idempotence
    if (path === "/api/v7/security/idempotency" && method === "POST") {
      const body = await request.json();

      const result =
        procheliaV7.checkIdempotency(
          body.idempotencyKey
        );

      return Response.json(
        result,
        {
          status: result.ok ? 200 : 400
        }
      );
    }

    // Aucun endpoint V7 correspondant
    return null;

  } catch (error) {
    return Response.json(
      {
        ok: false,
        version: procheliaV7.version,
        error:
          error?.message ||
          "Erreur V7"
      },
      {
        status: 500
      }
    );
  }
}
