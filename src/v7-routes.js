/// =====================================================
// PROCHÉLIA V7 - ROUTES ADDITIVES
// =====================================================
// Ces routes sont isolées.
// Elles ne remplacent aucune route existante.
// =====================================================

import { procheliaV7 } from "./v7.js";
import { evaluateLiveMessage, LIVE_MODERATION_PROFILES, LIVE_MODERATION_POLICY_VERSION } from "./live-moderation-policy.js";

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
    // NEXUS SUPRA — LIVE MODERATION POLICY PREVIEW
    // Authenticated, bounded input; no database write or live-control side effect.
    // =================================================
    if (path === "/api/v7/live/moderation/evaluate") {
      if (method !== "POST") {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "METHOD_NOT_ALLOWED" },
          { status: 405, headers: { allow: "POST" } }
        );
      }
      if (!auth?.user) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "UNAUTHENTICATED" },
          { status: 401 }
        );
      }
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (Number.isFinite(contentLength) && contentLength > 8192) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "BODY_TOO_LARGE" },
          { status: 413 }
        );
      }
      let raw = "";
      if (request.body) {
        const reader = request.body.getReader();
        const chunks = [];
        let total = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > 8192) {
              await reader.cancel();
              return Response.json(
                { ok: false, version: procheliaV7.version, error: "BODY_TOO_LARGE" },
                { status: 413 }
              );
            }
            chunks.push(value);
          }
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          return Response.json(
            { ok: false, version: procheliaV7.version, error: "INVALID_BODY" },
            { status: 400 }
          );
        }
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "INVALID_JSON" },
          { status: 400 }
        );
      }
      if (typeof body?.text !== "string" || !body.text.trim()) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "TEXT_REQUIRED" },
          { status: 400 }
        );
      }
      if (body.text.length > 3000) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "TEXT_TOO_LONG", max_length: 3000 },
          { status: 400 }
        );
      }
      if (body.profile !== undefined && !LIVE_MODERATION_PROFILES.includes(body.profile)) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "INVALID_PROFILE" },
          { status: 400 }
        );
      }
      const evaluation = evaluateLiveMessage(body.text, { profile: body.profile || "standard" });
      return Response.json({
        ok: true,
        module: "NEXUS_SUPRA_LIVE_MODERATION",
        policy_version: LIVE_MODERATION_POLICY_VERSION,
        execution: "policy_plan_only",
        evaluation
      });
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

      // Authorization must use the authenticated session, not caller-supplied role/permissions.
      if (!auth?.user) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "UNAUTHENTICATED" },
          { status: 401 }
        );
      }
      if (auth.user.role !== "gerante") {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "FORBIDDEN" },
          { status: 403 }
        );
      }

      const body = await request.json();
      const result = procheliaV7.checkPermissions({
        role: auth.user.role,
        permission: body?.permission,
        permissions: {}
      });

      return Response.json(result, { status: result.ok ? 200 : 403 });
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

      if (!auth?.user) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "UNAUTHENTICATED" },
          { status: 401 }
        );
      }
      if (auth.user.role !== "gerante") {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "FORBIDDEN" },
          { status: 403 }
        );
      }

      const body = await request.json();
      if (!body || typeof body.action !== "string" || !body.action.trim()) {
        return Response.json(
          { ok: false, version: procheliaV7.version, error: "INVALID_AUDIT_EVENT" },
          { status: 400 }
        );
      }

      const result = procheliaV7.auditEvent({
        ...body,
        actorId: auth.user.id,
        actorRole: auth.user.role
      });

      return Response.json({ ok: true, version: procheliaV7.version, audit: result });
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
