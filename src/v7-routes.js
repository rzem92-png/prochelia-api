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

      const body =
        await request.json();

      const result =
        procheliaV7.checkPermissions(
          body
        );

      return Response.json(

        result,

        {
          status:
            result.ok
              ? 200
              : 403
        }
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

      const body =
        await request.json();

      const result =
        procheliaV7.checkIdempotency(

          body.idempotencyKey

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
    // AUDIT
    // =================================================

    if (
      path === "/api/v7/security/audit" &&
      method === "POST"
    ) {

      const body =
        await request.json();

      const result =
        procheliaV7.auditEvent(
          body
        );

      return Response.json({

        ok: true,

        version:
          procheliaV7.version,

        audit:
          result

      });
    }


    // =================================================
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

    return Response.json(

      {
        ok: false,

        version:
          procheliaV7.version,

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
