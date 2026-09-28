/* =========================================================
   PROCHÉLIA API
   Cloudflare Workers + D1
   Backend MVP opérationnel
   ========================================================= */
import { handleV7Route } from "./v7-routes.js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

/* =========================================================
   OUTILS
   ========================================================= */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function id(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim() || null;
}

/* =========================================================
   HASH MOT DE PASSE
   PBKDF2 + SHA-256
   ========================================================= */

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function hashPassword(password, saltBase64 = null) {
  const encoder = new TextEncoder();

  const salt = saltBase64
    ? base64ToBytes(saltBase64)
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return {
    salt: bytesToBase64(salt),
    hash: bytesToBase64(new Uint8Array(derived))
  };
}

async function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.includes(":")) {
    return false;
  }

  const [salt, expectedHash] = storedValue.split(":");

  const result = await hashPassword(password, salt);

  return result.hash === expectedHash;
}

async function hashToken(token) {
  const data = new TextEncoder().encode(token);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return bytesToBase64(new Uint8Array(digest));
}

/* =========================================================
   BASE D1
   ========================================================= */

async function ensureDatabase(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (error) {
    console.log("sessions:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token
      ON sessions(token_hash)
    `).run();
  } catch (error) {
    console.log("idx_sessions_token:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user
      ON sessions(user_id)
    `).run();
  } catch (error) {
    console.log("idx_sessions_user:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_missions_client
      ON missions(client_id)
    `).run();
  } catch (error) {
    console.log("idx_missions_client:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_missions_intervenant
      ON missions(intervenant_id)
    `).run();
  } catch (error) {
    console.log("idx_missions_intervenant:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_missions_date
      ON missions(start_at)
    `).run();
  } catch (error) {
    console.log("idx_missions_date:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_disponibilites_intervenant
      ON disponibilites(intervenant_id)
    `).run();
  } catch (error) {
    console.log("idx_disponibilites_intervenant:", error?.message);
  }

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_evaluations_target
      ON evaluations(target_user_id)
    `).run();
  } catch (error) {
    console.log("idx_evaluations_target:", error?.message);
  }

  try {
    await env.DB.prepare(`
      ALTER TABLE users ADD COLUMN password_hash TEXT
    `).run();
  } catch (error) {
    // La colonne existe déjà.
  }
}
/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function authenticate(request, env) {
  const token = bearerToken(request);

  if (!token) {
    return null;
  }

  const tokenHash = await hashToken(token);

  const result = await env.DB.prepare(`
    SELECT
      u.id,
      u.role,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.status,
      u.created_at,
      u.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
      AND u.status != 'blocked'
    LIMIT 1
  `)
    .bind(tokenHash, now())
    .first();

  return result || null;
}

function requireAuth(user) {
  if (!user) {
    return json({
      ok: false,
      error: "Authentification requise"
    }, 401);
  }

  return null;
}

function requireRole(user, roles) {
  if (!user) {
    return json({
      ok: false,
      error: "Authentification requise"
    }, 401);
  }

  if (!roles.includes(user.role)) {
    return json({
      ok: false,
      error: "Accès non autorisé"
    }, 403);
  }

  return null;
}

/* =========================================================
   JOURNAL
   ========================================================= */

async function logAction(
  env,
  userId,
  action,
  entityType = null,
  entityId = null,
  details = null
) {
  try {
    await env.DB.prepare(`
      INSERT INTO journal
      (
        id,
        user_id,
        action,
        entity_type,
        entity_id,
        details
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(
        id("log"),
        userId,
        action,
        entityType,
        entityId,
        details ? JSON.stringify(details) : null
      )
      .run();
  } catch (_) {
    // Le journal ne doit pas bloquer l'opération principale.
  }
}

/* =========================================================
   PROCHÉLIA V2 — MISSIONS / NOTIFICATIONS / SÉCURITÉ
   À placer juste avant le bloc "ROUTEUR"
   ========================================================= */

async function ensureV2Tables(env) {

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (_) {}

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications(user_id)
    `).run();
  } catch (_) {}

  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created
      ON notifications(created_at)
    `).run();
  } catch (_) {}
}

/* =========================================================
   NOTIFICATION INTERNE
   ========================================================= */

async function createNotification(
  env,
  userId,
  type,
  title,
  message,
  entityType = null,
  entityId = null
) {
  if (!userId) return null;

  const notificationId = id("notif");

  await ensureV2Tables(env);

  await env.DB.prepare(`
    INSERT INTO notifications
    (
      id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      notificationId,
      userId,
      type,
      title,
      message,
      entityType,
      entityId
    )
    .run();

  return notificationId;
}

/* =========================================================
   V2 ROUTES
   ========================================================= */

async function handleV2Route(
  request,
  env,
  path,
  user
) {

  /* -------------------------------------------------------
     INITIALISATION TABLES V2
     ------------------------------------------------------- */

  await ensureV2Tables(env);

  /* -------------------------------------------------------
     NOTIFICATIONS — LISTE
     ------------------------------------------------------- */

  if (
    path === "/api/notifications" &&
    request.method === "GET"
  ) {

    const denied = requireAuth(user);

    if (denied) return denied;

    const result = await env.DB.prepare(`
      SELECT
        id,
        type,
        title,
        message,
        entity_type,
        entity_id,
        read_at,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `)
      .bind(user.id)
      .all();

    return json({
      ok: true,
      notifications: result.results || []
    });
  }

  /* -------------------------------------------------------
     NOTIFICATION — MARQUER COMME LUE
     ------------------------------------------------------- */

  if (
    path.startsWith("/api/notifications/") &&
    path.endsWith("/read") &&
    request.method === "POST"
  ) {

    const denied = requireAuth(user);

    if (denied) return denied;

    const parts = path.split("/");
    const notificationId =
      parts[parts.length - 2];

    const result = await env.DB.prepare(`
      UPDATE notifications
      SET read_at = ?
      WHERE id = ?
        AND user_id = ?
    `)
      .bind(
        now(),
        notificationId,
        user.id
      )
      .run();

    return json({
      ok: true,
      updated: Number(result.meta?.changes || 0)
    });
  }

  /* -------------------------------------------------------
     MISSIONS — DÉTAIL
     ------------------------------------------------------- */

  if (
    path.startsWith("/api/missions/") &&
    !path.endsWith("/status") &&
    request.method === "GET"
  ) {

    const denied = requireAuth(user);

    if (denied) return denied;

    const missionId =
      path.split("/")[3];

    const mission =
      await env.DB.prepare(`
        SELECT
          m.*,
          p.name AS prestation_name,
          c.user_id AS client_user_id,
          i.user_id AS intervenant_user_id
        FROM missions m
        JOIN prestations p
          ON p.id = m.prestation_id
        JOIN clients c
          ON c.id = m.client_id
        LEFT JOIN intervenants i
          ON i.id = m.intervenant_id
        WHERE m.id = ?
        LIMIT 1
      `)
        .bind(missionId)
        .first();

    if (!mission) {
      return json({
        ok: false,
        error: "Mission introuvable"
      }, 404);
    }

    const allowed =
      user.role === "gerante" ||
      user.role === "admin" ||
      mission.client_user_id === user.id ||
      mission.intervenant_user_id === user.id;

    if (!allowed) {
      return json({
        ok: false,
        error: "Accès non autorisé"
      }, 403);
    }

    return json({
      ok: true,
      mission
    });
  }

/* -------------------------------------------------------
   MISSION — CHANGEMENT DE STATUT
   ------------------------------------------------------- */

if (
  path.startsWith("/api/missions/") &&
  path.endsWith("/status") &&
  request.method === "POST"
) {

    const denied = requireAuth(user);

    if (denied) return denied;

    const missionId =
      path.split("/")[3];

    const data =
      await request.json();

    const newStatus =
      clean(data.status);

    const allowedStatuses = [
      "requested",
      "proposed",
      "confirmed",
      "accepted",
      "in_progress",
      "completed",
      "cancelled",
      "rejected"
    ];

    if (!allowedStatuses.includes(newStatus)) {
      return json({
        ok: false,
        error: "Statut de mission invalide"
      }, 400);
    }

    const mission =
      await env.DB.prepare(`
        SELECT
          m.*,
          c.user_id AS client_user_id,
          i.user_id AS intervenant_user_id
        FROM missions m
        JOIN clients c
          ON c.id = m.client_id
        LEFT JOIN intervenants i
          ON i.id = m.intervenant_id
        WHERE m.id = ?
        LIMIT 1
      `)
        .bind(missionId)
        .first();

    if (!mission) {
      return json({
        ok: false,
        error: "Mission introuvable"
      }, 404);
    }

    const isManager =
      user.role === "gerante" ||
      user.role === "admin";

    const isClient =
      mission.client_user_id === user.id;

    const isIntervenant =
      mission.intervenant_user_id === user.id;

    if (
      !isManager &&
      !isClient &&
      !isIntervenant
    ) {
      return json({
        ok: false,
        error: "Accès non autorisé"
      }, 403);
    }

    /* Une mission terminée ou annulée ne peut pas
       être modifiée par un utilisateur normal. */

    if (
      !isManager &&
      ["completed", "cancelled"].includes(
        mission.status
      )
    ) {
      return json({
        ok: false,
        error: "Cette mission est déjà clôturée"
      }, 409);
    }

    /* Une mission ne peut pas être confirmée deux fois. */

    if (
      newStatus === "confirmed" &&
      mission.status === "confirmed"
    ) {
      return json({
        ok: false,
        error: "Mission déjà confirmée"
      }, 409);
    }

    await env.DB.prepare(`
      UPDATE missions
      SET
        status = ?,
        updated_at = ?
      WHERE id = ?
    `)
      .bind(
        newStatus,
        now(),
        missionId
      )
      .run();

    await logAction(
      env,
      user.id,
      "MISSION_STATUS_CHANGE",
      "mission",
      missionId,
      {
        old_status: mission.status,
        new_status: newStatus
      }
    );

    /* -----------------------------------------------------
       NOTIFICATIONS
       ----------------------------------------------------- */

    const recipients = [];

    if (
      mission.client_user_id &&
      mission.client_user_id !== user.id
    ) {
      recipients.push(
        mission.client_user_id
      );
    }

    if (
      mission.intervenant_user_id &&
      mission.intervenant_user_id !== user.id
    ) {
      recipients.push(
        mission.intervenant_user_id
      );
    }

    for (const recipient of recipients) {

      await createNotification(
        env,
        recipient,
        "MISSION_STATUS",
        "Mise à jour de votre mission",
        `La mission ${missionId} est maintenant au statut : ${newStatus}.`,
        "mission",
        missionId
      );
    }

    return json({
      ok: true,
      mission_id: missionId,
      old_status: mission.status,
      status: newStatus
    });
  }

  /* -------------------------------------------------------
     MISSION — ATTRIBUTION INTERVENANT
     ------------------------------------------------------- */

  if (
    path.startsWith("/api/missions/") &&
    path.endsWith("/assign") &&
    request.method === "POST"
  ) {

    const denied = requireRole(
      user,
      ["gerante", "admin"]
    );

    if (denied) return denied;

    const missionId =
      path.split("/")[3];

    const data =
      await request.json();

    if (!data.intervenant_id) {
      return json({
        ok: false,
        error: "Intervenant obligatoire"
      }, 400);
    }

    const mission =
      await env.DB.prepare(`
        SELECT *
        FROM missions
        WHERE id = ?
        LIMIT 1
      `)
        .bind(missionId)
        .first();

    if (!mission) {
      return json({
        ok: false,
        error: "Mission introuvable"
      }, 404);
    }

    if (
      ["completed", "cancelled"].includes(
        mission.status
      )
    ) {
      return json({
        ok: false,
        error: "Mission déjà clôturée"
      }, 409);
    }

    const intervenant =
      await env.DB.prepare(`
        SELECT
          i.id,
          i.user_id,
          i.validation_status
        FROM intervenants i
        WHERE i.id = ?
        LIMIT 1
      `)
        .bind(data.intervenant_id)
        .first();

    if (!intervenant) {
      return json({
        ok: false,
        error: "Intervenant introuvable"
      }, 404);
    }

    await env.DB.prepare(`
      UPDATE missions
      SET
        intervenant_id = ?,
        status = 'proposed',
        updated_at = ?
      WHERE id = ?
    `)
      .bind(
        data.intervenant_id,
        now(),
        missionId
      )
      .run();

    await createNotification(
      env,
      intervenant.user_id,
      "MISSION_PROPOSED",
      "Nouvelle mission proposée",
      `Une nouvelle mission vous a été proposée : ${missionId}.`,
      "mission",
      missionId
    );

    await logAction(
      env,
      user.id,
      "ASSIGN_INTERVENANT",
      "mission",
      missionId,
      {
        intervenant_id:
          data.intervenant_id
      }
    );

    return json({
      ok: true,
      mission_id: missionId,
      intervenant_id:
        data.intervenant_id,
      status: "proposed"
    });
  }

  /* -------------------------------------------------------
     PAIEMENT — CRÉATION SÉCURISÉE / IDEMPOTENTE
     ------------------------------------------------------- */

  if (
    path === "/api/paiements/create" &&
    request.method === "POST"
  ) {

    const denied = requireAuth(user);

    if (denied) return denied;

    const data =
      await request.json();

    if (
      !data.mission_id ||
      data.amount === undefined
    ) {
      return json({
        ok: false,
        error: "Mission et montant obligatoires"
      }, 400);
    }

    const amount =
      Number(data.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return json({
        ok: false,
        error: "Montant invalide"
      }, 400);
    }

    /* Clé d'idempotence fournie par le frontend. */

    const idempotencyKey =
      clean(
        data.idempotency_key
      );

    if (!idempotencyKey) {
      return json({
        ok: false,
        error: "Clé d'idempotence obligatoire"
      }, 400);
    }

    const mission =
      await env.DB.prepare(`
        SELECT
          m.*,
          c.user_id AS client_user_id
        FROM missions m
        JOIN clients c
          ON c.id = m.client_id
        WHERE m.id = ?
        LIMIT 1
      `)
        .bind(data.mission_id)
        .first();

    if (!mission) {
      return json({
        ok: false,
        error: "Mission introuvable"
      }, 404);
    }

    if (
      user.role === "client" &&
      mission.client_user_id !== user.id
    ) {
      return json({
        ok: false,
        error: "Accès non autorisé"
      }, 403);
    }

    /* On utilise provider_reference comme clé
       d'idempotence tant que le vrai prestataire
       de paiement n'est pas branché. */

    const existing =
      await env.DB.prepare(`
        SELECT *
        FROM paiements
        WHERE provider_reference = ?
        LIMIT 1
      `)
        .bind(idempotencyKey)
        .first();

    if (existing) {
      return json({
        ok: true,
        duplicate: true,
        paiement: existing
      });
    }

    const paiementId =
      id("paiement");

    await env.DB.prepare(`
      INSERT INTO paiements
      (
        id,
        mission_id,
        amount,
        status,
        provider_reference
      )
      VALUES (?, ?, ?, 'pending', ?)
    `)
      .bind(
        paiementId,
        data.mission_id,
        amount,
        idempotencyKey
      )
      .run();

    await logAction(
      env,
      user.id,
      "PAYMENT_INTENT_CREATED",
      "paiement",
      paiementId
    );

    return json({
      ok: true,
      paiement_id: paiementId,
      status: "pending",
      provider: "pending_integration",
      message:
        "Paiement préparé. Le prestataire de paiement réel doit encore être connecté."
    }, 201);
  }

  /* -------------------------------------------------------
     DOCUMENT — MÉTADONNÉES SÉCURISÉES
     ------------------------------------------------------- */

  if (
    path === "/api/documents/secure" &&
    request.method === "POST"
  ) {

    const denied = requireAuth(user);

    if (denied) return denied;

    const data =
      await request.json();

    const ownerId =
      (
        user.role === "gerante" ||
        user.role === "admin"
      )
        ? data.user_id
        : user.id;

    if (
      !ownerId ||
      !data.document_type
    ) {
      return json({
        ok: false,
        error: "Utilisateur et type de document obligatoires"
      }, 400);
    }

    const documentId =
      id("doc");

    /* file_reference représente ici la future
       référence R2. Aucun fichier sensible n'est
       stocké directement dans D1. */

    const fileReference =
      clean(data.file_reference);

    if (!fileReference) {
      return json({
        ok: false,
        error:
          "Référence de stockage sécurisée obligatoire"
      }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO documents
      (
        id,
        user_id,
        document_type,
        file_reference,
        status,
        expires_at
      )
      VALUES (?, ?, ?, ?, 'pending', ?)
    `)
      .bind(
        documentId,
        ownerId,
        data.document_type,
        fileReference,
        data.expires_at || null
      )
      .run();

    await logAction(
      env,
      user.id,
      "SECURE_DOCUMENT_REGISTER",
      "document",
      documentId
    );

    return json({
      ok: true,
      document_id: documentId,
      status: "pending",
      storage: "R2_pending_integration"
    }, 201);
  }

  /* -------------------------------------------------------
     STATISTIQUES V2
     ------------------------------------------------------- */

  if (
    path === "/api/stats/production" &&
    request.method === "GET"
  ) {

    const denied = requireRole(
      user,
      ["gerante", "admin"]
    );

    if (denied) return denied;

    const missions =
      await env.DB.prepare(`
        SELECT
          status,
          COUNT(*) AS total
        FROM missions
        GROUP BY status
      `).all();

    const payments =
      await env.DB.prepare(`
        SELECT
          status,
          COUNT(*) AS total,
          COALESCE(SUM(amount), 0) AS amount
        FROM paiements
        GROUP BY status
      `).all();

    const notifications =
      await env.DB.prepare(`
        SELECT
          COUNT(*) AS total
        FROM notifications
      `).first();

    return json({
      ok: true,
      production: {
        missions:
          missions.results || [],
        paiements:
          payments.results || [],
        notifications:
          Number(notifications?.total || 0)
      }
    });
  }

  return null;
}/* =========================================================
   ROUTEUR
   ========================================================= */

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      await ensureDatabase(env);
await ensureV2Tables(env);
      const url = new URL(request.url);
      const path = url.pathname;

      const user = await authenticate(request, env);
const v2Response = await handleV2Route(
  request,
  env,
  path,
  user
);

if (v2Response) {
  return v2Response;
}
      /* =====================================================
         HEALTH
         ===================================================== */

      if (path === "/health" && request.method === "GET") {
        let database = false;

        try {
          await env.DB.prepare("SELECT 1 AS ok").first();
          database = true;
        } catch (_) {
          database = false;
        }

        return json({
          ok: true,
          database,
          service: "PROCHÉLIA API",
          version: "1.0.0",
          timestamp: now()
        });
      }

      if (path === "/" && request.method === "GET") {
        return json({
          ok: true,
          service: "PROCHÉLIA API",
          version: "1.0.0",
          status: "online"
        });
      }

      /* =====================================================
         PRESTATIONS
         ===================================================== */

      if (
        path === "/api/prestations" &&
        request.method === "GET"
      ) {
        const result = await env.DB.prepare(`
          SELECT
            id,
            name,
            description,
            active
          FROM prestations
          WHERE active = 1
          ORDER BY name
        `).all();

        return json({
          ok: true,
          prestations: result.results || []
        });
      }

      if (
        path === "/api/prestations" &&
        request.method === "POST"
      ) {
        const denied = requireRole(
          user,
          ["gerante", "admin"]
        );

        if (denied) return denied;

        const data = await request.json();

        const prestationId = id("prest");

        await env.DB.prepare(`
          INSERT INTO prestations
          (
            id,
            name,
            description,
            active
          )
          VALUES (?, ?, ?, ?)
        `)
          .bind(
            prestationId,
            clean(data.name),
            clean(data.description) || null,
            data.active === false ? 0 : 1
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_PRESTATION",
          "prestation",
          prestationId,
          data
        );

        return json({
          ok: true,
          prestation_id: prestationId
        }, 201);
      }

      /* =====================================================
         INSCRIPTION
         ===================================================== */

      if (
        path === "/api/register" &&
        request.method === "POST"
      ) {
        const data = await request.json();

        const email = clean(data.email)?.toLowerCase();
        const password = data.password;
        const firstName = clean(data.first_name);
        const lastName = clean(data.last_name);
        const phone = clean(data.phone) || null;

        if (
          !email ||
          !password ||
          !firstName ||
          !lastName
        ) {
          return json({
            ok: false,
            error: "Champs obligatoires manquants"
          }, 400);
        }

        if (password.length < 8) {
          return json({
            ok: false,
            error: "Le mot de passe doit contenir au moins 8 caractères"
          }, 400);
        }

        const role =
          data.role === "intervenant"
            ? "intervenant"
            : "client";

        const existing = await env.DB.prepare(`
          SELECT id
          FROM users
          WHERE email = ?
          LIMIT 1
        `)
          .bind(email)
          .first();

        if (existing) {
          return json({
            ok: false,
            error: "Cette adresse e-mail est déjà utilisée"
          }, 409);
        }

        const passwordData =
          await hashPassword(password);

        const passwordHash =
          `${passwordData.salt}:${passwordData.hash}`;

        const userId = id("user");

        await env.DB.prepare(`
          INSERT INTO users
          (
            id,
            role,
            email,
            first_name,
            last_name,
            phone,
            status,
            password_hash
          )
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
        `)
          .bind(
            userId,
            role,
            email,
            firstName,
            lastName,
            phone,
            passwordHash
          )
          .run();

        if (role === "client") {
          await env.DB.prepare(`
            INSERT INTO clients
            (
              id,
              user_id
            )
            VALUES (?, ?)
          `)
            .bind(
              id("client"),
              userId
            )
            .run();
        }

        if (role === "intervenant") {
          await env.DB.prepare(`
            INSERT INTO intervenants
            (
              id,
              user_id,
              professional_status,
              description,
              service_area,
              hourly_rate,
              validation_status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
          `)
            .bind(
              id("intervenant"),
              userId,
              clean(data.professional_status) || null,
              clean(data.description) || null,
              clean(data.service_area) || null,
              Number(data.hourly_rate) || 0
            )
            .run();
        }

        await logAction(
          env,
          userId,
          "REGISTER",
          "user",
          userId,
          {
            role,
            email
          }
        );

        return json({
          ok: true,
          user: {
            id: userId,
            role,
            email,
            first_name: firstName,
            last_name: lastName
          }
        }, 201);
      }

      /* =====================================================
         CONNEXION
         ===================================================== */

      if (
        path === "/api/login" &&
        request.method === "POST"
      ) {
        const data = await request.json();

        const email =
          clean(data.email)?.toLowerCase();

        const password =
          data.password;

        if (!email || !password) {
          return json({
            ok: false,
            error: "E-mail et mot de passe obligatoires"
          }, 400);
        }

        const account =
          await env.DB.prepare(`
            SELECT *
            FROM users
            WHERE email = ?
            LIMIT 1
          `)
            .bind(email)
            .first();

        if (!account) {
          return json({
            ok: false,
            error: "Identifiants incorrects"
          }, 401);
        }

        if (account.status === "blocked") {
          return json({
            ok: false,
            error: "Compte bloqué"
          }, 403);
        }

        const valid =
          await verifyPassword(
            password,
            account.password_hash
          );

        if (!valid) {
          return json({
            ok: false,
            error: "Identifiants incorrects"
          }, 401);
        }

        const sessionToken =
          `${crypto.randomUUID()}${crypto.randomUUID()}`;

        const tokenHash =
          await hashToken(sessionToken);

        const sessionId =
          id("session");

        const expiresAt =
          new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 30
          ).toISOString();

        await env.DB.prepare(`
          INSERT INTO sessions
          (
            id,
            user_id,
            token_hash,
            expires_at
          )
          VALUES (?, ?, ?, ?)
        `)
          .bind(
            sessionId,
            account.id,
            tokenHash,
            expiresAt
          )
          .run();

        await logAction(
          env,
          account.id,
          "LOGIN",
          "user",
          account.id
        );

        return json({
          ok: true,
          token: sessionToken,
          expires_at: expiresAt,
          user: safeUser(account)
        });
      }

      /* =====================================================
         ME
         ===================================================== */

      if (
        path === "/api/me" &&
        request.method === "GET"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        return json({
          ok: true,
          user: safeUser(user)
        });
      }

      /* =====================================================
         CLIENTS
         ===================================================== */

      if (
        path === "/api/clients" &&
        request.method === "GET"
      ) {
        const denied = requireRole(
          user,
          ["gerante", "admin", "intervenant"]
        );

        if (denied) return denied;

        const result = await env.DB.prepare(`
          SELECT
            c.id AS client_id,
            c.user_id,
            c.address,
            c.city,
            c.postal_code,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.status
          FROM clients c
          JOIN users u ON u.id = c.user_id
          ORDER BY u.last_name, u.first_name
        `).all();

        return json({
          ok: true,
          clients: result.results || []
        });
      }

      /* =====================================================
         INTERVENANTS
         ===================================================== */

      if (
        path === "/api/intervenants" &&
        request.method === "GET"
      ) {
        const result = await env.DB.prepare(`
          SELECT
            i.id AS intervenant_id,
            i.user_id,
            i.professional_status,
            i.description,
            i.service_area,
            i.hourly_rate,
            i.validation_status,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.status
          FROM intervenants i
          JOIN users u ON u.id = i.user_id
          WHERE u.status != 'blocked'
          ORDER BY u.last_name, u.first_name
        `).all();

        return json({
          ok: true,
          intervenants: result.results || []
        });
      }

      /* =====================================================
         MISSIONS - LISTE
         ===================================================== */

      if (
        path === "/api/missions" &&
        request.method === "GET"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        let query = `
          SELECT
            m.*,
            p.name AS prestation_name
          FROM missions m
          JOIN prestations p
            ON p.id = m.prestation_id
        `;

        let params = [];

        if (user.role === "client") {
          query += `
            WHERE m.client_id = (
              SELECT id
              FROM clients
              WHERE user_id = ?
            )
          `;

          params.push(user.id);
        }

        if (user.role === "intervenant") {
          query += `
            WHERE m.intervenant_id = (
              SELECT id
              FROM intervenants
              WHERE user_id = ?
            )
          `;

          params.push(user.id);
        }

        query += `
          ORDER BY m.start_at DESC
        `;

        const result =
          await env.DB.prepare(query)
            .bind(...params)
            .all();

        return json({
          ok: true,
          missions: result.results || []
        });
      }

      /* =====================================================
         MISSIONS - CREATION
         ===================================================== */

      if (
        path === "/api/missions" &&
        request.method === "POST"
      ) {
        const denied = requireRole(
          user,
          ["client", "gerante", "admin"]
        );

        if (denied) return denied;

        const data = await request.json();

        let clientId = data.client_id;

        if (user.role === "client") {
          const client =
            await env.DB.prepare(`
              SELECT id
              FROM clients
              WHERE user_id = ?
              LIMIT 1
            `)
              .bind(user.id)
              .first();

          if (!client) {
            return json({
              ok: false,
              error: "Profil client introuvable"
            }, 404);
          }

          clientId = client.id;
        }

        if (
          !clientId ||
          !data.prestation_id ||
          !data.start_at
        ) {
          return json({
            ok: false,
            error: "Client, prestation et date de mission obligatoires"
          }, 400);
        }

        const missionId =
          id("mission");

        const priceClient =
          Number(data.price_client) || 0;

        const priceIntervenant =
          Number(data.price_intervenant) || 0;

        const commission =
          data.commission !== undefined
            ? Number(data.commission)
            : Math.max(
                0,
                priceClient - priceIntervenant
              );

        await env.DB.prepare(`
          INSERT INTO missions
          (
            id,
            client_id,
            intervenant_id,
            prestation_id,
            start_at,
            end_at,
            address,
            price_client,
            price_intervenant,
            commission,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            missionId,
            clientId,
            data.intervenant_id || null,
            data.prestation_id,
            data.start_at,
            data.end_at || null,
            clean(data.address) || null,
            priceClient,
            priceIntervenant,
            commission,
            data.status || "requested"
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_MISSION",
          "mission",
          missionId,
          data
        );

        return json({
          ok: true,
          mission_id: missionId,
          status: data.status || "requested"
        }, 201);
      }

      /* =====================================================
         TARIFS
         ===================================================== */

      if (
        path === "/api/tarifs" &&
        request.method === "GET"
      ) {
        const result = await env.DB.prepare(`
          SELECT
            t.*,
            p.name AS prestation_name
          FROM tarifs t
          JOIN prestations p
            ON p.id = t.prestation_id
          WHERE t.active = 1
          ORDER BY p.name, t.type
        `).all();

        return json({
          ok: true,
          tarifs: result.results || []
        });
      }

      if (
        path === "/api/tarifs" &&
        request.method === "POST"
      ) {
        const denied = requireRole(
          user,
          ["gerante", "admin"]
        );

        if (denied) return denied;

        const data = await request.json();

        if (
          !data.prestation_id ||
          !data.type
        ) {
          return json({
            ok: false,
            error: "Prestation et type de tarif obligatoires"
          }, 400);
        }

        if (
          !["habituel", "fidelite", "negocie"]
            .includes(data.type)
        ) {
          return json({
            ok: false,
            error: "Type de tarif invalide"
          }, 400);
        }

        const tarifId =
          id("tarif");

        await env.DB.prepare(`
          INSERT INTO tarifs
          (
            id,
            prestation_id,
            type,
            client_price,
            intervenant_price,
            commission,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `)
          .bind(
            tarifId,
            data.prestation_id,
            data.type,
            Number(data.client_price) || 0,
            Number(data.intervenant_price) || 0,
            Number(data.commission) || 0
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_TARIF",
          "tarif",
          tarifId,
          data
        );

        return json({
          ok: true,
          tarif_id: tarifId
        }, 201);
      }

      /* =====================================================
         DISPONIBILITES
         ===================================================== */

      if (
        path === "/api/disponibilites" &&
        request.method === "GET"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        let intervenantId =
          new URL(request.url)
            .searchParams
            .get("intervenant_id");

        if (user.role === "intervenant") {
          const intervenant =
            await env.DB.prepare(`
              SELECT id
              FROM intervenants
              WHERE user_id = ?
              LIMIT 1
            `)
              .bind(user.id)
              .first();

          if (!intervenant) {
            return json({
              ok: false,
              error: "Profil intervenant introuvable"
            }, 404);
          }

          intervenantId = intervenant.id;
        }

        let result;

        if (intervenantId) {
          result = await env.DB.prepare(`
            SELECT *
            FROM disponibilites
            WHERE intervenant_id = ?
            ORDER BY start_at
          `)
            .bind(intervenantId)
            .all();
        } else {
          result = await env.DB.prepare(`
            SELECT *
            FROM disponibilites
            ORDER BY start_at
          `).all();
        }

        return json({
          ok: true,
          disponibilites: result.results || []
        });
      }

      if (
        path === "/api/disponibilites" &&
        request.method === "POST"
      ) {
        const denied = requireRole(
          user,
          ["intervenant", "gerante", "admin"]
        );

        if (denied) return denied;

        const data = await request.json();

        let intervenantId =
          data.intervenant_id;

        if (user.role === "intervenant") {
          const intervenant =
            await env.DB.prepare(`
              SELECT id
              FROM intervenants
              WHERE user_id = ?
              LIMIT 1
            `)
              .bind(user.id)
              .first();

          if (!intervenant) {
            return json({
              ok: false,
              error: "Profil intervenant introuvable"
            }, 404);
          }

          intervenantId = intervenant.id;
        }

        if (
          !intervenantId ||
          !data.start_at ||
          !data.end_at
        ) {
          return json({
            ok: false,
            error: "Intervenant, début et fin obligatoires"
          }, 400);
        }

        const availabilityId =
          id("disp");

        await env.DB.prepare(`
          INSERT INTO disponibilites
          (
            id,
            intervenant_id,
            start_at,
            end_at,
            status
          )
          VALUES (?, ?, ?, ?, ?)
        `)
          .bind(
            availabilityId,
            intervenantId,
            data.start_at,
            data.end_at,
            data.status || "available"
          )
          .run();

        return json({
          ok: true,
          disponibilite_id: availabilityId
        }, 201);
      }

      /* =====================================================
         EVALUATIONS
         ===================================================== */

      if (
        path === "/api/evaluations" &&
        request.method === "POST"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        const data = await request.json();

        const rating =
          Number(data.rating);

        if (
          !data.mission_id ||
          !data.target_user_id ||
          !rating ||
          rating < 1 ||
          rating > 5
        ) {
          return json({
            ok: false,
            error: "Mission, destinataire et note de 1 à 5 obligatoires"
          }, 400);
        }

        const mission =
          await env.DB.prepare(`
            SELECT *
            FROM missions
            WHERE id = ?
            LIMIT 1
          `)
            .bind(data.mission_id)
            .first();

        if (!mission) {
          return json({
            ok: false,
            error: "Mission introuvable"
          }, 404);
        }

        const evaluationId =
          id("eval");

        await env.DB.prepare(`
          INSERT INTO evaluations
          (
            id,
            mission_id,
            author_user_id,
            target_user_id,
            rating,
            comment
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
          .bind(
            evaluationId,
            data.mission_id,
            user.id,
            data.target_user_id,
            rating,
            clean(data.comment) || null
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_EVALUATION",
          "evaluation",
          evaluationId
        );

        return json({
          ok: true,
          evaluation_id: evaluationId
        }, 201);
      }

      /* =====================================================
         PAIEMENTS
         ===================================================== */

      if (
        path === "/api/paiements" &&
        request.method === "POST"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        const data = await request.json();

        if (!data.mission_id || data.amount === undefined) {
          return json({
            ok: false,
            error: "Mission et montant obligatoires"
          }, 400);
        }

        const mission =
          await env.DB.prepare(`
            SELECT *
            FROM missions
            WHERE id = ?
            LIMIT 1
          `)
            .bind(data.mission_id)
            .first();

        if (!mission) {
          return json({
            ok: false,
            error: "Mission introuvable"
          }, 404);
        }

        const paiementId =
          id("paiement");

        await env.DB.prepare(`
          INSERT INTO paiements
          (
            id,
            mission_id,
            amount,
            status,
            provider_reference
          )
          VALUES (?, ?, ?, 'pending', ?)
        `)
          .bind(
            paiementId,
            data.mission_id,
            Number(data.amount),
            data.provider_reference || null
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_PAYMENT",
          "paiement",
          paiementId
        );

        return json({
          ok: true,
          paiement_id: paiementId,
          status: "pending"
        }, 201);
      }

      /* =====================================================
         DOCUMENTS
         ===================================================== */

      if (
        path === "/api/documents" &&
        request.method === "GET"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        let userId =
          new URL(request.url)
            .searchParams
            .get("user_id");

        if (
          user.role !== "gerante" &&
          user.role !== "admin"
        ) {
          userId = user.id;
        }

        const result =
          await env.DB.prepare(`
            SELECT
              id,
              user_id,
              document_type,
              file_reference,
              status,
              expires_at,
              created_at
            FROM documents
            WHERE user_id = ?
            ORDER BY created_at DESC
          `)
            .bind(userId)
            .all();

        return json({
          ok: true,
          documents: result.results || []
        });
      }

      if (
        path === "/api/documents" &&
        request.method === "POST"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        const data = await request.json();

        const documentId =
          id("doc");

        const userId =
          (
            user.role === "gerante" ||
            user.role === "admin"
          )
            ? data.user_id
            : user.id;

        if (
          !userId ||
          !data.document_type ||
          !data.file_reference
        ) {
          return json({
            ok: false,
            error: "Utilisateur, type et référence du document obligatoires"
          }, 400);
        }

        await env.DB.prepare(`
          INSERT INTO documents
          (
            id,
            user_id,
            document_type,
            file_reference,
            status,
            expires_at
          )
          VALUES (?, ?, ?, ?, 'pending', ?)
        `)
          .bind(
            documentId,
            userId,
            data.document_type,
            data.file_reference,
            data.expires_at || null
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_DOCUMENT",
          "document",
          documentId
        );

        return json({
          ok: true,
          document_id: documentId
        }, 201);
      }

      /* =====================================================
         CONFLITS
         ===================================================== */

      if (
        path === "/api/conflits" &&
        request.method === "GET"
      ) {
        const denied = requireRole(
          user,
          ["gerante", "admin"]
        );

        if (denied) return denied;

        const result =
          await env.DB.prepare(`
            SELECT
              c.*,
              m.start_at,
              m.status AS mission_status
            FROM conflits c
            JOIN missions m
              ON m.id = c.mission_id
            ORDER BY c.created_at DESC
          `).all();

        return json({
          ok: true,
          conflits: result.results || []
        });
      }

      if (
        path === "/api/conflits" &&
        request.method === "POST"
      ) {
        const denied = requireAuth(user);

        if (denied) return denied;

        const data = await request.json();

        if (
          !data.mission_id ||
          !data.type
        ) {
          return json({
            ok: false,
            error: "Mission et type de conflit obligatoires"
          }, 400);
        }

        const conflitId =
          id("conflit");

        await env.DB.prepare(`
          INSERT INTO conflits
          (
            id,
            mission_id,
            type,
            description,
            status
          )
          VALUES (?, ?, ?, ?, 'open')
        `)
          .bind(
            conflitId,
            data.mission_id,
            data.type,
            clean(data.description) || null
          )
          .run();

        await logAction(
          env,
          user.id,
          "CREATE_CONFLICT",
          "conflit",
          conflitId
        );

        return json({
          ok: true,
          conflit_id: conflitId
        }, 201);
      }

      /* =====================================================
         STATISTIQUES
         ===================================================== */

      if (
        path === "/api/stats" &&
        request.method === "GET"
      ) {
        const denied = requireRole(
          user,
          ["gerante", "admin"]
        );

        if (denied) return denied;

        const users =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS total
            FROM users
          `).first();

        const clients =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS total
            FROM clients
          `).first();

        const intervenants =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS total
            FROM intervenants
          `).first();

        const missions =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS total
            FROM missions
          `).first();

        const missionsPending =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS total
            FROM missions
            WHERE status = 'requested'
          `).first();

        const missionsConfirmed =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS total
            FROM missions
            WHERE status IN ('confirmed', 'completed')
          `).first();

        const revenue =
          await env.DB.prepare(`
            SELECT
              COALESCE(SUM(price_client), 0) AS total
            FROM missions
            WHERE status != 'cancelled'
          `).first();

        const commissions =
          await env.DB.prepare(`
            SELECT
              COALESCE(SUM(commission), 0) AS total
            FROM missions
            WHERE status != 'cancelled'
          `).first();

        return json({
          ok: true,
          stats: {
            users: Number(users?.total || 0),
            clients: Number(clients?.total || 0),
            intervenants: Number(intervenants?.total || 0),
            missions: Number(missions?.total || 0),
            missions_pending: Number(
              missionsPending?.total || 0
            ),
            missions_confirmed: Number(
              missionsConfirmed?.total || 0
            ),
            chiffre_affaires: Number(
              revenue?.total || 0
            ),
            commissions: Number(
              commissions?.total || 0
            )
          }
        });
      }
if (path.startsWith("/api/v7/")) {
  return await handleV7Route(request, env, path);
}
      /* =====================================================
         ROUTE INCONNUE
         ===================================================== */

      return json({
        ok: false,
        error: "Route API inconnue",
        path
      }, 404);

    } catch (error) {
      return json({
        ok: false,
        error: error?.message || "Erreur serveur"
      }, 500);
    }
  }
};
