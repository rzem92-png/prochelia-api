import { evaluateSupraActionPolicy } from "./supra-action-policy.mjs";
import { handleV7Route } from "./v7-routes.js";
import { handleSupraRoute } from "./supra-api.js";
import { resolveTenantContext, tenantRoleAllowed, listTenantMemberships } from "./tenant-context.js";
import { handleSupraApprovalRoute } from "./supra-approvals.js";
import { handleDeviceTrustRoute } from "./device-trust.js";
import { handleAccountingRoute } from "./accounting-api.js";
// PROCHÉLIA — INDEX BACKEND CONSOLIDÉ UNIQUE
// Référence de consolidation : V14.1 Finance + sécurité/RBAC existants.
// Généré le 19/10/2026. À déployer uniquement après recette avec la vraie base D1.
// Les écritures de missions restent volontairement désactivées tant que la chaîne
// authentification/RBAC/idempotence/contrôles métier n'a pas été validée.

const VERSION = 'V14.3.0-PREPRODUCTION-2026-10-19';
const SECURITY_CODE_TTL_SECONDS = 15 * 60;
const SECURITY_MAX_ATTEMPTS = 5;
const SECURITY_LOCK_SECONDS = 15 * 60;
const SESSION_COOKIE = 'prochelia_session';
const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

async function readLimitedJson(request, maxBytes = 4096) {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail(value) {
  return clean(value)?.toLowerCase() || '';
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 10 && password.length <= 200;
}

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function sha256Base64url(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

async function hmacSha256Base64url(secret, value) {
  if (typeof secret !== 'string' || !secret) throw new Error('HMAC_SECRET_REQUIRED');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64url(new Uint8Array(signature));
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
    const salt = fromBase64url(parts[2]);
    const expected = fromBase64url(parts[3]);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      expected.length * 8
    );
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      // Malformed cookie values are untrusted input and must fail closed.
      return null;
    }
  }
  return null;
}

function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None`;
}

async function createSession(env, userId) {
  const token = base64url(randomBytes(32));
  const tokenHash = await sha256Base64url(token);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', ?))`
  ).bind(id, userId, tokenHash, `+${SESSION_TTL_SECONDS} seconds`).run();
  return token;
}

export async function getSessionUser(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Base64url(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.role, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at, u.updated_at,
            s.id AS session_id, s.active_tenant_id AS session_active_tenant_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > CURRENT_TIMESTAMP
        AND s.revoked_at IS NULL
      LIMIT 1`
  ).bind(tokenHash).first();
  if (!row) return null;
  if (row.status !== 'active') return null;
  return { user: safeUser(row), session_id: row.session_id, session_active_tenant_id: row.session_active_tenant_id || null, token_hash: tokenHash };
}

function requireRole(auth, roles) {
  if (!auth?.user) return false;
  return roles.includes(auth.user.role);
}

async function getPrestations(env) {
  if (!env.DB) return json({ ok: false, database: false, message: 'D1 non connectée' }, 503);
  const result = await env.DB.prepare('SELECT * FROM prestations ORDER BY id').all();
  return json({ ok: true, source: 'D1', total: result.results?.length || 0, prestations: result.results || [] });
}

async function health(env) {
  if (!env.DB) return json({ ok: false, database: false, service: 'PROCHÉLIA API', version: VERSION }, 503);
  const result = await env.DB.prepare('SELECT 1 AS ok').first();
  return json({ ok: true, database: result?.ok === 1, service: 'PROCHÉLIA API', version: VERSION });
}

async function coreAccountsSchema(env) {
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);
  const tables = ['users', 'clients', 'intervenants', 'sessions', 'disponibilites'];
  const results = {};
  for (const table of tables) {
    const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=? LIMIT 1;").bind(table).first();
    let total = 0;
    if (row?.sql) {
      const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table};`).first();
      total = Number(count?.total || 0);
    }
    results[table] = { exists: !!row?.sql, create_sql: row?.sql || null, total_rows: total };
  }
  return json({
    ok: true,
    source: 'D1',
    version: VERSION,
    mode: 'READ_ONLY_SCHEMA_AUDIT',
    writes: false,
    tables: results,
    note: 'Audit structurel uniquement : aucune donnée utilisateur ni aucun secret n’est renvoyé.'
  });
}

async function missionsSchema(env) {
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);
  const row = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='missions';").first();
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM missions;').first();
  return json({
    ok: true, source: 'D1', version: VERSION, table: 'missions', exists: !!row?.sql,
    create_sql: row?.sql || null, total_rows: Number(count?.total || 0),
    write_enabled: false, post_missions: 'DISABLED',
    note: 'Lecture seule tant que l’authentification/RBAC serveur n’est pas configurée.'
  });
}

function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['JSON_BODY_REQUIRED'];
  if (!clean(body.id)) errors.push('id_required');
  if (!clean(body.client_id)) errors.push('client_id_required');
  if (!clean(body.prestation_id)) errors.push('prestation_id_required');
  if (!clean(body.start_at)) errors.push('start_at_required');
  if (body.end_at != null && !clean(body.end_at)) errors.push('end_at_invalid');
  for (const field of ['price_client', 'price_intervenant', 'commission']) {
    if (body[field] != null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) errors.push(field + '_invalid');
  }
  return errors;
}

async function validateMission(env, body) {
  const errors = validatePayload(body);
  if (errors.length) return json({ ok: false, error: 'VALIDATION_ERROR', errors, version: VERSION }, 400);
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);

  const prestation = await env.DB.prepare('SELECT id, active FROM prestations WHERE id = ? LIMIT 1').bind(String(body.prestation_id)).first();
  if (!prestation) errors.push('prestation_not_found');
  else if (Number(prestation.active) !== 1) errors.push('prestation_inactive');

  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? LIMIT 1').bind(String(body.client_id)).first();

  if (!client) errors.push('client_not_found');

  if (body.intervenant_id) {
    const intervenant = await env.DB.prepare('SELECT id FROM intervenants WHERE id = ? LIMIT 1').bind(String(body.intervenant_id)).first();
    if (!intervenant) errors.push('intervenant_not_found');
  }

  const existing = await env.DB.prepare('SELECT id FROM missions WHERE id = ? LIMIT 1').bind(String(body.id)).first();
  if (existing) errors.push('mission_id_already_exists');

  return json({
    ok: errors.length === 0,
    version: VERSION,
    mode: 'READ_ONLY_VALIDATION',
    write_enabled: false,
    errors,
    normalized: errors.length === 0 ? {
      id: String(body.id), client_id: String(body.client_id), intervenant_id: body.intervenant_id ? String(body.intervenant_id) : null,
      prestation_id: String(body.prestation_id), start_at: String(body.start_at), end_at: body.end_at ? String(body.end_at) : null,
      address: body.address ? String(body.address) : null,
      price_client: Number(body.price_client || 0), price_intervenant: Number(body.price_intervenant || 0),
      commission: Number(body.commission || 0), status: 'requested'
    } : null
  }, errors.length ? 409 : 200);
}

async function postMissions(request, env) {
  const body = await readJson(request);
  return json({
    ok: false,
    error: env.MISSION_API_ENABLED === 'true' ? 'WRITE_GATE_NOT_ACTIVATED' : 'MISSION_API_NOT_ACTIVATED',
    version: VERSION,
    write_enabled: false,
    reason: 'POST /api/missions reste désactivé jusqu’à validation complète de l’authentification/RBAC, de l’idempotence et des contrôles métier.',
    next: '/api/missions/validate'
  }, 503);
}

async function login(request, env) {
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = body?.password;
  if (!validEmail(email) || !validPassword(password)) {
    return json({ ok: false, error: 'INVALID_CREDENTIALS', version: VERSION }, 401);
  }

  const user = await env.DB.prepare(
    `SELECT id, role, email, first_name, last_name, phone, status, created_at, updated_at, password_hash
       FROM users WHERE email = ? LIMIT 1`
  ).bind(email).first();

  if (!user || user.status !== 'active' || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return json({ ok: false, error: 'INVALID_CREDENTIALS', version: VERSION }, 401);
  }

  // Remove expired sessions for this user before creating a fresh one.
  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND expires_at <= CURRENT_TIMESTAMP`).bind(user.id).run();

  const token = await createSession(env, user.id);
  return json(
    { ok: true, version: VERSION, user: safeUser(user), session: { authenticated: true, expires_in: SESSION_TTL_SECONDS } },
    200,
    { 'set-cookie': sessionCookie(token) }
  );
}

export async function logout(request, env) {
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    const tokenHash = await sha256Base64url(token);
    try {
      const result = await env.DB.prepare(`UPDATE sessions
        SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'USER_LOGOUT'
        WHERE token_hash = ? AND revoked_at IS NULL`).bind(tokenHash).run();
      // D1 may report failure without throwing. Never clear the browser cookie
      // or claim logout succeeded until revocation is positively confirmed.
      if (result?.success !== true) {
        return json({ ok: false, error: 'SESSION_REVOCATION_UNCONFIRMED', version: VERSION }, 503);
      }
    } catch {
      return json({ ok: false, error: 'SESSION_REVOCATION_UNCONFIRMED', version: VERSION }, 503);
    }
  }
  return json({ ok: true, version: VERSION, authenticated: false }, 200, {
    'set-cookie': sessionCookie('', 0)
  });
}


export async function tenantMembershipsRoute(request, env) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED", version: VERSION }, 405, { allow: "GET" });
  }
  if (!env?.DB) return json({ ok: false, error: "TENANT_CONTEXT_UNAVAILABLE", version: VERSION }, 503);
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    // Distinguish an authentication lookup outage from an invalid session.
    // Do not convert a database failure into a misleading 401 response.
    return json({ ok: false, error: "TENANT_CONTEXT_UNAVAILABLE", version: VERSION }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: "UNAUTHENTICATED", version: VERSION }, 401);
  const result = await listTenantMemberships(env, auth);
  if (!result.ok) return json({ ok: false, error: result.error, version: VERSION }, result.status);
  return json({
    ok: true,
    version: VERSION,
    memberships: result.memberships,
    active_tenant_id: result.active_tenant_id,
    selection_required: result.selection_required,
    truncated: result.truncated
  });
}

export async function tenantContextRoute(request, env) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED", version: VERSION }, 405, { allow: "GET" });
  }
  const auth = await getSessionUser(request, env);
  if (!auth) return json({ ok: false, error: "UNAUTHENTICATED", version: VERSION }, 401);
  const context = await resolveTenantContext(request, env, auth);
  if (!context.ok) {
    return json({ ok: false, error: context.error, version: VERSION }, context.status);
  }
  return json({ ok: true, version: VERSION, tenant: context.tenant });
}

export async function selectTenantForSession(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED", version: VERSION }, 405, { allow: "POST" });
  }
  // This endpoint changes server-side session context. Require a real, allowlisted browser Origin.
  if (!request.headers.get("origin") || !securityOriginAllowed(request, env)) {
    return json({ ok: false, error: "ORIGIN_NOT_ALLOWED", version: VERSION }, 403);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "JSON_REQUIRED", version: VERSION }, 415);
  }
  const auth = await getSessionUser(request, env);
  if (!auth) return json({ ok: false, error: "UNAUTHENTICATED", version: VERSION }, 401);
  const parsedBody = await readLimitedJson(request, 1024);
  if (!parsedBody.ok) {
    return json({
      ok: false,
      error: parsedBody.tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON",
      version: VERSION
    }, parsedBody.tooLarge ? 413 : 400);
  }
  const body = parsedBody.value;
  const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id.trim() : "";
  if (!tenantId || tenantId.length > 128) {
    return json({ ok: false, error: "TENANT_ID_REQUIRED", version: VERSION }, 400);
  }
  try {
    const result = await env.DB.prepare(`
      UPDATE sessions
         SET active_tenant_id = ?, last_seen_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND user_id = ?
         AND expires_at > CURRENT_TIMESTAMP
         AND revoked_at IS NULL
         AND EXISTS (
           SELECT 1
             FROM tenant_memberships m
             JOIN tenants t ON t.id = m.tenant_id
            WHERE m.user_id = sessions.user_id
              AND m.tenant_id = ?
              AND m.status = 'ACTIVE'
              AND t.status = 'ACTIVE'
         )
    `).bind(tenantId, auth.session_id, auth.user.id, tenantId).run();
    if (Number(result?.meta?.changes || 0) !== 1) {
      return json({ ok: false, error: "TENANT_MEMBERSHIP_REQUIRED", version: VERSION }, 403);
    }
    const context = await resolveTenantContext(request, env, {
      ...auth, session_active_tenant_id: tenantId
    });
    if (!context.ok) return json({ ok: false, error: context.error, version: VERSION }, context.status);
    return json({ ok: true, version: VERSION, tenant: context.tenant });
  } catch {
    return json({ ok: false, error: "TENANT_CONTEXT_UNAVAILABLE", version: VERSION }, 503);
  }
}

async function me(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth) return json({ ok: false, authenticated: false, error: 'UNAUTHENTICATED', version: VERSION }, 401);
  return json({ ok: true, authenticated: true, version: VERSION, user: auth.user });
}

export async function createFirstManagerAtomically(env, input) {
  if (!env?.DB || !input?.id || !input?.email || !input?.passwordHash) return false;
  const result = await env.DB.prepare(`INSERT INTO users
    (id, role, email, first_name, last_name, phone, status, password_hash)
    SELECT ?, 'gerante', ?, ?, ?, ?, 'active', ?
    WHERE NOT EXISTS (SELECT 1 FROM users)`)
    .bind(input.id,input.email,input.firstName,input.lastName,input.phone || null,input.passwordHash)
    .run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function bootstrap(request, env) {
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);
  if (!env.BOOTSTRAP_TOKEN) {
    return json({ ok: false, error: 'BOOTSTRAP_NOT_CONFIGURED', version: VERSION, next: 'Configure the BOOTSTRAP_TOKEN secret before first administrator/manager creation.' }, 503);
  }

  const supplied = request.headers.get('authorization') || '';
  if (supplied !== `Bearer ${env.BOOTSTRAP_TOKEN}`) {
    return json({ ok: false, error: 'UNAUTHORIZED', version: VERSION }, 401);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const firstName = clean(body?.first_name);
  const lastName = clean(body?.last_name);
  const phone = clean(body?.phone) || null;
  const password = body?.password;

  if (!validEmail(email) || !firstName || !lastName || !validPassword(password)) {
    return json({ ok: false, error: 'INVALID_BOOTSTRAP_DATA', version: VERSION, password_min_length: 10 }, 400);
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  let created;
  try {
    created = await createFirstManagerAtomically(env, {
      id:userId, email, firstName, lastName, phone, passwordHash
    });
  } catch (error) {
    // A concurrent first-admin attempt can also collide on the unique email.
    console.error('BOOTSTRAP_CREATE_FAILED', error?.name || 'D1_ERROR');
    return json({ok:false,error:'BOOTSTRAP_CONFLICT_OR_DATABASE_ERROR',version:VERSION},409);
  }
  if (!created) return json({ok:false,error:'BOOTSTRAP_ALREADY_USED',version:VERSION},409);

  return json({
    ok: true,
    version: VERSION,
    created: true,
    user: {
      id: userId,
      role: 'gerante',
      email,
      first_name: firstName,
      last_name: lastName,
      phone
    },
    note: 'Compte initial gerante créé. Le jeton de bootstrap ne peut pas être réutilisé car la table users n’est plus vide.'
  }, 201);
}

async function authStatus(request, env) {
  const auth = await getSessionUser(request, env);
  const count = env.DB ? await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first() : null;
  return json({
    ok: true,
    version: VERSION,
    authenticated: !!auth,
    user: auth?.user || null,
    bootstrap_required: Number(count?.total || 0) === 0,
    session_ttl_seconds: SESSION_TTL_SECONDS
  });
}



/* ============================================================
   PROCHÉLIA V13.5.15 — IDENTITÉ / PRÉSENCE / CODE DOMICILE
   Additif serveur : ne remplace aucun module existant.
   Principe : un code client n'est JAMAIS suffisant à lui seul.
   Chaîne : identité vérifiée -> compte -> appareil -> mission ->
   présence -> code client -> journal d'audit.
=============================================================== */
async function securitySchemaReady(env) {
  if (!env?.DB) return false;
  const required = {
    identity_verifications: ['id','user_id','tenant_id','status','level','verified_at','expires_at'],
    mission_security: ['id','mission_id','client_id','intervenant_id','tenant_id','status','arrival_code_hash','end_code_hash'],
    mission_security_attempts: ['id','security_id','tenant_id','purpose','actor_user_id','result'],
    security_audit: ['id','event_type','mission_id','user_id','actor_role','result','metadata_json','tenant_id']
  };
  try {
    for (const [table, requiredColumns] of Object.entries(required)) {
      const columns = await tableColumns(env, table);
      if (!requiredColumns.every(column => columns.includes(column))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function securityCode() {
  const n = new DataView(randomBytes(4).buffer).getUint32(0) % 1000000;
  return String(n).padStart(6, '0');
}

async function securityAudit(env, tenantId, eventType, missionId, userId, role, result, metadata = {}) {
  if (!tenantId) throw new Error('SECURITY_AUDIT_TENANT_REQUIRED');
  await env.DB.prepare(
    `INSERT INTO security_audit (id,event_type,mission_id,user_id,actor_role,result,metadata_json,tenant_id)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(crypto.randomUUID(), eventType, missionId || null, userId || null, role || null, result, JSON.stringify(metadata), tenantId).run();
}

async function requireVerifiedIntervenant(env, userId, tenantId) {
  if (!userId || !tenantId) return null;
  const row = await env.DB.prepare(
    `SELECT id,status,level,verified_at,expires_at FROM identity_verifications
     WHERE user_id=? AND tenant_id=? AND status='verified'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ORDER BY verified_at DESC LIMIT 1`
  ).bind(userId, tenantId).first();
  return row || null;
}

async function securityIdentityStart(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user?403:401);
  const tenantContext = await resolveTenantContext(request, env, auth);
  if (!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const tenantId = tenantContext.tenant.id;
  if (!(await securitySchemaReady(env))) return json({ok:false,error:'SECURITY_SCHEMA_NOT_READY',version:VERSION,write_enabled:false},503);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO identity_verifications (id,user_id,tenant_id,status,level) VALUES (?,?,?, 'pending','standard')`
  ).bind(id, auth.user.id, tenantId).run();
  await securityAudit(env,tenantId,'IDENTITY_VERIFICATION_REQUESTED',null,auth.user.id,auth.user.role,'PENDING',{verification_id:id,tenant_id:tenantId});
  return json({ok:true,version:VERSION,verification_id:id,status:'pending',message:'Vérification d’identité requise avant l’accès aux missions.'},201);
}

async function securityIdentityApprove(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user?403:401);
  const tenantContext = await resolveTenantContext(request, env, auth);
  if (!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  if (!tenantRoleAllowed(tenantContext, ['OWNER','ADMIN','MANAGER'])) return json({ok:false,error:'TENANT_PERMISSION_REQUIRED',version:VERSION},403);
  const tenantId = tenantContext.tenant.id;
  if (!(await securitySchemaReady(env))) return json({ok:false,error:'SECURITY_SCHEMA_NOT_READY',version:VERSION,write_enabled:false},503);
  const body = await readJson(request);
  const verificationId = clean(body?.verification_id);
  const status = clean(body?.status);
  const level = clean(body?.level) || 'standard';
  if (!verificationId || !['verified','rejected','pending'].includes(status)) return json({ok:false,error:'INVALID_IDENTITY_DECISION',version:VERSION},400);
  const row = await env.DB.prepare('SELECT id,user_id,status FROM identity_verifications WHERE id=? AND tenant_id=? LIMIT 1').bind(verificationId,tenantId).first();
  if (!row) return json({ok:false,error:'VERIFICATION_NOT_FOUND',version:VERSION},404);
  if (row.status !== 'pending') return json({ok:false,error:'IDENTITY_DECISION_ALREADY_FINAL',version:VERSION},409);
  const provider = clean(body?.provider) || 'manual_control';
  const providerReference = clean(body?.provider_reference) || null;
  const reason = clean(body?.rejection_reason) || null;
  const verifiedAt = status === 'verified' ? new Date().toISOString() : null;
  const expiresAt = status === 'verified' ? new Date(Date.now()+30*24*60*60*1000).toISOString() : null;
  const result = await env.DB.prepare(
    `UPDATE identity_verifications SET status=?,level=?,provider=?,provider_reference=?,verified_at=?,expires_at=?,rejection_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='pending'`
  ).bind(status,level,provider,providerReference,verifiedAt,expiresAt,reason,verificationId,tenantId).run();
  if (Number(result?.meta?.changes || 0) !== 1) return json({ok:false,error:'IDENTITY_DECISION_CONFLICT',version:VERSION},409);
  await securityAudit(env,tenantId,'IDENTITY_VERIFICATION_DECISION',null,auth.user.id,auth.user.role,status,{verification_id:verificationId,subject_user_id:row.user_id,tenant_id:tenantId,level});
  return json({ok:true,version:VERSION,verification_id:verificationId,user_id:row.user_id,status,level,verified_at:verifiedAt},200);
}

export async function deliverSecurityCodes(env, payload) {
  const webhook = clean(env.SECURITY_CODE_WEBHOOK);
  if (!webhook) return {ok:false,error:'SECURITY_CODE_WEBHOOK_NOT_CONFIGURED'};
  const secret = clean(env.SECURITY_CODE_WEBHOOK_SECRET);
  if (!secret) return {ok:false,error:'SECURITY_CODE_WEBHOOK_SECRET_NOT_CONFIGURED'};
  const body = JSON.stringify({
    event:'PROCHELIA_SECURITY_CODES',
    mission_id:payload.mission_id,
    client_id:payload.client_id,
    arrival_code:payload.arrival_code,
    arrival_expires_at:payload.arrival_expires_at,
    end_code:payload.end_code,
    end_expires_at:payload.end_expires_at
  });
  const signature = await hmacSha256Base64url(secret, body);
  const response = await fetch(webhook,{
    method:'POST',
    headers:{'content-type':'application/json','x-prochelia-signature':signature},
    body
  });
  if (!response.ok) return {ok:false,error:'NOTIFICATION_PROVIDER_REJECTED'};
  return {ok:true,channel:'authenticated_notification_webhook'};
}

async function securityPrepareMission(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user?403:401);
  const tenantContext = await resolveTenantContext(request, env, auth);
  if (!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const tenantId = tenantContext.tenant.id;
  if (!(await securitySchemaReady(env))) return json({ok:false,error:'SECURITY_SCHEMA_NOT_READY',version:VERSION,write_enabled:false},503);
  const body = await readJson(request);
  const missionId=clean(body?.mission_id), clientId=clean(body?.client_id), intervenantId=clean(body?.intervenant_id);
  if(!missionId||!clientId||!intervenantId) return json({ok:false,error:'MISSION_SECURITY_FIELDS_REQUIRED',version:VERSION},400);
  // Resolve all three business identities inside the authenticated manager's active tenant.
  // Never verify an intervenant using an intervenant-row ID: identity_verifications is keyed by user_id.
  const assignment = await env.DB.prepare(
    `SELECT m.id, m.client_id, m.intervenant_id, m.tenant_id,
            c.user_id AS client_user_id, i.user_id AS intervenant_user_id
       FROM missions m
       JOIN clients c ON c.id=m.client_id AND c.tenant_id=m.tenant_id
       JOIN intervenants i ON i.id=m.intervenant_id AND i.tenant_id=m.tenant_id
      WHERE m.id=? AND m.tenant_id=? AND m.client_id=? AND m.intervenant_id=?
      LIMIT 1`
  ).bind(missionId,tenantId,clientId,intervenantId).first();
  if (!assignment) return json({ok:false,error:'MISSION_TENANT_ASSIGNMENT_NOT_FOUND',version:VERSION},404);
  const verified = await requireVerifiedIntervenant(env,assignment.intervenant_user_id,tenantId);
  if(!verified) return json({ok:false,error:'INTERVENANT_IDENTITY_NOT_VERIFIED',version:VERSION},409);
  const existing=await env.DB.prepare('SELECT id,status FROM mission_security WHERE mission_id=? AND tenant_id=? LIMIT 1').bind(missionId,tenantId).first();
  if(existing) return json({ok:false,error:'MISSION_SECURITY_ALREADY_PREPARED',version:VERSION,status:existing.status},409);
  const arrival=securityCode(), end=securityCode();
  const now=Date.now(), arrivalExpiry=new Date(now+SECURITY_CODE_TTL_SECONDS*1000).toISOString(), endExpiry=new Date(now+SECURITY_CODE_TTL_SECONDS*1000).toISOString();
  const id=crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO mission_security (id,mission_id,client_id,intervenant_id,tenant_id,risk_level,arrival_code_hash,arrival_expires_at,end_code_hash,end_expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(id,missionId,clientId,intervenantId,tenantId,clean(body?.risk_level)||'standard',await sha256Base64url(arrival),arrivalExpiry,await sha256Base64url(end),endExpiry).run();
  await securityAudit(env,tenantId,'MISSION_SECURITY_PREPARED',missionId,auth.user.id,auth.user.role,'OK',{intervenant_id:intervenantId,risk_level:clean(body?.risk_level)||'standard'});
  const delivery = await deliverSecurityCodes(env, {
    mission_id: missionId,
    client_id: clientId,
    arrival_code: arrival,
    arrival_expires_at: arrivalExpiry,
    end_code: end,
    end_expires_at: endExpiry
  });
  if (!delivery.ok) {
    await env.DB.prepare('DELETE FROM mission_security WHERE id=? AND tenant_id=?').bind(id,tenantId).run();
    await securityAudit(env,tenantId,'MISSION_SECURITY_PREPARE_DELIVERY_FAILED',missionId,auth.user.id,auth.user.role,'DENIED',{reason:delivery.error});
    return json({ok:false,error:'SECURITY_CODE_DELIVERY_FAILED',version:VERSION,details:delivery.error},503);
  }
  await securityAudit(env,tenantId,'SECURITY_CODES_DELIVERED',missionId,auth.user.id,auth.user.role,'OK',{channel:delivery.channel});
  return json({ok:true,version:VERSION,mission_id:missionId,status:'prepared',arrival:{expires_at:arrivalExpiry},end:{expires_at:endExpiry},delivery:{channel:delivery.channel,delivered:true},security_note:'Les codes en clair ne sont jamais renvoyés par l’API.'},201);
}

async function securityPresence(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['intervenant'])) {
    return json({ ok: false, error: auth?.user ? 'FORBIDDEN' : 'UNAUTHENTICATED', version: VERSION }, auth?.user ? 403 : 401);
  }

  // User-Agent and Client Hints are browser-controlled and can be spoofed.
  // Do not auto-enroll them as trusted devices or record mission presence.
  // Keep mission execution blocked until cryptographic enrollment and
  // server-verified proof-of-possession are implemented and tested.
  return json({
    ok: false,
    error: 'CRYPTOGRAPHIC_DEVICE_ENROLLMENT_REQUIRED',
    version: VERSION,
    write_enabled: false
  }, 503);
}

export async function consumeMissionSecurityCode(env, tenantId, securityId, purpose, expectedHash) {
  if (!env?.DB || !tenantId || !securityId || !expectedHash) return false;
  let statement;
  if (purpose === 'ARRIVAL') {
    statement = env.DB.prepare(`UPDATE mission_security
      SET arrival_used_at=CURRENT_TIMESTAMP,arrival_started_at=CURRENT_TIMESTAMP,status='in_progress',updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND tenant_id=? AND status='prepared' AND arrival_used_at IS NULL
        AND arrival_code_hash=? AND julianday(arrival_expires_at)>julianday('now')
        AND (locked_until IS NULL OR julianday(locked_until)<=julianday('now'))`).bind(securityId, tenantId, expectedHash);
  } else if (purpose === 'END') {
    statement = env.DB.prepare(`UPDATE mission_security
      SET end_used_at=CURRENT_TIMESTAMP,ended_at=CURRENT_TIMESTAMP,status='completed',updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND tenant_id=? AND status='in_progress' AND end_used_at IS NULL
        AND end_code_hash=? AND julianday(end_expires_at)>julianday('now')
        AND (locked_until IS NULL OR julianday(locked_until)<=julianday('now'))`).bind(securityId, tenantId, expectedHash);
  } else {
    return false;
  }
  const result = await statement.run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function securityVerifyCode(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['intervenant'])) {
    return json({ ok: false, error: auth?.user ? 'FORBIDDEN' : 'UNAUTHENTICATED', version: VERSION }, auth?.user ? 403 : 401);
  }

  // A six-digit mission code is not sufficient device authentication.
  // No code attempt is recorded and no mission-security state is changed
  // until a cryptographic device proof is available.
  return json({
    ok: false,
    error: 'CRYPTOGRAPHIC_DEVICE_ENROLLMENT_REQUIRED',
    version: VERSION,
    write_enabled: false
  }, 503);
}

async function securityResendCodes(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante','client'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  const tenantContext=await resolveTenantContext(request,env,auth);
  if(!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const tenantId=tenantContext.tenant.id;
  if(auth.user.role==='gerante'&&!tenantRoleAllowed(tenantContext,['OWNER','ADMIN','MANAGER'])) return json({ok:false,error:'TENANT_PERMISSION_REQUIRED',version:VERSION},403);
  if (!(await securitySchemaReady(env))) return json({ok:false,error:'SECURITY_SCHEMA_NOT_READY',version:VERSION,write_enabled:false},503);
  const body=await readJson(request);
  const missionId=clean(body?.mission_id);
  if(!missionId) return json({ok:false,error:'MISSION_ID_REQUIRED',version:VERSION},400);
  let sec;
  if(auth.user.role==='client') {
    sec=await env.DB.prepare(
      `SELECT s.id,s.status,s.client_id FROM mission_security s
        JOIN clients c ON c.id=s.client_id AND c.tenant_id=s.tenant_id
       WHERE s.mission_id=? AND s.tenant_id=? AND c.user_id=? LIMIT 1`
    ).bind(missionId,tenantId,auth.user.id).first();
  } else {
    sec=await env.DB.prepare(
      `SELECT s.id,s.status,s.client_id FROM mission_security s
        JOIN missions m ON m.id=s.mission_id AND m.tenant_id=s.tenant_id
       WHERE s.mission_id=? AND s.tenant_id=? LIMIT 1`
    ).bind(missionId,tenantId).first();
  }
  if(!sec) return json({ok:false,error:'MISSION_SECURITY_NOT_FOUND',version:VERSION},404);
  if(sec.status==='completed') return json({ok:false,error:'MISSION_ALREADY_COMPLETED',version:VERSION},409);
  return json({ok:false,error:'SECURITY_CODE_RESEND_REQUIRES_REGENERATION_FLOW',version:VERSION,message:'Pour éviter la réutilisation d’un ancien secret, la réémission doit générer de nouveaux codes et invalider les précédents.'},409);
}

async function securityClientCode(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['client'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  return json({ok:false,error:'CLIENT_CODE_DELIVERY_NOT_CONFIGURED',version:VERSION,message:'Le code doit être délivré au client par un canal authentifié (SMS/email/push). Aucun code n’est exposé à l’intervenant.'},503);
}

async function securityStatus(request, env) {
  const auth=await getSessionUser(request,env);
  if(!auth) return json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401);
  const schemaReady = await securitySchemaReady(env);
  // Return configuration state only. Do not expose global audit volume or
  // cross-tenant operational metadata to an individual authenticated user.
  return json({ok:true,version:VERSION,schema_ready:schemaReady,write_enabled:false,security:{identity:'verified_required',device:'cryptographic_enrollment_required',presence:'blocked',mission_code_verification:'blocked',arrival_code:'not_verifiable_until_device_enrollment',end_code:'not_verifiable_until_device_enrollment',max_attempts:SECURITY_MAX_ATTEMPTS,code_ttl_seconds:SECURITY_CODE_TTL_SECONDS},user:{id:auth.user.id,role:auth.user.role}},200);
}


/* ============================================================
   PROCHÉLIA V13.5.17 — PAIEMENTS / PORTEFEUILLE / COMMISSIONS
   Architecture de règlement de bout en bout.
   IMPORTANT : les fonds réels passent par un PSP agréé ; PROCHÉLIA
   conserve le ledger métier, les états, l'idempotence et l'audit.
=============================================================== */
async function ensurePaymentSchema(env) {
  if (!env?.DB) throw new Error('DATABASE_REQUIRED');
  // Financial schema is migration-owned. Runtime handlers may verify readiness,
  // but must never create legacy unscoped tables as a side effect.
  const required = {
    payment_accounts: ['id','user_id','tenant_id'],
    wallets: ['id','user_id','tenant_id'],
    payment_transactions: ['id','idempotency_key','mission_id','client_id','tenant_id'],
    payout_requests: ['id','idempotency_key','wallet_id','user_id','tenant_id'],
    payment_disputes: ['id','transaction_id','mission_id','tenant_id'],
    payment_wallet_ledger: ['id','user_id','tenant_id'],
    payment_reconciliation: ['id','tenant_id'],
    payment_audit: ['id','tenant_id'],
    payment_webhook_events: ['id','tenant_id']
  };
  for (const [table, requiredColumns] of Object.entries(required)) {
    const columns = await tableColumns(env, table);
    if (!requiredColumns.every(column => columns.includes(column))) {
      throw new Error('PAYMENT_SCHEMA_NOT_READY');
    }
  }
}


function moneyCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

async function paymentAudit(env, eventType, data = {}, result = 'OK') {
  await env.DB.prepare(`INSERT INTO payment_audit
    (id,event_type,transaction_id,payout_id,mission_id,user_id,result,metadata_json,tenant_id)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), eventType, data.transaction_id || null, data.payout_id || null,
      data.mission_id || null, data.user_id || null, result, JSON.stringify(data.metadata || {}),
      data.tenant_id || null).run();
}

function paymentProvider(env) {
  return clean(env.PAYMENT_PROVIDER) || 'psp_adapter';
}

export function paymentsConfigured(env) {
  // A provider name and webhook secret do not constitute a working PSP adapter.
  // Keep real charges and payouts disabled until a reviewed adapter implements
  // the charge, refund, payout, account-onboarding and verified-webhook contract.
  // This is intentionally fail-closed; configuration alone must never enable money movement.
  void env;
  return false;
}

async function paymentOnboard(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  if (!paymentsConfigured(env)) return json({ok:false,error:'PAYMENT_PROVIDER_NOT_CONFIGURED',version:VERSION,write_enabled:false},503);
  const tenantContext = await resolveTenantContext(request, env, auth);
  if (!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const schemaGate = await schemaColumnsReadinessResponse(env, {payment_accounts:['tenant_id'],wallets:['tenant_id'],payment_audit:['tenant_id']}, 'PAYMENT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const body = await readJson(request);
  const provider = paymentProvider(env);
  const accountId = clean(body?.provider_account_id) || null;
  const existing = await env.DB.prepare('SELECT * FROM payment_accounts WHERE user_id=? AND tenant_id=? LIMIT 1').bind(auth.user.id,tenantContext.tenant.id).first();
  if (existing) return json({ok:true,version:VERSION,account:existing,action:'REUSE_EXISTING'},200);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO payment_accounts
    (id,user_id,provider,provider_account_id,status,onboarding_status,tenant_id)
    VALUES (?,?,?,?, 'pending','required',?)`).bind(id,auth.user.id,provider,accountId,tenantContext.tenant.id).run();
  const wallet = await env.DB.prepare('SELECT id FROM wallets WHERE user_id=? AND tenant_id=? LIMIT 1').bind(auth.user.id,tenantContext.tenant.id).first();
  if (!wallet) await env.DB.prepare(`INSERT INTO wallets (id,user_id,tenant_id) VALUES (?,?,?)`).bind(crypto.randomUUID(),auth.user.id,tenantContext.tenant.id).run();
  await paymentAudit(env,'PAYOUT_ACCOUNT_CREATED',{user_id:auth.user.id,tenant_id:tenantContext.tenant.id,metadata:{provider}},'OK');
  return json({ok:true,version:VERSION,account_id:id,provider,onboarding_status:'required',next:'PSP_ONBOARDING_REQUIRED'},201);
}

async function paymentStatus(request, env) {
  const auth=await getSessionUser(request,env);
  if(!auth) return json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401);
  const tenantContext = await resolveTenantContext(request, env, auth);
  if (!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  if (!paymentsConfigured(env)) return json({ok:true,read_only:true,version:VERSION,provider:null,payments_configured:false,wallet:null,payout_account:null,pending_payouts:0},200);
  try {
    const tenantId=tenantContext.tenant.id;
    const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? AND tenant_id=? LIMIT 1').bind(auth.user.id,tenantId).first();
    const account=await env.DB.prepare('SELECT * FROM payment_accounts WHERE user_id=? AND tenant_id=? LIMIT 1').bind(auth.user.id,tenantId).first();
    const pending=await env.DB.prepare(`SELECT COUNT(*) total FROM payout_requests WHERE user_id=? AND tenant_id=? AND status IN ('requested','processing')`).bind(auth.user.id,tenantId).first();
    return json({ok:true,read_only:true,version:VERSION,provider:paymentProvider(env),payments_configured:true,
      wallet:wallet?{currency:wallet.currency,available_cents:wallet.available_cents,pending_cents:wallet.pending_cents,paid_cents:wallet.paid_cents,reserved_cents:wallet.reserved_cents}:null,
      payout_account:account?{status:account.status,onboarding_status:account.onboarding_status,payouts_enabled:!!account.payouts_enabled}:null,
      pending_payouts:Number(pending?.total||0)},200);
  } catch {
    return json({ok:false,error:'PAYMENT_STATUS_UNAVAILABLE',version:VERSION},503);
  }
}

export function sameMissionPaymentRequest(existing, requested) {
  if (!existing || !requested) return false;
  const gross = Number(requested.grossCents);
  const commission = Number(requested.commissionCents);
  return String(existing.type || "").toUpperCase() === "MISSION_CHARGE" &&
    String(existing.mission_id || "") === String(requested.missionId || "") &&
    String(existing.client_id || "") === String(requested.clientId || "") &&
    String(existing.intervenant_id || "") === String(requested.intervenantId || "") &&
    String(existing.tenant_id || "") === String(requested.tenantId || "") &&
    Number.isSafeInteger(gross) && Number.isSafeInteger(commission) &&
    Number(existing.gross_cents) === gross &&
    Number(existing.commission_cents) === commission &&
    Number(existing.net_intervenant_cents) === gross - commission &&
    String(existing.currency || "EUR").toUpperCase() === "EUR";
}

async function createMissionPayment(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  if (!paymentsConfigured(env)) return json({ok:false,error:'PAYMENT_PROVIDER_NOT_CONFIGURED',version:VERSION,write_enabled:false},503);
  const tenantContext=await resolveTenantContext(request,env,auth);
  if(!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const schemaGate = await schemaColumnsReadinessResponse(env, {payment_transactions:['tenant_id'],payment_audit:['tenant_id']}, 'PAYMENT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const body=await readJson(request);
  const missionId=clean(body?.mission_id), clientId=clean(body?.client_id), intervenantId=clean(body?.intervenant_id);
  const gross=moneyCents(body?.gross_eur), commission=moneyCents(body?.commission_eur);
  if(!missionId||!clientId||!intervenantId||gross===null||commission===null||commission>gross) return json({ok:false,error:'INVALID_PAYMENT_AMOUNT_OR_PARTIES',version:VERSION},400);
  const tenantId=tenantContext.tenant.id;
  const mission=await env.DB.prepare('SELECT id,client_id,intervenant_id FROM missions WHERE id=? AND tenant_id=? LIMIT 1').bind(missionId,tenantId).first();
  if(!mission||mission.client_id!==clientId||mission.intervenant_id!==intervenantId) return json({ok:false,error:'MISSION_NOT_FOUND_IN_ACTIVE_TENANT',version:VERSION},404);
  const idem=clean(request.headers.get('idempotency-key'))||clean(body?.idempotency_key);
  if(!idem) return json({ok:false,error:'IDEMPOTENCY_KEY_REQUIRED',version:VERSION},400);
  const old=await env.DB.prepare('SELECT * FROM payment_transactions WHERE idempotency_key=? AND tenant_id=? LIMIT 1').bind(idem,tenantId).first();
  if(old){
    if(!sameMissionPaymentRequest(old,{
      missionId,clientId,intervenantId,tenantId,grossCents:gross,commissionCents:commission
    })) return json({ok:false,error:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',version:VERSION},409);
    return json({ok:true,version:VERSION,idempotent_replay:true,transaction:old},200);
  }
  const net=gross-commission, txId=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO payment_transactions
    (id,idempotency_key,mission_id,client_id,intervenant_id,type,status,gross_cents,commission_cents,net_intervenant_cents,currency,provider,reason,tenant_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(txId,idem,missionId,clientId,intervenantId,'MISSION_CHARGE','pending',gross,commission,net,'EUR',paymentProvider(env),'MISSION_PAYMENT_CREATED',tenantId).run();
  await paymentAudit(env,'MISSION_PAYMENT_CREATED',{transaction_id:txId,mission_id:missionId,user_id:auth.user.id,tenant_id:tenantId,metadata:{gross_cents:gross,commission_cents:commission,net_cents:net}},'OK');
  return json({ok:true,version:VERSION,transaction_id:txId,status:'pending',gross_cents:gross,commission_cents:commission,net_intervenant_cents:net,provider:paymentProvider(env),next:'PSP_CHARGE_REQUIRED'},201);
}

async function finalizeMissionPayment(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user ? 403 : 401);
  // A manager action is not proof of settlement. Only a verified PSP event may
  // move a transaction to a financially final state.
  return json({
    ok:false,
    error:'PSP_VERIFIED_SETTLEMENT_REQUIRED',
    message:'La finalisation manuelle est désactivée. Seul un événement PSP signé et rapproché peut confirmer un paiement.',
    version:VERSION,
    write_enabled:false
  },409);
}

export async function reservePayoutAtomically(env, input) {
  const { payoutId,idempotencyKey,walletId,userId,tenantId,amountCents,mode,provider } = input;
  if (!env?.DB?.batch || !payoutId || !idempotencyKey || !walletId || !userId || !tenantId ||
      !Number.isSafeInteger(amountCents) || amountCents<=0 || !['standard','express'].includes(mode)) {
    return {ok:false,reason:'INVALID_INPUT'};
  }
  const statements=[
    env.DB.prepare(`INSERT INTO payout_requests
      (id,idempotency_key,wallet_id,user_id,amount_cents,mode,provider,status,tenant_id)
      SELECT ?,?,?,?, ?,?,?, 'requested',?
      FROM wallets WHERE id=? AND user_id=? AND tenant_id=? AND available_cents>=?
        AND NOT EXISTS (SELECT 1 FROM payout_requests WHERE idempotency_key=? AND tenant_id=?)`)
      .bind(payoutId,idempotencyKey,walletId,userId,amountCents,mode,provider,tenantId,walletId,userId,tenantId,amountCents,idempotencyKey,tenantId),
    env.DB.prepare(`UPDATE wallets SET available_cents=available_cents-?,reserved_cents=reserved_cents+?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND user_id=? AND tenant_id=? AND available_cents>=?
        AND EXISTS (SELECT 1 FROM payout_requests WHERE id=? AND user_id=? AND tenant_id=? AND idempotency_key=?)`)
      .bind(amountCents,amountCents,walletId,userId,tenantId,amountCents,payoutId,userId,tenantId,idempotencyKey),
    env.DB.prepare(`INSERT INTO payment_audit
      (id,event_type,transaction_id,payout_id,mission_id,user_id,result,metadata_json,tenant_id)
      SELECT ?, 'PAYOUT_REQUESTED', NULL, ?, NULL, ?, 'OK', ?, ?
      WHERE EXISTS (SELECT 1 FROM payout_requests WHERE id=? AND user_id=? AND tenant_id=? AND idempotency_key=?)`)
      .bind(crypto.randomUUID(),payoutId,userId,JSON.stringify({amount_cents:amountCents,mode}),tenantId,payoutId,userId,tenantId,idempotencyKey)
  ];
  const results=await env.DB.batch(statements);
  const inserted=Number(results?.[0]?.meta?.changes||0)===1;
  const debited=Number(results?.[1]?.meta?.changes||0)===1;
  return {ok:inserted&&debited,reason:inserted&&debited?null:'NOT_RESERVED'};
}

async function payoutRequest(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  if (!paymentsConfigured(env)) return json({ok:false,error:'PAYOUT_PROVIDER_NOT_CONFIGURED',version:VERSION,write_enabled:false},503);
  const tenantContext=await resolveTenantContext(request,env,auth);
  if(!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const schemaGate = await schemaColumnsReadinessResponse(env, {payout_requests:['tenant_id'],payment_accounts:['tenant_id'],wallets:['tenant_id'],payment_wallet_ledger:['tenant_id'],payment_audit:['tenant_id']}, 'PAYMENT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const tenantId=tenantContext.tenant.id, body=await readJson(request);
  const amount=moneyCents(body?.amount_eur), mode=clean(body?.mode)||'standard';
  const idem=clean(request.headers.get('idempotency-key'))||clean(body?.idempotency_key);
  if(amount===null||amount<=0||!['standard','express'].includes(mode)||!idem||idem.length>200) return json({ok:false,error:'INVALID_PAYOUT_REQUEST',version:VERSION},400);
  const existing=await env.DB.prepare('SELECT * FROM payout_requests WHERE idempotency_key=? AND user_id=? AND tenant_id=? LIMIT 1').bind(idem,auth.user.id,tenantId).first();
  if(existing){
    if(Number(existing.amount_cents)!==amount||existing.mode!==mode) return json({ok:false,error:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',version:VERSION},409);
    return json({ok:true,version:VERSION,idempotent_replay:true,payout:existing},200);
  }
  const account=await env.DB.prepare('SELECT * FROM payment_accounts WHERE user_id=? AND tenant_id=? LIMIT 1').bind(auth.user.id,tenantId).first();
  if(!account||Number(account.payouts_enabled)!==1) return json({ok:false,error:'PAYOUT_ACCOUNT_NOT_READY',version:VERSION,message:'Le compte de paiement de l’intervenant doit être vérifié et activé par le PSP.'},409);
  const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? AND tenant_id=? LIMIT 1').bind(auth.user.id,tenantId).first();
  if(!wallet) return json({ok:false,error:'WALLET_NOT_FOUND',version:VERSION},409);
  const payoutId=crypto.randomUUID();
  let reservation;
  try{
    reservation=await reservePayoutAtomically(env,{payoutId,idempotencyKey:idem,walletId:wallet.id,userId:auth.user.id,tenantId,amountCents:amount,mode,provider:paymentProvider(env)});
  }catch(error){
    console.error('PAYOUT_RESERVATION_FAILED',error?.name||'D1_ERROR');
    return json({ok:false,error:'PAYOUT_RESERVATION_FAILED',version:VERSION},503);
  }
  if(!reservation.ok){
    const sameOwner=await env.DB.prepare('SELECT * FROM payout_requests WHERE idempotency_key=? AND user_id=? AND tenant_id=? LIMIT 1').bind(idem,auth.user.id,tenantId).first();
    if(sameOwner){
      if(Number(sameOwner.amount_cents)!==amount||sameOwner.mode!==mode) return json({ok:false,error:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',version:VERSION},409);
      return json({ok:true,version:VERSION,idempotent_replay:true,payout:sameOwner},200);
    }
    const collision=await env.DB.prepare('SELECT 1 AS used FROM payout_requests WHERE idempotency_key=? AND tenant_id=? LIMIT 1').bind(idem,tenantId).first();
    if(collision) return json({ok:false,error:'IDEMPOTENCY_KEY_CONFLICT',version:VERSION},409);
    const latestWallet=await env.DB.prepare('SELECT available_cents FROM wallets WHERE id=? AND user_id=? AND tenant_id=? LIMIT 1').bind(wallet.id,auth.user.id,tenantId).first();
    return json({ok:false,error:'INSUFFICIENT_AVAILABLE_BALANCE',version:VERSION,available_cents:Number(latestWallet?.available_cents||0)},409);
  }
  return json({ok:true,version:VERSION,payout_id:payoutId,status:'requested',amount_cents:amount,mode,provider:paymentProvider(env),next:'PSP_PAYOUT_REQUIRED'},201);
}

function constantTimeStringEqual(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function readBoundedWebhookBody(request, maxBytes = 1_048_576) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return { ok: false, reason: "invalid_limit" };
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, reason: "invalid_length" };
    if (Number(declaredLength) > maxBytes) return { ok: false, reason: "too_large" };
  }
  if (!request.body) return { ok: true, body: "" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return { ok: false, reason: "invalid_stream" };
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
      return { ok: true, body: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch {
      return { ok: false, reason: "invalid_utf8" };
    }
  } catch {
    return { ok: false, reason: "read_failed" };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

export async function verifyWebhookSignature(request, env, rawBody) {
  // Stripe has its own timestamped signature format and secret. Never fall
  // back to the generic provider signature when Stripe-Signature is present.
  const stripeHeader = request.headers.get("stripe-signature");
  if (stripeHeader !== null) {
    const secret = env?.STRIPE_WEBHOOK_SECRET;
    if (typeof secret !== "string" || secret.length < 32 || typeof rawBody !== "string") return false;
    const fields = stripeHeader.split(",").map(part => {
      const item = part.trim();
      const separator = item.indexOf("=");
      return separator > 0 ? [item.slice(0, separator), item.slice(separator + 1)] : [item, ""];
    });
    const timestamps = fields.filter(([name]) => name === "t").map(([, value]) => value);
    const signatures = fields.filter(([name]) => name === "v1").map(([, value]) => value);
    if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0] || "") ||
        signatures.length === 0 || signatures.some(value => !/^[0-9a-f]{64}$/i.test(value || ""))) return false;
    const timestamp = Number(timestamps[0]);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signedPayload = new TextEncoder().encode(timestamps[0] + "." + rawBody);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, signedPayload));
    const expected = Array.from(mac, byte => byte.toString(16).padStart(2, "0")).join("");
    let matched = 0;
    for (const signature of signatures) matched |= Number(constantTimeStringEqual(signature.toLowerCase(), expected));
    return matched === 1;
  }

  const secret = env?.PAYMENT_WEBHOOK_SECRET;
  if (typeof secret !== "string" || secret.length < 32 || typeof rawBody !== "string") return false;
  const signature = request.headers.get("x-prochelia-signature") || request.headers.get("x-webhook-signature") || "";
  const supplied = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[A-Za-z0-9_-]{43}$/.test(supplied)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  return constantTimeStringEqual(supplied, base64url(mac));
}

export function webhookProviderForRequest(request, env) {
  if (request.headers.get("stripe-signature") !== null) return "stripe";
  const configuredProvider = paymentProvider(env);
  if (String(configuredProvider).toLowerCase() === "stripe") return null;
  return configuredProvider;
}

export function requiresAtomicFinancialSettlement(eventType) {
  return new Set([
    'payment_succeeded','charge_succeeded','payment_failed','charge_failed',
    'payment_refunded','payout_paid','payout_failed','payout_canceled'
  ]).has(String(eventType || '').trim());
}

export async function paymentWebhook(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED", version: VERSION }, 405, { allow: "POST" });
  }
  const bodyResult = await readBoundedWebhookBody(request);
  if (!bodyResult.ok) {
    const tooLarge = bodyResult.reason === "too_large";
    return json({ ok: false, error: tooLarge ? "WEBHOOK_BODY_TOO_LARGE" : "INVALID_WEBHOOK_BODY", version: VERSION }, tooLarge ? 413 : 400);
  }
  const raw = bodyResult.body;
  if (!(await verifyWebhookSignature(request, env, raw))) {
    return json({ ok: false, error: "INVALID_WEBHOOK_SIGNATURE", version: VERSION }, 401);
  }
  let event;
  try { event = JSON.parse(raw); }
  catch { return json({ ok: false, error: "INVALID_WEBHOOK_JSON", version: VERSION }, 400); }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return json({ ok: false, error: "INVALID_WEBHOOK_EVENT", version: VERSION }, 400);
  }
  const provider = webhookProviderForRequest(request, env);
  const eventId = clean(event.id);
  const type = clean(event.type);
  if (!provider || !eventId || !type) {
    return json({ ok: false, error: "INVALID_WEBHOOK_EVENT", version: VERSION }, 400);
  }
  // The receiver remains fail-closed until a reviewed PSP adapter, atomic
  // settlement ledger and Sandbox acceptance are available. No D1 writes,
  // wallet changes, refunds or payouts occur in this state.
  if (!paymentsConfigured(env)) {
    return json({ ok: false, error: "PAYMENT_PROVIDER_NOT_CONFIGURED", version: VERSION, provider, write_enabled: false }, 503);
  }
  if (requiresAtomicFinancialSettlement(type)) {
    return json({ ok: false, error: "ATOMIC_SETTLEMENT_LEDGER_REQUIRED", version: VERSION, retryable: true, write_enabled: false }, 503);
  }
  return json({ ok: false, error: "WEBHOOK_PROCESSOR_NOT_IMPLEMENTED", version: VERSION, provider, write_enabled: false }, 503);
}

async function openPaymentDispute(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['client','gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  if (!paymentsConfigured(env)) return json({ok:false,error:'PAYMENT_PROVIDER_NOT_CONFIGURED',version:VERSION,write_enabled:false},503);
  const tenantContext=await resolveTenantContext(request,env,auth);
  if(!tenantContext.ok) return json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status);
  const schemaGate = await schemaColumnsReadinessResponse(env, {payment_transactions:['tenant_id'],payment_disputes:['tenant_id'],payment_audit:['tenant_id']}, 'PAYMENT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const body=await readJson(request), missionId=clean(body?.mission_id), reason=clean(body?.reason), amount=moneyCents(body?.amount_eur);
  if(!missionId||!reason||reason.length>1000||amount===null) return json({ok:false,error:'INVALID_DISPUTE',version:VERSION},400);
  const tenantId=tenantContext.tenant.id;
  const tx=await env.DB.prepare('SELECT * FROM payment_transactions WHERE mission_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 1').bind(missionId,tenantId).first();
  if(!tx) return json({ok:false,error:'PAYMENT_NOT_FOUND_FOR_MISSION',version:VERSION},404);
  if(auth.user.role==='client'){
    const ownsClient=await env.DB.prepare('SELECT 1 AS ok FROM clients WHERE id=? AND user_id=? AND tenant_id=? LIMIT 1').bind(tx.client_id,auth.user.id,tenantId).first();
    if(!ownsClient) return json({ok:false,error:'PAYMENT_NOT_FOUND_FOR_MISSION',version:VERSION},404);
  }
  if(amount<=0||amount>Number(tx.gross_cents||0)) return json({ok:false,error:'DISPUTE_AMOUNT_OUT_OF_RANGE',version:VERSION},400);
  if(tx.status!=='paid') return json({ok:false,error:'PAYMENT_NOT_DISPUTABLE_IN_CURRENT_STATE',version:VERSION,status:tx.status},409);
  const id=crypto.randomUUID();
  const results=await env.DB.batch([
    env.DB.prepare("UPDATE payment_transactions SET status='held',updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='paid'").bind(tx.id,tenantId),
    env.DB.prepare(`INSERT INTO payment_disputes
      (id,mission_id,transaction_id,client_id,intervenant_id,status,reason,amount_cents,tenant_id)
      SELECT ?,?,?,?,?,?,?,?,?
      WHERE EXISTS (SELECT 1 FROM payment_transactions WHERE id=? AND tenant_id=? AND status='held')`)
      .bind(id,missionId,tx.id,tx.client_id,tx.intervenant_id,'open',reason,amount,tenantId,tx.id,tenantId),
    env.DB.prepare(`INSERT INTO payment_audit
      (id,event_type,transaction_id,payout_id,mission_id,user_id,result,metadata_json,tenant_id)
      SELECT ?, 'PAYMENT_DISPUTE_OPENED', ?, NULL, ?, ?, 'OK', ?, ?
      WHERE EXISTS (SELECT 1 FROM payment_disputes WHERE id=? AND tenant_id=? AND status='open')`)
      .bind(crypto.randomUUID(),tx.id,missionId,auth.user.id,JSON.stringify({amount_cents:amount,reason}),tenantId,id,tenantId)
  ]);
  if(Number(results?.[0]?.meta?.changes||0)!==1||Number(results?.[1]?.meta?.changes||0)!==1) return json({ok:false,error:'PAYMENT_STATE_CONFLICT',version:VERSION},409);
  return json({ok:true,version:VERSION,dispute_id:id,status:'open',payment_status:'held'},201);
}

async function paymentAdminResolve(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user ? 403 : 401);
  // Refunds and releases must be executed and reconciled by the PSP adapter.
  return json({
    ok:false,
    error:'PSP_DISPUTE_SETTLEMENT_REQUIRED',
    message:'La résolution financière reste bloquée tant que le flux PSP de remboursement/libération et son rapprochement ne sont pas intégrés.',
    version:VERSION,
    write_enabled:false
  },409);
}



/* ============================================================
   PROCHÉLIA — DIRECTORY API
   Authenticated, bounded and deterministic directory pagination.
   Personal fields are limited to those required by the manager UI.
=============================================================== */
function parseDirectoryOffset(url) {
  const raw = url.searchParams.get('offset') ?? '0';
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function directoryList(
  request, env, kind,
  resolveSession = getSessionUser,
  resolveTenant = resolveTenantContext
) {
  const auth = await resolveSession(request, env);
  if (!auth) return json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401);
  if (auth.user.role !== 'gerante') return json({ok:false,error:'FORBIDDEN',version:VERSION},403);
  if (!env?.DB) return json({ok:false,database:false,error:'DATABASE_UNAVAILABLE',version:VERSION},503);
  if (!['clients','intervenants'].includes(kind)) return json({ok:false,error:'INVALID_DIRECTORY_KIND',version:VERSION},400);

  const url = new URL(request.url);
  const offset = parseDirectoryOffset(url);
  if (offset === null) return json({ok:false,error:'INVALID_OFFSET',version:VERSION},400);

  let tenantContext;
  try {
    tenantContext = await resolveTenant(request, env, auth);
  } catch {
    return json({ok:false,error:'TENANT_CONTEXT_UNAVAILABLE',version:VERSION},503);
  }
  if (!tenantContext?.ok || !tenantContext.tenant?.id) {
    return json({ok:false,error:tenantContext?.error||'ACTIVE_TENANT_REQUIRED',version:VERSION},tenantContext?.status||403);
  }

  const table = kind === 'clients' ? 'clients' : 'intervenants';
  let columns;
  try {
    columns = await tableColumns(env, table);
  } catch {
    return json({ok:false,error:'TENANT_DIRECTORY_SCHEMA_UNAVAILABLE',version:VERSION},503);
  }
  if (!columns.includes('tenant_id')) {
    return json({ok:false,error:'TENANT_DIRECTORY_SCHEMA_REQUIRED',version:VERSION,write_enabled:false},503);
  }

  const pageSize = 100;
  const limit = pageSize + 1;
  let rows;
  if (kind === 'clients') {
    rows = await env.DB.prepare(
      `SELECT c.id,c.user_id,c.address,c.city,c.postal_code,c.created_at,c.updated_at,
              u.first_name,u.last_name,u.email,u.phone,u.status AS user_status
         FROM clients c JOIN users u ON u.id=c.user_id
        WHERE c.tenant_id=?
        ORDER BY c.created_at ASC,c.id ASC LIMIT ? OFFSET ?`
    ).bind(tenantContext.tenant.id, limit, offset).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT i.id,i.user_id,i.professional_status,i.description,i.service_area,
              i.hourly_rate,i.validation_status,i.created_at,i.updated_at,
              u.first_name,u.last_name,u.email,u.phone,u.status AS user_status
         FROM intervenants i JOIN users u ON u.id=i.user_id
        WHERE i.tenant_id=?
        ORDER BY i.created_at ASC,i.id ASC LIMIT ? OFFSET ?`
    ).bind(tenantContext.tenant.id, limit, offset).all();
  }

  const fetched = rows.results || [];
  const hasMore = fetched.length > pageSize;
  const items = fetched.slice(0, pageSize);
  return json({
    ok:true,
    version:VERSION,
    items,
    pagination:{offset,limit:pageSize,returned:items.length,has_more:hasMore,next_offset:hasMore ? offset + pageSize : null},
    has_more:hasMore,
    next_offset:hasMore ? offset + pageSize : null
  });
}

async function handleBase(request, env) {
  const url = new URL(request.url);


  if (url.pathname.startsWith('/api/security/device/')) {
    const deviceAuth = await getSessionUser(request, env);
    if (!deviceAuth) return json({ ok: false, error: 'UNAUTHENTICATED', version: VERSION }, 401);
    let deviceTenantContext;
    try {
      deviceTenantContext = await resolveTenantContext(request, env, deviceAuth);
    } catch {
      return json({ ok: false, error: 'TENANT_CONTEXT_UNAVAILABLE', version: VERSION, write_enabled: false }, 503);
    }
    return handleDeviceTrustRoute(request, env, deviceAuth, deviceTenantContext, requireVerifiedIntervenant);
  }

  if (url.pathname === '/api/clients') {
    if (request.method !== 'GET') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{'allow':'GET'});
    return directoryList(request,env,'clients');
  }

  if (url.pathname === '/api/intervenants') {
    if (request.method !== 'GET') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{'allow':'GET'});
    return directoryList(request,env,'intervenants');
  }

  if (url.pathname === '/api/security/identity/start') {
    if (request.method !== 'POST') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityIdentityStart(request, env);
  }
  if (url.pathname === '/api/security/identity/approve') {
    if (request.method !== 'POST') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityIdentityApprove(request, env);
  }
  if (url.pathname === '/api/security/mission/prepare') {
    if (request.method !== 'POST') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityPrepareMission(request, env);
  }
  if (url.pathname === '/api/security/presence') {
    if (request.method !== 'POST') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityPresence(request, env);
  }
  if (url.pathname === '/api/security/code/verify') {
    if (request.method !== 'POST') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityVerifyCode(request, env);
  }
  if (url.pathname === '/api/security/resend') {
    if (request.method !== 'POST') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405);
    return securityResendCodes(request, env);
  }
  if (url.pathname === '/api/security/client-code') {
    if (request.method !== 'GET') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityClientCode(request, env);
  }
  if (url.pathname === '/api/security/status') {
    if (request.method !== 'GET') return json({ ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION },405);
    return securityStatus(request, env);
  }

  if (url.pathname === '/api/health') {
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return health(env);
  }

  if (url.pathname === '/api/prestations') {
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return getPrestations(env);
  }

  if (url.pathname === '/api/core/schema') {
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return coreAccountsSchema(env);
  }

  if (url.pathname === '/api/missions/schema') {
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return missionsSchema(env);
  }

  if (url.pathname === '/api/missions/validate') {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    // Fail closed until validation is bound to the authenticated actor and
    // ownership/participation checks. Otherwise this endpoint can be used as
    // an unauthenticated oracle for client, provider and service IDs.
    return json({ ok: false, error: 'AUTHENTICATED_VALIDATION_REQUIRED', version: VERSION, write_enabled: false }, 403);
  }

  if (url.pathname === '/api/missions') {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return postMissions(request, env);
  }

  if (url.pathname === '/api/auth/status') {
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return authStatus(request, env);
  }

  if (url.pathname === '/api/auth/login') {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return login(request, env);
  }

  if (url.pathname === '/api/auth/logout') {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return logout(request, env);
  }

  if (url.pathname === '/api/auth/me') {
    if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return me(request, env);
  }

  if (url.pathname === '/api/auth/bootstrap') {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
    return bootstrap(request, env);
  }

  if (url.pathname === '/api/tenant/memberships') {
    return tenantMembershipsRoute(request, env);
  }

  if (url.pathname === '/api/tenant/context') {
    return tenantContextRoute(request, env);
  }

  if (url.pathname === '/api/tenant/select') {
    return selectTenantForSession(request, env);
  }

  if (url.pathname === '/api/readiness') {
    if (request.method !== 'GET') return json({ ok: false, ready: false, database: false, version: VERSION }, 503);
    if (!env.DB) return json({ ok: false, ready: false, database: false, version: VERSION }, 503);
    const h = await env.DB.prepare('SELECT 1 AS ok').first();
    const s = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='missions';").first();
    const u = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users';").first();
    return json({
      ok: true,
      ready: h?.ok === 1 && !!s?.sql && !!u?.sql,
      database: h?.ok === 1,
      missions_schema: !!s?.sql,
      users_schema: !!u?.sql,
      writes: false,
      version: VERSION
    });
  }

  // Payment endpoints are explicitly routed, but money movement remains fail-closed
  // until a reviewed PSP adapter and reconciled double-entry settlement are delivered.
  if (url.pathname === '/api/payments/status') {
    if (request.method !== 'GET') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'GET'});
    return paymentStatus(request, env);
  }
  if (url.pathname === '/api/payments/onboard') {
    if (request.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'POST'});
    return paymentOnboard(request, env);
  }
  if (url.pathname === '/api/payments/mission/create') {
    if (request.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'POST'});
    return createMissionPayment(request, env);
  }
  if (url.pathname === '/api/payments/mission/finalize') {
    if (request.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'POST'});
    return finalizeMissionPayment(request, env);
  }
  if (url.pathname === '/api/payments/payout') {
    if (request.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'POST'});
    return payoutRequest(request, env);
  }
  if (url.pathname === '/api/payments/dispute') {
    if (request.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'POST'});
    return openPaymentDispute(request, env);
  }
  if (url.pathname === '/api/payments/dispute/resolve') {
    if (request.method !== 'POST') return json({ ok:false, error:'METHOD_NOT_ALLOWED', version:VERSION },405,{allow:'POST'});
    return paymentAdminResolve(request, env);
  }

  if (url.pathname === '/api/info') {
    return json({
      ok: true,
      service: 'PROCHÉLIA API',
      version: VERSION,
      database: !!env.DB,
      routes: [
        '/api/health','/api/prestations','/api/core/schema',
        '/api/missions/schema','/api/missions/validate','/api/missions',
        '/api/auth/status','/api/auth/login','/api/auth/logout','/api/auth/me',
        '/api/auth/bootstrap','/api/tenant/context','/api/tenant/memberships','/api/tenant/select','/api/security/device/enroll/challenge','/api/security/device/enroll/complete','/api/security/device/prove/challenge','/api/security/device/prove/complete','/api/security/device/list','/api/security/device/revoke','/api/security/identity/start','/api/security/identity/approve','/api/security/mission/prepare','/api/security/presence','/api/security/code/verify','/api/security/resend','/api/security/client-code','/api/security/status','/api/payments/onboard','/api/payments/status','/api/payments/mission/create','/api/payments/mission/finalize','/api/payments/payout','/api/payments/webhook','/api/payments/dispute','/api/payments/dispute/resolve','/api/readiness','/api/info'
      ],
      writes: { missions: false, bootstrap: true, tenant_selection: true },
      status: 'AUTH_RBAC_IDENTITY_PRESENCE_SECURITY_HARDENED_FOR_TEST'
    });
  }

  return json({ ok: false, error: 'NOT_FOUND', service: 'PROCHÉLIA API', version: VERSION }, 404);
}


/* ============================================================
   PROCHÉLIA V13.6.0 — CONSOLIDATION OPÉRATIONNELLE UNIQUE
   Un seul moteur transversal : métiers → missions → incidents →
   résolution → finance → comptabilité → commercial → recrutement →
   Copilote → audit. Aucun second moteur métier n'est créé.
   Les paiements réels restent délégués à un PSP configuré.
=============================================================== */

const PROJECT_PHASES = {
  TEST:       {automation:'ASSISTED', pricingFactor:0.90, autoSimple:true},
  LANCEMENT:  {automation:'SEMI_AUTO', pricingFactor:0.94, autoSimple:true},
  AVANCE:     {automation:'AUTO', pricingFactor:1.00, autoSimple:true},
  EXPERT:     {automation:'AUTO_PLUS', pricingFactor:1.03, autoSimple:true},
  NATIONAL:   {automation:'INDUSTRIAL', pricingFactor:1.05, autoSimple:true}
};

const CASE_PRIORITIES = { LOW:10, MEDIUM:30, HIGH:60, CRITICAL:100 };
const SIMPLE_CASES = new Set([
  'retard_leger','notification_non_envoyee','document_expire_non_critique',
  'facture_non_envoyee','rappel_commercial','rappel_document','absence_confirmation',
  'petit_ecart_tarifaire','reclamation_information','incident_technique_recoverable'
]);
const SENSITIVE_CASES = new Set([
  'fraude','identite','securite_domicile','paiement_conteste','remboursement_important',
  'litige_juridique','suspension_intervenant','incident_majeur','violation_donnees',
  'decision_contractuelle','conflit_reglementaire'
]);

async function ensureConsolidatedSchema(env) {
  if (!env.DB) throw new Error('DATABASE_REQUIRED');
  const statements = [
    `CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS business_profiles (id TEXT PRIMARY KEY, kind TEXT NOT NULL, display_name TEXT, owner_user_id TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS métier_catalog (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, category TEXT, active INTEGER NOT NULL DEFAULT 1, rules_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS metier_suggestions (id TEXT PRIMARY KEY, label TEXT NOT NULL, reason TEXT, source TEXT NOT NULL DEFAULT 'copilot', status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS pricing_policies (id TEXT PRIMARY KEY, phase TEXT NOT NULL, service_code TEXT, client_type TEXT NOT NULL, intervenant_floor_cents INTEGER NOT NULL DEFAULT 0, client_ceiling_cents INTEGER NOT NULL DEFAULT 0, platform_fee_fixed_cents INTEGER NOT NULL DEFAULT 0, platform_fee_percent REAL NOT NULL DEFAULT 0, psp_percent REAL NOT NULL DEFAULT 0, psp_fixed_cents INTEGER NOT NULL DEFAULT 0, software_cost_cents INTEGER NOT NULL DEFAULT 0, fuel_cost_per_km_cents INTEGER NOT NULL DEFAULT 0, target_margin_percent REAL NOT NULL DEFAULT 0, market_min_cents INTEGER, market_max_cents INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS pricing_quotes (id TEXT PRIMARY KEY, phase TEXT NOT NULL, client_type TEXT NOT NULL, service_code TEXT, distance_km REAL NOT NULL DEFAULT 0, duration_minutes INTEGER NOT NULL DEFAULT 0, client_price_cents INTEGER NOT NULL DEFAULT 0, intervenant_amount_cents INTEGER NOT NULL DEFAULT 0, platform_commission_cents INTEGER NOT NULL DEFAULT 0, psp_cost_cents INTEGER NOT NULL DEFAULT 0, software_cost_cents INTEGER NOT NULL DEFAULT 0, fuel_cost_cents INTEGER NOT NULL DEFAULT 0, estimated_margin_cents INTEGER NOT NULL DEFAULT 0, assumptions_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS operational_cases (id TEXT PRIMARY KEY, case_type TEXT NOT NULL, source TEXT NOT NULL, phase TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 10, status TEXT NOT NULL DEFAULT 'OPEN', auto_mode TEXT NOT NULL DEFAULT 'PROPOSE', client_id TEXT, company_id TEXT, intervenant_id TEXT, mission_id TEXT, impact_level TEXT NOT NULL DEFAULT 'LOW', description TEXT, context_json TEXT NOT NULL DEFAULT '{}', proposed_solution_json TEXT, resolution_json TEXT, requires_manager INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_status ON operational_cases(status, priority, created_at)`,
    `CREATE TABLE IF NOT EXISTS case_actions (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, action_code TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PROPOSED', payload_json TEXT NOT NULL DEFAULT '{}', result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS copilot_log (id TEXT PRIMARY KEY, case_id TEXT, action_type TEXT NOT NULL, recommendation TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0, mode TEXT NOT NULL, approved_by TEXT, result TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS activity_journal (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, result TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS commercial_tasks (id TEXT PRIMARY KEY, company_id TEXT, client_id TEXT, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', due_at TEXT, priority INTEGER NOT NULL DEFAULT 10, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS recruitment_tasks (id TEXT PRIMARY KEY, candidate_id TEXT, metier_code TEXT, status TEXT NOT NULL DEFAULT 'OPEN', step TEXT NOT NULL DEFAULT 'SCREENING', priority INTEGER NOT NULL DEFAULT 10, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS complaints (id TEXT PRIMARY KEY, client_type TEXT NOT NULL, client_id TEXT, company_id TEXT, mission_id TEXT, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', severity TEXT NOT NULL DEFAULT 'LOW', description TEXT, resolution_case_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS accounting_ledger (id TEXT PRIMARY KEY, reference_type TEXT NOT NULL, reference_id TEXT NOT NULL, account_code TEXT NOT NULL, direction TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', label TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_ledger_ref ON accounting_ledger(reference_type, reference_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS business_expenses (id TEXT PRIMARY KEY, category TEXT NOT NULL, supplier TEXT, amount_cents INTEGER NOT NULL, recurring INTEGER NOT NULL DEFAULT 0, period TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS notification_outbox (id TEXT PRIMARY KEY, channel TEXT NOT NULL, recipient_ref TEXT NOT NULL, template TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS compliance_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, severity TEXT NOT NULL, entity_type TEXT, entity_id TEXT, status TEXT NOT NULL DEFAULT 'OPEN', details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT)`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
  const defaults = {
    project_phase:'TEST',
    fuel_cost_per_km_cents:'20',
    default_margin_percent:'15',
    software_monthly_cost_cents:'0',
    automation_policy:'simple_low_impact_auto_sensitive_manager',
    b2b_model:'company_pays_intervenant_platform_bills_commission',
    b2c_model:'client_pays_platform_platform_pays_intervenant'
  };
  for (const [key,value] of Object.entries(defaults)) {
    await env.DB.prepare(`INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES(?,?)`).bind(key, JSON.stringify(value)).run();
  }
}

async function getSetting(env,key,fallback=null) {
  const r=await env.DB.prepare('SELECT value_json FROM platform_settings WHERE key=? LIMIT 1').bind(key).first();
  if (!r) return fallback;
  try { return JSON.parse(r.value_json); } catch { return fallback; }
}

async function requireAuthRole(request, env, roles=[]) {
  const auth = await getSessionUser(request, env);
  if (!auth) return { error: json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401) };
  if (roles.length && !roles.includes(auth.user.role)) return { error: json({ok:false,error:'FORBIDDEN',version:VERSION},403) };
  return { auth };
}

// Tenant-scoped authorization foundation. Business data handlers must use the
// membership role resolved from the authenticated session, never a client header
// or the user's global role.
function legacyTenantScopeBlocked() {
  return json({
    ok: false,
    error: "TENANT_DATA_SCOPE_NOT_MIGRATED",
    message: "This legacy resource is temporarily unavailable until tenant ownership and row-level isolation are validated.",
    version: VERSION
  }, 503);
}

export async function requireTenantAuthRole(request, env, allowedTenantRoles = []) {
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return { error: json({ ok: false, error: "AUTH_CONTEXT_UNAVAILABLE", version: VERSION }, 503) };
  }
  if (!auth) {
    return { error: json({ ok: false, error: "UNAUTHENTICATED", version: VERSION }, 401) };
  }
  if (!Array.isArray(allowedTenantRoles) || allowedTenantRoles.length === 0) {
    return { error: json({ ok: false, error: "TENANT_ROLE_POLICY_REQUIRED", version: VERSION }, 500) };
  }
  const context = await resolveTenantContext(request, env, auth);
  if (!context.ok) {
    return { error: json({ ok: false, error: context.error, version: VERSION }, context.status) };
  }
  if (!tenantRoleAllowed(context, allowedTenantRoles)) {
    return { error: json({ ok: false, error: "FORBIDDEN", version: VERSION }, 403) };
  }
  return { auth, tenant: context.tenant };
}

async function journal(env, actorType, actorId, action, entityType=null, entityId=null, result='OK', metadata={}) {
  await env.DB.prepare(`INSERT INTO activity_journal(id,actor_type,actor_id,action,entity_type,entity_id,result,metadata_json) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),actorType,actorId,action,entityType,entityId,result,JSON.stringify(metadata)).run();
}

async function copilotRecommend(env, input) {
  const { caseType, impact='LOW', phase='TEST', context={} } = input;
  const sensitive = SENSITIVE_CASES.has(caseType) || impact === 'CRITICAL' || impact === 'HIGH';
  const simple = SIMPLE_CASES.has(caseType) && !sensitive;
  let action = 'ANALYZE_AND_PROPOSE';
  let solution = { steps:['qualify','simulate','notify','audit'], automatic:false };
  if (simple) {
    action='AUTO_RESOLVE';
    solution={steps:['detect','validate_rules','execute','verify','notify','audit','close'],automatic:true};
  } else if (caseType==='retard_intervenant' || caseType==='absence_intervenant' || caseType==='aucun_profil_disponible') {
    action='SEARCH_REPLACEMENT';
    solution={steps:['recalculate_delay','search_qualified_available_profiles','score_distance_reliability','propose_replacement','notify','audit'],automatic:false};
  } else if (caseType==='panne_application' || caseType==='incident_technique') {
    action='CONTINUITY';
    solution={steps:['isolate_failure','protect_client_flow','retry_safe_operation','fallback_channel','verify','audit'],automatic:!sensitive};
  } else if (caseType==='reclamation_client' || caseType==='litige') {
    action='RESOLVE_CASE';
    solution={steps:['collect_evidence','reconcile_mission','reconcile_finance','calculate_impact','propose_resolution','notify','audit'],automatic:false};
  }
  return { action, mode: solution.automatic ? 'AUTO' : 'MANAGER_APPROVAL', confidence: simple ? 0.95 : 0.82, solution, context, phase };
}

async function createOperationalCase(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','intervenant','entreprise']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  const body=await readJson(request)||{};
  const caseType=clean(body.case_type); if(!caseType)return json({ok:false,error:'CASE_TYPE_REQUIRED',version:VERSION},400);
  const phase=String(await getSetting(env,'project_phase','TEST')).toUpperCase();
  const impact=String(body.impact_level||'LOW').toUpperCase();
  const priority=CASE_PRIORITIES[impact]||10;
  const rec=await copilotRecommend(env,{caseType,impact,phase,context:body.context||{}});
  const id=crypto.randomUUID();
  const requiresManager=rec.mode==='MANAGER_APPROVAL' ? 1 : 0;
  const status=rec.action==='AUTO_RESOLVE' ? 'AUTO_PENDING' : 'OPEN';
  await env.DB.prepare(`INSERT INTO operational_cases(id,case_type,source,phase,priority,status,auto_mode,client_id,company_id,intervenant_id,mission_id,impact_level,description,context_json,proposed_solution_json,requires_manager) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,caseType,'API',phase,priority,status,rec.mode,clean(body.client_id)||null,clean(body.company_id)||null,clean(body.intervenant_id)||null,clean(body.mission_id)||null,impact,clean(body.description)||null,JSON.stringify(body.context||{}),JSON.stringify(rec),requiresManager).run();
  await env.DB.prepare(`INSERT INTO copilot_log(id,case_id,action_type,recommendation,confidence,mode) VALUES(?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),id,rec.action,JSON.stringify(rec.solution),rec.confidence,rec.mode).run();
  await journal(env,'copilot',null,'CASE_CREATED','operational_case',id,'OK',{caseType,impact});
  if(rec.action==='AUTO_RESOLVE') await executeOperationalCase(env,id,null,true);
  return json({ok:true,version:VERSION,case_id:id,recommendation:rec,status:rec.action==='AUTO_RESOLVE'?'AUTO_EXECUTED':'WAITING_MANAGER'},201);
}


async function getTableColumns(env, table) {
  if (!env.DB) return [];
  if (!/^[A-Za-z0-9_]+$/.test(table)) return [];
  const r = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return (r.results || []).map(x => String(x.name));
}

async function enqueueAction(env, caseId, actionType, payload, idempotencyKey) {
  const key = clean(idempotencyKey) || `${caseId}:${actionType}`;
  const existing = await env.DB.prepare('SELECT * FROM action_outbox WHERE idempotency_key=? LIMIT 1').bind(key).first();
  if (existing) return { created:false, id:existing.id, status:existing.status };
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO action_outbox(id,case_id,action_type,idempotency_key,payload_json,status,attempts) VALUES(?,?,?,?,?,'PENDING',0)`)
    .bind(id,caseId,actionType,key,JSON.stringify(payload||{})).run();
  return { created:true, id, status:'PENDING' };
}

async function executeCaseBusinessAction(env, c, rec, actorId=null, automatic=false) {
  const action = String(rec?.action || '').toUpperCase();
  const context = c.context_json ? JSON.parse(c.context_json) : {};
  const solution = rec?.solution || {};
  const results = [];

  // Safe, idempotent operational effects that do not require an external PSP/provider.
  if (c.mission_id && (action === 'AUTO_RESOLVE' || action === 'CONTINUITY' || action === 'RESOLVE_CASE')) {
    const queued = await enqueueAction(env,c.id,'MISSION_VERIFY_AND_NOTIFY',{mission_id:c.mission_id,case_id:c.id,reason:c.case_type},`${c.id}:mission-verify-notify`);
    results.push({action:'MISSION_VERIFY_AND_NOTIFY',...queued});
  }

  if (action === 'SEARCH_REPLACEMENT' || c.case_type === 'absence_intervenant' || c.case_type === 'retard_intervenant') {
    const replacementId = clean(context.replacement_intervenant_id || context.replacement_id);
    if (replacementId && c.mission_id) {
      // Do not write mission assignment directly: this path has not yet proven
      // tenant ownership, qualification, availability, conflict-free scheduling,
      // and a transactional mission-state transition.
      const queued=await enqueueAction(env,c.id,'ASSIGN_REPLACEMENT',{mission_id:c.mission_id,intervenant_id:replacementId},`${c.id}:replacement:${replacementId}`);
      results.push({action:'ASSIGN_REPLACEMENT',...queued,reason:'VERIFIED_ASSIGNMENT_WORKFLOW_REQUIRED'});
    } else {
      const queued=await enqueueAction(env,c.id,'SEARCH_REPLACEMENT',{mission_id:c.mission_id||null,criteria:context.replacement_criteria||{},case_type:c.case_type},`${c.id}:search-replacement`);
      results.push({action:'SEARCH_REPLACEMENT',...queued});
    }
  }

  if (context.reschedule_start_at && c.mission_id) {
    // Rescheduling remains queued until the tenant-scoped mission executor
    // validates ownership, allowed state transition and conflict checks.
    const queued=await enqueueAction(env,c.id,'RESCHEDULE_MISSION',{mission_id:c.mission_id,start_at:context.reschedule_start_at},`${c.id}:reschedule:${context.reschedule_start_at}`);
    results.push({action:'RESCHEDULE_MISSION',...queued,reason:'TENANT_SCOPED_MISSION_EXECUTOR_REQUIRED'});
  }

  if (context.client_notification || c.client_id || c.company_id) {
    const queued=await enqueueAction(env,c.id,'NOTIFY_CLIENT',{client_id:c.client_id||null,company_id:c.company_id||null,mission_id:c.mission_id||null,message:context.client_notification||solution.notification||`Mise à jour de votre dossier PROCHÉLIA : ${c.case_type}.`},`${c.id}:notify-client`);
    results.push({action:'NOTIFY_CLIENT',...queued});
  }

  // Financial actions are deliberately queued for the real PSP adapter; no fake money movement.
  if (context.refund_cents || action === 'REFUND_REQUEST') {
    const queued=await enqueueAction(env,c.id,'PSP_REFUND_REVIEW',{mission_id:c.mission_id||null,amount_cents:Math.max(0,Number(context.refund_cents||0)),reason:c.description||c.case_type},`${c.id}:psp-refund`);
    results.push({action:'PSP_REFUND_REVIEW',...queued});
  }

  await journal(env,automatic?'copilot':'gerante',actorId,'CASE_BUSINESS_ACTIONS_EXECUTED','operational_case',c.id,'OK',{results});
  return results;
}

async function processActionOutbox(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  const schemaGate = await schemaReadinessResponse(env, ['action_outbox','copilot_briefings','loyalty_events','loyalty_balances','quality_events','b2b_leads','capacity_snapshots','finance_forecasts','system_checks'], 'OPERATIONAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const rows=await env.DB.prepare(`SELECT * FROM action_outbox WHERE status='PENDING' ORDER BY created_at ASC LIMIT 50`).all();
  const processed=[];
  for(const row of (rows.results||[])) {
    // No action type is considered complete merely because it was read from the
    // outbox. A dedicated executor must perform the side effect and a verifier
    // must persist VERIFIED before this row can become COMPLETED.
    const status='WAITING_IMPLEMENTATION';
    const reason='NO_VERIFIED_EXECUTOR_REGISTERED';
    await env.DB.prepare(`UPDATE action_outbox SET status=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'`)
      .bind(status,reason,row.id).run();
    processed.push({id:row.id,status,action_type:row.action_type,reason});
  }
  await journal(env,'gerante',gate.auth.user.id,'ACTION_OUTBOX_PROCESSED','system',null,'WAITING_IMPLEMENTATION',{count:processed.length});
  return json({ok:true,version:VERSION,processed},200);
}

async function executeOperationalCase(env, caseId, approverId=null, automatic=false) {
  const c=await env.DB.prepare('SELECT * FROM operational_cases WHERE id=? LIMIT 1').bind(caseId).first();
  if(!c)return {ok:false,error:'CASE_NOT_FOUND'};
  if(c.status==='RESOLVED')return {ok:true,already:true};
  const rec=c.proposed_solution_json?JSON.parse(c.proposed_solution_json):{};
  if(c.requires_manager && !automatic && !approverId) return {ok:false,error:'MANAGER_APPROVAL_REQUIRED'};
  const businessResults = await executeCaseBusinessAction(env,c,rec,approverId,automatic);
  // Queue acceptance or a direct write is not independent proof of completion.
  // Close only when every requested effect has an explicit VERIFIED result.
  const verified = businessResults.length > 0 && businessResults.every(x => x?.status === 'VERIFIED');
  const nextStatus = verified ? 'RESOLVED' : 'IN_PROGRESS';
  const resolution={executed:verified,automatic,action:rec.action||'RESOLVE',steps:rec.solution?.steps||[],business_results:businessResults,verification_required:!verified,executed_at:new Date().toISOString()};
  await env.DB.prepare(`INSERT INTO case_actions(id,case_id,action_code,mode,status,payload_json,result_json,completed_at) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),caseId,rec.action||'RESOLVE',automatic?'AUTO':'MANAGER',verified?'VERIFIED':'PENDING',JSON.stringify(rec),JSON.stringify(resolution),verified?new Date().toISOString():null).run();
  await env.DB.prepare(`UPDATE operational_cases SET status=?,resolution_json=?,requires_manager=CASE WHEN ?='RESOLVED' THEN 0 ELSE requires_manager END,updated_at=CURRENT_TIMESTAMP,resolved_at=? WHERE id=?`)
    .bind(nextStatus,JSON.stringify(resolution),nextStatus,verified?new Date().toISOString():null,caseId).run();
  await env.DB.prepare(`UPDATE copilot_log SET approved_by=COALESCE(?,approved_by),result=? WHERE case_id=? AND id=(SELECT id FROM copilot_log WHERE case_id=? ORDER BY created_at DESC LIMIT 1)`).bind(approverId,JSON.stringify(resolution),caseId,caseId).run();
  await journal(env,automatic?'copilot':'gerante',approverId,verified?'CASE_RESOLVED':'CASE_ACTIONS_PENDING','operational_case',caseId,verified?'OK':'PENDING_VERIFICATION',resolution);
  return {ok:true,case_id:caseId,status:nextStatus,resolution};
}

async function approveOperationalCase(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  const body=await readJson(request)||{}; if(!body.case_id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const result=await executeOperationalCase(env,body.case_id,gate.auth.user.id,false);
  return json({...result,version:VERSION},result.ok?200:409);
}

async function getOperationsDashboard(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  const queries={
    open_cases:"SELECT COUNT(*) AS n FROM operational_cases WHERE status NOT IN ('RESOLVED','CLOSED')",
    auto_cases:"SELECT COUNT(*) AS n FROM operational_cases WHERE status='RESOLVED' AND auto_mode='AUTO'",
    complaints:"SELECT COUNT(*) AS n FROM complaints WHERE status NOT IN ('RESOLVED','CLOSED')",
    commercial:"SELECT COUNT(*) AS n FROM commercial_tasks WHERE status='OPEN'",
    recruitment:"SELECT COUNT(*) AS n FROM recruitment_tasks WHERE status='OPEN'",
    notifications:"SELECT COUNT(*) AS n FROM notification_outbox WHERE status='PENDING'",
    ledger:"SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_cents ELSE -amount_cents END),0) AS n FROM accounting_ledger"
  };
  const out={}; for(const [k,q] of Object.entries(queries)){const r=await env.DB.prepare(q).first();out[k]=Number(r?.n||0);}
  return json({ok:true,version:VERSION,phase:await getSetting(env,'project_phase','TEST'),automation:'simple_low_impact_auto_sensitive_manager',dashboard:out},200);
}

async function getJournal(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  const type=new URL(request.url).searchParams.get('type');
  const tables={copilot_log:'SELECT * FROM copilot_log ORDER BY created_at DESC LIMIT 200',activity_journal:'SELECT * FROM activity_journal ORDER BY created_at DESC LIMIT 200',commercial_tasks:'SELECT * FROM commercial_tasks ORDER BY created_at DESC LIMIT 200',recruitment_tasks:'SELECT * FROM recruitment_tasks ORDER BY created_at DESC LIMIT 200',operational_cases:'SELECT * FROM operational_cases ORDER BY created_at DESC LIMIT 200'};
  if(type && !tables[type])return json({ok:false,error:'UNKNOWN_JOURNAL',version:VERSION},400);
  if(type){const r=await env.DB.prepare(tables[type]).all();return json({ok:true,version:VERSION,type,rows:r.results||[]});}
  const all={};for(const [k,q] of Object.entries(tables)){const r=await env.DB.prepare(q).all();all[k]=r.results||[];}
  return json({ok:true,version:VERSION,journals:all});
}

async function metiers(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','entreprise','client','intervenant']); if(gate.error)return gate.error;
  const r=await env.DB.prepare('SELECT * FROM métier_catalog WHERE active=1 ORDER BY category,label').all();
  return json({ok:true,version:VERSION,metiers:r.results||[]});
}

async function suggestMetier(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const body=await readJson(request)||{};const label=clean(body.label);if(!label)return json({ok:false,error:'LABEL_REQUIRED',version:VERSION},400);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO metier_suggestions(id,label,reason,source) VALUES(?,?,?,?)').bind(id,label,clean(body.reason)||'Opportunité détectée par le Copilote',clean(body.source)||'copilot').run();
  await journal(env,'gerante',gate.auth.user.id,'METIER_SUGGESTED','metier_suggestion',id,'OK');
  return json({ok:true,version:VERSION,id,status:'proposed'},201);
}


/* ==================== V14 FINANCE STRATEGIC CORE ====================
   Intégration additive dans le moteur V14 unique.
   Aucun deuxième moteur financier : ces fonctions alimentent
   /api/pricing/quote et les synthèses finance existantes.
==================================================================== */
const FINANCE_STRATEGIC_VERSION = 'V14-FINANCE-1.1.0';
const FINANCE_STRATEGIC = Object.freeze({
  commissionDefaultPercent: 20,
  marginFloorPercent: 12,
  marginFloorCents: 200,
  fuel: {
    normalCentsPerLitre: 175,
    highCentsPerLitre: 200,
    consumptionL100: 6.5,
    maintenanceCentsPerKm: 10,
    insuranceCentsPerKm: 3,
    wearCentsPerKm: 4
  },
  multipliers: {
    urgency: { normal: 1, rapid: 1.10, urgent: 1.20, very_urgent: 1.35, immediate: 1.50 },
    evening: 1.15,
    night: 1.30,
    saturday: 1.10,
    sunday: 1.25,
    holiday: 1.35,
    last_minute: 1.15
  }
});

function financeStrategicTravel({distanceKm=0,fuelMode='normal',fuelPriceCentsPerLitre=null}={}) {
  const distance=Math.max(0,Number(distanceKm)||0);
  const fuelPrice=Number(fuelPriceCentsPerLitre ?? (String(fuelMode).toLowerCase()==='high'
    ? FINANCE_STRATEGIC.fuel.highCentsPerLitre
    : FINANCE_STRATEGIC.fuel.normalCentsPerLitre));
  const fuelCentsPerKm=fuelPrice*(FINANCE_STRATEGIC.fuel.consumptionL100/100);
  const realCentsPerKm=fuelCentsPerKm+
    FINANCE_STRATEGIC.fuel.maintenanceCentsPerKm+
    FINANCE_STRATEGIC.fuel.insuranceCentsPerKm+
    FINANCE_STRATEGIC.fuel.wearCentsPerKm;
  return {
    distance_km:Number(distance.toFixed(2)),
    fuel_mode:String(fuelMode).toLowerCase()==='high'?'high':'normal',
    fuel_price_cents_per_litre:Number(fuelPrice.toFixed(2)),
    fuel_cost_cents_per_km:Number(fuelCentsPerKm.toFixed(2)),
    real_cost_cents_per_km:Number(realCentsPerKm.toFixed(2)),
    total_cost_cents:Math.max(0,Math.round(distance*realCentsPerKm))
  };
}

function financeStrategicQuote({basePriceCents=0,phaseFactor=1,urgency='normal',evening=false,night=false,saturday=false,sunday=false,holiday=false,lastMinute=false,distanceKm=0,fuelMode='normal',commissionRate=0.20,commissionFixedCents=0,discountCents=0,regulatedMaxCents=null,intervenantFloorCents=0,pspPercent=0,pspFixedCents=0,softwareCostCents=0,targetMarginPercent=12}={}) {
  let service=Math.max(0,Math.round((Number(basePriceCents)||0)*(Number(phaseFactor)||1)));
  const u=String(urgency||'normal').toLowerCase();
  service=Math.round(service*(FINANCE_STRATEGIC.multipliers.urgency[u] ?? 1));
  if(evening)service=Math.round(service*FINANCE_STRATEGIC.multipliers.evening);
  if(night)service=Math.round(service*FINANCE_STRATEGIC.multipliers.night);
  if(saturday)service=Math.round(service*FINANCE_STRATEGIC.multipliers.saturday);
  if(sunday)service=Math.round(service*FINANCE_STRATEGIC.multipliers.sunday);
  if(holiday)service=Math.round(service*FINANCE_STRATEGIC.multipliers.holiday);
  if(lastMinute)service=Math.round(service*FINANCE_STRATEGIC.multipliers.last_minute);
  service=Math.max(0,service-Math.max(0,Math.round(Number(discountCents)||0)));
  if(regulatedMaxCents!=null)service=Math.min(service,Math.max(0,Math.round(Number(regulatedMaxCents)||0)));
  const travel=financeStrategicTravel({distanceKm,fuelMode});
  const rate=Math.max(0,Number(commissionRate)||0);
  const percentageCommission=Math.round(service*rate);
  const fixedCommission=Math.max(0,Math.round(Number(commissionFixedCents)||0));
  const commission=percentageCommission+fixedCommission;
  let clientPrice=service+travel.total_cost_cents;
  // The configured ceiling applies to the final customer total, including travel.
  if(regulatedMaxCents!=null) clientPrice=Math.min(clientPrice,Math.max(0,Math.round(Number(regulatedMaxCents)||0)));
  const intervenant=Math.max(0,Math.round(Number(intervenantFloorCents)||0));
  const psp=Math.round(clientPrice*(Math.max(0,Number(pspPercent)||0)/100))+Math.max(0,Math.round(Number(pspFixedCents)||0));
  const software=Math.max(0,Math.round(Number(softwareCostCents)||0));
  let margin=clientPrice-intervenant-psp-software-travel.total_cost_cents;
  const minMargin=Math.max(FINANCE_STRATEGIC.marginFloorCents,Math.round(clientPrice*(Math.max(0,Number(targetMarginPercent)||0)/100)));
  if(margin<minMargin){
    const uplift=minMargin-margin;
    const proposed=clientPrice+uplift;
    // Le plafond tarifaire est prioritaire : ne jamais augmenter le prix au-delà.
    clientPrice=regulatedMaxCents==null
      ? proposed
      : Math.min(proposed,Math.max(0,Math.round(Number(regulatedMaxCents)||0)));
    margin=clientPrice-intervenant-Math.round(clientPrice*(Math.max(0,Number(pspPercent)||0)/100))-Math.max(0,Math.round(Number(pspFixedCents)||0))-software-travel.total_cost_cents;
  }
  const finalMinMargin=Math.max(FINANCE_STRATEGIC.marginFloorCents,Math.round(clientPrice*(Math.max(0,Number(targetMarginPercent)||0)/100)));
  return {
    finance_version:FINANCE_STRATEGIC_VERSION,
    service_price_cents:service,
    travel,
    client_price_cents:clientPrice,
    intervenant_amount_cents:intervenant,
    commission_cents:commission,
    commission_percent_cents:percentageCommission,
    commission_fixed_cents:fixedCommission,
    psp_cost_cents:Math.round(clientPrice*(Math.max(0,Number(pspPercent)||0)/100))+Math.max(0,Math.round(Number(pspFixedCents)||0)),
    software_cost_cents:software,
    estimated_margin_cents:margin,
    target_margin_percent:Number(targetMarginPercent)||0,
    profitability_status:margin<0?'DEFICITAIRE':(margin<finalMinMargin?'MARGE_FAIBLE':'RENTABLE'),
    profitability_gate:margin>=finalMinMargin?'ALLOW':'ADJUST_OR_ESCALATE'
  };
}

async function pricingQuote(request, env) {
  if (request.method !== 'POST') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{allow:'POST'});
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  let tenantContext;
  try { tenantContext = await resolveTenantContext(request, env, gate.auth); }
  catch { return json({ok:false,error:'TENANT_CONTEXT_UNAVAILABLE',version:VERSION,write_enabled:false},503); }
  if (!tenantContext?.ok) return json({ok:false,error:tenantContext?.error || 'TENANT_CONTEXT_REQUIRED',version:VERSION,write_enabled:false},tenantContext?.status || 403);
  // The legacy pricing_policies and pricing_quotes models are not tenant-scoped,
  // and the old route accepted base_price_cents from the caller. Do not compute
  // or persist a commercial quote until a versioned, tenant-scoped server policy
  // (country, currency, service, effective dates and approval) is available.
  return json({
    ok:false,
    error:'TENANT_SCOPED_PRICING_POLICY_REQUIRED',
    version:VERSION,
    write_enabled:false,
    message:'Le devis est suspendu tant que la politique tarifaire serveur versionnée et isolée par tenant n’est pas validée.'
  },503);
}

async function financeSummary(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  let tenantContext;
  try { tenantContext = await resolveTenantContext(request, env, gate.auth); }
  catch { return json({ok:false,error:'TENANT_CONTEXT_UNAVAILABLE',version:VERSION,read_only:true},503); }
  if (!tenantContext?.ok) return json({ok:false,error:tenantContext?.error || 'TENANT_CONTEXT_REQUIRED',version:VERSION,read_only:true},tenantContext?.status || 403);
  // Legacy payment_transactions, accounting_ledger and business_expenses are
  // not consistently tenant-keyed. Never aggregate them globally into a tenant
  // dashboard; use the canonical tenant-scoped journal once its read model lands.
  return json({ok:false,error:'TENANT_SCOPED_FINANCE_READ_MODEL_REQUIRED',version:VERSION,read_only:true,write_enabled:false},503);
}
async function complaintCreate(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','entreprise']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
  const b=await readJson(request)||{};if(!b.category)return json({ok:false,error:'CATEGORY_REQUIRED',version:VERSION},400);
  const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO complaints(id,client_type,client_id,company_id,mission_id,category,severity,description) VALUES(?,?,?,?,?,?,?,?)`).bind(id,String(b.client_type||'B2C'),b.client_id||null,b.company_id||null,b.mission_id||null,b.category,String(b.severity||'LOW'),b.description||null).run();
  const caseType=SIMPLE_CASES.has(b.category)?b.category:'reclamation_client';
  const fakeReq=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({case_type:caseType,client_id:b.client_id,company_id:b.company_id,mission_id:b.mission_id,description:b.description,impact_level:b.severity||'LOW',context:{complaint_id:id}})});
  const caseResponse=await createOperationalCase(fakeReq,env);const caseJson=await caseResponse.json();
  if(caseJson.case_id)await env.DB.prepare('UPDATE complaints SET resolution_case_id=? WHERE id=?').bind(caseJson.case_id,id).run();
  return json({ok:true,version:VERSION,complaint_id:id,resolution_case_id:caseJson.case_id||null,copilot:caseJson.recommendation||null},201);
}

async function setPhase(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const b=await readJson(request)||{};const phase=String(b.phase||'').toUpperCase();if(!PROJECT_PHASES[phase])return json({ok:false,error:'INVALID_PHASE',allowed:Object.keys(PROJECT_PHASES),version:VERSION},400);
  await env.DB.prepare(`INSERT INTO platform_settings(key,value_json,updated_at) VALUES('project_phase',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP`).bind(JSON.stringify(phase)).run();
  await journal(env,'gerante',gate.auth.user.id,'PHASE_CHANGED','platform','project', 'OK',{phase});
  return json({ok:true,version:VERSION,phase,policy:PROJECT_PHASES[phase]},200);
}

async function consolidatedInfo(env) {
  const phase=await getSetting(env,'project_phase','TEST');
  return json({ok:true,version:VERSION,architecture:'UNIQUE_TRANSVERSAL_ENGINE',phase,automation:'simple_low_impact_auto_sensitive_manager',mobile_pc:'responsive_web_required',domains:['B2C','B2B','missions','matching','metiers','incidents','remplacement','paiements','finance','comptabilite','reclamations','commercial','recrutement','RGPD','securite','audit','copilote'],b2b_rule:'societe paie intervenant; PROCHÉLIA facture commissions/service',b2c_rule:'client paie la prestation; orchestration du reversement intervenant',note:'Aucune opération financière réelle n’est simulée : les fonds passent par un PSP configuré et vérifié.'});
}

async function handleConsolidated(request, env) {
  const url=new URL(request.url);
  const consolidatedPath = ['/api/consolidated/info','/api/ops/dashboard','/api/journal','/api/cases','/api/cases/approve','/api/metiers','/api/metiers/suggest','/api/complaints','/api/settings/phase'].includes(url.pathname);
  if (consolidatedPath) {
    const schemaGate = await schemaReadinessResponse(env, ['platform_settings','business_profiles','métier_catalog','metier_suggestions','pricing_policies','pricing_quotes','operational_cases','case_actions','copilot_log','activity_journal','commercial_tasks','recruitment_tasks','complaints','accounting_ledger','business_expenses','notification_outbox','compliance_events'], 'CONSOLIDATED_SCHEMA_NOT_READY');
    if (schemaGate) return schemaGate;
  }
  if(url.pathname==='/api/consolidated/info' && request.method==='GET') return consolidatedInfo(env);
  if(url.pathname==='/api/ops/dashboard' && request.method==='GET') return getOperationsDashboard(request,env);
  if(url.pathname==='/api/journal' && request.method==='GET') return getJournal(request,env);
  if(url.pathname==='/api/cases' && request.method==='POST') return createOperationalCase(request,env);
  if(url.pathname==='/api/cases/approve' && request.method==='POST') return approveOperationalCase(request,env);
  if(url.pathname==='/api/metiers' && request.method==='GET') return metiers(request,env);
  if(url.pathname==='/api/metiers/suggest' && request.method==='POST') return suggestMetier(request,env);
  if(url.pathname==='/api/pricing/quote' && request.method==='POST') return pricingQuote(request,env);
  if(url.pathname==='/api/finance/summary' && request.method==='GET') return financeSummary(request,env);
  if(url.pathname==='/api/complaints' && request.method==='POST') return complaintCreate(request,env);
  if(url.pathname==='/api/settings/phase' && request.method==='POST') return setPhase(request,env);
  return handleBase(request,env);
}

/* ============================================================
   PROCHÉLIA V13.7.0 — INTELLIGENCE COMMERCIALE & PROMOTIONS
   Couche stratégique unique, branchée sur le même moteur
   transversal que les missions, incidents, conflits, finance,
   recrutement, Copilote et audit.
=============================================================== */

const PROMOTION_TYPES = new Set([
  'WELCOME','OFF_PEAK','LAST_MINUTE','LOYALTY','REFERRAL','B2B_VOLUME',
  'REACTIVATION','NEW_SERVICE','GEOGRAPHIC','CAPACITY','SEASONAL',
  'FILL_RATE','CUSTOM'
]);

async function ensureStrategicSchema(env) {
  if (!env.DB) throw new Error('DATABASE_REQUIRED');
  const statements = [
    `CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      phase TEXT NOT NULL,
      client_type TEXT NOT NULL DEFAULT 'ALL',
      service_code TEXT,
      zone_code TEXT,
      discount_type TEXT NOT NULL DEFAULT 'PERCENT',
      discount_value REAL NOT NULL DEFAULT 0,
      min_amount_cents INTEGER NOT NULL DEFAULT 0,
      max_discount_cents INTEGER,
      budget_cents INTEGER,
      used_cents INTEGER NOT NULL DEFAULT 0,
      target_margin_percent REAL NOT NULL DEFAULT 0,
      intervenant_protection_cents INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      auto_apply INTEGER NOT NULL DEFAULT 0,
      requires_manager INTEGER NOT NULL DEFAULT 1,
      rationale TEXT,
      rules_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_promotions_active
      ON promotions(status, phase, client_type, starts_at, ends_at)`,
    `CREATE TABLE IF NOT EXISTS promotion_recommendations (
      id TEXT PRIMARY KEY,
      promotion_id TEXT,
      phase TEXT NOT NULL,
      service_code TEXT,
      client_type TEXT NOT NULL,
      zone_code TEXT,
      recommendation_type TEXT NOT NULL,
      suggested_discount_type TEXT NOT NULL,
      suggested_discount_value REAL NOT NULL,
      expected_conversion REAL,
      expected_revenue_cents INTEGER,
      expected_margin_cents INTEGER,
      risk_level TEXT NOT NULL DEFAULT 'LOW',
      rationale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PROPOSED',
      approved_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_promotion_reco_status
      ON promotion_recommendations(status, created_at)`,
    `CREATE TABLE IF NOT EXISTS commercial_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      client_id TEXT,
      company_id TEXT,
      promotion_id TEXT,
      service_code TEXT,
      zone_code TEXT,
      amount_cents INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_commercial_events
      ON commercial_events(event_type, created_at)`,
    `CREATE TABLE IF NOT EXISTS market_signals (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      service_code TEXT,
      zone_code TEXT,
      observed_value REAL,
      unit TEXT,
      confidence REAL NOT NULL DEFAULT 0,
      observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_market_signals
      ON market_signals(signal_type, service_code, zone_code, observed_at)`,
    `CREATE TABLE IF NOT EXISTS client_value_scores (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      company_id TEXT,
      segment TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      churn_risk REAL NOT NULL DEFAULT 0,
      lifetime_value_cents INTEGER NOT NULL DEFAULT 0,
      last_activity_at TEXT,
      next_best_action TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, company_id)
    )`,
    `CREATE TABLE IF NOT EXISTS strategic_alerts (
      id TEXT PRIMARY KEY,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM',
      entity_type TEXT,
      entity_id TEXT,
      recommendation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT
    )`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
}

function promotionCandidate(input) {
  const phase = String(input.phase || 'TEST').toUpperCase();
  const cfg = PROJECT_PHASES[phase] || PROJECT_PHASES.TEST;
  const base = Math.max(0, Number(input.base_price_cents || 0));
  const distance = Math.max(0, Number(input.distance_km || 0));
  const fuel = Math.round(distance * Number(input.fuel_cost_per_km_cents || 20));
  const intervenant = Math.max(0, Number(input.intervenant_amount_cents || Math.round(base * 0.70)));
  const psp = Math.max(0, Number(input.psp_cost_cents || 0));
  const software = Math.max(0, Number(input.software_cost_cents || 0));
  const current = Math.max(0, Number(input.current_price_cents || Math.round(base * cfg.pricingFactor)));
  const targetMargin = Math.max(0, Number(input.target_margin_percent ?? 15));
  const marginFloor = Math.ceil(current * targetMargin / 100);
  const safePriceFloor = intervenant + psp + software + fuel + marginFloor;
  const maxDiscount = Math.max(0, current - safePriceFloor);
  const maxPercent = current ? Math.floor((maxDiscount / current) * 10000) / 100 : 0;

  return {
    current_price_cents: current,
    safe_price_floor_cents: safePriceFloor,
    max_safe_discount_cents: maxDiscount,
    max_safe_discount_percent: maxPercent,
    phase,
    automation: cfg.automation
  };
}

async function recommendPromotions(request, env) {
  const gate = await requireAuthRole(request, env, ['gerante']);
  if (gate.error) return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['promotions','promotion_recommendations','commercial_events','market_signals','client_value_scores','strategic_alerts'], 'STRATEGIC_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;

  const b = await readJson(request) || {};
  const phase = String(b.phase || await getSetting(env, 'project_phase', 'TEST')).toUpperCase();
  const types = Array.isArray(b.types) && b.types.length ? b.types : [
    'OFF_PEAK','LAST_MINUTE','LOYALTY','REFERRAL','B2B_VOLUME',
    'REACTIVATION','CAPACITY','GEOGRAPHIC','SEASONAL'
  ];

  const safe = promotionCandidate({
    ...b,
    phase,
    target_margin_percent: b.target_margin_percent ?? await getSetting(env, 'default_margin_percent', 15),
    fuel_cost_per_km_cents: b.fuel_cost_per_km_cents ?? await getSetting(env, 'fuel_cost_per_km_cents', 20),
    software_cost_cents: b.software_cost_cents ?? 0
  });

  const proposals = [];
  for (const type of types) {
    if (!PROMOTION_TYPES.has(type)) continue;

    let discount = Math.min(safe.max_safe_discount_percent, 10);
    let rationale = 'Offre testée contre le plancher de coût, la rémunération intervenant et la marge cible.';

    if (type === 'LAST_MINUTE') {
      discount = Math.min(safe.max_safe_discount_percent, phase === 'TEST' ? 5 : 12);
      rationale = 'Remplir une capacité disponible à court terme sans passer sous la marge de sécurité.';
    } else if (type === 'OFF_PEAK') {
      discount = Math.min(safe.max_safe_discount_percent, 8);
      rationale = 'Déplacer la demande vers les créneaux creux.';
    } else if (type === 'LOYALTY') {
      discount = Math.min(safe.max_safe_discount_percent, 7);
      rationale = 'Augmenter la récurrence tout en protégeant la valeur vie client.';
    } else if (type === 'REFERRAL') {
      discount = Math.min(safe.max_safe_discount_percent, 8);
      rationale = 'Acquérir un nouveau client via le parrainage sans subvention excessive.';
    } else if (type === 'B2B_VOLUME') {
      discount = Math.min(safe.max_safe_discount_percent, phase === 'NATIONAL' ? 12 : 8);
      rationale = 'Récompenser le volume B2B en échange d’un engagement ou d’un volume minimum.';
    } else if (type === 'REACTIVATION') {
      discount = Math.min(safe.max_safe_discount_percent, 10);
      rationale = 'Réactiver un client inactif avec une offre limitée dans le temps.';
    } else if (type === 'CAPACITY') {
      discount = Math.min(safe.max_safe_discount_percent, 10);
      rationale = 'Utiliser une promotion pour lisser une sous-utilisation de capacité.';
    } else if (type === 'GEOGRAPHIC') {
      discount = Math.min(safe.max_safe_discount_percent, 7);
      rationale = 'Concentrer l’acquisition dans une zone où la densité de missions améliore les coûts de déplacement.';
    } else if (type === 'SEASONAL') {
      discount = Math.min(safe.max_safe_discount_percent, 10);
      rationale = 'Adapter la demande à une période saisonnière identifiée.';
    }

    const expected = Math.max(0, Math.round(safe.current_price_cents * (1 - discount / 100)));
    const margin = Math.max(0, expected - Number(b.intervenant_amount_cents || Math.round(safe.current_price_cents * 0.70))
      - Number(b.psp_cost_cents || 0) - Number(b.software_cost_cents || 0)
      - Number(b.distance_km || 0) * Number(b.fuel_cost_per_km_cents || 20));

    const recommendation = {
      type,
      phase,
      discount_percent: discount,
      current_price_cents: safe.current_price_cents,
      proposed_price_cents: expected,
      expected_margin_cents: Math.round(margin),
      max_safe_discount_percent: safe.max_safe_discount_percent,
      rationale
    };

    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO promotion_recommendations
      (id,phase,service_code,client_type,zone_code,recommendation_type,
       suggested_discount_type,suggested_discount_value,expected_revenue_cents,
       expected_margin_cents,risk_level,rationale)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, phase, clean(b.service_code) || null, String(b.client_type || 'ALL').toUpperCase(),
        clean(b.zone_code) || null, type, 'PERCENT', discount,
        expected, Math.round(margin), margin > 0 ? 'LOW' : 'HIGH', rationale).run();

    proposals.push({ id, ...recommendation });
  }

  await journal(env, 'copilot', null, 'PROMOTION_RECOMMENDATIONS_GENERATED',
    'promotion_recommendation', null, 'OK', { phase, count: proposals.length });

  return json({
    ok: true,
    version: VERSION,
    phase,
    strategy: 'PROMOTIONS_DYNAMIC_BY_PHASE_AND_UNIT_ECONOMICS',
    guardrails: safe,
    recommendations: proposals,
    rule: 'Le Copilote recommande ; une promotion commerciale engageante reste soumise aux règles et validations configurées.'
  });
}

async function createPromotion(request, env) {
  const gate = await requireAuthRole(request, env, ['gerante']);
  if (gate.error) return gate.error;
  return legacyTenantScopeBlocked();
  const schemaGate = await schemaReadinessResponse(env, ['promotions','promotion_recommendations','commercial_events','market_signals','client_value_scores','strategic_alerts'], 'STRATEGIC_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;

  const b = await readJson(request) || {};
  const code = clean(b.code);
  const name = clean(b.name);
  const type = String(b.type || '').toUpperCase();
  if (!code || !name || !PROMOTION_TYPES.has(type)) {
    return json({ok:false,error:'INVALID_PROMOTION',version:VERSION},400);
  }

  const phase = String(b.phase || await getSetting(env, 'project_phase', 'TEST')).toUpperCase();
  const discount = Number(b.discount_value || 0);
  if (!Number.isFinite(discount) || discount < 0) {
    return json({ok:false,error:'INVALID_DISCOUNT',version:VERSION},400);
  }

  const id = crypto.randomUUID();
  const autoApply = b.auto_apply === true ? 1 : 0;
  const requiresManager = b.requires_manager === false ? 0 : 1;

  await env.DB.prepare(`INSERT INTO promotions
    (id,code,name,type,phase,client_type,service_code,zone_code,discount_type,
     discount_value,min_amount_cents,max_discount_cents,budget_cents,target_margin_percent,
     intervenant_protection_cents,starts_at,ends_at,status,auto_apply,requires_manager,
     rationale,rules_json,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(
      id, code, name, type, phase, String(b.client_type || 'ALL').toUpperCase(),
      clean(b.service_code)||null, clean(b.zone_code)||null,
      String(b.discount_type || 'PERCENT').toUpperCase(), discount,
      Number(b.min_amount_cents || 0), b.max_discount_cents == null ? null : Number(b.max_discount_cents),
      b.budget_cents == null ? null : Number(b.budget_cents),
      Number(b.target_margin_percent || 15), Number(b.intervenant_protection_cents || 0),
      clean(b.starts_at) || new Date().toISOString(), clean(b.ends_at) || new Date(Date.now()+86400000).toISOString(),
      'DRAFT', autoApply, requiresManager, clean(b.rationale)||null,
      JSON.stringify(b.rules || {}), gate.auth.user.id
    ).run();

  await journal(env, 'gerante', gate.auth.user.id, 'PROMOTION_CREATED', 'promotion', id, 'OK', {code,type,phase});
  return json({ok:true,version:VERSION,promotion_id:id,status:'DRAFT'},201);
}

async function promotionList(request, env) {
  const gate = await requireAuthRole(request, env, ['gerante','entreprise','client']);
  if (gate.error) return gate.error;
  return legacyTenantScopeBlocked();
  const schemaGate = await schemaReadinessResponse(env, ['promotions','promotion_recommendations','commercial_events','market_signals','client_value_scores','strategic_alerts'], 'STRATEGIC_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const status = new URL(request.url).searchParams.get('status');
  const q = status
    ? 'SELECT * FROM promotions WHERE status=? ORDER BY created_at DESC LIMIT 200'
    : 'SELECT * FROM promotions ORDER BY created_at DESC LIMIT 200';
  const r = status ? await env.DB.prepare(q).bind(status).all() : await env.DB.prepare(q).all();
  return json({ok:true,version:VERSION,promotions:r.results||[]});
}

async function activatePromotion(request, env) {
  const gate = await requireAuthRole(request, env, ['gerante']);
  if (gate.error) return gate.error;
  return legacyTenantScopeBlocked();
  const schemaGate = await schemaReadinessResponse(env, ['promotions','promotion_recommendations','commercial_events','market_signals','client_value_scores','strategic_alerts'], 'STRATEGIC_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b = await readJson(request) || {};
  if (!b.promotion_id) return json({ok:false,error:'PROMOTION_ID_REQUIRED',version:VERSION},400);

  const p = await env.DB.prepare('SELECT * FROM promotions WHERE id=? LIMIT 1').bind(b.promotion_id).first();
  if (!p) return json({ok:false,error:'PROMOTION_NOT_FOUND',version:VERSION},404);

  if (p.requires_manager && !gate.auth.user.id) {
    return json({ok:false,error:'MANAGER_APPROVAL_REQUIRED',version:VERSION},403);
  }

  await env.DB.prepare(`UPDATE promotions SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(p.id).run();
  await journal(env,'gerante',gate.auth.user.id,'PROMOTION_ACTIVATED','promotion',p.id,'OK',{code:p.code});
  return json({ok:true,version:VERSION,promotion_id:p.id,status:'ACTIVE'},200);
}

async function strategicDashboard(request, env) {
  const gate = await requireAuthRole(request, env, ['gerante']);
  if (gate.error) return gate.error;
  return legacyTenantScopeBlocked();
  const schemaGate = await schemaReadinessResponse(env, ['promotions','promotion_recommendations','commercial_events','market_signals','client_value_scores','strategic_alerts'], 'STRATEGIC_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;

  const queries = {
    active_promotions: `SELECT COUNT(*) n FROM promotions WHERE status='ACTIVE'`,
    pending_recommendations: `SELECT COUNT(*) n FROM promotion_recommendations WHERE status='PROPOSED'`,
    open_alerts: `SELECT COUNT(*) n FROM strategic_alerts WHERE status='OPEN'`,
    market_signals: `SELECT COUNT(*) n FROM market_signals`,
    scored_clients: `SELECT COUNT(*) n FROM client_value_scores`
  };
  const out = {};
  for (const [k,q] of Object.entries(queries)) {
    const r = await env.DB.prepare(q).first();
    out[k] = Number(r?.n || 0);
  }
  return json({
    ok:true,
    version:VERSION,
    phase:await getSetting(env,'project_phase','TEST'),
    strategy: 'COMMERCIAL_INTELLIGENCE',
    dashboard:out
  });
}

async function handleStrategic(request, env) {
  const url = new URL(request.url);
  const strategicPaths = [
    '/api/strategic/promotions/recommend',
    '/api/strategic/promotions',
    '/api/strategic/promotions/activate',
    '/api/strategic/dashboard'
  ];



  if (url.pathname === '/api/strategic/promotions/recommend' && request.method === 'POST')
    return recommendPromotions(request, env);

  if (url.pathname === '/api/strategic/promotions' && request.method === 'POST')
    return createPromotion(request, env);

  if (url.pathname === '/api/strategic/promotions' && request.method === 'GET')
    return promotionList(request, env);

  if (url.pathname === '/api/strategic/promotions/activate' && request.method === 'POST')
    return activatePromotion(request, env);

  if (url.pathname === '/api/strategic/dashboard' && request.method === 'GET')
    return strategicDashboard(request, env);

  return handleConsolidated(request, env);
}


// ================================================================
// PROCHÉLIA V13.9.0 — MOTEUR OPÉRATIONNEL COMPLET
// Complète V13.7.0 sans supprimer le socle existant.
// ================================================================

async function ensureOperationalSchema(env) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS action_outbox (
      id TEXT PRIMARY KEY, case_id TEXT, action_type TEXT NOT NULL, entity_type TEXT,
      entity_id TEXT, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'PENDING',
      payload_json TEXT NOT NULL DEFAULT '{}', result_json TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, executed_at TEXT, processed_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_action_outbox_status ON action_outbox(status,created_at)`,
    `CREATE TABLE IF NOT EXISTS copilot_briefings (
      id TEXT PRIMARY KEY, phase TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 10,
      category TEXT NOT NULL, title TEXT NOT NULL, recommendation TEXT NOT NULL,
      action_type TEXT, entity_type TEXT, entity_id TEXT, impact_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_copilot_briefings_open ON copilot_briefings(status,priority,created_at)`,
    `CREATE TABLE IF NOT EXISTS loyalty_events (
      id TEXT PRIMARY KEY, client_id TEXT, company_id TEXT, event_type TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0, amount_cents INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS loyalty_balances (
      id TEXT PRIMARY KEY, client_id TEXT, company_id TEXT, points INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'STANDARD', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id,company_id)
    )`,
    `CREATE TABLE IF NOT EXISTS quality_events (
      id TEXT PRIMARY KEY, mission_id TEXT, client_id TEXT, company_id TEXT, intervenant_id TEXT,
      rating REAL, category TEXT, comment TEXT, severity TEXT NOT NULL DEFAULT 'LOW',
      metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS b2b_leads (
      id TEXT PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT, email TEXT,
      phone TEXT, source TEXT, status TEXT NOT NULL DEFAULT 'NEW', estimated_value_cents INTEGER DEFAULT 0,
      next_action TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS capacity_snapshots (
      id TEXT PRIMARY KEY, zone_code TEXT, service_code TEXT, snapshot_date TEXT NOT NULL,
      demand_count INTEGER NOT NULL DEFAULT 0, supply_count INTEGER NOT NULL DEFAULT 0,
      fill_rate REAL NOT NULL DEFAULT 0, unused_capacity INTEGER NOT NULL DEFAULT 0,
      recommendation TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_capacity_date ON capacity_snapshots(snapshot_date,zone_code,service_code)`,
    `CREATE TABLE IF NOT EXISTS finance_forecasts (
      id TEXT PRIMARY KEY, period TEXT NOT NULL, scenario TEXT NOT NULL,
      revenue_cents INTEGER NOT NULL DEFAULT 0, commission_cents INTEGER NOT NULL DEFAULT 0,
      payout_cents INTEGER NOT NULL DEFAULT 0, provider_fee_cents INTEGER NOT NULL DEFAULT 0,
      refund_cents INTEGER NOT NULL DEFAULT 0, estimated_margin_cents INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS system_checks (
      id TEXT PRIMARY KEY, check_type TEXT NOT NULL, status TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
  const actionInfo = await env.DB.prepare('PRAGMA table_info(action_outbox)').all();
  const actionColumns = (actionInfo.results || []).map(x => String(x.name));
  if (!actionColumns.includes('case_id')) await env.DB.prepare('ALTER TABLE action_outbox ADD COLUMN case_id TEXT').run();
  if (!actionColumns.includes('processed_at')) await env.DB.prepare('ALTER TABLE action_outbox ADD COLUMN processed_at TEXT').run();
}

async function tableExists(env, table) {
  const r = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(table).first();
  return !!r;
}

async function tableColumns(env, table) {
  if (!await tableExists(env, table)) return [];
  const r = await env.DB.prepare(`PRAGMA table_info(${table.replace(/[^A-Za-z0-9_]/g,'')})`).all();
  return (r.results||[]).map(x=>x.name);
}

async function missingRequiredTables(env, names) {
  const missing = [];
  for (const name of names) if (!(await tableExists(env, name))) missing.push(name);
  return missing;
}

async function schemaReadinessResponse(env, names, error) {
  const missing = await missingRequiredTables(env, names);
  return missing.length ? json({ok:false,error,missing_tables:missing,version:VERSION},503) : null;
}

async function schemaColumnsReadinessResponse(env, requirements, error) {
  const missing = [];
  for (const [table, requiredColumns] of Object.entries(requirements)) {
    const columns = await tableColumns(env, table);
    if (!columns.length) missing.push({table,missing_table:true,missing_columns:[]});
    else {
      const absent = requiredColumns.filter(column => !columns.includes(column));
      if (absent.length) missing.push({table,missing_table:false,missing_columns:absent});
    }
  }
  return missing.length ? json({ok:false,error,missing_schema:missing,version:VERSION},503) : null;
}

async function dynamicUpdate(env, table, id, updates) {
  const cols = await tableColumns(env, table);
  if (!cols.includes('id')) return {ok:false,reason:'TABLE_OR_ID_UNAVAILABLE'};
  const usable = Object.entries(updates).filter(([k,v])=>cols.includes(k) && v !== undefined);
  if (!usable.length) return {ok:false,reason:'NO_COMPATIBLE_COLUMNS'};
  const set = usable.map(([k])=>`${k}=?`).join(',');
  const vals = usable.map(([,v])=>v);
  vals.push(id);
  await env.DB.prepare(`UPDATE ${table} SET ${set} WHERE id=?`).bind(...vals).run();
  return {ok:true,updated:usable.map(([k])=>k)};
}

async function queueAction(env, actionType, entityType, entityId, payload, idem) {
  const key = idem || crypto.randomUUID();
  const existing = await env.DB.prepare('SELECT * FROM action_outbox WHERE idempotency_key=? LIMIT 1').bind(key).first();
  if (existing) return existing;
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO action_outbox(id,action_type,entity_type,entity_id,idempotency_key,payload_json) VALUES(?,?,?,?,?,?)`)
    .bind(id,actionType,entityType||null,entityId||null,key,JSON.stringify(payload||{})).run();
  return await env.DB.prepare('SELECT * FROM action_outbox WHERE id=?').bind(id).first();
}

async function executeQueuedAction(env, action, actorContext = {}) {
  if (!action) return {ok:false,error:'ACTION_NOT_FOUND'};
  const payload = JSON.parse(action.payload_json||'{}');
  const policyDecision = evaluateSupraActionPolicy({
    actionType: action.action_type,
    role: actorContext.role,
    jurisdiction: actorContext.jurisdiction,
    autonomyLevel: actorContext.autonomyLevel || "A0",
    hasApproval: actorContext.approvedAction === action.action_type,
    tenantScoped: actorContext.tenantScoped === true,
    idempotencyKey: action.idempotency_key
  });
  if (!policyDecision.allowed) {
    return {
      ok: false, status: "BLOCKED", performed: false,
      error: "SUPRA_ACTION_POLICY_DENIED",
      action: action.action_type,
      policy: { risk: policyDecision.risk, reasons: policyDecision.reasons }
    };
  }
  const now = new Date().toISOString();
  try {
    let result = {performed:false,action:action.action_type};
    if (action.action_type === 'NOTIFY') {
      const channel = payload.channel || 'IN_APP';
      if (await tableExists(env,'notification_outbox')) {
        const id = crypto.randomUUID();
        const cols = await tableColumns(env,'notification_outbox');
        const values = {id,channel,status:'PENDING',recipient_id:payload.recipient_id||null,
          user_id:payload.recipient_id||null,type:payload.type||'OPERATIONAL',
          title:payload.title||'PROCHÉLIA',message:payload.message||'',payload_json:JSON.stringify(payload)};
        const usable = Object.entries(values).filter(([k])=>cols.includes(k));
        if (usable.length) {
          const sql=`INSERT INTO notification_outbox(${usable.map(x=>x[0]).join(',')}) VALUES(${usable.map(()=>'?').join(',')})`;
          await env.DB.prepare(sql).bind(...usable.map(x=>x[1])).run();
          // Enqueueing is not delivery: keep the action pending until a delivery
          // adapter records a provider receipt and a separate verifier confirms it.
          result={performed:false,requires_provider:true,channel,notification_queued:true,reason:'DELIVERY_RECEIPT_REQUIRED'};
        } else result={performed:false,reason:'NOTIFICATION_SCHEMA_INCOMPATIBLE'};
      } else result={performed:false,reason:'NOTIFICATION_TABLE_MISSING'};
    } else if (action.action_type === 'RESCHEDULE_MISSION') {
      // This generic executor has no tenant-scoped authorization and post-write
      // verifier. Never mutate a mission by unscoped entity ID.
      result={performed:false,requires_provider:true,reason:'TENANT_SCOPED_MISSION_EXECUTOR_REQUIRED'};
    } else if (action.action_type === 'ASSIGN_REPLACEMENT') {
      // Assignment changes require qualification, availability, tenant ownership,
      // conflict checks and an auditable transactional transition.
      result={performed:false,requires_provider:true,reason:'VERIFIED_ASSIGNMENT_WORKFLOW_REQUIRED'};
    } else if (action.action_type === 'REFUND') {
      result={performed:false,requires_provider:true,reason:'PSP_EXECUTION_REQUIRED',payload};
    } else if (action.action_type === 'PAYOUT') {
      result={performed:false,requires_provider:true,reason:'PSP_EXECUTION_REQUIRED',payload};
    } else if (action.action_type === 'ACCOUNTING_ENTRY') {
      // Never turn a generic action payload into a ledger posting. The canonical
      // tenant-scoped double-entry service, chart-of-accounts validation,
      // balanced journal and expert-approved accounting rules are not integrated.
      result={performed:false,requires_provider:true,reason:'TENANT_SCOPED_DOUBLE_ENTRY_LEDGER_NOT_IMPLEMENTED'};
    } else result={performed:false,reason:'ACTION_TYPE_NOT_IMPLEMENTED'};

    const finalStatus = result.performed ? 'DONE' : (result.requires_provider ? 'WAITING_PROVIDER' : 'FAILED');
    await env.DB.prepare(`UPDATE action_outbox SET status=?,result_json=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP,executed_at=? WHERE id=?`)
      .bind(finalStatus,JSON.stringify(result),result.performed?now:null,action.id).run();
    return {ok:true,status:finalStatus,result};
  } catch(e) {
    await env.DB.prepare(`UPDATE action_outbox SET status='FAILED',last_error=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(String(e.message||e),action.id).run();
    return {ok:false,error:'ACTION_EXECUTION_FAILED',message:e.message};
  }
}

async function operationalExecute(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']);
  if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['operational_cases','case_actions','action_outbox','activity_journal','platform_settings'], 'OPERATIONAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request)||{};
  if(!b.case_id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const c=await env.DB.prepare('SELECT * FROM operational_cases WHERE id=? LIMIT 1').bind(b.case_id).first();
  if(!c)return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  const solution=JSON.parse(c.proposed_solution_json||'{}');
  const actions=Array.isArray(b.actions)?b.actions:(Array.isArray(solution.actions)?solution.actions:[]);
  if(!actions.length)return json({ok:false,error:'NO_ACTIONS_DEFINED',version:VERSION},400);
  const results=[];
  for(const a of actions){
    // Preflight before creating any outbox row: denied actions must not become
    // apparently executable pending work. All authority fields are server-derived
    // or deliberately absent until their authoritative resolvers are integrated.
    const actorContext = {
      role: gate.auth.user.role,
      jurisdiction: null,
      autonomyLevel: "A0",
      approvedAction: null,
      tenantScoped: false
    };
    const actionType = a.action_type || a.type;
    const preflight = evaluateSupraActionPolicy({
      actionType,
      role: actorContext.role,
      jurisdiction: actorContext.jurisdiction,
      autonomyLevel: actorContext.autonomyLevel,
      hasApproval: false,
      tenantScoped: actorContext.tenantScoped,
      idempotencyKey: a.idempotency_key
    });
    if (!preflight.allowed) {
      results.push({
        ok: false, status: "BLOCKED", performed: false,
        error: "SUPRA_ACTION_POLICY_DENIED",
        action: String(actionType || "").toUpperCase(),
        policy: { risk: preflight.risk, reasons: preflight.reasons },
        queued: false
      });
      continue;
    }
    const q=await queueAction(env,actionType,c.mission_id?'MISSION':'CASE',a.entity_id||c.mission_id,{...a},a.idempotency_key);
    results.push(await executeQueuedAction(env,q,actorContext));
  }
  // DONE only means that an executor reported a side effect. Resolution
  // requires a separate verifier to return VERIFIED for every requested action.
  const allVerified=results.length>0 && results.every(x=>x.ok && x.status==='VERIFIED');
  const caseStatus=allVerified?'RESOLVED':'IN_PROGRESS';
  await env.DB.prepare(`UPDATE operational_cases SET status=?,resolution_json=?,updated_at=CURRENT_TIMESTAMP,resolved_at=? WHERE id=?`)
    .bind(caseStatus,JSON.stringify({approved_by:gate.auth.user.id,results,verification_required:!allVerified}),allVerified?new Date().toISOString():null,c.id).run();
  await journal(env,'gerante',gate.auth.user.id,allVerified?'CASE_VERIFIED_AND_RESOLVED':'CASE_ACTIONS_PENDING_VERIFICATION','operational_case',c.id,allVerified?'OK':'PENDING_VERIFICATION',{results});
  return json({ok:true,version:VERSION,case_id:c.id,status:caseStatus,verification_required:!allVerified,results});
}

async function scoreClients(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
}

async function loyaltyUpdate(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
}

async function qualityCreate(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','entreprise']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
}

async function capacityDashboard(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
}

async function financeForecast(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return legacyTenantScopeBlocked();
}

async function copilotBriefing(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['operational_cases','promotion_recommendations','strategic_alerts','copilot_briefings','platform_settings'], 'COPILOT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const phase=await getSetting(env,'project_phase','TEST'); const items=[];
  const open=await env.DB.prepare(`SELECT * FROM operational_cases WHERE status NOT IN ('RESOLVED','CLOSED') ORDER BY priority DESC,created_at ASC LIMIT 20`).all();
  for(const c of (open.results||[])) items.push({priority:Number(c.priority||10),category:'OPERATIONS',title:c.description||c.case_type,recommendation:c.proposed_solution_json||'Analyser et proposer une résolution',entity_type:'CASE',entity_id:c.id});
  const promos=await env.DB.prepare(`SELECT * FROM promotion_recommendations WHERE status='PROPOSED' ORDER BY created_at DESC LIMIT 10`).all();
  for(const p of (promos.results||[])) items.push({priority:30,category:'COMMERCIAL',title:`Promotion ${p.recommendation_type}`,recommendation:p.rationale,entity_type:'PROMOTION_RECOMMENDATION',entity_id:p.id});
  const alerts=await env.DB.prepare(`SELECT * FROM strategic_alerts WHERE status='OPEN' ORDER BY CASE severity WHEN 'CRITICAL' THEN 100 WHEN 'HIGH' THEN 60 ELSE 30 END DESC,created_at ASC LIMIT 10`).all();
  for(const a of (alerts.results||[])) items.push({priority:a.severity==='CRITICAL'?100:a.severity==='HIGH'?60:30,category:'RISK',title:a.alert_type,recommendation:a.recommendation,entity_type:a.entity_type,entity_id:a.entity_id});
  items.sort((a,b)=>b.priority-a.priority);
  for(const x of items.slice(0,25)) await env.DB.prepare(`INSERT INTO copilot_briefings(id,phase,priority,category,title,recommendation,action_type,entity_type,entity_id,impact_json) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),phase,x.priority,x.category,x.title,String(x.recommendation).slice(0,4000),x.action_type||null,x.entity_type||null,x.entity_id||null,JSON.stringify(x)).run();
  return json({ok:true,version:VERSION,phase,top_actions:items.slice(0,25)});
}

async function systemAudit(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['system_checks'], 'OPERATIONAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const checks=[];
  const required=['users','sessions','payment_transactions','operational_cases','promotions','promotion_recommendations','accounting_ledger','notification_outbox','action_outbox'];
  for(const t of required){ const exists=await tableExists(env,t); checks.push({table:t,status:exists?'OK':'MISSING'}); }
  const paymentCols=await tableColumns(env,'payment_transactions');
  checks.push({check:'payment_schema',status:['gross_cents','commission_cents','provider_fee_cents','refund_cents','net_intervenant_cents'].every(x=>paymentCols.includes(x))?'OK':'INCOMPLETE',columns:paymentCols});
  const overall=checks.every(x=>x.status==='OK');
  await env.DB.prepare(`INSERT INTO system_checks(id,check_type,status,details_json) VALUES(?,?,?,?)`).bind(crypto.randomUUID(),'PRODUCTION_READINESS',overall?'OK':'ATTENTION',JSON.stringify(checks)).run();
  return json({ok:true,version:VERSION,production_readiness:overall?'OK':'ATTENTION',checks});
}

async function handleV139(request, env) {
  const url=new URL(request.url);
  const operationalPaths=[
    '/api/ops/case/execute','/api/ops/outbox/process','/api/copilot/briefing','/api/clients/score','/api/loyalty/update',
    '/api/quality','/api/capacity/dashboard','/api/finance/forecast','/api/system/audit'
  ];

  if(url.pathname==='/api/ops/case/execute'&&request.method==='POST')return operationalExecute(request,env);
  if(url.pathname==='/api/ops/outbox/process'&&request.method==='POST')return processActionOutbox(request,env);
  if(url.pathname==='/api/copilot/briefing'&&request.method==='GET')return copilotBriefing(request,env);
  if(url.pathname==='/api/clients/score'&&request.method==='POST')return scoreClients(request,env);
  if(url.pathname==='/api/loyalty/update'&&request.method==='POST')return loyaltyUpdate(request,env);
  if(url.pathname==='/api/quality'&&request.method==='POST')return qualityCreate(request,env);
  if(url.pathname==='/api/capacity/dashboard'&&request.method==='GET')return capacityDashboard(request,env);
  if(url.pathname==='/api/finance/forecast'&&request.method==='POST')return financeForecast(request,env);
  if(url.pathname==='/api/system/audit'&&request.method==='GET')return systemAudit(request,env);
  return handleStrategic(request,env);
}


// ================================================================
// PROCHÉLIA V14.0.0 — FINAL HARDENING / PRODUCTION GATE
// Dernier renforcement architectural du moteur backend.
// Objectif : ne plus ajouter de "fonctionnalités manquantes" par vagues.
// Les futures évolutions seront des branchements/adaptateurs ou des
// changements métier explicitement décidés, pas des trous structurels.
// ================================================================

async function ensureFinalHardeningSchema(env) {
  if (!env.DB) throw new Error('DATABASE_REQUIRED');
  const statements = [
    `CREATE TABLE IF NOT EXISTS system_config_checks (
      id TEXT PRIMARY KEY, check_code TEXT NOT NULL, status TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_system_config_checks_code ON system_config_checks(check_code,checked_at)`,
    `CREATE TABLE IF NOT EXISTS idempotency_records (
      id TEXT PRIMARY KEY, scope TEXT NOT NULL, idem_key TEXT NOT NULL,
      request_hash TEXT, response_json TEXT, status_code INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(scope,idem_key)
    )`,
    `CREATE TABLE IF NOT EXISTS background_jobs (
      id TEXT PRIMARY KEY, job_type TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5, run_after TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at TEXT, last_error TEXT, result_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_background_jobs_ready ON background_jobs(status,run_after,created_at)`,
    `CREATE TABLE IF NOT EXISTS background_jobs_dead_letter (
      id TEXT PRIMARY KEY, source_job_id TEXT NOT NULL UNIQUE, job_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}', attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT, failed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolution_status TEXT NOT NULL DEFAULT 'OPEN', resolved_at TEXT, resolution_note TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_background_jobs_dead_letter_open ON background_jobs_dead_letter(resolution_status,failed_at)`,
    `CREATE TABLE IF NOT EXISTS security_rate_limits (
      id TEXT PRIMARY KEY, bucket TEXT NOT NULL, subject_hash TEXT NOT NULL,
      window_start TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(bucket,subject_hash,window_start)
    )`,
    `CREATE TABLE IF NOT EXISTS integration_registry (
      id TEXT PRIMARY KEY, integration_code TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED', required_secrets_json TEXT NOT NULL DEFAULT '[]',
      capabilities_json TEXT NOT NULL DEFAULT '[]', last_checked_at TEXT, details_json TEXT NOT NULL DEFAULT '{}'
    )`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
}

function finalSecretConfigured(env, key) {
  return typeof env?.[key] === 'string' && env[key].trim().length > 0;
}

async function registerIntegration(env, code, category, required, capabilities, status, details={}) {
  await env.DB.prepare(`INSERT INTO integration_registry
    (id,integration_code,category,status,required_secrets_json,capabilities_json,last_checked_at,details_json)
    VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP,?)
    ON CONFLICT(integration_code) DO UPDATE SET status=excluded.status,
      required_secrets_json=excluded.required_secrets_json,capabilities_json=excluded.capabilities_json,
      last_checked_at=CURRENT_TIMESTAMP,details_json=excluded.details_json`)
    .bind(crypto.randomUUID(),code,category,status,JSON.stringify(required),JSON.stringify(capabilities),JSON.stringify(details)).run();
}

async function productionConfigCheck(env, { persist = false } = {}) {
  if (!env?.DB) throw new Error('DATABASE_REQUIRED');
  // Schema creation belongs to reviewed migrations, never to an audit/job request.
  const checks=[];
  const requiredTables=['users','sessions','missions','payment_transactions','payment_accounts','wallets','payout_requests','payment_wallet_ledger','payment_reconciliation','payment_audit','payment_webhook_events','payment_disputes','finance_workspace_entries','finance_export_log','finance_resolution_cases','operational_cases','action_outbox','notification_outbox','accounting_ledger','promotions','promotion_recommendations','activity_journal','compliance_events'];
  for(const t of requiredTables) checks.push({code:`TABLE:${t}`,status:await tableExists(env,t)?'OK':'MISSING'});
  const pspRequired=['PAYMENT_PROVIDER','PAYMENT_WEBHOOK_SECRET'];
  for(const k of pspRequired) checks.push({code:`SECRET:${k}`,status:finalSecretConfigured(env,k)?'OK':'NOT_CONFIGURED'});
  checks.push({code:'BOOTSTRAP_TOKEN',status:finalSecretConfigured(env,'BOOTSTRAP_TOKEN')?'OK':'NOT_CONFIGURED'});
  const paymentCols=await tableColumns(env,'payment_transactions');
  const requiredPaymentCols=['id','idempotency_key','mission_id','client_id','intervenant_id','tenant_id','gross_cents','commission_cents','provider_fee_cents','refund_cents','net_intervenant_cents','status','provider_payment_id'];
  checks.push({code:'PAYMENT_COLUMNS',status:requiredPaymentCols.every(x=>paymentCols.includes(x))?'OK':'INCOMPLETE',missing:requiredPaymentCols.filter(x=>!paymentCols.includes(x))});
  const missionCols=await tableColumns(env,'missions');
  const usefulMissionCols=['id','client_id','intervenant_id','tenant_id'];
  checks.push({code:'MISSION_CORE_COLUMNS',status:usefulMissionCols.every(x=>missionCols.includes(x))?'OK':'INCOMPLETE',missing:usefulMissionCols.filter(x=>!missionCols.includes(x))});
  // Financial data must be tenant-bound before the readiness gate can ever open.
  // These columns are deliberately required even while the PSP adapter is disabled:
  // a future secret/configuration change must not silently bypass tenant isolation.
  const tenantScopedTables=['missions','wallets','payment_transactions','payment_accounts','payout_requests','payment_disputes','payment_wallet_ledger','payment_reconciliation','finance_workspace_entries','finance_export_log','finance_resolution_cases'];
  const tenantScopeChecks=[];
  for(const table of tenantScopedTables){
    const cols=await tableColumns(env,table);
    const missing=cols.includes('tenant_id')?[]:['tenant_id'];
    let unassigned=0;
    if(!missing.length){
      const count=await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE tenant_id IS NULL`).first();
      unassigned=Number(count?.total||0);
    }
    tenantScopeChecks.push({table,status:missing.length||unassigned?'INCOMPLETE':'OK',missing,unassigned});
  }
  checks.push({code:'FINANCIAL_TENANT_SCOPE',status:tenantScopeChecks.every(x=>x.status==='OK')?'OK':'INCOMPLETE',tables:tenantScopeChecks,missing:tenantScopeChecks.filter(x=>x.status!=='OK').map(x=>x.table)});
  const auxiliaryTenantTables=['payment_audit','payment_webhook_events'];
  const auxiliaryTenantChecks=[];
  for(const table of auxiliaryTenantTables){
    const cols=await tableColumns(env,table);
    const missing=cols.includes('tenant_id')?[]:['tenant_id'];
    auxiliaryTenantChecks.push({table,status:missing.length?'INCOMPLETE':'OK',missing});
  }
  checks.push({code:'FINANCIAL_AUXILIARY_TENANT_COLUMNS',status:auxiliaryTenantChecks.every(x=>x.status==='OK')?'OK':'INCOMPLETE',tables:auxiliaryTenantChecks,missing:auxiliaryTenantChecks.filter(x=>x.status!=='OK').map(x=>x.table)});
  if (persist) {
    const missingPersistenceTables = await missingRequiredTables(env, ['integration_registry','system_config_checks']);
    if (missingPersistenceTables.length) throw new Error('PRODUCTION_AUDIT_SCHEMA_NOT_READY:' + missingPersistenceTables.join(','));
    await registerIntegration(env,'PSP','PAYMENT',['PAYMENT_PROVIDER','PAYMENT_WEBHOOK_SECRET'],['charge','refund','payout','webhook','reconciliation'],finalSecretConfigured(env,'PAYMENT_PROVIDER')&&finalSecretConfigured(env,'PAYMENT_WEBHOOK_SECRET')?'CONFIGURED':'NOT_CONFIGURED');
    await registerIntegration(env,'NOTIFICATIONS','MESSAGING',['NOTIFICATION_PROVIDER'],['email','sms','push'],finalSecretConfigured(env,'NOTIFICATION_PROVIDER')?'CONFIGURED':'NOT_CONFIGURED');
    await registerIntegration(env,'MAPS','LOCATION',['MAPS_PROVIDER','MAPS_API_KEY'],['distance','geocoding','routing'],finalSecretConfigured(env,'MAPS_API_KEY')?'CONFIGURED':'NOT_CONFIGURED');
    await registerIntegration(env,'MARKET_DATA','COMMERCIAL',['MARKET_DATA_PROVIDER'],['market_prices','competitor_signals'],finalSecretConfigured(env,'MARKET_DATA_PROVIDER')?'CONFIGURED':'NOT_CONFIGURED');
  }
  const blocking=checks.filter(x=>['MISSING','INCOMPLETE'].includes(x.status));
  const externalNotConfigured=checks.filter(x=>x.status==='NOT_CONFIGURED' && ['SECRET:PAYMENT_PROVIDER','SECRET:PAYMENT_WEBHOOK_SECRET'].includes(x.code));
  const overall=blocking.length===0 && externalNotConfigured.length===0;
  if (persist) for(const c of checks) await env.DB.prepare(`INSERT INTO system_config_checks(id,check_code,status,details_json) VALUES(?,?,?,?)`).bind(crypto.randomUUID(),c.code,c.status,JSON.stringify(c)).run();
  return {overall,checks,blocking:blocking.length,externalNotConfigured:externalNotConfigured.length};
}

async function finalProductionAudit(request,env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const result=await productionConfigCheck(env);
  // GET audit endpoint is intentionally read-only; persist audit via explicit mutation endpoint.
  return json({ok:true,version:VERSION,production_gate:result.overall?'OPEN':'CLOSED',ready_for_real_traffic:result.overall,checks:result.checks,note:result.overall?'Architecture gate passed; external business integrations must still be exercised with sandbox/acceptance tests.':'No real production traffic should be enabled until blocking configuration/schema checks are resolved.'});
}

async function copilotNextActions(request,env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['platform_settings','operational_cases','promotion_recommendations','action_outbox'], 'COPILOT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const phase=await getSetting(env,'project_phase','TEST');
  const items=[];
  const cases=await env.DB.prepare(`SELECT id,case_type,priority,status,impact_level,description,proposed_solution_json FROM operational_cases WHERE status NOT IN ('RESOLVED','CLOSED') ORDER BY priority DESC,created_at ASC LIMIT 30`).all();
  for(const c of cases.results||[]) items.push({priority:Number(c.priority||10),category:'OPERATIONS',type:'CASE',id:c.id,title:c.description||c.case_type,impact:c.impact_level,status:c.status,action:'REVIEW_OR_EXECUTE'});
  const promos=await env.DB.prepare(`SELECT id,recommendation_type,discount_percent,max_safe_discount_percent,status,rationale FROM promotion_recommendations WHERE status='PROPOSED' ORDER BY created_at DESC LIMIT 20`).all();
  for(const p of promos.results||[]) items.push({priority:30,category:'COMMERCIAL',type:'PROMOTION',id:p.id,title:`Promotion ${p.recommendation_type}`,action:'REVIEW_PROMOTION',discount_percent:p.discount_percent,max_safe_discount_percent:p.max_safe_discount_percent,rationale:p.rationale});
  const pending=await env.DB.prepare(`SELECT id,action_type,status,attempts,last_error FROM action_outbox WHERE status IN ('PENDING','FAILED','WAITING_PROVIDER') ORDER BY created_at ASC LIMIT 20`).all();
  for(const a of pending.results||[]) items.push({priority:a.status==='FAILED'?90:50,category:'EXECUTION',type:'ACTION',id:a.id,title:a.action_type,action:a.status==='FAILED'?'RETRY_OR_REVIEW':'PROCESS',status:a.status,attempts:a.attempts,last_error:a.last_error});
  items.sort((a,b)=>b.priority-a.priority);
  return json({ok:true,version:VERSION,phase,top_actions:items.slice(0,30),automation_policy:'simple_low_impact_auto_sensitive_manager'});
}

async function enqueueBackgroundJob(env, jobType, payload={}, maxAttempts=5) {
  if (!(await tableExists(env, 'background_jobs'))) throw new Error('BACKGROUND_JOB_SCHEMA_NOT_READY');
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO background_jobs(id,job_type,payload_json,max_attempts) VALUES(?,?,?,?)`).bind(id,jobType,JSON.stringify(payload),maxAttempts).run();
  return id;
}

async function processBackgroundJobs(request,env,{scheduler=false}={}) {
  // The scheduler flag is only supplied by the Worker's scheduled() handler; it is
  // never derived from an HTTP header, query parameter, or client-controlled body.
  const gate=scheduler
    ? {auth:{user:{id:'cloudflare-cron',role:'GERANTE'}}}
    : await requireAuthRole(request,env,['gerante']);
  if(gate.error)return gate.error;
  if (!env?.DB?.prepare) return json({ok:false,error:'DATABASE_REQUIRED'},503);
  // Runtime schedulers must never create or alter schema outside the reviewed
  // migration chain. Readiness is read-only and fails closed until every table
  // needed for claims, dead letters and audit journaling has been migrated.
  const requiredTables=['background_jobs','background_jobs_dead_letter','activity_journal'];
  const missingTables=[];
  for(const table of requiredTables) if(!await tableExists(env,table)) missingTables.push(table);
  if(missingTables.length) return json({ok:false,error:'BACKGROUND_JOB_SCHEMA_NOT_MIGRATED',missing:missingTables,write_enabled:false},503);
  // Recover abandoned leases after a worker crash. A bounded retry delay
  // prevents a hot loop while keeping exhausted jobs visible as FAILED.
  const stale=await env.DB.prepare(`SELECT id,attempts,max_attempts FROM background_jobs WHERE status='RUNNING' AND locked_at<=datetime(CURRENT_TIMESTAMP,'-10 minutes') ORDER BY locked_at LIMIT 50`).all();
  const recovered=[];
  for(const job of stale.results||[]) {
    const attempts=Number(job.attempts||0)+1;
    const exhausted=attempts>=Number(job.max_attempts||5);
    const delaySeconds=Math.min(3600,30*Math.pow(2,Math.min(attempts-1,7)));
    const moved=await env.DB.prepare(`UPDATE background_jobs SET status=?,attempts=?,run_after=datetime(CURRENT_TIMESTAMP,?),locked_at=NULL,last_error='STALE_LEASE_RECOVERED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='RUNNING'`)
      .bind(exhausted?'FAILED':'PENDING',attempts,`+${delaySeconds} seconds`,job.id).run();
    if(Number(moved?.meta?.changes||0)===1) {
      if(exhausted) {
        await env.DB.prepare(`INSERT OR IGNORE INTO background_jobs_dead_letter
          (id,source_job_id,job_type,payload_json,attempts,last_error)
          SELECT ?,id,job_type,payload_json,?,'STALE_LEASE_RETRY_LIMIT_REACHED' FROM background_jobs WHERE id=?`)
          .bind(crypto.randomUUID(),attempts,job.id).run();
      }
      recovered.push({id:job.id,status:exhausted?'FAILED':'PENDING',retry_after_seconds:exhausted?null:delaySeconds});
    }
  }
  const rows=await env.DB.prepare(`SELECT * FROM background_jobs WHERE status='PENDING' AND run_after<=CURRENT_TIMESTAMP ORDER BY created_at LIMIT 25`).all();
  const results=[];
  for(const job of rows.results||[]) {
    try {
      const claim=await env.DB.prepare(`UPDATE background_jobs SET status='RUNNING',locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'`).bind(job.id).run();
      // A concurrent scheduler/request may have claimed this job already.
      // Never execute a job unless this invocation owns the conditional claim.
      if(Number(claim?.meta?.changes||0)!==1) continue;
      let result={performed:false,reason:'JOB_TYPE_NOT_IMPLEMENTED'};
      const payload=JSON.parse(job.payload_json||'{}');
      // Delegation labels are not execution. Keep these jobs visible for an
      // implemented provider rather than falsely recording them as completed.
      if(job.job_type==='PROCESS_ACTION_OUTBOX') result={performed:false,reason:'OUTBOX_PROCESSOR_NOT_INTEGRATED',next:'/api/ops/outbox/process'};
      else if(job.job_type==='PRODUCTION_AUDIT') result=await productionConfigCheck(env,{persist:false});
      else if(job.job_type==='COPILOT_BRIEFING') result={performed:false,reason:'BRIEFING_PROVIDER_NOT_INTEGRATED',next:'/api/copilot/briefing'};
      const done=result.performed===true || result.overall===true;
      await env.DB.prepare(`UPDATE background_jobs SET status=?,result_json=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP,completed_at=? WHERE id=?`)
        .bind(done?'DONE':'WAITING_PROVIDER',JSON.stringify(result),done?new Date().toISOString():null,job.id).run();
      results.push({id:job.id,status:done?'DONE':'WAITING_PROVIDER',result});
    } catch(e) {
      const attempts=Number(job.attempts||0)+1;
      const exhausted=attempts>=Number(job.max_attempts||5);
      const status=exhausted?'FAILED':'PENDING';
      const delaySeconds=Math.min(3600,30*Math.pow(2,Math.min(attempts-1,7)));
      await env.DB.prepare(`UPDATE background_jobs SET status=?,attempts=?,run_after=datetime(CURRENT_TIMESTAMP,?),locked_at=NULL,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='RUNNING'`)
        .bind(status,attempts,`+${delaySeconds} seconds`,String(e.message||e),job.id).run();
      if(exhausted) {
        await env.DB.prepare(`INSERT OR IGNORE INTO background_jobs_dead_letter
          (id,source_job_id,job_type,payload_json,attempts,last_error)
          SELECT ?,id,job_type,payload_json,?,? FROM background_jobs WHERE id=?`)
          .bind(crypto.randomUUID(),attempts,String(e.message||e),job.id).run();
      }
      results.push({id:job.id,status,retry_after_seconds:exhausted?null:delaySeconds,error:String(e.message||e)});
    }
  }
  await journal(env,'gerante',gate.auth.user.id,'BACKGROUND_JOBS_PROCESSED','system',null,'OK',{count:results.length});
  return json({ok:true,version:VERSION,recovered_leases:recovered.length,recovered,processed:results.length,results});
}

function isMutatingMethod(method){ return ['POST','PUT','PATCH','DELETE'].includes(method); }
function securityOriginAllowed(request,env){
  const origin=request.headers.get('origin');
  // Les clients non-navigateur peuvent ne pas envoyer Origin. Les requêtes navigateur
  // avec Origin doivent correspondre à une origine explicitement autorisée.
  if(!origin) return true;
  const configured=clean(env?.CORS_ORIGIN);
  const defaults=[
    'https://prochelia.pages.dev',
    'https://56b01f85.prochelia.pages.dev'
  ];
  const allowed=(configured ? configured.split(',') : defaults)
    .map(x=>String(x).trim()).filter(Boolean);
  return allowed.includes(origin);
}


// ================================================================
// PROCHÉLIA V14.0.0 — COPILOTE COMMERCIAL & RECRUTEMENT
// Extension intégrée au moteur unique : aucun second moteur métier.
// Objectif : prospecter, présenter, argumenter, relancer, recruter,
// qualifier et piloter la croissance avec des fiches actionnables.
// Les contacts externes et envois réels restent soumis aux intégrations
// autorisées et aux règles RGPD/anti-spam applicables.
// ================================================================

async function ensureCommercialRecruitmentSchema(env){
  if(!env.DB) throw new Error('DATABASE_REQUIRED');
  const sql=[
    `CREATE TABLE IF NOT EXISTS commercial_prospects (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'B2B', company_name TEXT, contact_name TEXT,
      email TEXT, phone TEXT, website TEXT, sector TEXT, city TEXT, postal_code TEXT,
      source TEXT, need TEXT, estimated_potential_cents INTEGER, score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'QUALIFICATION', status TEXT NOT NULL DEFAULT 'OPEN',
      next_action TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_commercial_prospects_priority ON commercial_prospects(status,score DESC,updated_at)`,
    `CREATE TABLE IF NOT EXISTS commercial_playbooks (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, stage TEXT NOT NULL,
      objective TEXT NOT NULL, script TEXT NOT NULL, objections_json TEXT NOT NULL DEFAULT '[]',
      followup_json TEXT NOT NULL DEFAULT '[]', metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS recruitment_candidates (
      id TEXT PRIMARY KEY, full_name TEXT, email TEXT, phone TEXT, metier_code TEXT,
      city TEXT, radius_km REAL, qualifications_json TEXT NOT NULL DEFAULT '[]',
      documents_status TEXT NOT NULL DEFAULT 'TO_VERIFY', identity_status TEXT NOT NULL DEFAULT 'TO_VERIFY',
      score INTEGER NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'SOURCING',
      status TEXT NOT NULL DEFAULT 'OPEN', notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_recruitment_candidates ON recruitment_candidates(status,score DESC,updated_at)`,
    `CREATE TABLE IF NOT EXISTS copilot_growth_actions (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, target_type TEXT NOT NULL, title TEXT NOT NULL,
      recommendation TEXT NOT NULL, expected_impact_json TEXT NOT NULL DEFAULT '{}',
      priority INTEGER NOT NULL DEFAULT 10, status TEXT NOT NULL DEFAULT 'PROPOSED',
      approved_by TEXT, executed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sales_results (
      id TEXT PRIMARY KEY, prospect_id TEXT, stage TEXT NOT NULL, outcome TEXT NOT NULL,
      amount_cents INTEGER, margin_cents INTEGER, source TEXT, notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for(const q of sql) await env.DB.prepare(q).run();
}

function commercialStageGuide(stage){
  const s=String(stage||'FIRST_CONTACT').toUpperCase();
  const map={
    FIRST_CONTACT:{label:'Premier contact',objective:'Obtenir l’attention et une prise de rendez-vous',length:'COURT'},
    DISCOVERY:{label:'Découverte',objective:'Comprendre le besoin avant de vendre',length:'QUESTIONS'},
    PRESENTATION:{label:'Présentation',objective:'Présenter PROCHÉLIA avec les bénéfices adaptés',length:'MOYEN'},
    ARGUMENTATION:{label:'Argumentation',objective:'Démontrer la valeur et répondre aux objections',length:'COURT'},
    PROPOSAL:{label:'Proposition',objective:'Transformer l’intérêt en proposition concrète',length:'MOYEN'},
    FOLLOW_UP:{label:'Relance',objective:'Obtenir une réponse sans pression inutile',length:'COURT'},
    CLOSING:{label:'Conclusion',objective:'Obtenir l’accord, le rendez-vous ou la première mission',length:'COURT'},
    RETENTION:{label:'Fidélisation',objective:'Créer de la récurrence et développer le compte',length:'MOYEN'}
  };
  return map[s]||map.FIRST_CONTACT;
}

function commercialBenefits(target,need){
  const t=String(target||'B2B').toUpperCase(); const n=String(need||'').trim();
  if(t==='INTERVENANT') return ['accès à des missions adaptées','organisation et suivi des interventions','cadre de fonctionnement clair','suivi administratif et documentaire','visibilité sur les opportunités'];
  if(t==='B2C') return ['simplicité de réservation','solution adaptée au besoin','suivi de la prestation','sécurité et traçabilité','accompagnement'];
  return ['solution flexible pour les besoins d’intervention','simplification de l’organisation','traçabilité et suivi des missions','possibilité de gérer des besoins récurrents','interlocuteur et processus structurés'];
}

function makeObjections(target){
  const common=[
    {objection:'« Nous avons déjà un prestataire. »',answer:'« Je comprends. L’objectif n’est pas forcément de remplacer votre solution actuelle, mais de vous proposer une solution complémentaire lorsque vous avez un besoin ponctuel, urgent ou difficile à couvrir. »'},
    {objection:'« C’est trop cher. »',answer:'« Regardons d’abord le besoin et la valeur attendue. Je peux vous proposer une formule adaptée au volume, aux horaires et à la fréquence plutôt qu’une offre standard. »'},
    {objection:'« Envoyez-moi simplement vos informations. »',answer:'« Bien sûr. Pour vous envoyer uniquement ce qui vous concerne, puis-je vous poser deux questions rapides sur vos besoins ? »'}
  ];
  if(String(target).toUpperCase()==='INTERVENANT') common.push({objection:'« Pourquoi rejoindre PROCHÉLIA ? »',answer:'« L’intérêt est d’avoir un cadre organisé, des opportunités de missions et un suivi clair, avec des règles transparentes sur les documents, les missions et les paiements. »'});
  return common;
}

function makeFollowups(stage,target){
  const t=String(target||'B2B').toUpperCase();
  return [
    {delay:'J+2',channel:'email',text:`Bonjour, je reviens vers vous concernant PROCHÉLIA. Je reste disponible pour voir si notre solution peut répondre à vos besoins ${t==='INTERVENANT'?'de missions et d’activité':'d’intervention'}.`},
    {delay:'J+7',channel:'email',text:'Je me permets une dernière relance afin de savoir si le sujet est toujours d’actualité. Si oui, je peux vous proposer un échange court et ciblé.'},
    {delay:'J+21',channel:'crm',text:'Requalification du prospect et nouvelle proposition si besoin.'}
  ];
}

function makeSalesKit(body){
  const target=String(body?.target_type||'B2B').toUpperCase();
  const stage=String(body?.stage||'FIRST_CONTACT').toUpperCase();
  const g=commercialStageGuide(stage); const name=clean(body?.contact_name)||'Madame, Monsieur';
  const org=clean(body?.company_name)||'votre structure'; const need=clean(body?.need)||'vos besoins d’intervention';
  const benefits=commercialBenefits(target,need);
  let opening;
  if(stage==='FIRST_CONTACT') opening=`Bonjour ${name}, je vous contacte au nom de PROCHÉLIA. Nous proposons une solution organisée pour ${need}. L’objectif est de vous faire gagner du temps et de disposer d’une solution souple lorsque vous avez besoin d’interventions fiables et structurées. Seriez-vous disponible pour un échange de 10 minutes afin de voir si cela peut être utile à ${org} ?`;
  else if(stage==='DISCOVERY') opening=`Merci pour votre intérêt. Avant de vous présenter PROCHÉLIA en détail, j’aimerais comprendre ${need}. Quels sont aujourd’hui vos principaux besoins, vos contraintes de délai et votre fréquence d’intervention ?`;
  else if(stage==='PRESENTATION') opening=`PROCHÉLIA accompagne ${target==='INTERVENANT'?'les intervenants dans le développement et l’organisation de leur activité':target==='B2C'?'les particuliers dans leurs besoins d’intervention':'les entreprises dans l’organisation de leurs besoins d’intervention'}. La plateforme centralise les demandes, la mise en relation, le suivi et la traçabilité afin de simplifier le parcours.`;
  else if(stage==='FOLLOW_UP') opening=`Bonjour ${name}, je reviens vers vous au sujet de PROCHÉLIA. Je voulais simplement vérifier si ${need} est toujours d’actualité. Si oui, je peux vous proposer une solution adaptée sans vous faire perdre de temps.`;
  else if(stage==='CLOSING') opening=`Au regard de votre besoin, je vous propose que nous validions la prochaine étape : un premier échange, une première mission ou une proposition adaptée à votre volume. L’objectif est de commencer simplement et de mesurer les résultats.`;
  else opening=`Pour ${org}, je recommande de mettre en avant ${benefits.slice(0,3).join(', ')}. ${g.objective}.`;
  return {target_type:target,stage,stage_label:g.label,objective:g.objective,opening,benefits,questions:[`Quel est votre besoin principal aujourd’hui ?`,`À quelle fréquence ce besoin se présente-t-il ?`,`Quelles sont vos principales contraintes (délai, zone, budget, disponibilité) ?`,`Qu’est-ce qui ferait qu’une solution serait réellement utile pour vous ?`],objections:makeObjections(target),followups:makeFollowups(stage,target),closing:'« Si cela vous convient, je vous propose de définir maintenant la prochaine étape la plus simple. »'};
}

async function commercialProspectCreate(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['commercial_prospects','commercial_playbooks','recruitment_candidates','copilot_growth_actions','sales_results'], 'COMMERCIAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request);
  const id=crypto.randomUUID(); const kind=String(b?.kind||'B2B').toUpperCase();
  const score=Math.max(0,Math.min(100,Number(b?.score||0)||0));
  await env.DB.prepare(`INSERT INTO commercial_prospects(id,kind,company_name,contact_name,email,phone,website,sector,city,postal_code,source,need,estimated_potential_cents,score,next_action,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,kind,clean(b?.company_name)||null,clean(b?.contact_name)||null,normalizeEmail(b?.email)||null,clean(b?.phone)||null,clean(b?.website)||null,clean(b?.sector)||null,clean(b?.city)||null,clean(b?.postal_code)||null,clean(b?.source)||'COPILOTE',clean(b?.need)||null,Number.isFinite(Number(b?.estimated_potential_cents))?Math.max(0,Math.round(Number(b.estimated_potential_cents))):null,score,clean(b?.next_action)||'PREMIER_CONTACT',clean(b?.notes)||null).run();
  await journal(env,'gerante',gate.auth.user.id,'PROSPECT_CREATED','commercial_prospect',id,'OK',{kind,score});
  return json({ok:true,version:VERSION,prospect_id:id,score,next_action:clean(b?.next_action)||'PREMIER_CONTACT'},201);
}

async function commercialProspectSheet(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['commercial_prospects','commercial_playbooks','recruitment_candidates','copilot_growth_actions','sales_results'], 'COMMERCIAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request);
  const kit=makeSalesKit(b); const id=clean(b?.prospect_id)||null;
  let prospect=null; if(id) prospect=await env.DB.prepare('SELECT * FROM commercial_prospects WHERE id=? LIMIT 1').bind(id).first();
  const p=prospect||b; const potential=Number(p?.estimated_potential_cents||0);
  const sheet={ok:true,version:VERSION,prospect:prospect||null,kit,commercial_priority:potential>0?Math.min(100,Math.round((potential/100000)*20)+Number(p?.score||0)):Number(p?.score||0),recommended_next_action:kit.stage==='FIRST_CONTACT'?'CONTACTER':kit.stage==='FOLLOW_UP'?'RELANCER':'PREPARER_RENDEZ_VOUS'};
  await journal(env,'copilot',gate.auth.user.id,'PROSPECTION_SHEET_GENERATED','commercial_prospect',id,'OK',{stage:kit.stage,target:kit.target_type});
  return json(sheet,200);
}

async function commercialPlaybook(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['commercial_prospects','commercial_playbooks','recruitment_candidates','copilot_growth_actions','sales_results'], 'COMMERCIAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request); const kit=makeSalesKit(b); const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO commercial_playbooks(id,target_type,stage,objective,script,objections_json,followup_json,metadata_json) VALUES(?,?,?,?,?,?,?,?)`).bind(id,kit.target_type,kit.stage,kit.objective,kit.opening,JSON.stringify(kit.objections),JSON.stringify(kit.followups),JSON.stringify({benefits:kit.benefits,questions:kit.questions,closing:kit.closing})).run();
  return json({ok:true,version:VERSION,playbook_id:id,playbook:kit},201);
}

async function recruitmentCandidateCreate(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['commercial_prospects','commercial_playbooks','recruitment_candidates','copilot_growth_actions','sales_results'], 'COMMERCIAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request); const id=crypto.randomUUID();
  const qualifications=Array.isArray(b?.qualifications)?b.qualifications:[];
  const score=Math.max(0,Math.min(100,Number(b?.score||0)||0));
  await env.DB.prepare(`INSERT INTO recruitment_candidates(id,full_name,email,phone,metier_code,city,radius_km,qualifications_json,score,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,clean(b?.full_name)||null,normalizeEmail(b?.email)||null,clean(b?.phone)||null,clean(b?.metier_code)||null,clean(b?.city)||null,Number.isFinite(Number(b?.radius_km))?Number(b.radius_km):null,JSON.stringify(qualifications),score,clean(b?.notes)||null).run();
  await env.DB.prepare(`INSERT INTO recruitment_tasks(id,candidate_id,metier_code,status,step,priority,notes) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,clean(b?.metier_code)||null,'OPEN','SCREENING',Math.max(10,score),`Qualifier ${clean(b?.full_name)||'le candidat'} puis vérifier identité, qualifications et documents.`).run();
  await journal(env,'gerante',gate.auth.user.id,'RECRUITMENT_CANDIDATE_CREATED','recruitment_candidate',id,'OK',{score});
  return json({ok:true,version:VERSION,candidate_id:id,score,next_step:'SCREENING_AND_DOCUMENT_CHECK'},201);
}

async function recruitmentSheet(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['commercial_prospects','commercial_playbooks','recruitment_candidates','copilot_growth_actions','sales_results'], 'COMMERCIAL_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request);
  const target=clean(b?.metier_code)||'METIER_A_DEFINIR'; const zone=clean(b?.city)||'zone à définir';
  const intro=`PROCHÉLIA recherche des intervenants pour renforcer sa capacité dans ${zone}. Le rôle consiste à réaliser les missions correspondant à votre métier, dans un cadre organisé, avec suivi des documents, des missions et des paiements.`;
  const objections=[{objection:'« Je veux comprendre le fonctionnement avant de m’inscrire. »',answer:'« C’est normal. Nous vous expliquons d’abord le parcours, les documents requis, les règles de mission et le fonctionnement des paiements avant toute activation. »'},{objection:'« Est-ce que je suis obligé d’accepter toutes les missions ? »',answer:'« Les règles exactes dépendent du cadre contractuel et du fonctionnement de la plateforme ; elles sont présentées clairement avant l’activation. »'}];
  return json({ok:true,version:VERSION,recruitment_sheet:{metier_code:target,zone,introduction:intro,profile_recherche:['identité vérifiable','qualifications/documents applicables','disponibilités','secteur géographique','fiabilité et qualité de service'],questions:['Quel est votre métier et votre expérience ?','Dans quelle zone intervenez-vous ?','Quelles sont vos disponibilités ?','Quels types de missions recherchez-vous ?'],objections,closing:'« Si le fonctionnement vous convient, nous pouvons passer à l’étape de vérification et d’intégration. »',compliance_note:'Aucune promesse d’embauche ou d’habilitation n’est faite automatiquement ; les vérifications requises restent nécessaires.'}},200);
}

async function growthDashboard(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const schemaGate = await schemaReadinessResponse(env, ['commercial_prospects','recruitment_candidates','commercial_tasks','recruitment_tasks'], 'GROWTH_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const p=await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(AVG(score),0) avg_score FROM commercial_prospects WHERE status='OPEN'`).first();
  const r=await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(AVG(score),0) avg_score FROM recruitment_candidates WHERE status='OPEN'`).first();
  const ct=await env.DB.prepare(`SELECT COUNT(*) n FROM commercial_tasks WHERE status='OPEN'`).first();
  const rt=await env.DB.prepare(`SELECT COUNT(*) n FROM recruitment_tasks WHERE status='OPEN'`).first();
  const top=await env.DB.prepare(`SELECT id,kind,company_name,contact_name,sector,city,score,next_action FROM commercial_prospects WHERE status='OPEN' ORDER BY score DESC,updated_at DESC LIMIT 10`).all();
  const cand=await env.DB.prepare(`SELECT id,full_name,metier_code,city,score,stage FROM recruitment_candidates WHERE status='OPEN' ORDER BY score DESC,updated_at DESC LIMIT 10`).all();
  return json({ok:true,version:VERSION,growth_dashboard:{commercial:{prospects_open:Number(p?.n||0),average_score:Number(p?.avg_score||0),tasks_open:Number(ct?.n||0),top_prospects:top.results||[]},recruitment:{candidates_open:Number(r?.n||0),average_score:Number(r?.avg_score||0),tasks_open:Number(rt?.n||0),top_candidates:cand.results||[]},principle:'Prioriser les actions qui augmentent le chiffre d’affaires et la marge sans dégrader la qualité, la conformité ou la rémunération des intervenants.'}},200);
}


/* ==================== V14.0.0 — COMPTABILITÉ MULTI-ESPACE / EXPORTS / RÉSOLUTION ==================== */
async function assertFinanceWorkspaceTenantSchema(env) {
  if (!env?.DB) throw new Error('DATABASE_REQUIRED');
  // Finance workspace schema is owned by canonical migrations, never runtime DDL.
  const required = {
    finance_workspace_entries: ['id','user_id','tenant_id','entry_type','amount_cents'],
    finance_export_log: ['id','user_id','tenant_id','format'],
    finance_resolution_cases: ['id','user_id','tenant_id','issue_type','status']
  };
  for (const [table, requiredColumns] of Object.entries(required)) {
    const columns = await tableColumns(env, table);
    if (!requiredColumns.every(column => columns.includes(column))) {
      throw new Error('FINANCE_WORKSPACE_TENANT_SCHEMA_REQUIRED');
    }
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE tenant_id IS NULL`).first();
    if (Number(count?.total || 0) > 0) throw new Error('FINANCE_WORKSPACE_TENANT_ATTRIBUTION_REQUIRED');
  }
}

function financeRoleAllowed(role) {
  return ['CLIENT','CLIENT_SOCIAL','SOCIETE','COMPANY','INTERVENANT','GERANTE','ADMIN','FINANCE','SUPPORT'].includes(String(role||'').toUpperCase());
}

async function financeAuth(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth) return { response: json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401) };
  if (!financeRoleAllowed(auth.user.role)) return { response: json({ok:false,error:'FORBIDDEN',version:VERSION},403) };
  let tenantContext;
  try {
    tenantContext = await resolveTenantContext(request,env,auth);
  } catch {
    return { response: json({ok:false,error:'TENANT_CONTEXT_UNAVAILABLE',version:VERSION},503) };
  }
  if (!tenantContext?.ok || !tenantContext.tenant?.id) {
    return { response: json({ok:false,error:tenantContext?.error||'ACTIVE_TENANT_REQUIRED',version:VERSION},tenantContext?.status||403) };
  }
  try {
    await assertFinanceWorkspaceTenantSchema(env);
  } catch {
    return { response: json({ok:false,error:'FINANCE_WORKSPACE_TENANT_SCOPE_REQUIRED',version:VERSION,write_enabled:false},503) };
  }
  return { auth, tenantId:tenantContext.tenant.id };
}

function financeMoney(cents) {
  return Number(cents || 0) / 100;
}

function financeIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function financeRowsForUser(env, user, tenantId) {
  if (!tenantId) throw new Error('ACTIVE_TENANT_REQUIRED');
  const role = String(user.role||'').toUpperCase();
  const uid = user.id;
  const manager = ['GERANTE','ADMIN','FINANCE','SUPPORT','SOCIETE','COMPANY'].includes(role);
  let where = 'tenant_id=?';
  const params = [tenantId];
  if (role === 'INTERVENANT') {
    where += ' AND intervenant_id IN (SELECT id FROM intervenants WHERE user_id=? AND tenant_id=?)';
    params.push(uid,tenantId);
  } else if (!manager) {
    where += ' AND client_id IN (SELECT id FROM clients WHERE user_id=? AND tenant_id=?)';
    params.push(uid,tenantId);
  }

  let payments = [];
  const r = await env.DB.prepare(
    `SELECT id,mission_id,client_id,intervenant_id,type,status,gross_cents,commission_cents,
            provider_fee_cents,refund_cents,net_intervenant_cents,currency,provider,
            provider_payment_id,provider_payout_id,reason,created_at,updated_at
       FROM payment_transactions WHERE ${where}
      ORDER BY created_at DESC LIMIT 5000`
  ).bind(...params).all();
  payments = r.results || [];

  let ledger = [];
  const ledgerQuery = manager
    ? env.DB.prepare(`SELECT id,entry_type,direction,amount_cents,currency,label,reference_type,reference_id,status,created_at
         FROM finance_workspace_entries WHERE tenant_id=? ORDER BY created_at DESC LIMIT 5000`).bind(tenantId)
    : env.DB.prepare(`SELECT id,entry_type,direction,amount_cents,currency,label,reference_type,reference_id,status,created_at
         FROM finance_workspace_entries WHERE tenant_id=? AND user_id=? ORDER BY created_at DESC LIMIT 5000`).bind(tenantId,uid);
  const ledgerResult = await ledgerQuery.all();
  ledger = ledgerResult.results || [];

  let payouts = [];
  const payoutQuery = manager
    ? env.DB.prepare(`SELECT id,user_id,amount_cents,currency,mode,status,provider,provider_payout_id,failure_code,requested_at,completed_at
         FROM payout_requests WHERE tenant_id=? ORDER BY requested_at DESC LIMIT 5000`).bind(tenantId)
    : env.DB.prepare(`SELECT id,user_id,amount_cents,currency,mode,status,provider,provider_payout_id,failure_code,requested_at,completed_at
         FROM payout_requests WHERE tenant_id=? AND user_id=? ORDER BY requested_at DESC LIMIT 5000`).bind(tenantId,uid);
  const payoutResult = await payoutQuery.all();
  payouts = payoutResult.results || [];
  return {payments,ledger,payouts};
}

function financeSummaryFromRows(rows,user) {
  const role=String(user.role||'').toUpperCase();
  let gross=0, refunds=0, commission=0, psp=0, netIntervenant=0, count=0;
  for(const x of rows.payments){
    if(String(x.status||'').toLowerCase()==='failed') continue;
    gross += Number(x.gross_cents||0);
    refunds += Number(x.refund_cents||0);
    commission += Number(x.commission_cents||0);
    psp += Number(x.provider_fee_cents||0);
    netIntervenant += Number(x.net_intervenant_cents||0);
    count++;
  }
  let ledgerIn=0, ledgerOut=0;
  for(const x of rows.ledger){
    const n=Number(x.amount_cents||0);
    if(String(x.direction).toUpperCase()==='OUT') ledgerOut+=n; else ledgerIn+=n;
  }
  const clientNet = gross-refunds;
  const platformNet = gross-refunds-commission-psp;
  return {
    role,
    transactions:count,
    gross_cents:gross, gross_eur:financeMoney(gross),
    refunds_cents:refunds, refunds_eur:financeMoney(refunds),
    commission_cents:commission, commission_eur:financeMoney(commission),
    provider_fees_cents:psp, provider_fees_eur:financeMoney(psp),
    net_intervenant_cents:netIntervenant, net_intervenant_eur:financeMoney(netIntervenant),
    client_net_cents:clientNet, client_net_eur:financeMoney(clientNet),
    platform_net_cents:platformNet, platform_net_eur:financeMoney(platformNet),
    manual_ledger_in_cents:ledgerIn, manual_ledger_out_cents:ledgerOut,
    manual_ledger_balance_cents:ledgerIn-ledgerOut
  };
}

function financeProblemSolution(issueType) {
  const k=String(issueType||'').toUpperCase();
  const map={
    PAYMENT_FAILED:['PAYMENT_FAILED','Vérifier transaction → ne pas débiter deux fois → proposer nouveau moyen de paiement → journaliser → relancer si autorisé.'],
    REFUND_MISSING:['REFUND_MISSING','Rapprocher paiement/remboursement → vérifier statut PSP → créer une action idempotente → escalader si absence de confirmation.'],
    WRONG_AMOUNT:['WRONG_AMOUNT','Comparer snapshot du devis/facture/paiement → bloquer toute correction destructive → proposer avoir/remboursement ou régularisation → validation si impact financier.'],
    INVOICE_MISSING:['INVOICE_MISSING','Rechercher la facture → régénérer uniquement si l’identifiant n’existe pas déjà → notifier → tracer.'],
    EXPORT_FAILED:['EXPORT_FAILED','Relancer génération → vérifier volume/format → proposer CSV de secours → journaliser l’incident.'],
    DUPLICATE_CHARGE:['DUPLICATE_CHARGE','Détecter idempotency_key/référence PSP → geler la seconde opération → rapprocher → proposer remboursement si confirmé.'],
    PAYOUT_MISSING:['PAYOUT_MISSING','Vérifier transaction et statut PSP → aucun faux paiement → relance provider ou escalade support/finance.'],
    DISPUTE:['DISPUTE','Ouvrir dossier → figer preuves → chronologie → analyser → proposer résolution → validation humaine si impact élevé.'],
    ACCOUNTING_MISMATCH:['ACCOUNTING_MISMATCH','Comparer ledger, paiement, facture et remboursement → identifier l’écart → créer écriture corrective immuable → audit.'],
    UNKNOWN:['UNKNOWN','Qualifier automatiquement → proposer une résolution à faible impact si sûre → sinon transmettre à la Gérante avec toutes les preuves.']
  };
  return map[k]||map.UNKNOWN;
}

async function financeDashboard(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth,tenantId}=a, rows=await financeRowsForUser(env,auth.user,tenantId), summary=financeSummaryFromRows(rows,auth.user);
  return json({ok:true,version:VERSION,workspace:{
    owner:{id:auth.user.id,role:auth.user.role,email:auth.user.email},
    summary,
    payments:rows.payments,
    payouts:rows.payouts||[],
    ledger:rows.ledger,
    exports:['CSV','JSON','HTML/PDF'],
    support_resolution:{automatic_for_low_impact:true,human_validation_for_sensitive:true}
  }});
}

async function financeExport(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth,tenantId}=a, url=new URL(request.url);
  const format=String(url.searchParams.get('format')||'csv').toLowerCase();
  const start=url.searchParams.get('from'), end=url.searchParams.get('to');
  const rows=await financeRowsForUser(env,auth.user,tenantId);
  let payments=rows.payments.filter(x=>(!start||String(x.created_at)>=start)&&(!end||String(x.created_at)<=end));
  const data=payments.map(x=>({
    id:x.id, mission_id:x.mission_id, type:x.type, status:x.status, date:x.created_at,
    montant_brut_eur:financeMoney(x.gross_cents), remboursement_eur:financeMoney(x.refund_cents),
    commission_eur:financeMoney(x.commission_cents), frais_psp_eur:financeMoney(x.provider_fee_cents),
    remuneration_intervenant_eur:financeMoney(x.net_intervenant_cents), devise:x.currency||'EUR',
    motif:x.reason||''
  }));
  const summary=financeSummaryFromRows({payments,ledger:rows.ledger},auth.user);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO finance_export_log(id,user_id,role,format,period_start,period_end,row_count,tenant_id) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(id,auth.user.id,auth.user.role,format,start,end,data.length,tenantId).run();
  await journal(env,auth.user.role,auth.user.id,'FINANCE_EXPORT','finance_export',id,'OK',{format,row_count:data.length,from:start,to:end});

  if(format==='json') return json({ok:true,version:VERSION,summary,rows:data,export_id:id});
  if(format==='html' || format==='pdf') {
    const escHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const body=data.map(r=>`<tr><td>${escHtml(r.date)}</td><td>${escHtml(r.type)}</td><td>${escHtml(r.status)}</td><td>${r.montant_brut_eur.toFixed(2)}</td><td>${r.remboursement_eur.toFixed(2)}</td><td>${r.commission_eur.toFixed(2)}</td><td>${r.frais_psp_eur.toFixed(2)}</td><td>${r.remuneration_intervenant_eur.toFixed(2)}</td></tr>`).join('');
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>PROCHÉLIA — Export financier</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#172a2a}h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ddd;padding:6px}th{background:#eee}.tot{margin:14px 0}</style></head><body><h1>PROCHÉLIA — Export financier</h1><div class="tot">Période : ${escHtml(start||'Toutes')} → ${escHtml(end||'Toutes')} · Transactions : ${summary.transactions} · Brut : ${summary.gross_eur.toFixed(2)} € · Remboursements : ${summary.refunds_eur.toFixed(2)} €</div><table><thead><tr><th>Date</th><th>Type</th><th>Statut</th><th>Brut €</th><th>Remb. €</th><th>Commission €</th><th>PSP €</th><th>Intervenant €</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
    return new Response(html,{status:200,headers:{'content-type':'text/html; charset=UTF-8','content-disposition':`inline; filename="prochelia-finance-${id}.html"`,'cache-control':'no-store'}});
  }
  const header=['date','type','status','mission_id','montant_brut_eur','remboursement_eur','commission_eur','frais_psp_eur','remuneration_intervenant_eur','devise','motif'];
  const csv=[header,...data.map(r=>header.map(k=>String(r[k]??'').replace(/"/g,'""')))].map(row=>row.map(v=>`"${v}"`).join(';')).join('\r\n');
  return new Response('\ufeff'+csv,{status:200,headers:{'content-type':'text/csv; charset=UTF-8','content-disposition':`attachment; filename="prochelia-finance-${id}.csv"`,'cache-control':'no-store'}});
}

async function financeEntryCreate(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth,tenantId}=a, b=await readJson(request)||{};
  const amount=Math.round(Number(b.amount_eur)*100);
  if(!Number.isFinite(amount)||amount<=0||!b.entry_type) return json({ok:false,error:'INVALID_FINANCE_ENTRY',version:VERSION},400);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO finance_workspace_entries(id,user_id,role,entry_type,direction,amount_cents,currency,label,reference_type,reference_id,metadata_json,tenant_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,auth.user.id,auth.user.role,String(b.entry_type),String(b.direction||'IN').toUpperCase()==='OUT'?'OUT':'IN',amount,b.currency||'EUR',clean(b.label)||null,clean(b.reference_type)||null,clean(b.reference_id)||null,JSON.stringify(b.metadata||{}),tenantId).run();
  await journal(env,auth.user.role,auth.user.id,'FINANCE_ENTRY_CREATE','finance_workspace_entries',id,'OK',{entry_type:b.entry_type});
  return json({ok:true,version:VERSION,id});
}

async function financeProblemCreate(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth,tenantId}=a,b=await readJson(request)||{}, [issueType,solution]=financeProblemSolution(b.issue_type);
  const severity=['CRITICAL','HIGH','MEDIUM','LOW'].includes(String(b.severity||'').toUpperCase())?String(b.severity).toUpperCase():'LOW';
  const auto=['LOW','MEDIUM'].includes(severity) && ['PAYMENT_FAILED','EXPORT_FAILED','INVOICE_MISSING','UNKNOWN'].includes(issueType);
  const status=auto?'AUTO_RESOLUTION_PROPOSED':'OPEN';
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO finance_resolution_cases(id,user_id,role,issue_type,status,severity,description,proposed_solution,amount_cents,reference_id,metadata_json,tenant_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,auth.user.id,auth.user.role,issueType,status,severity,clean(b.description)||null,solution,Number.isFinite(Number(b.amount_cents))?Number(b.amount_cents):null,clean(b.reference_id)||null,JSON.stringify(b.metadata||{}),tenantId).run();
  await journal(env,auth.user.role,auth.user.id,'FINANCE_PROBLEM_CREATE','finance_resolution_cases',id,status,{issue_type:issueType,auto});
  return json({ok:true,version:VERSION,case:{id,issue_type:issueType,status,severity,automatic_resolution_possible:auto,proposed_solution:solution,requires_human_validation:!auto}});
}

async function financeProblemResolve(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth,tenantId}=a,b=await readJson(request)||{},id=clean(b.case_id);
  if(!id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const row=await env.DB.prepare('SELECT * FROM finance_resolution_cases WHERE id=? AND tenant_id=? LIMIT 1').bind(id,tenantId).first();
  if(!row)return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  const role=String(auth.user.role||'').toUpperCase();
  const owner=String(row.user_id)===String(auth.user.id);
  const manager=['GERANTE','ADMIN','FINANCE','SUPPORT','SOCIETE','COMPANY'].includes(role);
  if(!owner&&!manager)return json({ok:false,error:'FORBIDDEN',version:VERSION},403);
  const approved=Boolean(b.approve);
  const resolution=clean(b.resolution)||row.proposed_solution||'Résolution contrôlée par le Copilote.';
  const status=approved?'RESOLVED':'ESCALATED';
  await env.DB.prepare(`UPDATE finance_resolution_cases SET status=?,resolution=?,resolved_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`).bind(status,resolution,id,tenantId).run();
  await journal(env,auth.user.role,auth.user.id,'FINANCE_PROBLEM_RESOLVE','finance_resolution_cases',id,status,{approved});
  return json({ok:true,version:VERSION,case_id:id,status,resolution});
}

async function handleFinanceWorkspace(request,env) {
  const u=new URL(request.url);
  if(u.pathname==='/api/finance/dashboard'&&request.method==='GET')return financeDashboard(request,env);
  if(u.pathname==='/api/finance/export'&&request.method==='GET')return financeExport(request,env);
  if(u.pathname==='/api/finance/entry'&&request.method==='POST')return financeEntryCreate(request,env);
  if(u.pathname==='/api/finance/problem'&&request.method==='POST')return financeProblemCreate(request,env);
  if(u.pathname==='/api/finance/problem/resolve'&&request.method==='POST')return financeProblemResolve(request,env);
  return null;
}
/* ==================== FIN — COMPTABILITÉ MULTI-ESPACE ==================== */

async function handleCommercialRecruitment(request,env){
  const u=new URL(request.url);
  if(u.pathname==='/api/copilot/commercial/prospect'&&request.method==='POST')return commercialProspectCreate(request,env);
  if(u.pathname==='/api/copilot/commercial/prospect-sheet'&&request.method==='POST')return commercialProspectSheet(request,env);
  if(u.pathname==='/api/copilot/commercial/playbook'&&request.method==='POST')return commercialPlaybook(request,env);
  if(u.pathname==='/api/copilot/recruitment/candidate'&&request.method==='POST')return recruitmentCandidateCreate(request,env);
  if(u.pathname==='/api/copilot/recruitment/sheet'&&request.method==='POST')return recruitmentSheet(request,env);
  if(u.pathname==='/api/copilot/growth-dashboard'&&request.method==='GET')return growthDashboard(request,env);
  return null;
}


async function intervenantWorkspaceReadModel(request, env) {
  if (request.method !== 'GET') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    // Missing canonical session columns must be visible as a readiness failure,
    // never disguised as an invalid user credential.
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  if (!auth.session_active_tenant_id) {
    return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);
  }

  // Business data is not exposed until every returned domain is tenant-scoped.
  // This deliberately blocks the legacy schema rather than mixing tenants.
  for (const table of ['intervenants', 'missions', 'prestations', 'disponibilites', 'wallets', 'documents']) {
    try {
      const columns = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
      if (!(columns.results || []).some(column => column.name === 'tenant_id')) {
        return json({ ok: false, error: 'BUSINESS_TENANT_SCHEMA_UNAVAILABLE', table }, 503);
      }
    } catch {
      return json({ ok: false, error: 'BUSINESS_TENANT_SCHEMA_UNAVAILABLE' }, 503);
    }
  }

  const tenantId = auth.session_active_tenant_id;
  const partial = [];
  let profile;
  try {
    profile = await env.DB.prepare(
      'SELECT id, professional_status, description, service_area, hourly_rate, validation_status FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch {
    return json({ ok: false, error: 'WORKSPACE_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);

  let missions = [];
  try {
    const result = await env.DB.prepare(
      `SELECT m.id, m.prestation_id, p.name AS prestation_name, m.start_at, m.end_at, m.status
         FROM missions m
         LEFT JOIN prestations p ON p.id = m.prestation_id AND p.tenant_id = m.tenant_id
        WHERE m.intervenant_id = ? AND m.tenant_id = ?
        ORDER BY m.start_at DESC
        LIMIT 50`
    ).bind(profile.id, tenantId).all();
    missions = result.results || [];
  } catch { partial.push('missions'); }

  let availability = [];
  try {
    const result = await env.DB.prepare(
      'SELECT id, start_at, end_at, status FROM disponibilites WHERE intervenant_id = ? AND tenant_id = ? ORDER BY start_at LIMIT 100'
    ).bind(profile.id, tenantId).all();
    availability = result.results || [];
  } catch { partial.push('availability'); }

  let wallet = null;
  try {
    wallet = await env.DB.prepare(
      'SELECT currency, available_cents, pending_cents, paid_cents, reserved_cents FROM wallets WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch { partial.push('wallet'); }

  let documentCounts = { total: 0, pending: 0, expired: 0 };
  try {
    const result = await env.DB.prepare(
      'SELECT status, expires_at FROM documents WHERE user_id = ? AND tenant_id = ? LIMIT 200'
    ).bind(auth.user.id, tenantId).all();
    const now = Date.now();
    for (const row of result.results || []) {
      documentCounts.total++;
      const expired = row.expires_at && Date.parse(row.expires_at) < now;
      if (expired) documentCounts.expired++;
      else if (!['verified', 'approved', 'valid'].includes(String(row.status || '').toLowerCase())) documentCounts.pending++;
    }
  } catch { partial.push('documents'); }

  return json({
    ok: true,
    read_only: true,
    writes: false,
    profile: {
      first_name: auth.user.first_name || null,
      last_name: auth.user.last_name || null,
      professional_status: profile.professional_status || null,
      description: profile.description || null,
      service_area: profile.service_area || null,
      hourly_rate: profile.hourly_rate ?? null,
      validation_status: profile.validation_status || null
    },
    missions,
    availability,
    // Internal wallet figures are not presented as payable earnings unless a real PSP adapter is configured.
    finance: { payments_configured: paymentsConfigured(env), wallet: paymentsConfigured(env) ? wallet : null, payout_account: null },
    documents: documentCounts,
    partial_data: partial
  });
}




async function intervenantApplicationWithdrawRoute(request, env, url) {
  const match = url.pathname.match(/^\/api\/intervenant\/applications\/([^/]+)\/withdraw$/);
  if (!match) return null;
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'POST' });
  }
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);
  let profile;
  try {
    profile = await env.DB.prepare(
      'SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch {
    return json({ ok: false, error: 'INTERVENANT_PROFILE_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);

  let applicationId;
  try { applicationId = decodeURIComponent(match[1]); }
  catch { return json({ ok: false, error: 'INVALID_APPLICATION_ID' }, 400); }
  try {
    const result = await env.DB.prepare(
      `UPDATE mission_applications
          SET status = 'WITHDRAWN', updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE id = ? AND applicant_tenant_id = ? AND intervenant_id = ?
          AND status IN ('SUBMITTED', 'SHORTLISTED')`
    ).bind(applicationId, tenantId, profile.id).run();
    if (Number(result.meta?.changes || 0) === 1) {
      return json({ ok: true, application: { id: applicationId, status: 'WITHDRAWN' } });
    }
    const existing = await env.DB.prepare(
      'SELECT status FROM mission_applications WHERE id = ? AND applicant_tenant_id = ? AND intervenant_id = ? LIMIT 1'
    ).bind(applicationId, tenantId, profile.id).first();
    if (!existing) return json({ ok: false, error: 'APPLICATION_NOT_FOUND' }, 404);
    // State-idempotent retry: if the first response was lost, repeating the
    // same withdrawal request returns the already-committed result without
    // another mutation. The conditional UPDATE above remains tenant-scoped.
    if (existing.status === 'WITHDRAWN') {
      return json({ ok: true, replayed: true, application: { id: applicationId, status: 'WITHDRAWN' } });
    }
    return json({ ok: false, error: 'APPLICATION_NOT_WITHDRAWABLE', status: existing.status }, 409);
  } catch {
    return json({ ok: false, error: 'APPLICATION_WITHDRAWAL_REJECTED' }, 409);
  }
}

async function intervenantApplicationsRoute(request, env) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });
  }
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);

  let profile;
  try {
    profile = await env.DB.prepare(
      'SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch {
    return json({ ok: false, error: 'INTERVENANT_PROFILE_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);

  try {
    const result = await env.DB.prepare(
      `SELECT a.id, a.status, a.applied_at, a.decided_at, a.provider_pay_cents, a.currency,
              o.category_code, o.public_summary, o.city, o.start_at, o.end_at
         FROM mission_applications a
         JOIN mission_opportunities o
           ON o.id = a.opportunity_id AND o.owner_tenant_id = a.owner_tenant_id
        WHERE a.applicant_tenant_id = ? AND a.intervenant_id = ?
        ORDER BY a.applied_at DESC
        LIMIT 100`
    ).bind(tenantId, profile.id).all();
    return json({ ok: true, read_only: true, applications: result.results || [] });
  } catch {
    return json({ ok: false, error: 'APPLICATIONS_SCHEMA_UNAVAILABLE' }, 503);
  }
}

async function intervenantSkillsRoute(request, env) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });
  }
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);

  try {
    const profile = await env.DB.prepare(
      'SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
    if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);
    const result = await env.DB.prepare(
      `SELECT skill_code, verification_status, verified_at, created_at, updated_at
         FROM intervenant_skills
        WHERE tenant_id = ? AND intervenant_id = ?
        ORDER BY skill_code ASC
        LIMIT 100`
    ).bind(tenantId, profile.id).all();
    return json({ ok: true, read_only: true, skills: result.results || [] });
  } catch {
    return json({ ok: false, error: 'SKILLS_SCHEMA_UNAVAILABLE' }, 503);
  }
}

async function intervenantAssignmentsRoute(request, env) {
  if (request.method !== 'GET') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });
  }
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);

  let profile;
  try {
    profile = await env.DB.prepare(
      'SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch {
    return json({ ok: false, error: 'INTERVENANT_PROFILE_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);

  try {
    const result = await env.DB.prepare(
      `SELECT a.id, a.status, a.assigned_at, a.started_at, a.completed_at, a.version,
              o.category_code, o.public_summary, o.city, o.start_at, o.end_at,
              o.provider_pay_cents, o.currency
         FROM mission_assignments a
         JOIN mission_opportunities o
           ON o.id = a.opportunity_id AND o.owner_tenant_id = a.owner_tenant_id
        WHERE a.provider_tenant_id = ? AND a.intervenant_id = ?
        ORDER BY a.assigned_at DESC
        LIMIT 100`
    ).bind(tenantId, profile.id).all();
    return json({
      ok: true,
      read_only: true,
      assignments: result.results || []
    });
  } catch {
    return json({ ok: false, error: 'ASSIGNMENTS_SCHEMA_UNAVAILABLE' }, 503);
  }
}

async function intervenantAvailabilityRoute(request, env, url) {
  if (url.pathname !== '/api/intervenant/availability') return null;
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }
  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);

  let profile;
  try {
    profile = await env.DB.prepare(
      'SELECT id FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch {
    return json({ ok: false, error: 'INTERVENANT_PROFILE_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);

  if (request.method === 'GET') {
    try {
      const result = await env.DB.prepare(
        `SELECT id, start_at, end_at, status
           FROM disponibilites
          WHERE intervenant_id = ? AND tenant_id = ?
          ORDER BY start_at ASC LIMIT 200`
      ).bind(profile.id, tenantId).all();
      return json({ ok: true, read_only: true, availability: result.results || [] });
    } catch {
      return json({ ok: false, error: 'AVAILABILITY_SCHEMA_UNAVAILABLE' }, 503);
    }
  }

  const parsedPayload = await readLimitedJson(request, 4096);
  if (!parsedPayload.ok) {
    return json({ ok: false, error: parsedPayload.tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON' }, parsedPayload.tooLarge ? 413 : 400);
  }
  const payload = parsedPayload.value;
  const startAt = typeof payload?.start_at === 'string' ? payload.start_at : '';
  const endAt = typeof payload?.end_at === 'string' ? payload.end_at : '';
  const isoWithZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  const startMs = isoWithZone.test(startAt) ? Date.parse(startAt) : NaN;
  const endMs = isoWithZone.test(endAt) ? Date.parse(endAt) : NaN;
  const now = Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) ||
      startMs < now + 5 * 60 * 1000 || endMs <= startMs ||
      endMs - startMs < 15 * 60 * 1000 || endMs - startMs > 24 * 60 * 60 * 1000 ||
      startMs > now + 366 * 24 * 60 * 60 * 1000) {
    return json({ ok: false, error: 'INVALID_AVAILABILITY_WINDOW' }, 400);
  }

  // Persist one UTC representation; compare instants, not timezone-formatted strings.
  const canonicalStartAt = new Date(startMs).toISOString();
  const canonicalEndAt = new Date(endMs).toISOString();
  // The persisted key is scoped to the authenticated tenant/profile; retries after a lost response must replay the same slot.
  const idempotencyKey = String(request.headers.get('Idempotency-Key') || request.headers.get('X-Idempotency-Key') || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
    return json({ ok: false, error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
  }

  try {
    const previous = await env.DB.prepare(
      `SELECT id, start_at, end_at, status FROM disponibilites
        WHERE tenant_id = ? AND intervenant_id = ? AND idempotency_key = ?
        LIMIT 1`
    ).bind(tenantId, profile.id, idempotencyKey).first();
    if (previous) {
      const samePayload = Date.parse(previous.start_at) === startMs && Date.parse(previous.end_at) === endMs;
      if (samePayload) {
        return json({ ok: true, idempotent_replay: true, availability: {
          id: previous.id, start_at: previous.start_at, end_at: previous.end_at, status: previous.status
        } });
      }
      return json({ ok: false, error: 'IDEMPOTENCY_KEY_CONFLICT' }, 409);
    }

    const conflict = await env.DB.prepare(
      `SELECT id FROM disponibilites
        WHERE intervenant_id = ? AND tenant_id = ? AND status = 'available'
          AND julianday(start_at) < julianday(?)
          AND julianday(end_at) > julianday(?)
        LIMIT 1`
    ).bind(profile.id, tenantId, canonicalEndAt, canonicalStartAt).first();
    if (conflict) return json({ ok: false, error: 'AVAILABILITY_OVERLAP' }, 409);

    const id = 'availability-' + crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO disponibilites(id, intervenant_id, tenant_id, start_at, end_at, status, idempotency_key)
       VALUES (?, ?, ?, ?, ?, 'available', ?)`
    ).bind(id, profile.id, tenantId, canonicalStartAt, canonicalEndAt, idempotencyKey).run();
    return json({ ok: true, availability: { id, start_at: canonicalStartAt, end_at: canonicalEndAt, status: 'available' } }, 201);
  } catch (error) {
    // Resolve a concurrent replay after the unique idempotency index rejects
    // the second INSERT. The database trigger remains the final overlap guard.
    try {
      const replay = await env.DB.prepare(
        `SELECT id, start_at, end_at, status FROM disponibilites
          WHERE tenant_id = ? AND intervenant_id = ? AND idempotency_key = ?
          LIMIT 1`
      ).bind(tenantId, profile.id, idempotencyKey).first();
      if (replay) {
        const samePayload = Date.parse(replay.start_at) === startMs && Date.parse(replay.end_at) === endMs;
        if (samePayload) return json({ ok: true, idempotent_replay: true, availability: {
          id: replay.id, start_at: replay.start_at, end_at: replay.end_at, status: replay.status
        } });
        return json({ ok: false, error: 'IDEMPOTENCY_KEY_CONFLICT' }, 409);
      }
    } catch {}
    if (String(error?.message || error).includes('AVAILABILITY_OVERLAP')) {
      return json({ ok: false, error: 'AVAILABILITY_OVERLAP' }, 409);
    }
    return json({ ok: false, error: 'AVAILABILITY_WRITE_REJECTED' }, 409);
  }
}

async function intervenantOpportunityRoute(request, env, url) {
  const applyMatch = url.pathname.match(/^\/api\/intervenant\/opportunities\/([^/]+)\/apply$/);
  const isFeed = url.pathname === '/api/intervenant/opportunities';
  if (!isFeed && !applyMatch) return null;
  if (isFeed && request.method !== 'GET') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (applyMatch && request.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  let auth;
  try {
    auth = await getSessionUser(request, env);
  } catch {
    return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);

  let profile;
  try {
    profile = await env.DB.prepare(
      'SELECT id, validation_status FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
  } catch {
    return json({ ok: false, error: 'INTERVENANT_PROFILE_SCHEMA_UNAVAILABLE' }, 503);
  }
  if (!profile?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);
  const verifiedProfile = ['verified', 'approved', 'active'].includes(String(profile.validation_status || '').toLowerCase());

  if (isFeed) {
    if (!verifiedProfile) {
      return json({
        ok: true, read_only: true, eligible: false,
        reason: 'PROFILE_VALIDATION_REQUIRED', opportunities: []
      });
    }
    try {
      const result = await env.DB.prepare(
        `SELECT o.id, o.category_code, o.public_summary, o.city, o.postal_prefix,
                o.start_at, o.end_at, o.provider_pay_cents, o.currency,
                o.required_skills_json, o.expires_at,
                (SELECT a.status FROM mission_applications a
                  WHERE a.opportunity_id = o.id
                    AND a.applicant_tenant_id = ?
                    AND a.intervenant_id = ?
                  LIMIT 1) AS application_status
           FROM mission_opportunities o
           JOIN tenants owner ON owner.id = o.owner_tenant_id AND owner.status = 'ACTIVE'
          WHERE o.status = 'OPEN'
            AND o.expires_at > CURRENT_TIMESTAMP
            AND EXISTS (
              SELECT 1 FROM disponibilites d
               WHERE d.tenant_id = ? AND d.intervenant_id = ?
                 AND d.status = 'available'
                 AND d.start_at <= o.start_at AND d.end_at >= o.end_at
            )
            AND NOT EXISTS (
              SELECT 1
                FROM mission_assignments ma
                JOIN mission_opportunities assigned
                  ON assigned.id = ma.opportunity_id
                 AND assigned.owner_tenant_id = ma.owner_tenant_id
               WHERE ma.provider_tenant_id = ? AND ma.intervenant_id = ?
                 AND ma.status IN ('ASSIGNED','IN_PROGRESS','DISPUTED')
                 AND assigned.start_at < o.end_at AND assigned.end_at > o.start_at
            )
            AND NOT EXISTS (
              SELECT 1 FROM json_each(o.required_skills_json) required_skill
               WHERE NOT EXISTS (
                 SELECT 1 FROM intervenant_skills skill
                  WHERE skill.tenant_id = ? AND skill.intervenant_id = ?
                    AND skill.skill_code = lower(CAST(required_skill.value AS TEXT))
                    AND skill.verification_status = 'VERIFIED'
               )
            )
          ORDER BY o.start_at ASC
          LIMIT 100`
      ).bind(tenantId, profile.id, tenantId, profile.id, tenantId, profile.id, tenantId, profile.id).all();
      const opportunities = (result.results || []).map(row => {
        let requiredSkills = [];
        try {
          const parsed = JSON.parse(row.required_skills_json || '[]');
          if (Array.isArray(parsed)) requiredSkills = parsed.slice(0, 30);
        } catch {}
        return {
          id: row.id,
          category: row.category_code,
          summary: row.public_summary,
          city: row.city,
          postal_prefix: row.postal_prefix || null,
          start_at: row.start_at,
          end_at: row.end_at,
          provider_pay_cents: row.provider_pay_cents,
          currency: row.currency,
          required_skills: requiredSkills,
          expires_at: row.expires_at,
          application_status: row.application_status || null,
          can_apply: !row.application_status
        };
      });
      return json({ ok: true, read_only: true, eligible: true, opportunities });
    } catch {
      return json({ ok: false, error: 'OPPORTUNITY_SCHEMA_UNAVAILABLE' }, 503);
    }
  }

  if (!verifiedProfile) {
    return json({ ok: false, error: 'PROFILE_VALIDATION_REQUIRED' }, 403);
  }
  const opportunityId = decodeURIComponent(applyMatch[1]);
  const idempotencyKey = String(request.headers.get('Idempotency-Key') || request.headers.get('X-Idempotency-Key') || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
    return json({ ok: false, error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
  }
  const parsedPayload = await readLimitedJson(request, 4096);
  if (!parsedPayload.ok) {
    return json({ ok: false, error: parsedPayload.tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON' }, parsedPayload.tooLarge ? 413 : 400);
  }
  const payload = parsedPayload.value;
  const publicNote = typeof payload?.public_note === 'string' ? payload.public_note.trim() : '';
  if (publicNote.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(publicNote)) {
    return json({ ok: false, error: 'INVALID_PUBLIC_NOTE' }, 400);
  }

  try {
    const previous = await env.DB.prepare(
      'SELECT id, opportunity_id, applicant_user_id, status FROM mission_applications WHERE applicant_tenant_id = ? AND idempotency_key = ? LIMIT 1'
    ).bind(tenantId, idempotencyKey).first();
    if (previous) {
      if (previous.opportunity_id === opportunityId && previous.applicant_user_id === auth.user.id) {
        return json({ ok: true, idempotent_replay: true, application: { id: previous.id, status: previous.status } });
      }
      return json({ ok: false, error: 'IDEMPOTENCY_KEY_CONFLICT' }, 409);
    }

    const opportunity = await env.DB.prepare(
      `SELECT o.id, o.owner_tenant_id, o.provider_pay_cents, o.currency, o.start_at, o.end_at
         FROM mission_opportunities o
         JOIN tenants t ON t.id = o.owner_tenant_id AND t.status = 'ACTIVE'
        WHERE o.id = ? AND o.status = 'OPEN' AND o.expires_at > CURRENT_TIMESTAMP
        LIMIT 1`
    ).bind(opportunityId).first();
    if (!opportunity) return json({ ok: false, error: 'OPPORTUNITY_NOT_AVAILABLE' }, 404);

    // Re-check schedule conflicts at submission time; the public feed is not
    // an authorization boundary and may be stale or deliberately bypassed.
    // Assignment-time database guards remain the final concurrency control.
    const assignmentConflict = await env.DB.prepare(
      `SELECT ma.id
         FROM mission_assignments ma
         JOIN mission_opportunities assigned
           ON assigned.id = ma.opportunity_id
          AND assigned.owner_tenant_id = ma.owner_tenant_id
        WHERE ma.provider_tenant_id = ? AND ma.intervenant_id = ?
          AND ma.status IN ('ASSIGNED','IN_PROGRESS','DISPUTED')
          AND assigned.start_at < ? AND assigned.end_at > ?
        LIMIT 1`
    ).bind(tenantId, profile.id, opportunity.end_at, opportunity.start_at).first();
    if (assignmentConflict) {
      return json({ ok: false, error: 'INTERVENANT_SCHEDULE_CONFLICT' }, 409);
    }

    const applicationId = 'application-' + crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO mission_applications(
         id, opportunity_id, owner_tenant_id, applicant_tenant_id,
         intervenant_id, applicant_user_id, provider_pay_cents, currency,
         idempotency_key, public_note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      applicationId, opportunity.id, opportunity.owner_tenant_id, tenantId,
      profile.id, auth.user.id, opportunity.provider_pay_cents, opportunity.currency,
      idempotencyKey, publicNote || null
    ).run();
    return json({
      ok: true,
      application: { id: applicationId, opportunity_id: opportunity.id, status: 'SUBMITTED' }
    }, 201);
  } catch {
    return json({ ok: false, error: 'APPLICATION_NOT_ELIGIBLE_OR_OPPORTUNITY_CHANGED' }, 409);
  }
}

async function intervenantProfileUpdateRoute(request, env) {
  if (request.method !== 'PUT') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  let auth;
  try { auth = await getSessionUser(request, env); }
  catch { return json({ ok: false, error: 'AUTHENTICATION_SCHEMA_UNAVAILABLE' }, 503); }
  if (!auth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  if (!requireRole(auth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const tenantId = auth.session_active_tenant_id;
  if (!tenantId) return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);
  const parsed = await readLimitedJson(request, 2048);
  if (!parsed.ok) return json({ ok: false, error: parsed.tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON' }, parsed.tooLarge ? 413 : 400);
  const payload = parsed.value;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ ok: false, error: 'INVALID_PROFILE_PAYLOAD' }, 400);
  const allowed = new Set(['service_area', 'hourly_rate']);
  if (Object.keys(payload).some(key => !allowed.has(key)) || Object.keys(payload).length === 0) {
    return json({ ok: false, error: 'UNSUPPORTED_PROFILE_FIELD' }, 400);
  }
  let serviceArea;
  if (Object.hasOwn(payload, 'service_area')) {
    if (typeof payload.service_area !== 'string' || payload.service_area.trim().length > 120) {
      return json({ ok: false, error: 'INVALID_SERVICE_AREA' }, 400);
    }
    serviceArea = payload.service_area.trim();
  }
  let hourlyRate;
  if (Object.hasOwn(payload, 'hourly_rate')) {
    if (payload.hourly_rate !== null && (typeof payload.hourly_rate !== 'number' || !Number.isFinite(payload.hourly_rate) || payload.hourly_rate < 0 || payload.hourly_rate > 500)) {
      return json({ ok: false, error: 'INVALID_HOURLY_RATE' }, 400);
    }
    hourlyRate = payload.hourly_rate;
  }
  try {
    const current = await env.DB.prepare(
      'SELECT id, service_area, hourly_rate FROM intervenants WHERE user_id = ? AND tenant_id = ? LIMIT 1'
    ).bind(auth.user.id, tenantId).first();
    if (!current?.id) return json({ ok: false, error: 'INTERVENANT_PROFILE_NOT_FOUND' }, 404);
    const nextServiceArea = Object.hasOwn(payload, 'service_area') ? serviceArea : current.service_area;
    const nextHourlyRate = Object.hasOwn(payload, 'hourly_rate') ? hourlyRate : current.hourly_rate;
    const result = await env.DB.prepare(
      'UPDATE intervenants SET service_area = ?, hourly_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND tenant_id = ?'
    ).bind(nextServiceArea, nextHourlyRate, current.id, auth.user.id, tenantId).run();
    if (result.meta?.changes === 0) return json({ ok: false, error: 'PROFILE_NOT_UPDATED' }, 409);
    return json({ ok: true, profile: { service_area: nextServiceArea, hourly_rate: nextHourlyRate } });
  } catch {
    return json({ ok: false, error: 'PROFILE_UPDATE_UNAVAILABLE' }, 503);
  }
}

async function handle(request,env){
  try {
    if(isMutatingMethod(request.method) && !securityOriginAllowed(request,env)) return json({ok:false,error:'ORIGIN_NOT_ALLOWED',version:VERSION},403);
    const url=new URL(request.url);
    if (url.pathname === '/api/payments/webhook') return paymentWebhook(request, env);
    // Fail closed before any schema helper touches D1: unauthenticated callers
    // must not use mission validation as an existence oracle for private IDs.
    if (url.pathname === '/api/missions/validate') {
      if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
      return json({ ok: false, error: 'AUTHENTICATED_VALIDATION_REQUIRED', version: VERSION, write_enabled: false }, 403);
    }
    // Central tenant-membership gate for every intervenant API route.
    // Individual handlers still enforce their own business role and tenant filters;
    // this guard additionally rejects revoked memberships and suspended tenants.
    if (url.pathname.startsWith('/api/intervenant/')) {
      const membershipAuth = await getSessionUser(request, env).catch(() => null);
      if (!membershipAuth?.user) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
      if (!requireRole(membershipAuth, ['intervenant'])) return json({ ok: false, error: 'FORBIDDEN' }, 403);
      const membershipContext = await resolveTenantContext(request, env, membershipAuth);
      if (!membershipContext.ok) {
        return json({ ok: false, error: membershipContext.error }, membershipContext.status);
      }
      // User role identifies the person as an intervenant; tenant membership
      // uses the least-privileged generic MEMBER role from migration 0024.
      if (!tenantRoleAllowed(membershipContext, ['MEMBER'])) {
        return json({ ok: false, error: 'TENANT_ROLE_FORBIDDEN' }, 403);
      }
      if (!membershipAuth.session_active_tenant_id ||
          membershipAuth.session_active_tenant_id !== membershipContext.tenant.id) {
        return json({ ok: false, error: 'ACTIVE_TENANT_REQUIRED' }, 403);
      }
    }
    if (/^\/api\/intervenant\/applications\/[^/]+\/withdraw$/.test(url.pathname)) return intervenantApplicationWithdrawRoute(request, env, url);
    if (url.pathname === '/api/intervenant/applications') return intervenantApplicationsRoute(request, env);
    if (url.pathname === '/api/intervenant/assignments') return intervenantAssignmentsRoute(request, env);
    if (url.pathname === '/api/intervenant/skills') return intervenantSkillsRoute(request, env);
    if (url.pathname === '/api/intervenant/availability') return intervenantAvailabilityRoute(request, env, url);
    if (url.pathname === '/api/intervenant/opportunities' || /^\/api\/intervenant\/opportunities\/[^/]+\/apply$/.test(url.pathname)) return intervenantOpportunityRoute(request, env, url);
    if (url.pathname === '/api/intervenant/profile') return intervenantProfileUpdateRoute(request, env);
    if (url.pathname === '/api/intervenant/workspace') return intervenantWorkspaceReadModel(request, env);
    if (url.pathname.startsWith('/api/accounting/')) {
      const accountingAuth = await getSessionUser(request, env).catch(() => null);
      if (!accountingAuth?.user) return json({ ok: false, error: 'UNAUTHENTICATED', version: VERSION }, 401);
      const accountingContext = await resolveTenantContext(request, env, accountingAuth);
      if (!accountingContext.ok) {
        return json({ ok: false, error: accountingContext.error, version: VERSION }, accountingContext.status);
      }
      const accountingResponse = await handleAccountingRoute(request, env, {
        ...accountingAuth,
        tenant: accountingContext.tenant
      });
      if (accountingResponse) return accountingResponse;
    }
    if (url.pathname.startsWith('/api/supra/')) {
      let supraAuth = await getSessionUser(request, env).catch(() => null);
      if (supraAuth?.user) {
        const tenantContext = await resolveTenantContext(request, env, supraAuth);
        if (!tenantContext.ok) {
          return json({ ok: false, error: tenantContext.error }, tenantContext.status);
        }
        // Tenant authority is derived only from the authenticated session and
        // active server-side membership; request body/query/header values are ignored.
        supraAuth = {
          ...supraAuth,
          user: {
            ...supraAuth.user,
            tenant_id: tenantContext.tenant.id,
            tenant_role: tenantContext.tenant.role
          }
        };
      }
      const approvalResponse = await handleSupraApprovalRoute(request, env, supraAuth);
      if (approvalResponse) return approvalResponse;
      const supraResponse = await handleSupraRoute(request, env, supraAuth);
      if (supraResponse) return supraResponse;
    }
    if (url.pathname.startsWith('/api/v7/')) {
      const v7Auth = await getSessionUser(request, env).catch(() => null);
      const v7Response = await handleV7Route(request, env, url.pathname, v7Auth);
      if (v7Response) return v7Response;
    }
    const fw=await handleFinanceWorkspace(request,env); if(fw) return fw;
    const cr=await handleCommercialRecruitment(request,env); if(cr) return cr;
    if(url.pathname==='/api/system/final-audit' && request.method==='GET') return finalProductionAudit(request,env);
    if(url.pathname==='/api/copilot/next-actions' && request.method==='GET') return copilotNextActions(request,env);
    if(url.pathname==='/api/jobs/process' && request.method==='POST') return processBackgroundJobs(request,env);
    if(url.pathname==='/api/system/production-check' && request.method==='GET') return finalProductionAudit(request,env);
    const response=await handleV139(request,env);
    const headers=new Headers(response.headers);
    headers.set('x-content-type-options','nosniff');
    headers.set('x-frame-options','DENY');
    headers.set('referrer-policy','no-referrer');
    headers.set('permissions-policy','geolocation=(self),camera=(),microphone=()');
    headers.set('cache-control','no-store');
    if(request.url.startsWith('https://')) headers.set('strict-transport-security','max-age=31536000; includeSubDomains');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  } catch(error) {
    return json({ok:false,error:'INTERNAL_ERROR',version:VERSION},500);
  }
}

async function handleCors(request, env) {
  const origin = request.headers.get('origin');
  // Les opérations authentifiées par cookie doivent porter Origin :
  // sans cette preuve, un POST cross-site ne doit pas être accepté.
  if (isMutatingMethod(request.method) && getCookie(request, SESSION_COOKIE) && !origin) {
    return json({ ok: false, error: 'ORIGIN_REQUIRED', version: VERSION }, 403);
  }
  if (origin && !securityOriginAllowed(request, env)) {
    return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED', version: VERSION }, 403);
  }
  if (request.method === 'OPTIONS') {
    if (!origin) return json({ ok: false, error: 'CORS_ORIGIN_REQUIRED', version: VERSION }, 403);
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-Idempotency-Key',
      'access-control-max-age': '600',
      'vary': 'Origin',
      'cache-control': 'no-store'
    }});
  }
  const response = await handle(request, env);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-credentials', 'true');
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  fetch(request,env){ return handleCors(request,env); },
  async scheduled(event,env,ctx){
    if(event?.cron === '*/1 * * * *'){
      const internalRequest = new Request('https://prochelia.internal/api/jobs/process', { method: 'POST' });
      ctx.waitUntil(processBackgroundJobs(internalRequest,env,{scheduler:true}).catch(error => {
        console.error('PROCHELIA_SCHEDULER_TICK_FAILED', String(error?.message || error));
      }));
    }
  }
};


/* ============================================================================
   PROCHÉLIA — CONSOLIDATION NATIONALE / SAUVEGARDES / SCALABILITÉ
   - aucune limite métier artificielle sur Clients / Intervenants / Sociétés
   - pagination et traitement par lots
   - sauvegardes logiques chiffrées vers R2 si le binding est configuré
   - déclenchement manuel + automatique par Cron
   - journal des sauvegardes
   ============================================================================ */
async function nationalScaleStatus(env){
  if(!env?.DB?.prepare) throw new Error('DATABASE_REQUIRED');
  const t=await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  const tableNames=(t.results||[]).map(x=>String(x.name));
  const c=tableNames.includes('platform_scale_config')
    ? await env.DB.prepare(`SELECT key,value_json FROM platform_scale_config ORDER BY key`).all()
    : {results:[]};
  const encryptionConfigured=typeof env.BACKUP_ENCRYPTION_KEY==='string'&&env.BACKUP_ENCRYPTION_KEY.trim().length>0;
  const bucketBindingPresent=!!env.BACKUP_BUCKET&&typeof env.BACKUP_BUCKET.put==='function';
  return {ok:true,mode:'NATIONAL_SCALE',artificialUserCap:false,unlimitedInBusinessRules:true,database:'D1',documents:'R2_RECOMMENDED',backups:{provider:'R2',bindingPresent:bucketBindingPresent,configured:false,verificationStatus:'UNVERIFIED',automatic:false,scheduleStatus:'NOT_ATTESTED',encryptionConfigured,encrypted:false,retentionDays:null,retentionStatus:'UNVERIFIED'},pagination:{cursorRecommended:true,maxPageSize:100},tables:tableNames,config:(c.results||[])};
}
async function backupStatus(env){
  if(!env?.DB?.prepare) throw new Error('DATABASE_REQUIRED');
  const schema=await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='backup_runs'`).all();
  const schemaReady=(schema.results||[]).length>0;
  const r=schemaReady
    ? await env.DB.prepare(`SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 20`).all()
    : {results:[]};
  const encryptionConfigured=typeof env.BACKUP_ENCRYPTION_KEY==='string'&&env.BACKUP_ENCRYPTION_KEY.trim().length>0;
  const bindingPresent=!!env.BACKUP_BUCKET&&typeof env.BACKUP_BUCKET.put==='function';
  return {ok:true,schemaReady,bindingPresent,configured:false,verificationStatus:'UNVERIFIED',encryptionConfigured,automatic:false,frequency:null,scheduleStatus:'NOT_ATTESTED',retentionDays:null,retentionStatus:'UNVERIFIED',runs:r.results||[]};
}

const __procheliaNationalHandle = handle;
handle = async function(request,env){
  const url=new URL(request.url);
  try{
    if(request.method==='GET'&&url.pathname==='/api/system/scale'){
      const auth=await getSessionUser(request,env).catch(()=>null); if(!auth?.user||String(auth.user.role||'').toUpperCase()!=='GERANTE') return json({ok:false,error:'FORBIDDEN'},403);
      return json(await nationalScaleStatus(env));
    }
    if(request.method==='GET'&&url.pathname==='/api/system/backups'){
      const auth=await getSessionUser(request,env).catch(()=>null); if(!auth?.user||String(auth.user.role||'').toUpperCase()!=='GERANTE') return json({ok:false,error:'FORBIDDEN'},403);
      return json(await backupStatus(env));
    }
    if(request.method==='POST'&&url.pathname==='/api/system/backup/run'){
      const auth=await getSessionUser(request,env).catch(()=>null); if(!auth?.user||String(auth.user.role||'').toUpperCase()!=='GERANTE') return json({ok:false,error:'FORBIDDEN'},403);
      return json({ok:false,error:'SIGNED_BACKUP_WORKFLOW_REQUIRED',message:'Direct Worker backup is disabled; use the signed EU R2 backup workflow.'},503);
    }
    return __procheliaNationalHandle(request,env);
  }catch(e){return json({ok:false,error:'NATIONAL_CONTINUITY_ERROR',message:String(e.message||e)},500)}
};

/* ============================================================================
   PROCHÉLIA — COMPLÉMENT MAÎTRE SANS DOUBLON
   Identité de marque / interfaces différenciées / centre réclamations /
   résolution Copilote multi-espace / traçabilité.
   Ce bloc complète le moteur existant : il ne remplace ni ne duplique
   les moteurs Auth/RBAC, Finance, Paiements, Copilote, Commercial,
   Recrutement, Sécurité, Sauvegardes ou Scalabilité déjà présents.
   ============================================================================ */

const PROCHELIA_BRAND = Object.freeze({
  name:'PROCHÉLIA',
  legal_name:'PROCHÉLIA',
  positioning:'plateforme premium de coordination de prestations et interventions',
  visual:{
    primary:'#0D4F4A',
    secondary:'#F7F0E7',
    accent:'#E7B8B0',
    gold:'#C9A46A',
    rose_gold:'#D8A08E',
    typography:'premium_serif + sans_ui',
    emblem:'forme originale végétale/humaine évoquant feuille, cœur et personne',
    usage:'web, PWA, application, documents, véhicules, vêtements, enseigne, réseaux sociaux'
  },
  uniqueness_policy:{
    design_source:'PROCHELIA_ORIGINAL_CONCEPT',
    no_third_party_logo_reuse:true,
    no_claim_of_legal_exclusivity_without_clearance:true,
    required_clearance:['recherche à l’identique','recherche de similarités INPI','recherche logo','surveillance de marque']
  }
});

const PROCHELIA_UI = Object.freeze({
  CLIENT:{
    label:'Client',
    promise:'simple, rassurant, transparent',
    primary_actions:['demander une prestation','suivre une mission','payer','documents','messagerie','réclamation / assistance'],
    finance:['paiements','remboursements','factures','historique','exports'],
    support:'espace réclamation dédié avec suivi du dossier et notifications'
  },
  SOCIETE:{
    label:'Société',
    promise:'pilotage B2B, contrôle et centralisation',
    primary_actions:['créer une demande','gérer plusieurs bénéficiaires','missions','planning','facturation','documents','réclamations'],
    finance:['activité','commissions/service PROCHÉLIA','paiements','remboursements','factures','exports'],
    support:'centre de réclamations B2B avec pièces, historique et résolution'
  },
  INTERVENANT:{
    label:'Intervenant',
    promise:'missions claires, identité protégée, rémunération suivie',
    primary_actions:['disponibilité','missions','navigation','validation présence','documents','messagerie','incident / réclamation'],
    finance:['rémunérations','paiements reçus','commissions/frais','anomalies','exports'],
    support:'déclaration incident, contestation et demande d’assistance'
  },
  GERANTE:{
    label:'Gérante',
    promise:'pilotage central, Copilote transversal et décisions sécurisées',
    primary_actions:['dashboard','Copilote','missions','clients','sociétés','intervenants','finance','comptabilité','commercial','recrutement','conformité','sécurité','réclamations'],
    finance:['CA','commissions','frais PSP','remboursements','rémunérations','impayés','litiges','marge','charges','exports'],
    support:'centre de résolution avec automatisation simple et validation humaine des cas sensibles'
  }
});

async function ensureProcheliaMasterComplementSchema(env){
  if(!env.DB) throw new Error('DATABASE_REQUIRED');
  const sqls=[
    `CREATE TABLE IF NOT EXISTS brand_identity (id TEXT PRIMARY KEY, brand_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, visual_json TEXT NOT NULL, uniqueness_policy_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS brand_assets (id TEXT PRIMARY KEY, asset_type TEXT NOT NULL, asset_name TEXT NOT NULL, storage_key TEXT, checksum TEXT, version TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', metadata_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS brand_clearance_log (id TEXT PRIMARY KEY, search_type TEXT NOT NULL, term TEXT NOT NULL, source TEXT, result TEXT, evidence_ref TEXT, checked_at TEXT DEFAULT CURRENT_TIMESTAMP, notes TEXT)`,
    `CREATE TABLE IF NOT EXISTS interface_profiles (id TEXT PRIMARY KEY, role TEXT NOT NULL UNIQUE, config_json TEXT NOT NULL, version TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS support_cases (id TEXT PRIMARY KEY, source_role TEXT NOT NULL, requester_id TEXT, company_id TEXT, mission_id TEXT, complaint_id TEXT, category TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'LOW', status TEXT NOT NULL DEFAULT 'OPEN', description TEXT, proposed_resolution TEXT, resolution TEXT, requires_manager INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS support_case_events (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, actor_role TEXT, actor_id TEXT, event_type TEXT NOT NULL, details_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS copilot_resolution_rules (id TEXT PRIMARY KEY, scenario_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL, severity TEXT NOT NULL, auto_allowed INTEGER NOT NULL DEFAULT 0, manager_approval_required INTEGER NOT NULL DEFAULT 1, steps_json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_support_cases_status ON support_cases(status,severity,created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_support_case_events_case ON support_case_events(case_id,created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON brand_assets(asset_type,status)`,
    `CREATE INDEX IF NOT EXISTS idx_clearance_term ON brand_clearance_log(term,checked_at)`
  ];
  for(const q of sqls) await env.DB.prepare(q).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO brand_identity(id,brand_key,name,visual_json,uniqueness_policy_json) VALUES(?,?,?,?,?)`)
    .bind(crypto.randomUUID(),'PROCHELIA',PROCHELIA_BRAND.name,JSON.stringify(PROCHELIA_BRAND.visual),JSON.stringify(PROCHELIA_BRAND.uniqueness_policy)).run();
  for(const [role,config] of Object.entries(PROCHELIA_UI)){
    await env.DB.prepare(`INSERT OR IGNORE INTO interface_profiles(id,role,config_json,version) VALUES(?,?,?,?)`)
      .bind(crypto.randomUUID(),role,JSON.stringify(config),VERSION).run();
  }
  const rules={
    DELAY_LIGHT:{category:'DELAY',severity:'LOW',auto:1,manager:0,steps:['verify_mission','recalculate_eta','notify_client','journal','close_if_resolved']},
    NOTIFICATION_FAILED:{category:'TECHNICAL',severity:'LOW',auto:1,manager:0,steps:['retry_notification','verify_delivery','fallback_channel','journal','close_if_resolved']},
    DOCUMENT_REMINDER:{category:'DOCUMENT',severity:'LOW',auto:1,manager:0,steps:['identify_missing_document','notify_owner','create_follow_up','journal']},
    SIMPLE_REFUND_CHECK:{category:'PAYMENT',severity:'LOW',auto:1,manager:0,steps:['reconcile_transaction','verify_refund_eligibility','prepare_or_execute_allowed_action','notify','journal']},
    DUPLICATE_PAYMENT:{category:'PAYMENT',severity:'HIGH',auto:0,manager:1,steps:['freeze_duplicate_action','reconcile_psp','calculate_exposure','propose_resolution','manager_approval','notify','journal']},
    IDENTITY_SECURITY:{category:'SECURITY',severity:'CRITICAL',auto:0,manager:1,steps:['lock_sensitive_action','preserve_evidence','risk_assessment','manager_approval','notify_if_required','journal']},
    DATA_INCIDENT:{category:'RGPD_SECURITY',severity:'CRITICAL',auto:0,manager:1,steps:['contain','preserve_evidence','classify','compliance_review','manager_approval','journal']},
    LEGAL_DISPUTE:{category:'LEGAL',severity:'CRITICAL',auto:0,manager:1,steps:['collect_evidence','freeze_irreversible_action','legal_review','manager_approval','notify','journal']},
    INTERVENANT_ABSENT:{category:'REPLACEMENT',severity:'HIGH',auto:0,manager:1,steps:['verify_absence','check_available_intervenants','propose_replacement','manager_approval','notify','journal']},
    CLIENT_COMPLAINT:{category:'COMPLAINT',severity:'MEDIUM',auto:1,manager:0,steps:['acknowledge','collect_evidence','reconcile_mission','reconcile_finance','propose_resolution','notify','journal','close_if_resolved']}
  };
  for(const [k,v] of Object.entries(rules)){
    await env.DB.prepare(`INSERT OR IGNORE INTO copilot_resolution_rules(id,scenario_key,category,severity,auto_allowed,manager_approval_required,steps_json) VALUES(?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),k,v.category,v.severity,v.auto,v.manager,JSON.stringify(v.steps)).run();
  }
}

function supportRoleAllowed(role){return ['CLIENT','SOCIETE','INTERVENANT','GERANTE','ADMIN'].includes(String(role||'').toUpperCase())}
function supportRoleNormalize(role){
  const r=String(role||'').toUpperCase();
  return r==='COMPANY'||r==='ENTREPRISE'?'SOCIETE':r;
}
function supportScenarioFor(category,severity){
  const c=String(category||'').toUpperCase();
  if(['IDENTITY','SECURITY','FRAUD','DATA_BREACH','RGPD'].some(x=>c.includes(x))) return 'IDENTITY_SECURITY';
  if(['LEGAL','LITIGE'].some(x=>c.includes(x))) return 'LEGAL_DISPUTE';
  if(['ABSENCE','REPLACEMENT'].some(x=>c.includes(x))) return 'INTERVENANT_ABSENT';
  if(['DUPLICATE','DOUBLE_PAYMENT'].some(x=>c.includes(x))) return 'DUPLICATE_PAYMENT';
  if(['PAYMENT','REFUND','FACTURE'].some(x=>c.includes(x)) && String(severity).toUpperCase()==='LOW') return 'SIMPLE_REFUND_CHECK';
  if(['DELAY','RETARD'].some(x=>c.includes(x)) && String(severity).toUpperCase()==='LOW') return 'DELAY_LIGHT';
  if(['NOTIFICATION','TECHNICAL'].some(x=>c.includes(x)) && String(severity).toUpperCase()==='LOW') return 'NOTIFICATION_FAILED';
  if(['DOCUMENT'].some(x=>c.includes(x)) && String(severity).toUpperCase()==='LOW') return 'DOCUMENT_REMINDER';
  return 'CLIENT_COMPLAINT';
}

async function supportAuth(request,env){
  const auth=await getSessionUser(request,env).catch(()=>null);
  if(!auth?.user?.id) return {response:json({ok:false,error:'UNAUTHORIZED',version:VERSION},401)};
  const role=supportRoleNormalize(auth.user.role);
  if(!supportRoleAllowed(role)) return {response:json({ok:false,error:'FORBIDDEN',version:VERSION},403)};
  // Support cases can contain personal, operational and financial evidence.
  // Revalidate session, membership and tenant status against D1 on every request.
  const tenantContext=await resolveTenantContext(request,env,auth);
  if(!tenantContext.ok) {
    return {response:json({ok:false,error:tenantContext.error,version:VERSION},tenantContext.status)};
  }
  const tenantId=tenantContext.tenant.id;
  if(!auth.session_active_tenant_id || auth.session_active_tenant_id!==tenantId) {
    return {response:json({ok:false,error:'ACTIVE_TENANT_REQUIRED',version:VERSION},403)};
  }
  return {auth,role,tenantId,tenantContext};
}

async function supportEvent(env,caseId,actorRole,actorId,eventType,details={}){
  await env.DB.prepare(`INSERT INTO support_case_events(id,case_id,actor_role,actor_id,event_type,details_json) VALUES(?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),caseId,actorRole||null,actorId||null,eventType,JSON.stringify(details||{})).run();
}

async function brandIdentityEndpoint(request,env){
  const schemaGate = await schemaReadinessResponse(env, ['brand_identity','brand_assets'], 'BRAND_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const r=await env.DB.prepare(`SELECT * FROM brand_identity WHERE brand_key='PROCHELIA' LIMIT 1`).first();
  const assets=await env.DB.prepare(`SELECT asset_type,asset_name,storage_key,checksum,version,status FROM brand_assets WHERE status='ACTIVE' ORDER BY asset_type,asset_name`).all();
  return json({ok:true,version:VERSION,brand:{name:PROCHELIA_BRAND.name,identity:r||null,assets:assets.results||[],visual:PROCHELIA_BRAND.visual,uniqueness_policy:PROCHELIA_BRAND.uniqueness_policy,note:'L’originalité graphique interne est une spécification de création ; l’exclusivité juridique doit être confirmée par les recherches de similarités et le dépôt de marque.'}});
}

async function brandClearanceRecord(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  if(a.role!=='GERANTE'&&!tenantRoleAllowed(a.tenantContext,['OWNER','ADMIN','MANAGER'])) return json({ok:false,error:'FORBIDDEN'},403);
  const schemaGate = await schemaReadinessResponse(env, ['brand_clearance_log'], 'BRAND_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request)||{};
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO brand_clearance_log(id,search_type,term,source,result,evidence_ref,notes) VALUES(?,?,?,?,?,?,?)`)
    .bind(id,clean(b.search_type)||'SIMILARITY',clean(b.term)||'PROCHÉLIA',clean(b.source)||'INPI',clean(b.result)||'PENDING',clean(b.evidence_ref)||null,clean(b.notes)||null).run();
  await journal(env,a.role,a.auth.user.id,'BRAND_CLEARANCE_RECORDED','brand_clearance_log',id,'OK',{term:b.term||'PROCHÉLIA',source:b.source||'INPI'});
  return json({ok:true,version:VERSION,id});
}

async function interfaceConfigEndpoint(request,env){
  const url=new URL(request.url); const requested=supportRoleNormalize(url.searchParams.get('role')||'');
  if(requested && PROCHELIA_UI[requested]) return json({ok:true,version:VERSION,role:requested,config:PROCHELIA_UI[requested],brand:PROCHELIA_BRAND.visual});
  return json({ok:true,version:VERSION,interfaces:PROCHELIA_UI,brand:PROCHELIA_BRAND.visual});
}

async function supportCreate(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  const schemaGate = await schemaColumnsReadinessResponse(env, {support_cases:['tenant_id'],support_case_events:['case_id'],copilot_resolution_rules:['scenario_key']}, 'SUPPORT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request)||{};
  const category=clean(b.category)||'GENERAL';
  const severity=String(b.severity||'LOW').toUpperCase();
  const scenario=supportScenarioFor(category,severity);
  const rule=await env.DB.prepare(`SELECT * FROM copilot_resolution_rules WHERE scenario_key=? LIMIT 1`).bind(scenario).first();
  const auto=Number(rule?.auto_allowed||0)===1 && String(severity)!=='CRITICAL' && String(severity)!=='HIGH';
  const requiresManager=Number(rule?.manager_approval_required||1)===1 || !auto;
  const id=crypto.randomUUID();
  const proposed=rule?JSON.parse(rule.steps_json||'[]'):{steps:['collect_evidence','copilot_analysis','notify','audit']};
  await env.DB.prepare(`INSERT INTO support_cases(id,source_role,requester_id,company_id,mission_id,complaint_id,category,severity,status,description,proposed_resolution,requires_manager,tenant_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,a.role,a.auth.user.id,b.company_id||null,b.mission_id||null,b.complaint_id||null,category,severity,auto?'PROCESSING':'OPEN',clean(b.description)||null,JSON.stringify({scenario,steps:proposed.steps||proposed}),requiresManager?1:0,a.tenantId).run();
  await supportEvent(env,id,a.role,a.auth.user.id,'CREATED',{scenario,auto,requiresManager});
  await journal(env,a.role,a.auth.user.id,'SUPPORT_CASE_CREATE','support_cases',id,'OK',{scenario,severity,auto});
  let autoResult=null;
  if(auto){
    autoResult=await supportAutoResolve(env,id,a.auth.user.id,a.role,scenario,b);
  }
  return json({ok:true,version:VERSION,case_id:id,scenario,automatic_resolution:!!auto,auto_result:autoResult,manager_approval_required:!auto});
}

async function supportAutoResolve(env,caseId,actorId,actorRole,scenario,context={}){
  const safeAuto=['DELAY_LIGHT','NOTIFICATION_FAILED','DOCUMENT_REMINDER','SIMPLE_REFUND_CHECK','CLIENT_COMPLAINT'];
  if(!safeAuto.includes(scenario)) return {ok:false,status:'MANAGER_REQUIRED'};
  // Fail closed: context is supplied by the requester, so it is never proof
  // that a downstream action actually executed. No trusted execution receipt
  // adapter is wired yet; cases must remain open until a server-side verifier exists.
  const verified=false;
  const resolution={scenario,actions:['verify_context','apply_only_reversible_or_preapproved_action','notify_requester','journal'],context:context||{}};
  if(!verified){
    await env.DB.prepare(`UPDATE support_cases SET status='WAITING_ACTION',resolution=?,resolved_at=NULL WHERE id=?`).bind(JSON.stringify({...resolution,status:'ACTION_REQUIRED'}),caseId).run();
    await supportEvent(env,caseId,actorRole,actorId,'AUTO_CHECKED_WAITING_ACTION',resolution);
    await journal(env,actorRole,actorId,'SUPPORT_CASE_AUTO_CHECK','support_cases',caseId,'WAITING_ACTION',{scenario});
    return {ok:true,status:'WAITING_ACTION',scenario,closed:false,reason:'NO_VERIFIED_DOWNSTREAM_ACTION'};
  }
  await env.DB.prepare(`UPDATE support_cases SET status='RESOLVED',resolution=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?`).bind(JSON.stringify(resolution),caseId).run();
  await supportEvent(env,caseId,actorRole,actorId,'AUTO_RESOLVED_VERIFIED',resolution);
  await journal(env,actorRole,actorId,'SUPPORT_CASE_AUTO_RESOLVE','support_cases',caseId,'RESOLVED',{scenario});
  return {ok:true,status:'RESOLVED',scenario,closed:true};
}

async function supportList(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  const schemaGate = await schemaColumnsReadinessResponse(env, {support_cases:['tenant_id']}, 'SUPPORT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const u=new URL(request.url),status=clean(u.searchParams.get('status')||'');
  const isManager=a.role==='GERANTE'||tenantRoleAllowed(a.tenantContext,['OWNER','ADMIN','MANAGER']);
  let r;
  if(isManager){
    r=status?await env.DB.prepare(`SELECT * FROM support_cases WHERE tenant_id=? AND status=? ORDER BY created_at DESC LIMIT 200`).bind(a.tenantId,status).all():await env.DB.prepare(`SELECT * FROM support_cases WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200`).bind(a.tenantId).all();
  }else{
    r=status?await env.DB.prepare(`SELECT * FROM support_cases WHERE tenant_id=? AND requester_id=? AND status=? ORDER BY created_at DESC LIMIT 200`).bind(a.tenantId,a.auth.user.id,status).all():await env.DB.prepare(`SELECT * FROM support_cases WHERE tenant_id=? AND requester_id=? ORDER BY created_at DESC LIMIT 200`).bind(a.tenantId,a.auth.user.id).all();
  }
  return json({ok:true,version:VERSION,role:a.role,cases:r.results||[]});
}

// Tenant-scoped, privacy-minimized activity timeline. Never expose event details_json or actor IDs.
export function encodeSupportCaseEventCursor(row){
  const createdAt=typeof row?.created_at==='string'?row.created_at:'';
  const id=typeof row?.id==='string'?row.id:'';
  if(!createdAt||!Number.isFinite(Date.parse(createdAt))||!id||id.length>160) return null;
  return base64url(new TextEncoder().encode(JSON.stringify({created_at:createdAt,id})));
}

export function decodeSupportCaseEventCursor(value){
  if(typeof value!=='string'||!value||value.length>512||!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try{
    const decoded=JSON.parse(new TextDecoder().decode(fromBase64url(value)));
    const createdAt=typeof decoded?.created_at==='string'?decoded.created_at:'';
    const id=typeof decoded?.id==='string'?decoded.id:'';
    if(!createdAt||!Number.isFinite(Date.parse(createdAt))||createdAt.length>40||!id||id.length>160) return null;
    return {created_at:createdAt,id};
  }catch{return null;}
}

// Tenant-scoped, privacy-minimized activity timeline. Never expose event details_json or actor IDs.
export function normalizeSupportCaseEventRows(rows){
  const source=Array.isArray(rows)?rows:[];
  const rawHasMore=source.length>100;
  const pageRows=source.slice(0,100);
  const nextCursor=rawHasMore?encodeSupportCaseEventCursor(pageRows.at(-1)):null;
  const hasMore=rawHasMore&&Boolean(nextCursor);
  const allowedRoles=new Set(['CLIENT','SOCIETE','INTERVENANT','GERANTE','ADMIN','OWNER','MANAGER']);
  const events=pageRows.map(row=>{
    const type=String(row?.event_type||'EVENT').toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,60)||'EVENT';
    const rawRole=String(row?.actor_role||'').toUpperCase().slice(0,30);
    const actorRole=allowedRoles.has(rawRole)?rawRole:'TEAM';
    const rawDate=typeof row?.created_at==='string'?row.created_at.slice(0,40):'';
    const createdAt=rawDate&&Number.isFinite(Date.parse(rawDate))?rawDate:null;
    return {type,actor_role:actorRole,created_at:createdAt};
  }).reverse();
  return {events,has_more:hasMore,next_cursor:hasMore?nextCursor:null};
}

export async function supportCaseEventsRoute(request,env){
  if(request.method!=='GET') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{allow:'GET'});
  const a=await supportAuth(request,env); if(a.response)return a.response;
  const schemaGate=schemaColumnsReadinessResponse(env,{support_cases:['tenant_id','requester_id'],support_case_events:['case_id','event_type','actor_role','created_at','id']},'SUPPORT_SCHEMA_NOT_READY'); if(schemaGate)return schemaGate;
  const path=new URL(request.url).pathname;
  const match=path.match(/^\/api\/support\/cases\/([A-Za-z0-9._:-]{1,160})\/events$/);
  if(!match) return json({ok:false,error:'CASE_ID_INVALID',version:VERSION},400);
  const cursorValue=new URL(request.url).searchParams.get('cursor')||'';
  const cursor=cursorValue?decodeSupportCaseEventCursor(cursorValue):null;
  if(cursorValue&&!cursor) return json({ok:false,error:'CURSOR_INVALID',version:VERSION},400);
  const caseId=match[1];
  const isManager=a.role==='GERANTE'||tenantRoleAllowed(a.tenantContext,['OWNER','ADMIN','MANAGER']);
  let caseRow;
  try{
    caseRow=isManager
      ? await env.DB.prepare('SELECT id,requester_id FROM support_cases WHERE id=? AND tenant_id=? LIMIT 1').bind(caseId,a.tenantId).first()
      : await env.DB.prepare('SELECT id,requester_id FROM support_cases WHERE id=? AND tenant_id=? AND requester_id=? LIMIT 1').bind(caseId,a.tenantId,a.auth.user.id).first();
  }catch{return json({ok:false,error:'SUPPORT_DATA_UNAVAILABLE',version:VERSION},503);}
  if(!caseRow) return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  try{
    const base=`SELECT e.id,e.event_type,e.actor_role,e.created_at
      FROM support_case_events e
      JOIN support_cases c ON c.id=e.case_id
     WHERE e.case_id=? AND c.tenant_id=?`;
    const pageClause=cursor?' AND (e.created_at < ? OR (e.created_at = ? AND e.id < ?))':'';
    const managerQuery=base+pageClause+' ORDER BY e.created_at DESC,e.id DESC LIMIT 101';
    const requesterQuery=base+' AND c.requester_id=?'+pageClause+' ORDER BY e.created_at DESC,e.id DESC LIMIT 101';
    const managerBindings=cursor?[caseId,a.tenantId,cursor.created_at,cursor.created_at,cursor.id]:[caseId,a.tenantId];
    const requesterBindings=cursor?[caseId,a.tenantId,a.auth.user.id,cursor.created_at,cursor.created_at,cursor.id]:[caseId,a.tenantId,a.auth.user.id];
    const result=isManager
      ? await env.DB.prepare(managerQuery).bind(...managerBindings).all()
      : await env.DB.prepare(requesterQuery).bind(...requesterBindings).all();
    if(result?.success!==true||!Array.isArray(result.results)) return json({ok:false,error:'SUPPORT_DATA_UNAVAILABLE',version:VERSION},503);
    const normalized=normalizeSupportCaseEventRows(result.results);
    return json({ok:true,version:VERSION,case_id:caseId,events:normalized.events,has_more:normalized.has_more,next_cursor:normalized.next_cursor});
  }catch{return json({ok:false,error:'SUPPORT_DATA_UNAVAILABLE',version:VERSION},503);}
}

async function supportResolve(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  if(a.role!=='GERANTE'&&!tenantRoleAllowed(a.tenantContext,['OWNER','ADMIN','MANAGER'])) return json({ok:false,error:'MANAGER_APPROVAL_REQUIRED',version:VERSION},403);
  const schemaGate = await schemaColumnsReadinessResponse(env, {support_cases:['tenant_id'],support_case_events:['case_id']}, 'SUPPORT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const b=await readJson(request)||{}; const id=clean(b.case_id);
  if(!id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const row=await env.DB.prepare(`SELECT * FROM support_cases WHERE id=? AND tenant_id=? LIMIT 1`).bind(id,a.tenantId).first();
  if(!row)return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  const resolution=clean(b.resolution)||'Résolution validée par la Gérante après contrôle du dossier.';
  await env.DB.prepare(`UPDATE support_cases SET status='RESOLVED',resolution=?,resolved_at=CURRENT_TIMESTAMP,requires_manager=0 WHERE id=? AND tenant_id=?`).bind(resolution,id,a.tenantId).run();
  await supportEvent(env,id,a.role,a.auth.user.id,'MANAGER_RESOLVED',{resolution});
  await journal(env,a.role,a.auth.user.id,'SUPPORT_CASE_MANAGER_RESOLVE','support_cases',id,'RESOLVED',{resolution});
  return json({ok:true,version:VERSION,case_id:id,status:'RESOLVED',resolution});
}

async function supportDashboard(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  if(a.role!=='GERANTE'&&!tenantRoleAllowed(a.tenantContext,['OWNER','ADMIN','MANAGER'])) return json({ok:false,error:'FORBIDDEN'},403);
  const schemaGate = await schemaColumnsReadinessResponse(env, {support_cases:['tenant_id']}, 'SUPPORT_SCHEMA_NOT_READY'); if (schemaGate) return schemaGate;
  const rows=await env.DB.prepare(`SELECT status,severity,COUNT(*) AS n FROM support_cases WHERE tenant_id=? GROUP BY status,severity ORDER BY status,severity`).bind(a.tenantId).all();
  const recent=await env.DB.prepare(`SELECT id,source_role,category,severity,status,created_at,resolved_at FROM support_cases WHERE tenant_id=? ORDER BY created_at DESC LIMIT 30`).bind(a.tenantId).all();
  return json({ok:true,version:VERSION,dashboard:{breakdown:rows.results||[],recent:recent.results||[],policy:{simple_low_impact:'AUTOMATIQUE_APRES_CONTROLE',sensitive_or_high_impact:'VALIDATION_GERANTE',security_legal_rgpd:'ESCALADE_IMMEDIATE'}}});
}

const __procheliaComplementHandle = handle;
handle = async function(request,env){
  try{
    const u=new URL(request.url);
    if((u.pathname==='/api/brand/identity')&&request.method==='GET') return brandIdentityEndpoint(request,env);
    if((u.pathname==='/api/brand/clearance')&&request.method==='POST') return brandClearanceRecord(request,env);
    if((u.pathname==='/api/ui/config')&&request.method==='GET') return interfaceConfigEndpoint(request,env);
    if((u.pathname==='/api/support/cases')&&request.method==='POST') return supportCreate(request,env);
    if((u.pathname==='/api/support/cases')&&request.method==='GET') return supportList(request,env);
    if(/^\/api\/support\/cases\/[A-Za-z0-9._:-]{1,160}\/events$/.test(u.pathname)) return supportCaseEventsRoute(request,env);
    if((u.pathname==='/api/support/cases/resolve')&&request.method==='POST') return supportResolve(request,env);
    if((u.pathname==='/api/support/dashboard')&&request.method==='GET') return supportDashboard(request,env);
    return __procheliaComplementHandle(request,env);
  }catch(e){return json({ok:false,error:'MASTER_COMPLEMENT_ERROR',version:VERSION,message:String(e.message||e)},500)}
};

/* ============================================================================
   PROCHÉLIA — PRODUCTION SAFETY HARDENING 2026-10-06
   Renforcement sans duplication :
   - rate limiting effectif sur routes sensibles
   - gate production plus strict pour les flux réellement utilisés
   - aucune résolution Copilote "automatique" annoncée comme terminée si
     aucune action vérifiable n'a réellement été exécutée
   - traçabilité des blocages de sécurité
   ============================================================================ */

async function productionSafetySchema(env){
  if(!env.DB) throw new Error('DATABASE_REQUIRED');
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_security_events (
    id TEXT PRIMARY KEY, event_type TEXT NOT NULL, route TEXT, subject_hash TEXT,
    decision TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_prod_sec_events_date ON production_security_events(event_type,created_at)`).run();
}

async function productionSubjectHash(request, route){
  const ip=clean(request.headers.get('CF-Connecting-IP')) || clean(request.headers.get('X-Forwarded-For')) || 'unknown';
  return sha256Hex(`${ip}|${route}`);
}

async function productionRateLimit(request,env){
  if(!isMutatingMethod(request.method)) return {ok:true};
  const path=new URL(request.url).pathname;
  const sensitive =
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/security/') ||
    path.startsWith('/api/payments/') ||
    path.startsWith('/api/support/') ||
    path==='/api/complaints' ||
    path==='/api/jobs/process' ||
    path==='/api/system/backup/run';
  const limit=sensitive ? 20 : 120;
  const windowSeconds=60;
  const bucket=`${sensitive?'SENSITIVE':'GENERAL'}:${path}`;
  const subject=await productionSubjectHash(request,path);
  const now=Math.floor(Date.now()/1000);
  const start=new Date(Math.floor(now/windowSeconds)*windowSeconds*1000).toISOString();
  const rateSchemaGate = await schemaReadinessResponse(env, ['security_rate_limits'], 'RATE_LIMIT_SCHEMA_NOT_READY');
  if (rateSchemaGate) return {ok:false,response:rateSchemaGate};
  const existing=await env.DB.prepare(`SELECT request_count FROM security_rate_limits WHERE bucket=? AND subject_hash=? AND window_start=? LIMIT 1`).bind(bucket,subject,start).first();
  const count=Number(existing?.request_count||0)+1;
  if(existing){
    await env.DB.prepare(`UPDATE security_rate_limits SET request_count=? WHERE bucket=? AND subject_hash=? AND window_start=?`).bind(count,bucket,subject,start).run();
  }else{
    await env.DB.prepare(`INSERT INTO security_rate_limits(id,bucket,subject_hash,window_start,request_count) VALUES(?,?,?,?,1)`).bind(crypto.randomUUID(),bucket,subject,start).run();
  }
  if(count>limit){
    const eventSchemaGate = await schemaReadinessResponse(env, ['production_security_events'], 'RATE_LIMIT_AUDIT_SCHEMA_NOT_READY');
    if (eventSchemaGate) return {ok:false,response:eventSchemaGate};
    await env.DB.prepare(`INSERT INTO production_security_events(id,event_type,route,subject_hash,decision,details_json) VALUES(?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),'RATE_LIMIT',path,subject,'BLOCKED',JSON.stringify({limit,windowSeconds})).run();
    return {ok:false,response:json({ok:false,error:'RATE_LIMITED',version:VERSION,retry_after_seconds:Math.max(1,windowSeconds-(now%windowSeconds))},429,{'retry-after':String(Math.max(1,windowSeconds-(now%windowSeconds)))})};
  }
  return {ok:true};
}

async function strictProductionAudit(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const result=await productionConfigCheck(env);
  const extra=[
    {code:'SECURITY_CODE_DELIVERY',status:finalSecretConfigured(env,'SECURITY_CODE_WEBHOOK')&&finalSecretConfigured(env,'SECURITY_CODE_WEBHOOK_SECRET')?'OK':'NOT_CONFIGURED'},
    {code:'CORS_ORIGIN',status:finalSecretConfigured(env,'CORS_ORIGIN')?'OK':'NOT_CONFIGURED'},
    {code:'BACKUP_R2',status:'NOT_VERIFIED',bindingPresent:!!env.BACKUP_BUCKET&&typeof env.BACKUP_BUCKET.put==='function',encryptionConfigured:finalSecretConfigured(env,'BACKUP_ENCRYPTION_KEY')},
    {code:'NOTIFICATION_PROVIDER',status:finalSecretConfigured(env,'NOTIFICATION_PROVIDER')?'OK':'NOT_CONFIGURED'},
    {code:'MAPS_PROVIDER',status:finalSecretConfigured(env,'MAPS_API_KEY')?'OK':'NOT_CONFIGURED'}
  ];
  const checks=[...(result.checks||[]),...extra];
  // Configuration is only one layer of readiness. Do not represent secrets or
  // schema presence as proof that money movement, recovery, isolation, or legal
  // controls have passed independent end-to-end acceptance.
  const releaseEvidence=[
    {code:'PSP_ADAPTER',status:paymentsConfigured(env)?'OK':'NOT_IMPLEMENTED'},
    {code:'PSP_SANDBOX_E2E',status:'NOT_VERIFIED'},
    {code:'BACKUP_RESTORE_E2E',status:'NOT_VERIFIED'},
    {code:'TENANT_ISOLATION',status:'NOT_VERIFIED'},
    {code:'SECURITY_LEGAL_REVIEW',status:'NOT_VERIFIED'},
    {code:'LOAD_RECOVERY',status:'NOT_VERIFIED'},
    {code:'HUMAN_RELEASE_APPROVAL',status:'NOT_GRANTED'}
  ];
  checks.push(...releaseEvidence);
  const blockingCodes=new Set(['SECRET:PAYMENT_PROVIDER','SECRET:PAYMENT_WEBHOOK_SECRET','SECURITY_CODE_DELIVERY','CORS_ORIGIN','BACKUP_R2','PSP_ADAPTER','PSP_SANDBOX_E2E','BACKUP_RESTORE_E2E','TENANT_ISOLATION','SECURITY_LEGAL_REVIEW','LOAD_RECOVERY','HUMAN_RELEASE_APPROVAL']);
  const blocking=checks.filter(x=>blockingCodes.has(x.code)&&x.status!=='OK');
  const configurationReady=result.blocking===0 && checks.filter(x=>['SECRET:PAYMENT_PROVIDER','SECRET:PAYMENT_WEBHOOK_SECRET','SECURITY_CODE_DELIVERY','CORS_ORIGIN','BACKUP_R2'].includes(x.code)).every(x=>x.status==='OK');
  const overall=configurationReady && releaseEvidence.every(x=>x.status==='OK');
  // GET production-check is read-only: no config writes or journal side effects.
  return json({ok:true,version:VERSION,configuration_gate:configurationReady?'PASS':'BLOCKED',production_gate:overall?'OPEN':'CLOSED',ready_for_real_traffic:overall,checks,blocking:blocking.map(x=>x.code),note:overall?'All configuration and independently verified release-evidence gates passed.':'Production traffic remains blocked: configuration, independent acceptance evidence, and explicit human release approval are all required.'});
}

const __procheliaProductionSafetyHandle = handle;
handle = async function(request,env){
  try{
    // Rejeter d'abord les méthodes non prises en charge sur les endpoints
    // de diagnostic : une requête invalide ne doit pas dépendre de D1 ni
    // déclencher le middleware de limitation de débit.
    const preflightUrl = new URL(request.url);
    const preflightPath = preflightUrl.pathname;
    const preflightMethod = request.method.toUpperCase();
    const getOnlyDiagnostics = new Set(['/api/health','/api/readiness','/api/info']);
    // Apply browser-origin rejection before rate limiting or any D1 access.
    // This keeps forbidden cross-origin writes a deterministic 403 even when
    // the database is unavailable, instead of masking them as a generic 500.
    if (isMutatingMethod(preflightMethod) && !securityOriginAllowed(request,env)) {
      return json({ok:false,error:'ORIGIN_NOT_ALLOWED',version:VERSION},403);
    }
    // Block anonymous mission validation before rate limiting touches D1.
    if (preflightPath === '/api/missions/validate') {
      if (preflightMethod !== 'POST') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{'allow':'POST'});
      return json({ok:false,error:'AUTHENTICATED_VALIDATION_REQUIRED',version:VERSION,write_enabled:false},403);
    }
    if (getOnlyDiagnostics.has(preflightPath) && preflightMethod !== 'GET' && preflightMethod !== 'HEAD') {
      return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{'allow':'GET, HEAD'});
    }
    if (getOnlyDiagnostics.has(preflightPath) && preflightMethod === 'HEAD') {
      const response = await __procheliaProductionSafetyHandle(new Request(request.url,{method:'GET',headers:request.headers}),env);
      return new Response(null,{status:response.status,headers:response.headers});
    }
    // Fail closed with a truthful service-unavailable response when a write
    // needs the persistent rate limiter but D1 is not bound.
    if (isMutatingMethod(preflightMethod) && !env?.DB) {
      return json({ok:false,error:'DATABASE_UNAVAILABLE',database:false,version:VERSION},503);
    }
    const rate=await productionRateLimit(request,env);
    if(!rate.ok) return rate.response;
    const u=new URL(request.url);
    if(u.pathname==='/api/system/final-audit' && request.method==='GET') return strictProductionAudit(request,env);
    if(u.pathname==='/api/system/production-check' && request.method==='GET') return strictProductionAudit(request,env);
    return __procheliaProductionSafetyHandle(request,env);
  }catch(e){
    return json({ok:false,error:'PRODUCTION_SAFETY_ERROR',version:VERSION},500);
  }
};
