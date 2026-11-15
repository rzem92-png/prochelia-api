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
  path,
  auth = null
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
    // DSA — SIGNALEMENT DE CONTENU / SERVICE
    // =================================================
    if (path === "/api/compliance/notices" && method === "GET") {
      if (!auth?.user?.id) {
        return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
      }
      if (!env?.DB) {
        return Response.json({ ok: false, error: "COMPLIANCE_STORE_UNAVAILABLE" }, { status: 503 });
      }
      const result = await env.DB.prepare(
        `SELECT id, subject_type, subject_id, notice_type, status, received_at,
                decided_at, decision_reason, outcome_notified_at
         FROM dsa_notices WHERE reporter_user_id = ?
         ORDER BY received_at DESC LIMIT 100`
      ).bind(auth.user.id).all();
      return Response.json({ ok: true, notices: result?.results || [] }, {
        headers: { "cache-control": "no-store" }
      });
    }

    if (path === "/api/compliance/notices" && method === "POST") {
      if (!auth?.user?.id) {
        return Response.json(
          { ok: false, error: "UNAUTHENTICATED" },
          { status: 401 }
        );
      }

      const body = await request.json().catch(() => null);
      const subjectTypes = new Set(["LISTING", "PROFILE", "MESSAGE", "REVIEW", "AD", "SERVICE"]);
      const noticeTypes = new Set(["ILLEGAL_CONTENT", "ILLEGAL_SERVICE", "FRAUD", "IP_RIGHTS", "SAFETY", "OTHER"]);
      const subjectId = typeof body?.subject_id === "string" ? body.subject_id.trim() : "";
      const explanation = typeof body?.explanation === "string" ? body.explanation.trim() : "";
      const subjectType = typeof body?.subject_type === "string" ? body.subject_type : "";
      const noticeType = typeof body?.notice_type === "string" ? body.notice_type : "";
      const legalBasis = typeof body?.legal_basis === "string" ? body.legal_basis.trim().slice(0, 500) : null;

      if (!body || !subjectTypes.has(subjectType) || !noticeTypes.has(noticeType) ||
          !subjectId || subjectId.length > 200 || explanation.length < 20 || explanation.length > 5000) {
        return Response.json(
          { ok: false, error: "INVALID_NOTICE", message: "Type, référence et explication du signalement requis." },
          { status: 400 }
        );
      }
      if (!env?.DB) {
        return Response.json({ ok: false, error: "COMPLIANCE_STORE_UNAVAILABLE" }, { status: 503 });
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO dsa_notices
          (id, reporter_user_id, subject_type, subject_id, notice_type, legal_basis, explanation, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED')`
      ).bind(id, auth.user.id, subjectType, subjectId, noticeType, legalBasis, explanation).run();

      return Response.json(
        { ok: true, notice: { id, status: "RECEIVED", received_at: new Date().toISOString() } },
        { status: 201, headers: { "cache-control": "no-store" } }
      );
    }


    // =================================================
    // DSA — RECOURS INTERNE CONTRE UNE DÉCISION
    // =================================================
    if (path === "/api/compliance/appeals" && method === "POST") {
      if (!auth?.user?.id) {
        return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
      }
      const body = await request.json().catch(() => null);
      const decisionId = typeof body?.decision_id === "string" ? body.decision_id.trim() : "";
      const grounds = typeof body?.grounds === "string" ? body.grounds.trim() : "";
      if (!decisionId || decisionId.length > 200 || grounds.length < 20 || grounds.length > 5000) {
        return Response.json({ ok: false, error: "INVALID_APPEAL" }, { status: 400 });
      }
      if (!env?.DB) {
        return Response.json({ ok: false, error: "COMPLIANCE_STORE_UNAVAILABLE" }, { status: 503 });
      }

      // Only the person affected by the decision may appeal it.
      const decision = await env.DB.prepare(
        "SELECT id FROM moderation_decisions WHERE id = ? AND affected_user_id = ? LIMIT 1"
      ).bind(decisionId, auth.user.id).first();
      if (!decision) {
        return Response.json({ ok: false, error: "DECISION_NOT_APPEALABLE" }, { status: 404 });
      }
      const existing = await env.DB.prepare(
        "SELECT id FROM moderation_appeals WHERE decision_id = ? AND appellant_user_id = ? AND status IN ('SUBMITTED','UNDER_REVIEW') LIMIT 1"
      ).bind(decisionId, auth.user.id).first();
      if (existing) {
        return Response.json({ ok: false, error: "APPEAL_ALREADY_PENDING" }, { status: 409 });
      }

      const id = crypto.randomUUID();
      try {
        await env.DB.prepare(
          "INSERT INTO moderation_appeals (id, decision_id, appellant_user_id, grounds, status) VALUES (?, ?, ?, ?, 'SUBMITTED')"
        ).bind(id, decisionId, auth.user.id, grounds).run();
      } catch (error) {
        // The partial unique index is the final race-safe guard.
        if (String(error?.message || "").includes("uq_moderation_appeals_pending") ||
            String(error?.message || "").includes("moderation_appeals.decision_id, moderation_appeals.appellant_user_id")) {
          return Response.json({ ok: false, error: "APPEAL_ALREADY_PENDING" }, { status: 409 });
        }
        throw error;
      }
      return Response.json({ ok: true, appeal: { id, decision_id: decisionId, status: "SUBMITTED" } }, {
        status: 201, headers: { "cache-control": "no-store" }
      });
    }

    // =================================================
    // AUCUNE ROUTE V7 CORRESPONDANTE
    // =================================================

    return null;

  } catch (error) {
    const missingComplianceSchema =
      typeof path === "string" &&
      path.startsWith("/api/compliance/") &&
      /no such table|no such column/i.test(String(error?.message || ""));
    return Response.json(
      {
        ok: false,
        version: procheliaV7.version,
        error: missingComplianceSchema
          ? "COMPLIANCE_SCHEMA_UNAVAILABLE"
          : (error?.message || "Erreur V7")
      },
      { status: missingComplianceSchema ? 503 : 500 }
    );
  }
}
