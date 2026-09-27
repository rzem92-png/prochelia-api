const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

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

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (!env.DB) {
      return json({
        ok: false,
        database: false,
        message: "D1 non connectée"
      }, 500);
    }

    try {

      /* =========================
         SANTÉ API + D1
      ========================= */

      if (path === "/health") {
        const result = await env.DB
          .prepare("SELECT 1 AS ok")
          .first();

        return json({
          ok: true,
          database: result?.ok === 1,
          service: "PROCHÉLIA API"
        });
      }


      /* =========================
         PRESTATIONS
      ========================= */

      if (path === "/api/prestations" && request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT id, name, description, active
            FROM prestations
            WHERE active = 1
            ORDER BY name
          `)
          .all();

        return json({
          ok: true,
          prestations: results
        });
      }


      if (path === "/api/prestations" && request.method === "POST") {

        const data = await body(request);

        if (!data.name) {
          return json({
            ok: false,
            message: "Le nom de la prestation est obligatoire"
          }, 400);
        }

        const prestationId = id("prest");

        await env.DB
          .prepare(`
            INSERT INTO prestations
            (id, name, description, active)
            VALUES (?, ?, ?, 1)
          `)
          .bind(
            prestationId,
            data.name,
            data.description || null
          )
          .run();

        return json({
          ok: true,
          id: prestationId
        }, 201);
      }


      /* =========================
         UTILISATEURS
      ========================= */

      if (path === "/api/users" && request.method === "POST") {

        const data = await body(request);

        if (!data.email || !data.first_name || !data.last_name || !data.role) {
          return json({
            ok: false,
            message: "Nom, prénom, email et rôle sont obligatoires"
          }, 400);
        }

        const userId = id("user");

        await env.DB
          .prepare(`
            INSERT INTO users
            (id, role, email, first_name, last_name, phone, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
          `)
          .bind(
            userId,
            data.role,
            data.email,
            data.first_name,
            data.last_name,
            data.phone || null
          )
          .run();

        await env.DB
          .prepare(`
            INSERT INTO journal
            (id, user_id, action, entity_type, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .bind(
            id("log"),
            userId,
            "CREATE_USER",
            "users",
            userId,
            JSON.stringify({
              role: data.role,
              email: data.email
            })
          )
          .run();

        return json({
          ok: true,
          user: {
            id: userId,
            role: data.role,
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name
          }
        }, 201);
      }


      if (path === "/api/users" && request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT id, role, email, first_name, last_name,
                   phone, status, created_at
            FROM users
            ORDER BY created_at DESC
          `)
          .all();

        return json({
          ok: true,
          users: results
        });
      }


      /* =========================
         CLIENTS
      ========================= */

      if (path === "/api/clients" && request.method === "POST") {

        const data = await body(request);

        if (!data.user_id) {
          return json({
            ok: false,
            message: "user_id obligatoire"
          }, 400);
        }

        const clientId = id("client");

        await env.DB
          .prepare(`
            INSERT INTO clients
            (id, user_id, address, city, postal_code, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .bind(
            clientId,
            data.user_id,
            data.address || null,
            data.city || null,
            data.postal_code || null,
            data.notes || null
          )
          .run();

        return json({
          ok: true,
          client_id: clientId
        }, 201);
      }


      /* =========================
         INTERVENANTS
      ========================= */

      if (path === "/api/intervenants" && request.method === "POST") {

        const data = await body(request);

        if (!data.user_id) {
          return json({
            ok: false,
            message: "user_id obligatoire"
          }, 400);
        }

        const intervenantId = id("inter");

        await env.DB
          .prepare(`
            INSERT INTO intervenants
            (id, user_id, professional_status, description,
             service_area, hourly_rate, validation_status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
          `)
          .bind(
            intervenantId,
            data.user_id,
            data.professional_status || null,
            data.description || null,
            data.service_area || null,
            data.hourly_rate || null
          )
          .run();

        return json({
          ok: true,
          intervenant_id: intervenantId
        }, 201);
      }


      if (path === "/api/intervenants" && request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT
              i.id,
              i.user_id,
              u.first_name,
              u.last_name,
              u.email,
              u.phone,
              i.professional_status,
              i.description,
              i.service_area,
              i.hourly_rate,
              i.validation_status
            FROM intervenants i
            JOIN users u ON u.id = i.user_id
            ORDER BY u.last_name, u.first_name
          `)
          .all();

        return json({
          ok: true,
          intervenants: results
        });
      }


      /* =========================
         TARIFS
      ========================= */

      if (path === "/api/tarifs" && request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT
              t.*,
              p.name AS prestation_name
            FROM tarifs t
            JOIN prestations p ON p.id = t.prestation_id
            WHERE t.active = 1
            ORDER BY p.name, t.type
          `)
          .all();

        return json({
          ok: true,
          tarifs: results
        });
      }


      if (path === "/api/tarifs" && request.method === "POST") {

        const data = await body(request);

        if (
          !data.prestation_id ||
          !data.type ||
          data.client_price === undefined ||
          data.intervenant_price === undefined
        ) {
          return json({
            ok: false,
            message: "Données tarifaires incomplètes"
          }, 400);
        }

        const tarifId = id("tarif");

        const commission =
          Number(data.client_price) -
          Number(data.intervenant_price);

        await env.DB
          .prepare(`
            INSERT INTO tarifs
            (id, prestation_id, type, client_price,
             intervenant_price, commission, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `)
          .bind(
            tarifId,
            data.prestation_id,
            data.type,
            Number(data.client_price),
            Number(data.intervenant_price),
            commission
          )
          .run();

        return json({
          ok: true,
          tarif_id: tarifId,
          commission
        }, 201);
      }


      /* =========================
         MISSIONS
      ========================= */

      if (path === "/api/missions" && request.method === "POST") {

        const data = await body(request);

        if (
          !data.client_id ||
          !data.prestation_id ||
          !data.start_at
        ) {
          return json({
            ok: false,
            message: "Client, prestation et date/heure obligatoires"
          }, 400);
        }

        const missionId = id("mission");

        await env.DB
          .prepare(`
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')
          `)
          .bind(
            missionId,
            data.client_id,
            data.intervenant_id || null,
            data.prestation_id,
            data.start_at,
            data.end_at || null,
            data.address || null,
            Number(data.price_client || 0),
            Number(data.price_intervenant || 0),
            Number(data.commission || 0)
          )
          .run();

        return json({
          ok: true,
          mission_id: missionId,
          status: "requested"
        }, 201);
      }


      if (path === "/api/missions" && request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT
              m.*,
              p.name AS prestation_name
            FROM missions m
            JOIN prestations p
              ON p.id = m.prestation_id
            ORDER BY m.start_at DESC
          `)
          .all();

        return json({
          ok: true,
          missions: results
        });
      }


      /* =========================
         DISPONIBILITÉS
      ========================= */

      if (path === "/api/disponibilites" && request.method === "POST") {

        const data = await body(request);

        if (
          !data.intervenant_id ||
          !data.start_at ||
          !data.end_at
        ) {
          return json({
            ok: false,
            message: "Intervenant, début et fin obligatoires"
          }, 400);
        }

        const availabilityId = id("disp");

        await env.DB
          .prepare(`
            INSERT INTO disponibilites
            (id, intervenant_id, start_at, end_at, status)
            VALUES (?, ?, ?, ?, 'available')
          `)
          .bind(
            availabilityId,
            data.intervenant_id,
            data.start_at,
            data.end_at
          )
          .run();

        return json({
          ok: true,
          disponibilite_id: availabilityId
        }, 201);
      }


      /* =========================
         ÉVALUATIONS
      ========================= */

      if (path === "/api/evaluations" && request.method === "POST") {

        const data = await body(request);

        if (
          !data.mission_id ||
          !data.author_user_id ||
          !data.target_user_id ||
          !data.rating
        ) {
          return json({
            ok: false,
            message: "Évaluation incomplète"
          }, 400);
        }

        const evaluationId = id("eval");

        await env.DB
          .prepare(`
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
            data.author_user_id,
            data.target_user_id,
            Number(data.rating),
            data.comment || null
          )
          .run();

        return json({
          ok: true,
          evaluation_id: evaluationId
        }, 201);
      }


      /* =========================
         CONFLITS
      ========================= */

      if (path === "/api/conflits" && request.method === "POST") {

        const data = await body(request);

        if (!data.mission_id || !data.type) {
          return json({
            ok: false,
            message: "Mission et type de conflit obligatoires"
          }, 400);
        }

        const conflitId = id("conflict");

        await env.DB
          .prepare(`
            INSERT INTO conflits
            (id, mission_id, type, description, status)
            VALUES (?, ?, ?, ?, 'open')
          `)
          .bind(
            conflitId,
            data.mission_id,
            data.type,
            data.description || null
          )
          .run();

        return json({
          ok: true,
          conflit_id: conflitId,
          status: "open"
        }, 201);
      }


      /* =========================
         PAIEMENTS
      ========================= */

      if (path === "/api/paiements" && request.method === "POST") {

        const data = await body(request);

        if (!data.mission_id || data.amount === undefined) {
          return json({
            ok: false,
            message: "Mission et montant obligatoires"
          }, 400);
        }

        const paiementId = id("pay");

        await env.DB
          .prepare(`
            INSERT INTO paiements
            (id, mission_id, amount, status)
            VALUES (?, ?, ?, 'pending')
          `)
          .bind(
            paiementId,
            data.mission_id,
            Number(data.amount)
          )
          .run();

        return json({
          ok: true,
          paiement_id: paiementId,
          status: "pending"
        }, 201);
      }


      /* =========================
         ROUTE INCONNUE
      ========================= */

      return json({
        ok: false,
        message: "Route API inconnue",
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
