/// =====================================================
// PROCHÉLIA V7 - ROUTES ADDITIVES
// =====================================================
// Ces routes sont isolées.
// Elles ne remplacent aucune route existante.
// =====================================================

import { procheliaV7 } from "./v7.js";

export async function handleV7Route(
  request,
  env,
  path
) {

  try {

    const method =
      request.method.toUpperCase();

    // Stream-limit request bodies instead of clone().text(), which could buffer
    // an attacker-controlled oversized payload before checking its length.
    if (method === "POST") {
      const maxBodyBytes = 32 * 1024;
      const declaredLengthHeader = request.headers.get("content-length");
      if (declaredLengthHeader !== null) {
        if (!/^\\d+$/.test(declaredLengthHeader) || Number(declaredLengthHeader) > maxBodyBytes) {
          return Response.json(
            { ok: false, version: procheliaV7.version, error: "PAYLOAD_TOO_LARGE" },
            { status: 413, headers: { "cache-control": "no-store" } }
          );
        }
      }
      if (request.body) {
        const reader = request.body.getReader();
        const chunks = [];
        let total = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBodyBytes) {
              await reader.cancel();
              return Response.json(
                { ok: false, version: procheliaV7.version, error: "PAYLOAD_TOO_LARGE" },
                { status: 413, headers: { "cache-control": "no-store" } }
              );
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const boundedBody = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          boundedBody.set(chunk, offset);
          offset += chunk.byteLength;
        }
        request = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: boundedBody
        });
      }
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

      return Response.json(

        valid

          ? {
              ok: true,

              email:
                procheliaV7.normalizeEmail(
                  body.email
                )
            }

          : {
              ok: false,

              error:
                "E-mail invalide"
            },

        {
          status:
            valid
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE COMPTE
    // =================================================

    if (
      path === "/api/v7/check/account" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkAccount(
          body.account
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE PERMISSIONS
    // =================================================

    if (
      path === "/api/v7/check/permissions" &&
      method === "POST"
    ) {
      // Never authorize from a role/permissions object supplied by the caller.
      // Authorization must be derived from a verified server-side session.
      return Response.json(
        { ok: false, version: procheliaV7.version, error: "AUTHORIZATION_CONTEXT_REQUIRED" },
        { status: 403, headers: { "cache-control": "no-store" } }
      );
    }


    // =================================================
    // CONTRÔLE PROFIL INTERVENANT
    // =================================================

    if (
      path === "/api/v7/check/intervenant" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkIntervenantProfile(
          body.profile
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE DOCUMENT
    // =================================================

    if (
      path === "/api/v7/check/document" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkDocument(
          body.document
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE EXPIRATION
    // =================================================

    if (
      path === "/api/v7/check/expiration" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkExpiration(
          body.date
        );

      return Response.json({

        ok: true,

        version:
          procheliaV7.version,

        ...result

      });
    }


    // =================================================
    // CONTRÔLE TRANSPORT
    // =================================================

    if (
      path === "/api/v7/check/transport" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkTransport(
          body.profile
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE MISSION
    // =================================================

    if (
      path === "/api/v7/check/mission" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkMission(
          body.mission
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // TRANSITION DE STATUT
    // =================================================

    if (
      path === "/api/v7/check/mission-transition" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkMissionTransition(

          body.currentStatus,

          body.nextStatus

        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE DISPONIBILITÉ
    // =================================================

    if (
      path === "/api/v7/check/availability" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkAvailability(
          body
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE CONFLIT
    // =================================================

    if (
      path === "/api/v7/check/conflict" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkConflict(
          body
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 409
        }
      );
    }


    // =================================================
    // CONTRÔLE TARIFICATION
    // =================================================

    if (
      path === "/api/v7/check/pricing" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkPricing(
          body
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE QR
    // =================================================

    if (
      path === "/api/v7/check/qr" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkQr(

          body.mission,

          body.qr

        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CONTRÔLE PAIEMENT
    // =================================================

    if (
      path === "/api/v7/check/payment" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.checkPayment(
          body.payment
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // CALCUL FINANCIER
    // =================================================

    if (
      path === "/api/v7/finance/calculate" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.calculateFinance(
          body
        );

      return Response.json(
        result
      );
    }


    // =================================================
    // CONTRÔLE GLOBAL AVANT MISSION
    // =================================================

    if (
      path === "/api/v7/check/pre-mission" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.preMissionCheck(
          body
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 400
        }
      );
    }


    // =================================================
    // IDEMPOTENCE
    // =================================================

    if (
      path === "/api/v7/security/idempotency" &&
      method === "POST"
    ) {
      // A format check is not durable replay protection. Disable this
      // endpoint until the key is reserved atomically with the business write.
      return Response.json(
        { ok: false, version: procheliaV7.version, error: "IDEMPOTENCY_NOT_ENFORCED" },
        { status: 501, headers: { "cache-control": "no-store" } }
      );
    }


    // AUDIT
    // =================================================

    if (
      path === "/api/v7/security/audit" &&
      method === "POST"
    ) {
      // Client-supplied audit events are untrusted and are not durable logs.
      return Response.json(
        { ok: false, version: procheliaV7.version, error: "AUDIT_ENDPOINT_DISABLED" },
        { status: 403, headers: { "cache-control": "no-store" } }
      );
    }


    // INDICATEURS STRATÉGIQUES
    // =================================================

    if (
      path === "/api/v7/strategy/indicators" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.strategicIndicators(
          body
        );

      return Response.json({

        ok: true,

        version:
          procheliaV7.version,

        ...result

      });
    }


    // =================================================
    // AUCUNE ROUTE V7 CORRESPONDANTE
    // =================================================

    return null;

  } catch (error) {
    // Avoid returning parser/internal exception text to untrusted callers.
    const invalidJson = error instanceof SyntaxError;
    return Response.json(
      {
        ok: false,
        version: procheliaV7.version,
        error: invalidJson ? "INVALID_JSON" : "V7_INTERNAL_ERROR"
      },
      {
        status: invalidJson ? 400 : 500,
        headers: { "cache-control": "no-store" }
      }
    );
  }
}
