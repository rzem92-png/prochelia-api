import { handleV7Route } from "./v7-routes.js";
import { procheliaV7 } from "./v7.js";
// PROCHÉLIA — INDEX BACKEND CONSOLIDÉ UNIQUE
// Référence de consolidation : V14.1 Finance + sécurité/RBAC existants.
// Généré le 19/10/2026. À déployer uniquement après recette avec la vraie base D1.
// Les écritures de missions restent volontairement désactivées tant que la chaîne
// authentification/RBAC/idempotence/contrôles métier n'a pas été validée.

const VERSION = 'V14.3.0-PREPRODUCTION-2026-10-19';
const SECURITY_CODE_TTL_SECONDS = 15 * 60;
const SECURITY_MAX_ATTEMPTS = 5;
const SECURITY_LOCK_SECONDS = 15 * 60;
const SECURITY_DEVICE_TTL_SECONDS = 60 * 60 * 24 * 30;
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
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
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

async function getSessionUser(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Base64url(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.role, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at, u.updated_at,
            s.id AS session_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > CURRENT_TIMESTAMP
      LIMIT 1`
  ).bind(tokenHash).first();
  if (!row) return null;
  if (row.status !== 'active') return null;
  return { user: safeUser(row), session_id: row.session_id, token_hash: tokenHash };
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

async function logout(request, env) {
  if (!env.DB) return json({ ok: false, database: false, version: VERSION }, 503);
  const token = getCookie(request, SESSION_COOKIE);
  const headers = { 'set-cookie': sessionCookie('', 0) };
  if (token) {
    const tokenHash = await sha256Base64url(token);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  return json({ ok: true, version: VERSION, authenticated: false }, 200, headers);
}

async function me(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth) return json({ ok: false, authenticated: false, error: 'UNAUTHENTICATED', version: VERSION }, 401);
  return json({ ok: true, authenticated: true, version: VERSION, user: auth.user });
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

  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first();
  if (Number(count?.total || 0) !== 0) {
    return json({ ok: false, error: 'BOOTSTRAP_ALREADY_USED', version: VERSION }, 409);
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

  await env.DB.prepare(
    `INSERT INTO users (id, role, email, first_name, last_name, phone, status, password_hash)
     VALUES (?, 'gerante', ?, ?, ?, ?, 'active', ?)`
  ).bind(userId, email, firstName, lastName, phone, passwordHash).run();

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
async function ensureSecuritySchema(env) {
  if (!env.DB) throw new Error('DATABASE_REQUIRED');
  const statements = [
    `CREATE TABLE IF NOT EXISTS identity_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      level TEXT NOT NULL DEFAULT 'standard',
      provider TEXT,
      provider_reference TEXT,
      verified_at TEXT,
      expires_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications(user_id, status, updated_at)`,
    `CREATE TABLE IF NOT EXISTS trusted_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      UNIQUE(user_id, device_hash)
    )`,
    `CREATE TABLE IF NOT EXISTS mission_security (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      intervenant_id TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'standard',
      arrival_code_hash TEXT,
      arrival_expires_at TEXT,
      arrival_used_at TEXT,
      end_code_hash TEXT,
      end_expires_at TEXT,
      end_used_at TEXT,
      status TEXT NOT NULL DEFAULT 'prepared',
      locked_until TEXT,
      arrival_started_at TEXT,
      ended_at TEXT,
      last_presence_at TEXT,
      last_device_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mission_security_intervenant ON mission_security(intervenant_id, status)`,
    `CREATE TABLE IF NOT EXISTS mission_security_attempts (
      id TEXT PRIMARY KEY,
      security_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      actor_user_id TEXT,
      device_id TEXT,
      result TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_security_attempts_security ON mission_security_attempts(security_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS security_audit (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      mission_id TEXT,
      user_id TEXT,
      actor_role TEXT,
      result TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_security_audit_mission ON security_audit(mission_id, created_at)`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
}

function securityCode() {
  const n = new DataView(randomBytes(4).buffer).getUint32(0) % 1000000;
  return String(n).padStart(6, '0');
}

async function securityAudit(env, eventType, missionId, userId, role, result, metadata = {}) {
  await env.DB.prepare(
    `INSERT INTO security_audit (id,event_type,mission_id,user_id,actor_role,result,metadata_json)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(crypto.randomUUID(), eventType, missionId || null, userId || null, role || null, result, JSON.stringify(metadata)).run();
}

async function requireVerifiedIntervenant(env, userId) {
  const row = await env.DB.prepare(
    `SELECT id,status,level,verified_at,expires_at FROM identity_verifications
     WHERE user_id=? AND status='verified'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ORDER BY verified_at DESC LIMIT 1`
  ).bind(userId).first();
  return row || null;
}

async function deviceHash(request, userId) {
  const raw = [userId, request.headers.get('user-agent') || '', request.headers.get('sec-ch-ua') || ''].join('|');
  return sha256Base64url(raw);
}

async function securityIdentityStart(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user?403:401);
  await ensureSecuritySchema(env);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO identity_verifications (id,user_id,status,level) VALUES (?,?, 'pending','standard')`
  ).bind(id, auth.user.id).run();
  await securityAudit(env,'IDENTITY_VERIFICATION_REQUESTED',null,auth.user.id,auth.user.role,'PENDING',{verification_id:id});
  return json({ok:true,version:VERSION,verification_id:id,status:'pending',message:'Vérification d’identité requise avant l’accès aux missions.'},201);
}

async function securityIdentityApprove(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION}, auth?.user?403:401);
  await ensureSecuritySchema(env);
  const body = await readJson(request);
  const verificationId = clean(body?.verification_id);
  const status = clean(body?.status);
  const level = clean(body?.level) || 'standard';
  if (!verificationId || !['verified','rejected','pending'].includes(status)) return json({ok:false,error:'INVALID_IDENTITY_DECISION',version:VERSION},400);
  const row = await env.DB.prepare('SELECT * FROM identity_verifications WHERE id=? LIMIT 1').bind(verificationId).first();
  if (!row) return json({ok:false,error:'VERIFICATION_NOT_FOUND',version:VERSION},404);
  const provider = clean(body?.provider) || 'manual_control';
  const providerReference = clean(body?.provider_reference) || null;
  const reason = clean(body?.rejection_reason) || null;
  const verifiedAt = status === 'verified' ? new Date().toISOString() : null;
  const expiresAt = status === 'verified' ? new Date(Date.now()+30*24*60*60*1000).toISOString() : null;
  await env.DB.prepare(
    `UPDATE identity_verifications SET status=?,level=?,provider=?,provider_reference=?,verified_at=?,expires_at=?,rejection_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(status,level,provider,providerReference,verifiedAt,expiresAt,reason,verificationId).run();
  await securityAudit(env,'IDENTITY_VERIFICATION_DECISION',null,auth.user.id,auth.user.role,status,{verification_id:verificationId,subject_user_id:row.user_id,level});
  return json({ok:true,version:VERSION,verification_id:verificationId,user_id:row.user_id,status,level,verified_at:verifiedAt},200);
}

async function deliverSecurityCodes(env, payload) {
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
  const signature = await sha256Base64url(secret + '.' + body);
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
  await ensureSecuritySchema(env);
  const body = await readJson(request);
  const missionId=clean(body?.mission_id), clientId=clean(body?.client_id), intervenantId=clean(body?.intervenant_id);
  if(!missionId||!clientId||!intervenantId) return json({ok:false,error:'MISSION_SECURITY_FIELDS_REQUIRED',version:VERSION},400);
  const verified = await requireVerifiedIntervenant(env,intervenantId);
  if(!verified) return json({ok:false,error:'INTERVENANT_IDENTITY_NOT_VERIFIED',version:VERSION},409);
  const existing=await env.DB.prepare('SELECT id,status FROM mission_security WHERE mission_id=? LIMIT 1').bind(missionId).first();
  if(existing) return json({ok:false,error:'MISSION_SECURITY_ALREADY_PREPARED',version:VERSION,status:existing.status},409);
  const arrival=securityCode(), end=securityCode();
  const now=Date.now(), arrivalExpiry=new Date(now+SECURITY_CODE_TTL_SECONDS*1000).toISOString(), endExpiry=new Date(now+SECURITY_CODE_TTL_SECONDS*1000).toISOString();
  const id=crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO mission_security (id,mission_id,client_id,intervenant_id,risk_level,arrival_code_hash,arrival_expires_at,end_code_hash,end_expires_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(id,missionId,clientId,intervenantId,clean(body?.risk_level)||'standard',await sha256Base64url(arrival),arrivalExpiry,await sha256Base64url(end),endExpiry).run();
  await securityAudit(env,'MISSION_SECURITY_PREPARED',missionId,auth.user.id,auth.user.role,'OK',{intervenant_id:intervenantId,risk_level:clean(body?.risk_level)||'standard'});
  const delivery = await deliverSecurityCodes(env, {
    mission_id: missionId,
    client_id: clientId,
    arrival_code: arrival,
    arrival_expires_at: arrivalExpiry,
    end_code: end,
    end_expires_at: endExpiry
  });
  if (!delivery.ok) {
    await env.DB.prepare('DELETE FROM mission_security WHERE id=?').bind(id).run();
    await securityAudit(env,'MISSION_SECURITY_PREPARE_DELIVERY_FAILED',missionId,auth.user.id,auth.user.role,'DENIED',{reason:delivery.error});
    return json({ok:false,error:'SECURITY_CODE_DELIVERY_FAILED',version:VERSION,details:delivery.error},503);
  }
  await securityAudit(env,'SECURITY_CODES_DELIVERED',missionId,auth.user.id,auth.user.role,'OK',{channel:delivery.channel});
  return json({ok:true,version:VERSION,mission_id:missionId,status:'prepared',arrival:{expires_at:arrivalExpiry},end:{expires_at:endExpiry},delivery:{channel:delivery.channel,delivered:true},security_note:'Les codes en clair ne sont jamais renvoyés par l’API.'},201);
}

async function securityPresence(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensureSecuritySchema(env);
  const identity = await requireVerifiedIntervenant(env, auth.user.id);
  if(!identity) return json({ok:false,error:'INTERVENANT_IDENTITY_NOT_VERIFIED',version:VERSION},403);
  const body=await readJson(request), missionId=clean(body?.mission_id);
  if(!missionId) return json({ok:false,error:'MISSION_ID_REQUIRED',version:VERSION},400);
  const sec=await env.DB.prepare('SELECT * FROM mission_security WHERE mission_id=? AND intervenant_id=? LIMIT 1').bind(missionId,auth.user.id).first();
  if(!sec) return json({ok:false,error:'MISSION_NOT_ASSIGNED_OR_NOT_PREPARED',version:VERSION},404);
  const device=await deviceHash(request,auth.user.id);
  await env.DB.prepare(`INSERT INTO trusted_devices (id,user_id,device_hash,expires_at) VALUES (?,?,?,datetime('now',?)) ON CONFLICT(user_id,device_hash) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP,expires_at=excluded.expires_at,status='active'`)
    .bind(crypto.randomUUID(),auth.user.id,device,`+${SECURITY_DEVICE_TTL_SECONDS} seconds`).run();
  await env.DB.prepare(`UPDATE mission_security SET last_presence_at=CURRENT_TIMESTAMP,last_device_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(device,sec.id).run();
  await securityAudit(env,'MISSION_PRESENCE_RECORDED',missionId,auth.user.id,auth.user.role,'OK',{device_bound:true});
  return json({ok:true,version:VERSION,mission_id:missionId,presence:'RECORDED',device_bound:true},200);
}

async function securityVerifyCode(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensureSecuritySchema(env);
  const body=await readJson(request), missionId=clean(body?.mission_id), purpose=clean(body?.purpose), code=clean(body?.code);
  if(!missionId||!['ARRIVAL','END'].includes(purpose)||!/^[0-9]{6}$/.test(code)) return json({ok:false,error:'INVALID_SECURITY_CODE_REQUEST',version:VERSION},400);
  const sec=await env.DB.prepare('SELECT * FROM mission_security WHERE mission_id=? AND intervenant_id=? LIMIT 1').bind(missionId,auth.user.id).first();
  if(!sec) return json({ok:false,error:'MISSION_NOT_ASSIGNED_OR_NOT_PREPARED',version:VERSION},404);
  const identity = await requireVerifiedIntervenant(env, auth.user.id);
  if(!identity) {
    await securityAudit(env,'SECURITY_IDENTITY_RECHECK_FAILED',missionId,auth.user.id,auth.user.role,'DENIED',{});
    return json({ok:false,error:'INTERVENANT_IDENTITY_NOT_VERIFIED',version:VERSION},403);
  }
  if(!sec.last_presence_at) {
    await securityAudit(env,'SECURITY_PRESENCE_REQUIRED',missionId,auth.user.id,auth.user.role,'DENIED',{purpose});
    return json({ok:false,error:'PRESENCE_CHECK_REQUIRED',version:VERSION,message:'La présence de l’intervenant doit être enregistrée avant la validation du code.'},428);
  }
  const device=await deviceHash(request,auth.user.id);
  const trusted = await env.DB.prepare(`SELECT id,status,expires_at FROM trusted_devices WHERE user_id=? AND device_hash=? AND status='active' AND expires_at>CURRENT_TIMESTAMP LIMIT 1`).bind(auth.user.id,device).first();
  if(!trusted || sec.last_device_id !== device) {
    await securityAudit(env,'SECURITY_DEVICE_RECHECK_FAILED',missionId,auth.user.id,auth.user.role,'DENIED',{purpose});
    return json({ok:false,error:'DEVICE_NOT_TRUSTED_FOR_MISSION',version:VERSION},403);
  }
  const now=new Date().toISOString();
  if(sec.locked_until && sec.locked_until>now) return json({ok:false,error:'SECURITY_TEMPORARILY_LOCKED',version:VERSION,locked_until:sec.locked_until},423);
  const used=purpose==='ARRIVAL'?sec.arrival_used_at:sec.end_used_at;
  const expires=purpose==='ARRIVAL'?sec.arrival_expires_at:sec.end_expires_at;
  const stored=purpose==='ARRIVAL'?sec.arrival_code_hash:sec.end_code_hash;
  if(used) return json({ok:false,error:'SECURITY_CODE_ALREADY_USED',version:VERSION},409);
  if(purpose==='END' && sec.status !== 'in_progress') return json({ok:false,error:'MISSION_NOT_IN_PROGRESS',version:VERSION},409);
  if(purpose==='ARRIVAL' && sec.status !== 'prepared') return json({ok:false,error:'MISSION_NOT_READY_FOR_ARRIVAL',version:VERSION},409);
  if(!expires||expires<=now) return json({ok:false,error:'SECURITY_CODE_EXPIRED',version:VERSION},410);
  const expected=await sha256Base64url(code), ok=expected===stored;
  await env.DB.prepare(`INSERT INTO mission_security_attempts (id,security_id,purpose,actor_user_id,device_id,result,reason) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),sec.id,purpose,auth.user.id,device,ok?'SUCCESS':'FAIL',ok?'CODE_MATCH':'CODE_MISMATCH').run();
  if(!ok){
    const attempts=await env.DB.prepare(`SELECT COUNT(*) AS total FROM mission_security_attempts WHERE security_id=? AND purpose=? AND result='FAIL' AND created_at >= datetime('now','-15 minutes')`).bind(sec.id,purpose).first();
    const count=Number(attempts?.total||0);
    if(count>=SECURITY_MAX_ATTEMPTS){
      const locked=new Date(Date.now()+SECURITY_LOCK_SECONDS*1000).toISOString();
      await env.DB.prepare('UPDATE mission_security SET locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(locked,sec.id).run();
      await securityAudit(env,'SECURITY_CODE_LOCK',missionId,auth.user.id,auth.user.role,'BLOCKED',{purpose,attempts:count});
      return json({ok:false,error:'SECURITY_TOO_MANY_ATTEMPTS',version:VERSION,locked_until:locked},423);
    }
    await securityAudit(env,'SECURITY_CODE_FAILED',missionId,auth.user.id,auth.user.role,'DENIED',{purpose,attempts:count});
    return json({ok:false,error:'SECURITY_CODE_INVALID',version:VERSION,remaining_attempts:Math.max(0,SECURITY_MAX_ATTEMPTS-count)},401);
  }
  if(purpose==='ARRIVAL'){
    await env.DB.prepare(`UPDATE mission_security SET arrival_used_at=CURRENT_TIMESTAMP,arrival_started_at=CURRENT_TIMESTAMP,status='in_progress',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(sec.id).run();
  }else{
    await env.DB.prepare(`UPDATE mission_security SET end_used_at=CURRENT_TIMESTAMP,ended_at=CURRENT_TIMESTAMP,status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(sec.id).run();
  }
  await securityAudit(env,`SECURITY_CODE_${purpose}_SUCCESS`,missionId,auth.user.id,auth.user.role,'OK',{purpose,device_bound:true});
  return json({ok:true,version:VERSION,mission_id:missionId,purpose,status:purpose==='ARRIVAL'?'in_progress':'completed',identity_control:'VERIFIED_ACCOUNT_REQUIRED',presence_control:'RECORDED',code:'CONSUMED'},200);
}

async function securityResendCodes(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante','client'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensureSecuritySchema(env);
  const body=await readJson(request);
  const missionId=clean(body?.mission_id);
  if(!missionId) return json({ok:false,error:'MISSION_ID_REQUIRED',version:VERSION},400);
  const sec=await env.DB.prepare('SELECT * FROM mission_security WHERE mission_id=? LIMIT 1').bind(missionId).first();
  if(!sec) return json({ok:false,error:'MISSION_SECURITY_NOT_FOUND',version:VERSION},404);
  if(auth.user.role==='client' && sec.client_id!==auth.user.id) return json({ok:false,error:'FORBIDDEN',version:VERSION},403);
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
  await ensureSecuritySchema(env);
  const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM security_audit').first();
  return json({ok:true,version:VERSION,security:{identity:'verified_required',device:'bound',presence:'recorded',arrival_code:'single_use',end_code:'single_use',max_attempts:SECURITY_MAX_ATTEMPTS,code_ttl_seconds:SECURITY_CODE_TTL_SECONDS,audit_events:Number(count?.total||0)},user:auth.user},200);
}


/* ============================================================
   PROCHÉLIA V13.5.17 — PAIEMENTS / PORTEFEUILLE / COMMISSIONS
   Architecture de règlement de bout en bout.
   IMPORTANT : les fonds réels passent par un PSP agréé ; PROCHÉLIA
   conserve le ledger métier, les états, l'idempotence et l'audit.
=============================================================== */
async function ensurePaymentSchema(env) {
  if (!env.DB) throw new Error('DATABASE_REQUIRED');
  const statements = [
    `CREATE TABLE IF NOT EXISTS payment_accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, provider TEXT NOT NULL,
      provider_account_id TEXT, status TEXT NOT NULL DEFAULT 'pending',
      onboarding_status TEXT NOT NULL DEFAULT 'required',
      payouts_enabled INTEGER NOT NULL DEFAULT 0,
      charges_enabled INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, currency TEXT NOT NULL DEFAULT 'EUR',
      available_cents INTEGER NOT NULL DEFAULT 0, pending_cents INTEGER NOT NULL DEFAULT 0,
      paid_cents INTEGER NOT NULL DEFAULT 0, reserved_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, mission_id TEXT,
      client_id TEXT, intervenant_id TEXT, type TEXT NOT NULL, status TEXT NOT NULL,
      gross_cents INTEGER NOT NULL DEFAULT 0, commission_cents INTEGER NOT NULL DEFAULT 0,
      provider_fee_cents INTEGER NOT NULL DEFAULT 0, refund_cents INTEGER NOT NULL DEFAULT 0,
      net_intervenant_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'EUR',
      provider TEXT, provider_payment_id TEXT, provider_payout_id TEXT,
      reason TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_payment_tx_mission ON payment_transactions(mission_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_tx_intervenant ON payment_transactions(intervenant_id, status, created_at)`,
    `CREATE TABLE IF NOT EXISTS payout_requests (
      id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, wallet_id TEXT NOT NULL,
      user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
      mode TEXT NOT NULL DEFAULT 'standard', status TEXT NOT NULL DEFAULT 'requested',
      provider TEXT, provider_payout_id TEXT, failure_code TEXT, failure_message TEXT,
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_payout_user ON payout_requests(user_id, status, requested_at)`,
    `CREATE TABLE IF NOT EXISTS payment_webhook_events (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_id TEXT NOT NULL,
      event_type TEXT NOT NULL, signature_valid INTEGER NOT NULL DEFAULT 0,
      processed INTEGER NOT NULL DEFAULT 0, payload_hash TEXT, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT, UNIQUE(provider, event_id)
    )`,
    `CREATE TABLE IF NOT EXISTS payment_disputes (
      id TEXT PRIMARY KEY, mission_id TEXT, transaction_id TEXT, client_id TEXT, intervenant_id TEXT,
      status TEXT NOT NULL DEFAULT 'open', reason TEXT, amount_cents INTEGER NOT NULL DEFAULT 0,
      resolution TEXT, resolved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS payment_reconciliation (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL,
      internal_transaction_id TEXT, internal_payout_id TEXT, amount_cents INTEGER,
      currency TEXT, status TEXT NOT NULL DEFAULT 'unmatched', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, external_id)
    )`,
    `CREATE TABLE IF NOT EXISTS payment_audit (
      id TEXT PRIMARY KEY, event_type TEXT NOT NULL, transaction_id TEXT, payout_id TEXT,
      mission_id TEXT, user_id TEXT, result TEXT NOT NULL, metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
}

function moneyCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

async function paymentAudit(env, eventType, data = {}, result = 'OK') {
  await env.DB.prepare(`INSERT INTO payment_audit
    (id,event_type,transaction_id,payout_id,mission_id,user_id,result,metadata_json)
    VALUES (?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), eventType, data.transaction_id || null, data.payout_id || null,
      data.mission_id || null, data.user_id || null, result, JSON.stringify(data.metadata || {})).run();
}

function paymentProvider(env) {
  return clean(env.PAYMENT_PROVIDER) || 'psp_adapter';
}

function paymentsConfigured(env) {
  return !!env.PAYMENT_WEBHOOK_SECRET && !!env.PAYMENT_PROVIDER;
}

async function paymentOnboard(request, env) {
  const auth = await getSessionUser(request, env);
  if (!requireRole(auth, ['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body = await readJson(request);
  const provider = paymentProvider(env);
  const accountId = clean(body?.provider_account_id) || null;
  const existing = await env.DB.prepare('SELECT * FROM payment_accounts WHERE user_id=? LIMIT 1').bind(auth.user.id).first();
  if (existing) return json({ok:true,version:VERSION,account:existing,action:'REUSE_EXISTING'},200);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO payment_accounts
    (id,user_id,provider,provider_account_id,status,onboarding_status)
    VALUES (?,?,?,?, 'pending','required')`).bind(id,auth.user.id,provider,accountId).run();
  await env.DB.prepare(`INSERT INTO wallets (id,user_id) VALUES (?,?)`).bind(crypto.randomUUID(),auth.user.id).run();
  await paymentAudit(env,'PAYOUT_ACCOUNT_CREATED',{user_id:auth.user.id,metadata:{provider}},'OK');
  return json({ok:true,version:VERSION,account_id:id,provider,onboarding_status:'required',next:'PSP_ONBOARDING_REQUIRED'},201);
}

async function paymentStatus(request, env) {
  const auth=await getSessionUser(request,env);
  if(!auth) return json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401);
  await ensurePaymentSchema(env);
  let wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(auth.user.id).first();
  if(!wallet){ await env.DB.prepare('INSERT INTO wallets (id,user_id) VALUES (?,?)').bind(crypto.randomUUID(),auth.user.id).run(); wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(auth.user.id).first(); }
  const account=await env.DB.prepare('SELECT * FROM payment_accounts WHERE user_id=? LIMIT 1').bind(auth.user.id).first();
  const pending=await env.DB.prepare(`SELECT COUNT(*) total FROM payout_requests WHERE user_id=? AND status IN ('requested','processing')`).bind(auth.user.id).first();
  return json({ok:true,version:VERSION,provider:paymentProvider(env),payments_configured:paymentsConfigured(env),wallet:{currency:wallet.currency,available_cents:wallet.available_cents,pending_cents:wallet.pending_cents,paid_cents:wallet.paid_cents,reserved_cents:wallet.reserved_cents},payout_account:account?{status:account.status,onboarding_status:account.onboarding_status,payouts_enabled:!!account.payouts_enabled}:null,pending_payouts:Number(pending?.total||0)},200);
}

async function createMissionPayment(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request);
  const missionId=clean(body?.mission_id), clientId=clean(body?.client_id), intervenantId=clean(body?.intervenant_id);
  const gross=moneyCents(body?.gross_eur), commission=moneyCents(body?.commission_eur);
  if(!missionId||!clientId||!intervenantId||gross===null||commission===null||commission>gross) return json({ok:false,error:'INVALID_PAYMENT_AMOUNT_OR_PARTIES',version:VERSION},400);
  const idem=clean(request.headers.get('idempotency-key'))||clean(body?.idempotency_key);
  if(!idem) return json({ok:false,error:'IDEMPOTENCY_KEY_REQUIRED',version:VERSION},400);
  if(idem.length>180) return json({ok:false,error:'IDEMPOTENCY_KEY_TOO_LONG',version:VERSION},400);
  const old=await env.DB.prepare('SELECT * FROM payment_transactions WHERE idempotency_key=? LIMIT 1').bind(idem).first();
  if(old) {
    const sameRequest=old.mission_id===missionId && old.client_id===clientId &&
      old.intervenant_id===intervenantId && Number(old.gross_cents)===gross &&
      Number(old.commission_cents)===commission && old.currency==='EUR' &&
      old.provider===paymentProvider(env) && old.type==='MISSION_CHARGE';
    if(!sameRequest) return json({ok:false,error:'IDEMPOTENCY_KEY_CONFLICT',version:VERSION},409);
    return json({ok:true,version:VERSION,idempotent_replay:true,transaction:old},200);
  }
  const net=gross-commission;
  const txId=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO payment_transactions
    (id,idempotency_key,mission_id,client_id,intervenant_id,type,status,gross_cents,commission_cents,net_intervenant_cents,currency,provider,reason)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(txId,idem,missionId,clientId,intervenantId,'MISSION_CHARGE','pending',gross,commission,net,'EUR',paymentProvider(env),'MISSION_PAYMENT_CREATED').run();
  await paymentAudit(env,'MISSION_PAYMENT_CREATED',{transaction_id:txId,mission_id:missionId,user_id:auth.user.id,metadata:{gross_cents:gross,commission_cents:commission,net_cents:net}},'OK');
  return json({ok:true,version:VERSION,transaction_id:txId,status:'pending',gross_cents:gross,commission_cents:commission,net_intervenant_cents:net,provider:paymentProvider(env),next:paymentsConfigured(env)?'PSP_CHARGE_REQUIRED':'PAYMENT_PROVIDER_NOT_CONFIGURED'},201);
}

async function finalizeMissionPayment(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), txId=clean(body?.transaction_id), outcome=clean(body?.outcome);
  if(!txId||!['paid','failed','refunded','held'].includes(outcome)) return json({ok:false,error:'INVALID_PAYMENT_FINALIZATION',version:VERSION},400);
  const tx=await env.DB.prepare('SELECT * FROM payment_transactions WHERE id=? LIMIT 1').bind(txId).first();
  if(!tx) return json({ok:false,error:'TRANSACTION_NOT_FOUND',version:VERSION},404);
  if(tx.status===outcome) return json({ok:true,version:VERSION,transaction_id:txId,status:outcome,idempotent_replay:true},200);
  if(['paid','refunded','failed'].includes(tx.status)) return json({ok:false,error:'PAYMENT_STATE_CONFLICT',version:VERSION,status:tx.status},409);
  // Manual status changes are not financial evidence. In particular, a manager
  // must not create a paid/refunded/failed/held state or wallet movement by API.
  // Only verified PSP events plus reconciliation may change financial state.
  await paymentAudit(env,'MISSION_PAYMENT_FINALIZATION_BLOCKED',{transaction_id:txId,mission_id:tx.mission_id,user_id:auth.user.id,metadata:{requested_outcome:outcome,reason:'PSP_RECONCILIATION_REQUIRED'}},'REJECTED');
  return json({ok:false,error:'PSP_RECONCILIATION_REQUIRED',version:VERSION,financial_state_changed:false},409);
}

async function payoutRequest(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), amount=moneyCents(body?.amount_eur), mode=clean(body?.mode)||'standard';
  const idem=clean(request.headers.get('idempotency-key'))||clean(body?.idempotency_key);
  if(amount===null||amount<=0||!['standard','express'].includes(mode)||!idem) return json({ok:false,error:'INVALID_PAYOUT_REQUEST',version:VERSION},400);
  if(idem.length>180) return json({ok:false,error:'IDEMPOTENCY_KEY_TOO_LONG',version:VERSION},400);
  const old=await env.DB.prepare('SELECT * FROM payout_requests WHERE idempotency_key=? LIMIT 1').bind(idem).first();
  if(old) {
    if(String(old.user_id)!==String(auth.user.id)) {
      return json({ok:false,error:'IDEMPOTENCY_KEY_CONFLICT',version:VERSION},409);
    }
    return json({ok:true,version:VERSION,idempotent_replay:true,payout:old},200);
  }
  const account=await env.DB.prepare(`SELECT * FROM payment_accounts WHERE user_id=? LIMIT 1`).bind(auth.user.id).first();
  if(!account||Number(account.payouts_enabled)!==1) return json({ok:false,error:'PAYOUT_ACCOUNT_NOT_READY',version:VERSION,message:'Le compte de paiement de l’intervenant doit être vérifié et activé par le PSP.'},409);
  const activeDispute=await env.DB.prepare(`SELECT id FROM payment_disputes WHERE intervenant_id=? AND status IN ('open','awaiting_psp_action') LIMIT 1`).bind(auth.user.id).first();
  if(activeDispute) return json({ok:false,error:'PAYOUT_BLOCKED_BY_ACTIVE_DISPUTE',version:VERSION,dispute_id:activeDispute.id},409);
  const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(auth.user.id).first();
  if(!wallet||String(wallet.currency||'EUR').toUpperCase()!=='EUR'||Number(wallet.available_cents)<amount) return json({ok:false,error:'INSUFFICIENT_AVAILABLE_BALANCE_OR_CURRENCY_MISMATCH',version:VERSION,available_cents:Number(wallet?.available_cents||0),currency:wallet?.currency||null},409);
  const payoutId=crypto.randomUUID();
  // Reserve balance and create the payout request in one D1 transaction.
  // The conditional INSERT is evaluated immediately after the guarded UPDATE:
  // no request can be created unless the wallet reservation succeeded.
  try {
    const reservation=env.DB.prepare(`UPDATE wallets
      SET available_cents=available_cents-?,reserved_cents=reserved_cents+?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND user_id=? AND currency='EUR' AND available_cents>=?`).bind(amount,amount,wallet.id,auth.user.id,amount);
    const createPayout=env.DB.prepare(`INSERT INTO payout_requests
      (id,idempotency_key,wallet_id,user_id,amount_cents,currency,mode,provider,status)
      SELECT ?,?,?,?,?, 'EUR',?,?, 'requested' WHERE changes()=1`).bind(payoutId,idem,wallet.id,auth.user.id,amount,mode,paymentProvider(env));
    const results=await env.DB.batch([reservation,createPayout]);
    if(Number(results?.[0]?.meta?.changes)!==1||Number(results?.[1]?.meta?.changes)!==1) {
      const replay=await env.DB.prepare('SELECT * FROM payout_requests WHERE idempotency_key=? LIMIT 1').bind(idem).first();
      if(replay && String(replay.user_id)===String(auth.user.id)) return json({ok:true,version:VERSION,idempotent_replay:true,payout:replay},200);
      if(replay) return json({ok:false,error:'IDEMPOTENCY_KEY_CONFLICT',version:VERSION},409);
      return json({ok:false,error:'PAYOUT_RESERVATION_NOT_CONFIRMED',version:VERSION},409);
    }
  } catch(error) {
    const replay=await env.DB.prepare('SELECT * FROM payout_requests WHERE idempotency_key=? LIMIT 1').bind(idem).first();
    if(replay && String(replay.user_id)===String(auth.user.id)) return json({ok:true,version:VERSION,idempotent_replay:true,payout:replay},200);
    if(replay) return json({ok:false,error:'IDEMPOTENCY_KEY_CONFLICT',version:VERSION},409);
    throw error;
  }
  await paymentAudit(env,'PAYOUT_REQUESTED',{payout_id:payoutId,user_id:auth.user.id,metadata:{amount_cents:amount,mode}},'OK');
  return json({ok:true,version:VERSION,payout_id:payoutId,status:'requested',amount_cents:amount,mode,provider:paymentProvider(env),next:paymentsConfigured(env)?'PSP_PAYOUT_REQUIRED':'PAYMENT_PROVIDER_NOT_CONFIGURED'},201);
}

async function verifyWebhookSignature(request, env, rawBody) {
  const secret=env.PAYMENT_WEBHOOK_SECRET;
  if(!secret) return false;
  const signature=request.headers.get('x-prochelia-signature') || request.headers.get('x-webhook-signature') || '';
  if(!signature) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(rawBody)));
  const expected=base64url(mac);
  return signature===expected || signature===`sha256=${expected}`;
}

async function paymentWebhook(request, env) {
  await ensurePaymentSchema(env);
  const raw=await request.text();
  if(!(await verifyWebhookSignature(request,env,raw))) return json({ok:false,error:'INVALID_WEBHOOK_SIGNATURE',version:VERSION},401);
  let event; try{event=JSON.parse(raw)}catch{return json({ok:false,error:'INVALID_WEBHOOK_JSON',version:VERSION},400);}
  const provider=clean(event?.provider)||paymentProvider(env), eventId=clean(event?.id), type=clean(event?.type);
  if(!eventId||!type) return json({ok:false,error:'INVALID_WEBHOOK_EVENT',version:VERSION},400);
  // This deployment has one configured PSP adapter. Never let a signed payload
  // select another provider namespace or bypass provider-specific verification.
  if(provider!==paymentProvider(env)) return json({ok:false,error:'PAYMENT_PROVIDER_MISMATCH',version:VERSION},400);
  const txId=clean(event?.data?.transaction_id), payoutId=clean(event?.data?.payout_id);
  const providerPaymentId=clean(event?.data?.provider_payment_id);
  const paymentEvents=['payment_succeeded','charge_succeeded','payment_failed','charge_failed'];
  const payoutEvents=['payout_processing','payout_paid','payout_failed','payout_canceled'];
  const supportedEvents=[...paymentEvents,...payoutEvents];
  if(!supportedEvents.includes(type)) {
    return json({ok:false,error:type==='payment_refunded'?'REFUND_RECONCILIATION_NOT_IMPLEMENTED':'UNSUPPORTED_WEBHOOK_EVENT',version:VERSION},501);
  }
  if(['payment_succeeded','charge_succeeded'].includes(type) && (!txId||!providerPaymentId)) {
    return json({ok:false,error:'PSP_PAYMENT_REFERENCE_REQUIRED',version:VERSION},400);
  }
  if(paymentEvents.includes(type)&&!txId) return json({ok:false,error:'PAYMENT_TRANSACTION_REFERENCE_REQUIRED',version:VERSION},400);
  if(payoutEvents.includes(type)&&!payoutId) return json({ok:false,error:'PAYOUT_REFERENCE_REQUIRED',version:VERSION},400);
  const payloadHash=await sha256Base64url(raw);
  const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO payment_webhook_events (id,provider,event_id,event_type,signature_valid,payload_hash) VALUES (?,?,?,?,1,?)`).bind(crypto.randomUUID(),provider,eventId,type,payloadHash).run();
  const existing=await env.DB.prepare('SELECT * FROM payment_webhook_events WHERE provider=? AND event_id=? LIMIT 1').bind(provider,eventId).first();
  if(!existing) return json({ok:false,error:'WEBHOOK_EVENT_PERSISTENCE_FAILED',version:VERSION},503);
  if(existing.payload_hash && existing.payload_hash!==payloadHash) {
    await paymentAudit(env,'PSP_WEBHOOK_ID_COLLISION',{metadata:{provider,event_id:eventId,event_type:type}},'REJECTED');
    return json({ok:false,error:'WEBHOOK_EVENT_ID_PAYLOAD_CONFLICT',version:VERSION},409);
  }
  if(Number(existing.processed)===1) return json({ok:true,version:VERSION,duplicate:true,event_id:eventId},200);
  // Atomic claim prevents two concurrent deliveries from crediting the same wallet.
  // An abandoned claim becomes retryable after five minutes.
  const claim=await env.DB.prepare(`UPDATE payment_webhook_events SET processed=2,received_at=CURRENT_TIMESTAMP
    WHERE provider=? AND event_id=? AND (processed=0 OR (processed=2 AND received_at < datetime('now','-5 minutes')))`).bind(provider,eventId).run();
  if(!claim.meta?.changes) return json({ok:true,version:VERSION,accepted:true,processing:true,event_id:eventId,retry_after_seconds:30},202);
  try {
    if(txId){
      const tx=await env.DB.prepare('SELECT * FROM payment_transactions WHERE id=? LIMIT 1').bind(txId).first();
      if(!tx) throw new Error('PAYMENT_TRANSACTION_NOT_FOUND');
      if(clean(tx.provider)!==provider) throw new Error('PAYMENT_PROVIDER_MISMATCH');
      if(['payment_succeeded','charge_succeeded'].includes(type)) {
        const amount=event?.data?.amount_cents, currency=clean(event?.data?.currency)?.toUpperCase();
        if(!Number.isSafeInteger(amount)||amount!==Number(tx.gross_cents)||currency!==String(tx.currency||'EUR').toUpperCase()) {
          throw new Error('PSP_PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH');
        }
      }
      const statusMap={payment_succeeded:'paid',charge_succeeded:'paid',payment_failed:'failed',charge_failed:'failed',payment_refunded:'refunded'};
      const newStatus=statusMap[type];
      if(newStatus){
        const alreadyFinal = ['paid','failed','refunded'].includes(tx.status);
        if(!alreadyFinal){
          const wallet=newStatus==='paid'
            ? await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(tx.intervenant_id).first()
            : null;
          if(newStatus==='paid'&&!wallet) throw new Error('INTERVENANT_WALLET_NOT_FOUND');
          const txUpdate=env.DB.prepare(`UPDATE payment_transactions SET status=?,provider_payment_id=COALESCE(?,provider_payment_id),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('paid','failed','refunded')`).bind(newStatus,providerPaymentId||null,txId);
          if(newStatus==='paid'){
            // D1 batch is transactional. The second statement runs only when
            // the guarded state transition changed exactly one row.
            const walletCredit=env.DB.prepare(`UPDATE wallets SET available_cents=available_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()=1`).bind(tx.net_intervenant_cents,wallet.id);
            await env.DB.batch([txUpdate,walletCredit]);
          } else {
            await txUpdate.run();
          }
        }
      }
    }
    if(payoutId){
      const payout=await env.DB.prepare('SELECT * FROM payout_requests WHERE id=? LIMIT 1').bind(payoutId).first();
      if(!payout) throw new Error('PAYOUT_REQUEST_NOT_FOUND');
      if(clean(payout.provider)!==provider) throw new Error('PAYOUT_PROVIDER_MISMATCH');
      if(type==='payout_paid') {
        const amount=event?.data?.amount_cents, currency=clean(event?.data?.currency)?.toUpperCase();
        const providerPayoutId=clean(event?.data?.provider_payout_id);
        if(!providerPayoutId) throw new Error('PSP_PAYOUT_REFERENCE_REQUIRED');
        if(!Number.isSafeInteger(amount)||amount!==Number(payout.amount_cents)||currency!==String(payout.currency||'EUR').toUpperCase()) {
          throw new Error('PSP_PAYOUT_AMOUNT_OR_CURRENCY_MISMATCH');
        }
      }
      const statusMap={payout_processing:'processing',payout_paid:'completed',payout_failed:'failed',payout_canceled:'canceled'};
      const newStatus=statusMap[type];
      if(newStatus){
        const alreadyFinal=['completed','failed','canceled'].includes(payout.status);
        if(!alreadyFinal){
          // State transition is conditional; a retry cannot apply wallet movements twice.
          const payoutUpdate=env.DB.prepare(`UPDATE payout_requests SET status=?,provider_payout_id=COALESCE(?,provider_payout_id),failure_code=?,failure_message=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('completed','failed','canceled')`).bind(newStatus,clean(event?.data?.provider_payout_id)||null,clean(event?.data?.failure_code)||null,clean(event?.data?.failure_message)||null,newStatus,payoutId);
          if(newStatus==='completed'){
            const settle=env.DB.prepare(`UPDATE wallets SET reserved_cents=MAX(0,reserved_cents-?),paid_cents=paid_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()=1`).bind(payout.amount_cents,payout.amount_cents,payout.wallet_id);
            await env.DB.batch([payoutUpdate,settle]);
          } else if(['failed','canceled'].includes(newStatus)){
            const release=env.DB.prepare(`UPDATE wallets SET reserved_cents=MAX(0,reserved_cents-?),available_cents=available_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND changes()=1`).bind(payout.amount_cents,payout.amount_cents,payout.wallet_id);
            await env.DB.batch([payoutUpdate,release]);
          } else {
            await payoutUpdate.run();
          }
        }
      }
    }
    await paymentAudit(env,'PSP_WEBHOOK_PROCESSED',{transaction_id:txId,payout_id:payoutId,metadata:{provider,event_id:eventId,event_type:type}},'OK');
    await env.DB.prepare('UPDATE payment_webhook_events SET processed=1,processed_at=CURRENT_TIMESTAMP WHERE provider=? AND event_id=? AND processed=2').bind(provider,eventId).run();
    return json({ok:true,version:VERSION,processed:true,event_id:eventId},200);
  } catch(e) {
    await env.DB.prepare('UPDATE payment_webhook_events SET processed=0 WHERE provider=? AND event_id=? AND processed=2').bind(provider,eventId).run();
    await paymentAudit(env,'PSP_WEBHOOK_PROCESSING_FAILED',{transaction_id:txId,payout_id:payoutId,metadata:{provider,event_id:eventId,event_type:type,error:String(e.message||e).slice(0,180)}},'RETRYABLE').catch(()=>{});
    return json({ok:false,error:'WEBHOOK_PROCESSING_FAILED',retryable:true,version:VERSION},503);
  }
}
async function openPaymentDispute(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['client','gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), missionId=clean(body?.mission_id), reason=clean(body?.reason), amount=moneyCents(body?.amount_eur);
  if(!missionId||!reason||amount===null||amount<=0) return json({ok:false,error:'INVALID_DISPUTE',version:VERSION},400);
  const tx=await env.DB.prepare(`SELECT * FROM payment_transactions WHERE mission_id=? ORDER BY created_at DESC LIMIT 1`).bind(missionId).first();
  if(!tx) return json({ok:false,error:'PAYMENT_NOT_FOUND_FOR_MISSION',version:VERSION},404);
  if(auth.user.role==='client'&&String(tx.client_id)!==String(auth.user.id)) return json({ok:false,error:'MISSION_PAYMENT_FORBIDDEN',version:VERSION},403);
  if(amount>Number(tx.gross_cents)) return json({ok:false,error:'DISPUTE_AMOUNT_EXCEEDS_PAYMENT',version:VERSION},400);
  if(!['paid','held'].includes(tx.status)) return json({ok:false,error:'PAYMENT_NOT_DISPUTABLE_IN_CURRENT_STATE',version:VERSION},409);
  const prior=await env.DB.prepare(`SELECT id FROM payment_disputes WHERE transaction_id=? AND status IN ('open','awaiting_psp_action') LIMIT 1`).bind(tx.id).first();
  if(prior) return json({ok:false,error:'ACTIVE_DISPUTE_ALREADY_EXISTS',version:VERSION,dispute_id:prior.id},409);
  const id=crypto.randomUUID();
  // A single guarded INSERT closes the race between the pre-check and creation:
  // only one active dispute can be inserted for this payment.
  const created=await env.DB.prepare(`INSERT INTO payment_disputes
    (id,mission_id,transaction_id,client_id,intervenant_id,status,reason,amount_cents)
    SELECT ?,?,?,?,?,?,?,? FROM payment_transactions
    WHERE id=? AND status IN ('paid','held')
      AND NOT EXISTS (SELECT 1 FROM payment_disputes WHERE transaction_id=? AND status IN ('open','awaiting_psp_action'))`)
    .bind(id,missionId,tx.id,tx.client_id,tx.intervenant_id,'open',reason,amount,tx.id,tx.id).run();
  if(Number(created.meta?.changes)!==1) {
    const active=await env.DB.prepare(`SELECT id FROM payment_disputes WHERE transaction_id=? AND status IN ('open','awaiting_psp_action') LIMIT 1`).bind(tx.id).first();
    if(active) return json({ok:false,error:'ACTIVE_DISPUTE_ALREADY_EXISTS',version:VERSION,dispute_id:active.id},409);
    return json({ok:false,error:'PAYMENT_STATE_CHANGED_RETRY',version:VERSION},409);
  }
  // Do not label the payment "held": this code path does not atomically freeze
  // the provider wallet. The open dispute instead blocks new payouts below.
  await paymentAudit(env,'PAYMENT_DISPUTE_OPENED',{transaction_id:tx.id,mission_id:missionId,user_id:auth.user.id,metadata:{amount_cents:amount,reason,wallet_frozen:false}},'OK');
  return json({ok:true,version:VERSION,dispute_id:id,status:'open',payment_status:tx.status,payouts_blocked:true},201);
}

async function paymentAdminResolve(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), disputeId=clean(body?.dispute_id), resolution=clean(body?.resolution);
  if(!disputeId||!['release','partial_refund','full_refund','cancel'].includes(resolution)) return json({ok:false,error:'INVALID_DISPUTE_RESOLUTION',version:VERSION},400);
  const d=await env.DB.prepare('SELECT * FROM payment_disputes WHERE id=? LIMIT 1').bind(disputeId).first();
  if(!d||!['open','awaiting_psp_action'].includes(d.status)) return json({ok:false,error:'DISPUTE_NOT_FOUND_OR_ALREADY_RESOLVED',version:VERSION},409);
  // A manager decision is not proof of a PSP refund or a wallet release.
  // Record the requested outcome, keep the dispute active and block payouts
  // until an independently verified PSP/accounting reconciliation closes it.
  const changed=await env.DB.prepare(`UPDATE payment_disputes SET status='awaiting_psp_action',resolution=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('open','awaiting_psp_action')`).bind(resolution,disputeId).run();
  if(Number(changed?.meta?.changes)!==1) return json({ok:false,error:'DISPUTE_STATE_CHANGED_RETRY',version:VERSION},409);
  await paymentAudit(env,'PAYMENT_DISPUTE_DECISION_RECORDED',{transaction_id:d.transaction_id,mission_id:d.mission_id,user_id:auth.user.id,metadata:{dispute_id:disputeId,resolution,psp_action_required:true}},'PENDING');
  return json({ok:true,version:VERSION,dispute_id:disputeId,status:'awaiting_psp_action',resolution,psp_action_required:true,financial_state_changed:false},202);
}

async function handleBase(request, env) {
  const url = new URL(request.url);


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
        '/api/auth/bootstrap','/api/security/identity/start','/api/security/identity/approve','/api/security/mission/prepare','/api/security/presence','/api/security/code/verify','/api/security/resend','/api/security/client-code','/api/security/status','/api/payments/onboard','/api/payments/status','/api/payments/mission/create','/api/payments/mission/finalize','/api/payments/payout','/api/payments/webhook','/api/payments/dispute','/api/payments/dispute/resolve','/api/readiness','/api/info'
      ],
      writes: { missions: false, bootstrap: true },
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
    `CREATE TRIGGER IF NOT EXISTS trg_ledger_validate_insert BEFORE INSERT ON accounting_ledger
      WHEN NEW.amount_cents IS NULL OR NEW.amount_cents<=0
        OR NEW.direction NOT IN ('DEBIT','CREDIT')
        OR length(trim(NEW.account_code))=0
        OR length(trim(NEW.reference_type))=0
        OR length(trim(NEW.reference_id))=0
        OR NEW.currency NOT GLOB '[A-Z][A-Z][A-Z]'
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_LEDGER_INVALID_ENTRY'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_ledger_immutable_update BEFORE UPDATE ON accounting_ledger
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_LEDGER_IMMUTABLE'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_ledger_immutable_delete BEFORE DELETE ON accounting_ledger
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_LEDGER_IMMUTABLE'); END`,
    `CREATE TABLE IF NOT EXISTS accounting_operations (
      id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
      description TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, posted_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS accounting_operation_lines (
      id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, account_code TEXT NOT NULL,
      direction TEXT NOT NULL, amount_cents INTEGER NOT NULL, label TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(operation_id) REFERENCES accounting_operations(id))`,
    `CREATE INDEX IF NOT EXISTS idx_accounting_lines_operation ON accounting_operation_lines(operation_id)`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_line_validate BEFORE INSERT ON accounting_operation_lines
      WHEN NEW.amount_cents<=0 OR NEW.direction NOT IN ('DEBIT','CREDIT')
        OR length(trim(NEW.account_code))=0
        OR NOT EXISTS (SELECT 1 FROM accounting_operations WHERE id=NEW.operation_id AND status='DRAFT')
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_LINE_INVALID'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_operation_post BEFORE UPDATE OF status ON accounting_operations
      WHEN OLD.status='DRAFT' AND NEW.status='POSTED'
        AND ((SELECT COUNT(*) FROM accounting_operation_lines WHERE operation_id=NEW.id)<2
          OR (SELECT COALESCE(SUM(CASE direction WHEN 'DEBIT' THEN amount_cents WHEN 'CREDIT' THEN -amount_cents ELSE 0 END),0)
              FROM accounting_operation_lines WHERE operation_id=NEW.id)<>0
          OR (SELECT COUNT(DISTINCT account_code) FROM accounting_operation_lines WHERE operation_id=NEW.id)<2)
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_NOT_BALANCED'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_operation_immutable BEFORE UPDATE ON accounting_operations
      WHEN OLD.status='POSTED'
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_IMMUTABLE'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_operation_no_delete BEFORE DELETE ON accounting_operations
      WHEN OLD.status='POSTED'
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_IMMUTABLE'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_lines_immutable_update BEFORE UPDATE ON accounting_operation_lines
      WHEN EXISTS (SELECT 1 FROM accounting_operations WHERE id=OLD.operation_id AND status='POSTED')
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_IMMUTABLE'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_lines_immutable_delete BEFORE DELETE ON accounting_operation_lines
      WHEN EXISTS (SELECT 1 FROM accounting_operations WHERE id=OLD.operation_id AND status='POSTED')
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_IMMUTABLE'); END`,
    `CREATE TRIGGER IF NOT EXISTS trg_accounting_lines_no_late_insert BEFORE INSERT ON accounting_operation_lines
      WHEN EXISTS (SELECT 1 FROM accounting_operations WHERE id=NEW.operation_id AND status<>'DRAFT')
      BEGIN SELECT RAISE(ABORT,'ACCOUNTING_OPERATION_IMMUTABLE'); END`,
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

// Post a complete double-entry operation. All header, detail and legacy-ledger
// rows are written in one D1 batch; the DB trigger is the final balance guard.
async function postBalancedAccountingOperation(env,input) {
  await ensureConsolidatedSchema(env);
  const idempotencyKey=clean(input?.idempotency_key);
  const referenceType=clean(input?.reference_type), referenceId=clean(input?.reference_id);
  const currency=clean(input?.currency||'EUR').toUpperCase();
  const lines=Array.isArray(input?.lines)?input.lines:[];
  if(!idempotencyKey||idempotencyKey.length>180||!referenceType||!referenceId||
    !/^[A-Z]{3}$/.test(currency)||lines.length<2||lines.length>40) {
    return {ok:false,error:'INVALID_ACCOUNTING_OPERATION'};
  }
  let debit=0,credit=0;
  const normalized=[];
  for(const line of lines) {
    const accountCode=clean(line?.account_code),direction=clean(line?.direction).toUpperCase();
    const amount=Number(line?.amount_cents);
    if(!accountCode||accountCode.length>64||!['DEBIT','CREDIT'].includes(direction)||
      !Number.isSafeInteger(amount)||amount<=0) return {ok:false,error:'INVALID_ACCOUNTING_LINE'};
    if(direction==='DEBIT') debit+=amount; else credit+=amount;
    if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit)) return {ok:false,error:'ACCOUNTING_AMOUNT_OVERFLOW'};
    normalized.push({account_code:accountCode,direction,amount_cents:amount,label:clean(line?.label)||null});
  }
  if(debit!==credit||new Set(normalized.map(x=>x.account_code)).size<2)
    return {ok:false,error:'ACCOUNTING_OPERATION_NOT_BALANCED'};
  normalized.sort((a,b)=>a.account_code.localeCompare(b.account_code)||a.direction.localeCompare(b.direction)||a.amount_cents-b.amount_cents||String(a.label||'').localeCompare(String(b.label||'')));
  const existing=await env.DB.prepare('SELECT * FROM accounting_operations WHERE idempotency_key=? LIMIT 1').bind(idempotencyKey).first();
  if(existing) {
    const prior=await env.DB.prepare('SELECT account_code,direction,amount_cents,label FROM accounting_operation_lines WHERE operation_id=? ORDER BY account_code,direction,amount_cents,label').bind(existing.id).all();
    const priorLines=(prior.results||[]).map(x=>({account_code:x.account_code,direction:x.direction,amount_cents:Number(x.amount_cents),label:x.label||null})).sort((a,b)=>a.account_code.localeCompare(b.account_code)||a.direction.localeCompare(b.direction)||a.amount_cents-b.amount_cents||String(a.label||'').localeCompare(String(b.label||'')));
    const same=existing.reference_type===referenceType&&existing.reference_id===referenceId&&existing.currency===currency&&
      JSON.stringify(priorLines)===JSON.stringify(normalized);
    return same&&existing.status==='POSTED'
      ? {ok:true,idempotent_replay:true,operation_id:existing.id,status:'POSTED',total_debit_cents:debit,currency}
      : {ok:false,error:'ACCOUNTING_IDEMPOTENCY_CONFLICT'};
  }
  const operationId=crypto.randomUUID();
  const statements=[
    env.DB.prepare(`INSERT INTO accounting_operations(id,idempotency_key,reference_type,reference_id,currency,status,description)
      VALUES(?,?,?,?,?,'DRAFT',?)`).bind(operationId,idempotencyKey,referenceType,referenceId,currency,clean(input?.description)||null)
  ];
  for(const line of normalized) {
    const lineId=crypto.randomUUID();
    statements.push(env.DB.prepare(`INSERT INTO accounting_operation_lines(id,operation_id,account_code,direction,amount_cents,label)
      VALUES(?,?,?,?,?,?)`).bind(lineId,operationId,line.account_code,line.direction,line.amount_cents,line.label));
    statements.push(env.DB.prepare(`INSERT INTO accounting_ledger(id,reference_type,reference_id,account_code,direction,amount_cents,currency,label,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),referenceType,referenceId,line.account_code,line.direction,line.amount_cents,currency,line.label,
        JSON.stringify({operation_id:operationId,idempotency_key:idempotencyKey})));
  }
  statements.push(env.DB.prepare(`UPDATE accounting_operations SET status='POSTED',posted_at=CURRENT_TIMESTAMP WHERE id=? AND status='DRAFT'`).bind(operationId));
  await env.DB.batch(statements);
  const posted=await env.DB.prepare('SELECT status FROM accounting_operations WHERE id=?').bind(operationId).first();
  if(posted?.status!=='POSTED') return {ok:false,error:'ACCOUNTING_POST_NOT_CONFIRMED'};
  return {ok:true,idempotent_replay:false,operation_id:operationId,status:'POSTED',total_debit_cents:debit,currency};
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
  const governance = procheliaV7.assessSupraDecision({
    caseType, impact, requestedAction: action === 'AUTO_RESOLVE' ? 'ANALYZE_AND_PROPOSE' : action,
    actorRole: 'system', context
  });
  const supraPlan = procheliaV7.buildSupraPlan({
    caseType, impact, requestedAction: action === 'AUTO_RESOLVE' ? 'ANALYZE_AND_PROPOSE' : action,
    domain: context.domain, market: context.market || 'fr', context
  });
  // Le moteur transversal relie les domaines et prépare un parcours complet.
  // L'exécution réelle reste désactivée tant que chaque adaptateur n'a pas ses tests E2E.
  action = action === 'AUTO_RESOLVE' ? 'ANALYZE_AND_PROPOSE' : action;
  solution = { ...solution, automatic:false, governance, supraPlan };
  return {
    action, mode:'MANAGER_APPROVAL', confidence: simple ? 0.95 : 0.82,
    solution, context, phase, governance, supraPlan,
    domainsCovered: supraPlan.connectedDomains
  };
}

async function createOperationalCase(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','intervenant','entreprise']); if(gate.error)return gate.error;
  const body=await readJson(request)||{};
  const caseType=clean(body.case_type); if(!caseType)return json({ok:false,error:'CASE_TYPE_REQUIRED',version:VERSION},400);
  const phase=String(await getSetting(env,'project_phase','TEST')).toUpperCase();
  const impact=String(body.impact_level||'LOW').toUpperCase();
  const priority=CASE_PRIORITIES[impact]||10;
  const rec=await copilotRecommend(env,{caseType,impact,phase,context:body.context||{}});
  const id=crypto.randomUUID();
  // SUPRA V1 : aucune création de dossier ne déclenche d'écriture métier automatique.
  // Les dossiers restent en attente de validation explicite de la Gérante.
  const requiresManager=1;
  const status='OPEN';
  await env.DB.prepare(`INSERT INTO operational_cases(id,case_type,source,phase,priority,status,auto_mode,client_id,company_id,intervenant_id,mission_id,impact_level,description,context_json,proposed_solution_json,requires_manager) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,caseType,'API',phase,priority,status,rec.mode,clean(body.client_id)||null,clean(body.company_id)||null,clean(body.intervenant_id)||null,clean(body.mission_id)||null,impact,clean(body.description)||null,JSON.stringify(body.context||{}),JSON.stringify(rec),requiresManager).run();
  await env.DB.prepare(`INSERT INTO copilot_log(id,case_id,action_type,recommendation,confidence,mode) VALUES(?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),id,rec.action,JSON.stringify(rec.solution),rec.confidence,rec.mode).run();
  await journal(env,'copilot',null,'CASE_CREATED','operational_case',id,'OK',{caseType,impact});
  // SUPRA V1 : recommandation uniquement ; jamais d'exécution automatique ici.
  return json({ok:true,version:VERSION,case_id:id,recommendation:rec,status:'WAITING_MANAGER'},201);
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
      // SUPRA V1 : aucune réaffectation directe. Contrôles d'éligibilité,
      // disponibilité, propriété et acceptation du prestataire requis avant exécution.
      const queued=await enqueueAction(env,c.id,'ASSIGN_REPLACEMENT',{mission_id:c.mission_id,intervenant_id:replacementId,requires_manager:true,requires_provider_validation:true},`${c.id}:replacement:${replacementId}`);
      results.push({action:'ASSIGN_REPLACEMENT',...queued,reason:'SUPRA_VALIDATION_REQUIRED'});
    } else {
      const queued=await enqueueAction(env,c.id,'SEARCH_REPLACEMENT',{mission_id:c.mission_id||null,criteria:context.replacement_criteria||{},case_type:c.case_type},`${c.id}:search-replacement`);
      results.push({action:'SEARCH_REPLACEMENT',...queued});
    }
  }

  if (context.reschedule_start_at && c.mission_id) {
    // SUPRA V1 : une modification de planning reste une proposition en attente.
    const queued=await enqueueAction(env,c.id,'RESCHEDULE_MISSION',{mission_id:c.mission_id,start_at:context.reschedule_start_at,requires_manager:true,requires_participant_acceptance:true},`${c.id}:reschedule:${context.reschedule_start_at}`);
    results.push({action:'RESCHEDULE_MISSION',...queued,reason:'SUPRA_VALIDATION_REQUIRED'});
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
  await ensureOperationalSchema(env);
  const rows=await env.DB.prepare(`SELECT * FROM action_outbox WHERE status='PENDING' ORDER BY created_at ASC LIMIT 50`).all();
  const processed=[];
  for(const row of (rows.results||[])) {
    const payload=row.payload_json?JSON.parse(row.payload_json):{};
    // SUPRA V2 : ne jamais déclarer une action terminée sans adaptateur métier
    // qui l'a réellement exécutée et vérifiée. Aucun faux statut COMPLETED.
    const external = ['PSP_REFUND_REVIEW','NOTIFY_CLIENT','SEARCH_REPLACEMENT','RESCHEDULE_MISSION','ASSIGN_REPLACEMENT'].includes(String(row.action_type));
    const waitingStatus = external ? 'WAITING_PROVIDER' : 'WAITING_EXECUTOR';
    const reason = external
      ? 'External adapter/provider required for final execution.'
      : 'No verified business executor is registered for this action type.';
    await env.DB.prepare(`UPDATE action_outbox SET status=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(waitingStatus,reason,row.id).run();
    processed.push({id:row.id,status:waitingStatus,action_type:row.action_type,execution_verified:false});
  }
  await journal(env,'gerante',gate.auth.user.id,'ACTION_OUTBOX_PROCESSED','system',null,'OK',{count:processed.length});
  return json({ok:true,version:VERSION,processed},200);
}

async function executeOperationalCase(env, caseId, approverId=null, automatic=false) {
  // SUPRA V1 : le mode automatique est neutralisé jusqu'à validation des contrôles
  // de propriété, d'éligibilité, de disponibilité, d'idempotence et de preuve PSP.
  if (automatic) return {ok:false,error:'AUTOMATION_DISABLED_PENDING_SUPRA_GOVERNANCE'};
  const c=await env.DB.prepare('SELECT * FROM operational_cases WHERE id=? LIMIT 1').bind(caseId).first();
  if(!c)return {ok:false,error:'CASE_NOT_FOUND'};
  if(c.status==='RESOLVED')return {ok:true,already:true};
  const rec=c.proposed_solution_json?JSON.parse(c.proposed_solution_json):{};
  if(c.requires_manager && !automatic && !approverId) return {ok:false,error:'MANAGER_APPROVAL_REQUIRED'};
  const businessResults = await executeCaseBusinessAction(env,c,rec,approverId,automatic);
  const hasPendingActions=businessResults.some(item=>['PENDING','WAITING_PROVIDER'].includes(String(item.status||'')));
  const finalCaseStatus=hasPendingActions?'ACTION_PENDING':'RESOLVED';
  const resolution={executed:!hasPendingActions,execution_state:hasPendingActions?'ACTIONS_QUEUED':'COMPLETED',automatic,action:rec.action||'RESOLVE',steps:rec.solution?.steps||[],business_results:businessResults,executed_at:new Date().toISOString()};
  await env.DB.prepare(`INSERT INTO case_actions(id,case_id,action_code,mode,status,payload_json,result_json,completed_at) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),caseId,rec.action||'RESOLVE',automatic?'AUTO':'MANAGER',hasPendingActions?'PENDING':'COMPLETED',JSON.stringify(rec),JSON.stringify(resolution),hasPendingActions?null:new Date().toISOString()).run();
  await env.DB.prepare(`UPDATE operational_cases SET status=?,resolution_json=?,requires_manager=0,updated_at=CURRENT_TIMESTAMP,resolved_at=CASE WHEN ?='RESOLVED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?`).bind(finalCaseStatus,JSON.stringify(resolution),finalCaseStatus,caseId).run();
  await env.DB.prepare(`UPDATE copilot_log SET approved_by=COALESCE(?,approved_by),result=? WHERE case_id=? AND id=(SELECT id FROM copilot_log WHERE case_id=? ORDER BY created_at DESC LIMIT 1)`).bind(approverId,JSON.stringify(resolution),caseId,caseId).run();
  await journal(env,automatic?'copilot':'gerante',approverId,automatic?'AUTO_CASE_RESOLVED':(hasPendingActions?'CASE_ACTIONS_QUEUED':'CASE_RESOLVED'),'operational_case',caseId,'OK',resolution);
  return {ok:true,case_id:caseId,status:finalCaseStatus,resolution};
}

async function approveOperationalCase(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const body=await readJson(request)||{}; if(!body.case_id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const result=await executeOperationalCase(env,body.case_id,gate.auth.user.id,false);
  return json({...result,version:VERSION},result.ok?200:409);
}

async function getOperationsDashboard(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
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

function financeStrategicQuote({basePriceCents=0,phaseFactor=1,urgency='normal',evening=false,night=false,saturday=false,sunday=false,holiday=false,lastMinute=false,distanceKm=0,fuelMode='normal',commissionRate=0.20,discountCents=0,regulatedMaxCents=null,intervenantFloorCents=0,pspPercent=0,pspFixedCents=0,softwareCostCents=0,targetMarginPercent=12}={}) {
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
  const commission=Math.round(service*rate);
  let clientPrice=service+travel.total_cost_cents;
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
    psp_cost_cents:Math.round(clientPrice*(Math.max(0,Number(pspPercent)||0)/100))+Math.max(0,Math.round(Number(pspFixedCents)||0)),
    software_cost_cents:software,
    estimated_margin_cents:margin,
    target_margin_percent:Number(targetMarginPercent)||0,
    profitability_status:margin<0?'DEFICITAIRE':(margin<finalMinMargin?'MARGE_FAIBLE':'RENTABLE'),
    profitability_gate:margin>=finalMinMargin?'ALLOW':'ADJUST_OR_ESCALATE'
  };
}

function deriveMissionCalendarFlags(date, holidayDates=[]) {
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
    weekday:'short',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  const value=type=>parts.find(part=>part.type===type)?.value;
  const localDate=`${value('year')}-${value('month')}-${value('day')}`;
  const weekday=value('weekday');
  const hour=Number(value('hour'));
  return {
    localDate,
    evening:hour>=18 && hour<22,
    night:hour>=22 || hour<6,
    saturday:weekday==='Sat',
    sunday:weekday==='Sun',
    holiday:Array.isArray(holidayDates) && holidayDates.includes(localDate),
    lastMinute:date.getTime()-Date.now()<=24*60*60*1000
  };
}

async function pricingQuote(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','entreprise','intervenant']); if(gate.error)return gate.error;
  const b=await readJson(request);
  if(!b || typeof b!=='object' || Array.isArray(b)) return json({ok:false,error:'INVALID_QUOTE_INPUT',version:VERSION},400);
  const phase=String(await getSetting(env,'project_phase','TEST')).toUpperCase();
  const cfg=PROJECT_PHASES[phase];
  if(!cfg) return json({ok:false,error:'INVALID_PROJECT_PHASE',version:VERSION},409);
  const distance=Number(b.distance_km??0);
  const duration=Number(b.duration_minutes??60);
  const serviceCode=clean(b.service_code);
  const role=String(gate.auth.user.role||'').toLowerCase();
  const clientType=role==='entreprise'?'B2B':role==='gerante'?String(b.client_type||'B2C').toUpperCase():'B2C';
  if(!serviceCode || serviceCode.length>80 ||
     !Number.isFinite(distance) || distance<0 || distance>300 ||
     !Number.isInteger(duration) || duration<15 || duration>1440 ||
     !['B2C','B2B'].includes(clientType)) {
    return json({ok:false,error:'INVALID_QUOTE_INPUT',version:VERSION},400);
  }

  const catalog=await env.DB.prepare(`SELECT code,label,rules_json FROM métier_catalog WHERE code=? AND active=1 LIMIT 1`)
    .bind(serviceCode).first();
  if(!catalog) return json({ok:false,error:'ACTIVE_SERVICE_NOT_FOUND',version:VERSION},404);
  let serviceRules;
  try { serviceRules=JSON.parse(catalog.rules_json||'{}'); }
  catch { return json({ok:false,error:'SERVICE_TARIFF_CONFIGURATION_INVALID',version:VERSION},409); }
  const base=Number(serviceRules?.base_price_cents);
  if(!Number.isSafeInteger(base) || base<=0) {
    return json({ok:false,error:'SERVER_TARIFF_NOT_CONFIGURED',version:VERSION},409);
  }

  const policy=await env.DB.prepare(`SELECT * FROM pricing_policies WHERE active=1 AND phase=? AND client_type=? AND (service_code=? OR service_code IS NULL) ORDER BY CASE WHEN service_code=? THEN 0 ELSE 1 END LIMIT 1`)
    .bind(phase,clientType,serviceCode,serviceCode).first();
  const fuelMode=String(await getSetting(env,'fuel_mode','normal')).toLowerCase()==='high'?'high':'normal';
  const fuelPriceCentsPerLitre=Number(await getSetting(env,
    fuelMode==='high'?'fuel_reference_price_cents_litre_high':'fuel_reference_price_cents_litre_normal',
    fuelMode==='high'?200:175));
  const software=Number(policy?.software_cost_cents??await getSetting(env,'software_monthly_cost_cents',0));
  const pspPercent=Number(policy?.psp_percent||await getSetting(env,'psp_percent',0));
  const pspFixed=Number(policy?.psp_fixed_cents||await getSetting(env,'psp_fixed_cents',0));
  const configuredMargin=Number(policy?.target_margin_percent||0);
  const targetMargin=configuredMargin>0?configuredMargin:Number(await getSetting(env,'default_margin_percent',FINANCE_STRATEGIC.marginFloorPercent));
  const configuredCommission=Number(policy?.platform_fee_percent||0);
  const commissionRate=(configuredCommission>0?configuredCommission:FINANCE_STRATEGIC.commissionDefaultPercent)/100;
  const configuredProviderFloor=Number(policy?.intervenant_floor_cents||0);
  const intervenantFloor=Math.max(0,Math.round(configuredProviderFloor>0?configuredProviderFloor:base*0.70));
  const regulatedMax=Number(policy?.client_ceiling_cents)>0?Number(policy.client_ceiling_cents):null;
  if(phase!=='TEST' && (!policy || configuredCommission<=0 ||
     Number(policy.psp_percent)<=0 || configuredMargin<=0 ||
     configuredProviderFloor<=0)) {
    return json({ok:false,error:'NON_TEST_PRICING_POLICY_INCOMPLETE',version:VERSION},409);
  }
  const financeInputs=[fuelPriceCentsPerLitre,software,pspPercent,pspFixed,targetMargin,commissionRate,intervenantFloor];
  if(financeInputs.some(value=>!Number.isFinite(value)||value<0) ||
     fuelPriceCentsPerLitre>1000 || pspPercent>20 || pspFixed>100000 ||
     targetMargin>100 || commissionRate>1 || intervenantFloor>base*3 ||
     (regulatedMax!==null && (!Number.isSafeInteger(regulatedMax)||regulatedMax<=0))) {
    return json({ok:false,error:'SERVER_PRICING_POLICY_INVALID',version:VERSION},409);
  }
  if(regulatedMax!==null && intervenantFloor>regulatedMax) {
    return json({ok:false,error:'PRICING_POLICY_INFEASIBLE',version:VERSION},409);
  }

  let calendar={evening:false,night:false,saturday:false,sunday:false,holiday:false,lastMinute:false,localDate:null};
  if(b.scheduled_at!==undefined) {
    if(typeof b.scheduled_at!=='string' || !/(Z|[+-]\d{2}:\d{2})$/.test(b.scheduled_at)) {
      return json({ok:false,error:'SCHEDULED_AT_MUST_INCLUDE_TIMEZONE',version:VERSION},400);
    }
    const scheduledAt=new Date(b.scheduled_at);
    if(!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime()<Date.now()) {
      return json({ok:false,error:'INVALID_OR_PAST_SCHEDULED_AT',version:VERSION},400);
    }
    let holidayDates=[];
    try {
      const parsed=JSON.parse(await getSetting(env,'public_holidays_fr','[]'));
      if(Array.isArray(parsed)) holidayDates=parsed.filter(x=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
    } catch {}
    calendar=deriveMissionCalendarFlags(scheduledAt,holidayDates);
  }
  const urgency=String(b.urgency||'normal').toLowerCase();
  if(!['normal','rapid','urgent','very_urgent','immediate'].includes(urgency)) {
    return json({ok:false,error:'INVALID_URGENCY',version:VERSION},400);
  }

  const strategic=financeStrategicQuote({
    basePriceCents:base,phaseFactor:cfg.pricingFactor,urgency,
    evening:calendar.evening,night:calendar.night,saturday:calendar.saturday,
    sunday:calendar.sunday,holiday:calendar.holiday,lastMinute:calendar.lastMinute,
    distanceKm:distance,fuelMode,fuelPriceCentsPerLitre,commissionRate,
    discountCents:0,regulatedMaxCents:regulatedMax,intervenantFloorCents:intervenantFloor,
    pspPercent,pspFixedCents:pspFixed,softwareCostCents:software,targetMarginPercent:targetMargin
  });
  const quote={
    phase,clientType,serviceCode,distance,duration,scheduled_local_date:calendar.localDate,
    client_price_cents:strategic.client_price_cents,
    intervenant_amount_cents:strategic.intervenant_amount_cents,
    platform_commission_cents:strategic.commission_cents,
    psp_cost_cents:strategic.psp_cost_cents,
    software_cost_cents:strategic.software_cost_cents,
    fuel_cost_cents:strategic.travel.total_cost_cents,
    estimated_margin_cents:strategic.estimated_margin_cents,
    strategic_finance:strategic,
    assumptions:{
      tariff_source:'ACTIVE_SERVER_SERVICE_CATALOG',
      policy_source:policy?'ACTIVE_SERVER_PRICING_POLICY':'SERVER_DEFAULTS',
      calendar_source:b.scheduled_at?'EUROPE_PARIS_SERVER_DERIVED':'NOT_PROVIDED',
      promotion_discount_cents:0,
      promotion_note:'Aucune remise client n’est acceptée sans promotion validée côté serveur.',
      final_price_recalculated_at_mission_confirmation:true,
      b2b_rule:'company_pays_intervenant_platform_bills_commission',
      single_finance_engine:true
    }
  };
  await env.DB.prepare(`INSERT INTO pricing_quotes(id,phase,client_type,service_code,distance_km,duration_minutes,client_price_cents,intervenant_amount_cents,platform_commission_cents,psp_cost_cents,software_cost_cents,fuel_cost_cents,estimated_margin_cents,assumptions_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),phase,clientType,serviceCode,distance,duration,quote.client_price_cents,quote.intervenant_amount_cents,quote.platform_commission_cents,quote.psp_cost_cents,quote.software_cost_cents,quote.fuel_cost_cents,quote.estimated_margin_cents,JSON.stringify(quote.assumptions)).run();
  return json({ok:true,version:VERSION,quote},200);
}

async function financeSummary(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  // Report payment-status totals separately from a fully reconciled accounting result.
  // "paid" is a platform state; it is not proof of PSP/bank reconciliation.
  const tx=await env.DB.prepare(`SELECT COALESCE(SUM(gross_cents),0) gross,COALESCE(SUM(commission_cents),0) commission,COALESCE(SUM(provider_fee_cents),0) provider_fee,COALESCE(SUM(refund_cents),0) refunds,COALESCE(SUM(net_intervenant_cents),0) intervenant FROM payment_transactions WHERE status='paid'`).first();
  const ledger=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount_cents ELSE -amount_cents END),0) balance FROM accounting_ledger`).first();
  const expenses=await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents),0) total FROM business_expenses`).first();
  const pending=await env.DB.prepare(`SELECT COALESCE(SUM(gross_cents),0) total,COUNT(*) n FROM payment_transactions WHERE status IN ('pending','processing','held')`).first();
  const paid=await env.DB.prepare(`SELECT COALESCE(SUM(gross_cents),0) total,COUNT(*) n FROM payment_transactions WHERE status='paid'`).first();
  const payouts=await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents),0) total,COUNT(*) n FROM payout_requests WHERE status IN ('requested','processing')`).first();
  const disputed=await env.DB.prepare(`SELECT COALESCE(SUM(amount_cents),0) total,COUNT(*) n FROM payment_disputes WHERE status IN ('open','pending')`).first().catch(()=>null);
  return json({ok:true,version:VERSION,finance:{gross_cents:Number(tx?.gross||0),commission_cents:Number(tx?.commission||0),provider_fee_cents:Number(tx?.provider_fee||0),refund_cents:Number(tx?.refunds||0),intervenant_cents:Number(tx?.intervenant||0),ledger_balance_cents:Number(ledger?.balance||0),expenses_cents:Number(expenses?.total||0),net_estimate_cents:null,net_profit_available:false,net_profit_reason:'PSP_AND_ACCOUNTING_RECONCILIATION_AND_FULL_COST_ALLOCATION_REQUIRED',paid_status_is_reconciled:false,pending_cents:Number(pending?.total||0),pending_transactions:Number(pending?.n||0),paid_cents:Number(paid?.total||0),paid_transactions:Number(paid?.n||0),payouts_pending_cents:Number(payouts?.total||0),payouts_pending:Number(payouts?.n||0),disputed_cents:Number(disputed?.total||0),disputes_pending:Number(disputed?.n||0)},models:{B2C:'client -> PROCHÉLIA -> intervenant',B2B:'société -> intervenant ; PROCHÉLIA facture sa commission/service'},finance_core_version:FINANCE_STRATEGIC_VERSION});
}

async function complaintCreate(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','entreprise']); if(gate.error)return gate.error;
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

async function supraDomains(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  return json({ok:true,version:VERSION,engine:'PROCHELIA_SUPRA_ORCHESTRATOR_V2',domains:procheliaV7.getSupraDomainRegistry()},200);
}

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function supraPlan(request, env) {
  // Le plan de pilotage transversal expose des informations stratégiques : Gérante uniquement.
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  if(request.method!=='POST') return json({ok:false,error:'METHOD_NOT_ALLOWED',version:VERSION},405,{'allow':'POST'});
  // Enforce the limit while streaming; do not buffer an attacker-sized body first.
  const reader=request.body?.getReader();
  const decoder=new TextDecoder();
  let rawBody='';
  let receivedBytes=0;
  if(reader) {
    while(true) {
      const chunk=await reader.read();
      if(chunk.done) break;
      receivedBytes+=chunk.value.byteLength;
      if(receivedBytes>16384) {
        await reader.cancel().catch(()=>{});
        return json({ok:false,error:'REQUEST_TOO_LARGE',version:VERSION},413);
      }
      rawBody+=decoder.decode(chunk.value,{stream:true});
    }
    rawBody+=decoder.decode();
  }
  let body;
  try { body=JSON.parse(rawBody); }
  catch { return json({ok:false,error:'INVALID_JSON'},400); }
  if(!isPlainRecord(body)) return json({ok:false,error:'INVALID_JSON_OBJECT',version:VERSION},400);
  const allowedBodyKeys=new Set(['case_type','domain','action','impact','market','context','evidence']);
  if(Object.keys(body).some(key=>!allowedBodyKeys.has(key))) {
    return json({ok:false,error:'UNEXPECTED_SUPRA_PLAN_FIELD',version:VERSION},400);
  }
  for(const key of ['case_type','domain','action','impact','market']) {
    if(body[key]!==undefined && typeof body[key]!=='string') {
      return json({ok:false,error:'INVALID_SUPRA_PLAN_FIELD_TYPE',field:key,version:VERSION},400);
    }
  }
  const caseType=body.case_type===undefined?'analyse_generale':body.case_type.trim();
  const domain=body.domain===undefined?undefined:body.domain.trim();
  const action=body.action===undefined?'ANALYZE_AND_PROPOSE':body.action.trim().toUpperCase();
  const impact=body.impact===undefined?'LOW':body.impact.trim().toUpperCase();
  const market=body.market===undefined?'fr':body.market.trim().toLowerCase();
  if(!caseType || caseType.length>100 || !/^[A-Z0-9_]{2,64}$/.test(action) ||
     !['LOW','MEDIUM','HIGH','CRITICAL'].includes(impact) ||
     !(market === "other" || /^[a-z]{2}$/.test(market)) ||
     (domain!==undefined && (!domain || domain.length>60)) ||
     (body.context!==undefined && !isPlainRecord(body.context))) {
    return json({ok:false,error:'INVALID_SUPRA_PLAN_INPUT',version:VERSION},400);
  }
  if(body.evidence!==undefined) return json({ok:false,error:'CLIENT_SUPPLIED_EVIDENCE_NOT_TRUSTED',version:VERSION},400);
  const context=body.context||{};
  // The request body is never a source of trusted evidence. Governance remains fail-closed
  // until server-side adapters independently verify ownership, eligibility and PSP state.
  const plan=procheliaV7.buildSupraPlan({
    caseType,domain,impact,requestedAction:action,market,context
  });
  const governance=procheliaV7.assessSupraDecision({
    caseType:plan.caseType,impact:plan.impact,requestedAction:plan.requestedAction,
    actorRole:gate.auth.user.role,context
  });
  const missingEvidence=[...new Set([...(plan.missingEvidence||[]),...(governance.missingEvidence||[])])];
  return json({
    ok:true,version:VERSION,plan:{
      ...plan,
      missingEvidence,
      executionAllowed:false,
      autonomy:{...plan.autonomy,executionAdapterReady:false}
    },
    governance
  },200);
}

async function handleConsolidated(request, env) {
  const url=new URL(request.url);
  const consolidatedPath = ['/api/consolidated/info','/api/ops/dashboard','/api/journal','/api/cases','/api/cases/approve','/api/metiers','/api/metiers/suggest','/api/pricing/quote','/api/finance/summary','/api/complaints','/api/settings/phase'].includes(url.pathname);
  if (consolidatedPath) {
    try { await ensureConsolidatedSchema(env); } catch (e) { return json({ok:false,error:'CONSOLIDATED_SCHEMA_ERROR',version:VERSION,message:e.message},500); }
  }
  if(url.pathname==='/api/consolidated/info' && request.method==='GET') return consolidatedInfo(env);
  if(url.pathname==='/api/supra/domains' && request.method==='GET') return supraDomains(request,env);
  if(url.pathname==='/api/supra/plan' && request.method==='POST') return supraPlan(request,env);
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
  await ensureStrategicSchema(env);

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
  await ensureStrategicSchema(env);

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
  await ensureStrategicSchema(env);
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
  await ensureStrategicSchema(env);
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
  await ensureStrategicSchema(env);

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

  if (strategicPaths.includes(url.pathname)) {
    try { await ensureStrategicSchema(env); }
    catch (e) { return json({ok:false,error:'STRATEGIC_SCHEMA_ERROR',version:VERSION,message:e.message},500); }
  }

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

async function executeQueuedAction(env, action) {
  if (!action) return {ok:false,error:'ACTION_NOT_FOUND'};
  const payload = JSON.parse(action.payload_json||'{}');
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
          result={performed:true,channel,notification_queued:true};
        } else result={performed:false,reason:'NOTIFICATION_SCHEMA_INCOMPATIBLE'};
      } else result={performed:false,reason:'NOTIFICATION_TABLE_MISSING'};
    } else if (action.action_type === 'RESCHEDULE_MISSION') {
      result = await dynamicUpdate(env,'missions',action.entity_id,{scheduled_at:payload.scheduled_at,date:payload.date,time:payload.time,status:payload.status||'RESCHEDULED'});
      result.action='RESCHEDULE_MISSION';
    } else if (action.action_type === 'ASSIGN_REPLACEMENT') {
      result = await dynamicUpdate(env,'missions',action.entity_id,{intervenant_id:payload.intervenant_id,assigned_intervenant_id:payload.intervenant_id,status:payload.status||'ASSIGNED'});
      result.action='ASSIGN_REPLACEMENT';
    } else if (action.action_type === 'REFUND') {
      result={performed:false,requires_provider:true,reason:'PSP_EXECUTION_REQUIRED',payload};
    } else if (action.action_type === 'PAYOUT') {
      result={performed:false,requires_provider:true,reason:'PSP_EXECUTION_REQUIRED',payload};
    } else if (action.action_type === 'ACCOUNTING_ENTRY') {
      // A single unbalanced line is never accepted as a complete accounting
      // operation. Until the paired-entry writer and reconciliation workflow
      // are invoked, keep this action pending for a reviewed accounting batch.
      result={performed:false,requires_accounting_batch:true,reason:'BALANCED_DOUBLE_ENTRY_REQUIRED',
        reference_type:action.entity_type||null,reference_id:action.entity_id||null};
    } else result={performed:false,reason:'ACTION_TYPE_NOT_IMPLEMENTED'};

    const finalStatus = result.performed ? 'DONE' : (result.requires_provider ? 'WAITING_PROVIDER' : (result.requires_accounting_batch ? 'WAITING_ACCOUNTING_BATCH' : 'FAILED'));
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
  await ensureConsolidatedSchema(env); await ensureOperationalSchema(env);
  const b=await readJson(request)||{};
  if(!b.case_id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const c=await env.DB.prepare('SELECT * FROM operational_cases WHERE id=? LIMIT 1').bind(b.case_id).first();
  if(!c)return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  const solution=JSON.parse(c.proposed_solution_json||'{}');
  const actions=Array.isArray(b.actions)?b.actions:(Array.isArray(solution.actions)?solution.actions:[]);
  if(!actions.length)return json({ok:false,error:'NO_ACTIONS_DEFINED',version:VERSION},400);
  const results=[];
  for(const a of actions){
    const q=await queueAction(env,a.action_type||a.type,c.mission_id?'MISSION':'CASE',a.entity_id||c.mission_id,{...a},a.idempotency_key);
    results.push(await executeQueuedAction(env,q));
  }
  const allDone=results.every(x=>x.ok && ['DONE'].includes(x.status));
  await env.DB.prepare(`UPDATE operational_cases SET status=?,resolution_json=?,updated_at=CURRENT_TIMESTAMP,resolved_at=? WHERE id=?`)
    .bind(allDone?'RESOLVED':'IN_PROGRESS',JSON.stringify({approved_by:gate.auth.user.id,results}),allDone?new Date().toISOString():null,c.id).run();
  await journal(env,'gerante',gate.auth.user.id,'CASE_EXECUTED','operational_case',c.id,allDone?'OK':'PARTIAL',{results});
  return json({ok:true,version:VERSION,case_id:c.id,status:allDone?'RESOLVED':'IN_PROGRESS',results});
}

async function scoreClients(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureStrategicSchema(env); await ensureOperationalSchema(env);
  const rows=[];
  if(await tableExists(env,'payment_transactions')){
    const r=await env.DB.prepare(`SELECT client_id,COUNT(*) tx_count,COALESCE(SUM(gross_cents),0) gross,MAX(created_at) last_activity FROM payment_transactions WHERE client_id IS NOT NULL GROUP BY client_id LIMIT 1000`).all();
    for(const x of (r.results||[])){
      const gross=Number(x.gross||0), count=Number(x.tx_count||0);
      const score=Math.min(100,Math.round(count*10+gross/10000));
      const churn=Math.max(0,Math.min(100,100-score));
      const segment=score>=70?'VIP':score>=40?'ACTIVE':'STANDARD';
      const action=churn>=70?'REACTIVATE':score>=70?'FIDELIZE':'MAINTAIN';
      const id=crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO client_value_scores(id,client_id,company_id,segment,score,churn_risk,lifetime_value_cents,last_activity_at,next_best_action) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(client_id,company_id) DO UPDATE SET segment=excluded.segment,score=excluded.score,churn_risk=excluded.churn_risk,lifetime_value_cents=excluded.lifetime_value_cents,last_activity_at=excluded.last_activity_at,next_best_action=excluded.next_best_action,updated_at=CURRENT_TIMESTAMP`)
        .bind(id,x.client_id,null,segment,score,churn,gross,x.last_activity,action).run();
      rows.push({client_id:x.client_id,score,churn_risk:churn,segment,next_best_action:action});
    }
  }
  return json({ok:true,version:VERSION,scored:rows.length,clients:rows});
}

async function loyaltyUpdate(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureOperationalSchema(env);
  const b=await readJson(request)||{}; if(!b.client_id&&!b.company_id)return json({ok:false,error:'CLIENT_OR_COMPANY_REQUIRED',version:VERSION},400);
  const points=Math.max(-100000,Math.min(100000,Number(b.points||0)));
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO loyalty_events(id,client_id,company_id,event_type,points,amount_cents,metadata_json) VALUES(?,?,?,?,?,?,?)`)
    .bind(id,b.client_id||null,b.company_id||null,b.event_type||'MANUAL',points,Number(b.amount_cents||0),JSON.stringify(b)).run();
  const existing=await env.DB.prepare('SELECT * FROM loyalty_balances WHERE client_id IS ? AND company_id IS ? LIMIT 1').bind(b.client_id||null,b.company_id||null).first();
  const total=Number(existing?.points||0)+points;
  const tier=total>=1000?'PLATINUM':total>=500?'GOLD':total>=200?'SILVER':'STANDARD';
  if(existing) await env.DB.prepare(`UPDATE loyalty_balances SET points=?,tier=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(total,tier,existing.id).run();
  else await env.DB.prepare(`INSERT INTO loyalty_balances(id,client_id,company_id,points,tier) VALUES(?,?,?,?,?)`).bind(crypto.randomUUID(),b.client_id||null,b.company_id||null,total,tier).run();
  await journal(env,'gerante',gate.auth.user.id,'LOYALTY_UPDATED','client',b.client_id||b.company_id,'OK',{points,tier});
  return json({ok:true,version:VERSION,points:total,tier});
}

async function qualityCreate(request, env) {
  const gate=await requireAuthRole(request,env,['gerante','client','entreprise']); if(gate.error)return gate.error;
  await ensureOperationalSchema(env); const b=await readJson(request)||{};
  if(!b.mission_id)return json({ok:false,error:'MISSION_ID_REQUIRED',version:VERSION},400);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO quality_events(id,mission_id,client_id,company_id,intervenant_id,rating,category,comment,severity,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,b.mission_id,b.client_id||null,b.company_id||null,b.intervenant_id||null,b.rating==null?null:Number(b.rating),b.category||'GENERAL',b.comment||'',b.severity||'LOW',JSON.stringify(b)).run();
  return json({ok:true,version:VERSION,id});
}

async function capacityDashboard(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureOperationalSchema(env);
  let missions=0, available=0;
  if(await tableExists(env,'missions')) { const r=await env.DB.prepare(`SELECT COUNT(*) n FROM missions WHERE date(created_at)>=date('now','-7 day')`).first(); missions=Number(r?.n||0); }
  if(await tableExists(env,'users')) { const r=await env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE role IN ('intervenant','aide_soignant','infirmier') AND status IN ('ACTIVE','active')`).first(); available=Number(r?.n||0); }
  const utilization=available?Math.min(100,Math.round(missions/Math.max(1,available*7)*100)):0;
  const recommendation=utilization<50?'ACTIVER_PROMOTIONS_CAPACITE':utilization>90?'RENFORCER_RECRUTEMENT':'MAINTENIR';
  await env.DB.prepare(`INSERT INTO capacity_snapshots(id,snapshot_date,demand_count,supply_count,fill_rate,unused_capacity,recommendation) VALUES(?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),new Date().toISOString().slice(0,10),missions,available,utilization,Math.max(0,100-utilization),recommendation).run();
  return json({ok:true,version:VERSION,missions_last_7_days:missions,active_intervenants:available,utilization_percent:utilization,recommendation});
}

async function financeForecast(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const months=Math.max(1,Math.min(12,Number((await readJson(request)||{}).months||3)));
  const tx=await env.DB.prepare(`SELECT COALESCE(SUM(gross_cents),0) gross,COALESCE(SUM(commission_cents),0) commission,COALESCE(SUM(provider_fee_cents),0) provider_fee,COALESCE(SUM(refund_cents),0) refunds,COALESCE(SUM(net_intervenant_cents),0) intervenant FROM payment_transactions WHERE created_at>=datetime('now','-90 day')`).first();
  const base=Number(tx?.gross||0)/3;
  const rows=[];
  for(let i=1;i<=months;i++){
    const revenue=Math.round(base*(1+0.03*i));
    const commission=Math.round(Number(tx?.commission||0)/3*(1+0.03*i));
    const payout=Math.round(Number(tx?.intervenant||0)/3*(1+0.03*i));
    const provider=Math.round(Number(tx?.provider_fee||0)/3*(1+0.03*i));
    const refunds=Math.round(Number(tx?.refunds||0)/3*(1+0.03*i));
    const margin=revenue-commission*0+payout*-1+commission-provider-refunds;
    const period=new Date(); period.setMonth(period.getMonth()+i); const key=period.toISOString().slice(0,7);
    await env.DB.prepare(`INSERT INTO finance_forecasts(id,period,scenario,revenue_cents,commission_cents,payout_cents,provider_fee_cents,refund_cents,estimated_margin_cents,confidence) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),key,'BASE',revenue,commission,payout,provider,refunds,margin,0.55).run();
    rows.push({period:key,revenue_cents:revenue,commission_cents:commission,payout_cents:payout,provider_fee_cents:provider,refund_cents:refunds,estimated_margin_cents:margin,confidence:0.55});
  }
  return json({ok:true,version:VERSION,method:'rolling_90_day_projection',rows});
}

async function copilotBriefing(request, env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureConsolidatedSchema(env); await ensureStrategicSchema(env); await ensureOperationalSchema(env);
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
  await ensureOperationalSchema(env);
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
  if(operationalPaths.includes(url.pathname)){
    try{await ensureOperationalSchema(env);}catch(e){return json({ok:false,error:'OPERATIONAL_SCHEMA_ERROR',version:VERSION,message:e.message},500);}
  }
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

async function productionConfigCheck(env) {
  await ensureConsolidatedSchema(env); await ensurePaymentSchema(env); await ensureOperationalSchema(env); await ensureStrategicSchema(env); await ensureFinalHardeningSchema(env);
  const checks=[];
  const requiredTables=['users','sessions','missions','payment_transactions','payment_webhook_events','payment_disputes','operational_cases','action_outbox','notification_outbox','accounting_ledger','promotions','promotion_recommendations','activity_journal','compliance_events'];
  for(const t of requiredTables) checks.push({code:`TABLE:${t}`,status:await tableExists(env,t)?'OK':'MISSING'});
  const pspRequired=['PAYMENT_PROVIDER','PAYMENT_WEBHOOK_SECRET'];
  for(const k of pspRequired) checks.push({code:`SECRET:${k}`,status:finalSecretConfigured(env,k)?'OK':'NOT_CONFIGURED'});
  checks.push({code:'BOOTSTRAP_TOKEN',status:finalSecretConfigured(env,'BOOTSTRAP_TOKEN')?'OK':'NOT_CONFIGURED'});
  const paymentCols=await tableColumns(env,'payment_transactions');
  const requiredPaymentCols=['id','idempotency_key','mission_id','client_id','intervenant_id','gross_cents','commission_cents','provider_fee_cents','refund_cents','net_intervenant_cents','status','provider_payment_id'];
  checks.push({code:'PAYMENT_COLUMNS',status:requiredPaymentCols.every(x=>paymentCols.includes(x))?'OK':'INCOMPLETE',missing:requiredPaymentCols.filter(x=>!paymentCols.includes(x))});
  const missionCols=await tableColumns(env,'missions');
  const usefulMissionCols=['id','client_id','intervenant_id'];
  checks.push({code:'MISSION_CORE_COLUMNS',status:usefulMissionCols.every(x=>missionCols.includes(x))?'OK':'INCOMPLETE',missing:usefulMissionCols.filter(x=>!missionCols.includes(x))});
  await registerIntegration(env,'PSP','PAYMENT',['PAYMENT_PROVIDER','PAYMENT_WEBHOOK_SECRET'],['charge','refund','payout','webhook','reconciliation'],finalSecretConfigured(env,'PAYMENT_PROVIDER')&&finalSecretConfigured(env,'PAYMENT_WEBHOOK_SECRET')?'CONFIGURED':'NOT_CONFIGURED');
  await registerIntegration(env,'NOTIFICATIONS','MESSAGING',['NOTIFICATION_PROVIDER'],['email','sms','push'],finalSecretConfigured(env,'NOTIFICATION_PROVIDER')?'CONFIGURED':'NOT_CONFIGURED');
  await registerIntegration(env,'MAPS','LOCATION',['MAPS_PROVIDER','MAPS_API_KEY'],['distance','geocoding','routing'],finalSecretConfigured(env,'MAPS_API_KEY')?'CONFIGURED':'NOT_CONFIGURED');
  await registerIntegration(env,'MARKET_DATA','COMMERCIAL',['MARKET_DATA_PROVIDER'],['market_prices','competitor_signals'],finalSecretConfigured(env,'MARKET_DATA_PROVIDER')?'CONFIGURED':'NOT_CONFIGURED');
  const blocking=checks.filter(x=>['MISSING','INCOMPLETE'].includes(x.status));
  const externalNotConfigured=checks.filter(x=>x.status==='NOT_CONFIGURED' && ['SECRET:PAYMENT_PROVIDER','SECRET:PAYMENT_WEBHOOK_SECRET'].includes(x.code));
  const overall=blocking.length===0 && externalNotConfigured.length===0;
  for(const c of checks) await env.DB.prepare(`INSERT INTO system_config_checks(id,check_code,status,details_json) VALUES(?,?,?,?)`).bind(crypto.randomUUID(),c.code,c.status,JSON.stringify(c)).run();
  return {overall,checks,blocking:blocking.length,externalNotConfigured:externalNotConfigured.length};
}

async function finalProductionAudit(request,env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  const result=await productionConfigCheck(env);
  await journal(env,'gerante',gate.auth.user.id,'FINAL_PRODUCTION_AUDIT','system',null,result.overall?'OK':'ATTENTION',{blocking:result.blocking,externalNotConfigured:result.externalNotConfigured});
  return json({ok:true,version:VERSION,production_gate:result.overall?'OPEN':'CLOSED',ready_for_real_traffic:result.overall,checks:result.checks,note:result.overall?'Architecture gate passed; external business integrations must still be exercised with sandbox/acceptance tests.':'No real production traffic should be enabled until blocking configuration/schema checks are resolved.'});
}

async function copilotNextActions(request,env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureConsolidatedSchema(env); await ensureOperationalSchema(env); await ensureStrategicSchema(env); await ensureFinalHardeningSchema(env);
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
  await ensureFinalHardeningSchema(env);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO background_jobs(id,job_type,payload_json,max_attempts) VALUES(?,?,?,?)`).bind(id,jobType,JSON.stringify(payload),maxAttempts).run();
  return id;
}

async function processBackgroundJobs(request,env) {
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureFinalHardeningSchema(env); await ensureOperationalSchema(env);
  const rows=await env.DB.prepare(`SELECT * FROM background_jobs WHERE status='PENDING' AND run_after<=CURRENT_TIMESTAMP ORDER BY created_at LIMIT 25`).all();
  const results=[];
  for(const job of rows.results||[]) {
    try {
      await env.DB.prepare(`UPDATE background_jobs SET status='RUNNING',locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'`).bind(job.id).run();
      let result={performed:false,reason:'JOB_TYPE_NOT_IMPLEMENTED'};
      const payload=JSON.parse(job.payload_json||'{}');
      if(job.job_type==='PROCESS_ACTION_OUTBOX') result={performed:true,delegation:'Use /api/ops/outbox/process'};
      else if(job.job_type==='PRODUCTION_AUDIT') result=await productionConfigCheck(env);
      else if(job.job_type==='COPILOT_BRIEFING') result={performed:true,delegation:'Use /api/copilot/briefing'};
      const done=result.performed===true || result.overall===true;
      await env.DB.prepare(`UPDATE background_jobs SET status=?,result_json=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP,completed_at=? WHERE id=?`)
        .bind(done?'DONE':'WAITING_PROVIDER',JSON.stringify(result),done?new Date().toISOString():null,job.id).run();
      results.push({id:job.id,status:done?'DONE':'WAITING_PROVIDER',result});
    } catch(e) {
      const attempts=Number(job.attempts||0)+1;
      const status=attempts>=Number(job.max_attempts||5)?'FAILED':'PENDING';
      await env.DB.prepare(`UPDATE background_jobs SET status=?,attempts=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,attempts,String(e.message||e),job.id).run();
      results.push({id:job.id,status,error:String(e.message||e)});
    }
  }
  await journal(env,'gerante',gate.auth.user.id,'BACKGROUND_JOBS_PROCESSED','system',null,'OK',{count:results.length});
  return json({ok:true,version:VERSION,processed:results.length,results});
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
  await ensureCommercialRecruitmentSchema(env); const b=await readJson(request);
  const id=crypto.randomUUID(); const kind=String(b?.kind||'B2B').toUpperCase();
  const score=Math.max(0,Math.min(100,Number(b?.score||0)||0));
  await env.DB.prepare(`INSERT INTO commercial_prospects(id,kind,company_name,contact_name,email,phone,website,sector,city,postal_code,source,need,estimated_potential_cents,score,next_action,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,kind,clean(b?.company_name)||null,clean(b?.contact_name)||null,normalizeEmail(b?.email)||null,clean(b?.phone)||null,clean(b?.website)||null,clean(b?.sector)||null,clean(b?.city)||null,clean(b?.postal_code)||null,clean(b?.source)||'COPILOTE',clean(b?.need)||null,Number.isFinite(Number(b?.estimated_potential_cents))?Math.max(0,Math.round(Number(b.estimated_potential_cents))):null,score,clean(b?.next_action)||'PREMIER_CONTACT',clean(b?.notes)||null).run();
  await journal(env,'gerante',gate.auth.user.id,'PROSPECT_CREATED','commercial_prospect',id,'OK',{kind,score});
  return json({ok:true,version:VERSION,prospect_id:id,score,next_action:clean(b?.next_action)||'PREMIER_CONTACT'},201);
}

async function commercialProspectSheet(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureCommercialRecruitmentSchema(env); const b=await readJson(request);
  const kit=makeSalesKit(b); const id=clean(b?.prospect_id)||null;
  let prospect=null; if(id) prospect=await env.DB.prepare('SELECT * FROM commercial_prospects WHERE id=? LIMIT 1').bind(id).first();
  const p=prospect||b; const potential=Number(p?.estimated_potential_cents||0);
  const sheet={ok:true,version:VERSION,prospect:prospect||null,kit,commercial_priority:potential>0?Math.min(100,Math.round((potential/100000)*20)+Number(p?.score||0)):Number(p?.score||0),recommended_next_action:kit.stage==='FIRST_CONTACT'?'CONTACTER':kit.stage==='FOLLOW_UP'?'RELANCER':'PREPARER_RENDEZ_VOUS'};
  await journal(env,'copilot',gate.auth.user.id,'PROSPECTION_SHEET_GENERATED','commercial_prospect',id,'OK',{stage:kit.stage,target:kit.target_type});
  return json(sheet,200);
}

async function commercialPlaybook(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureCommercialRecruitmentSchema(env); const b=await readJson(request); const kit=makeSalesKit(b); const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO commercial_playbooks(id,target_type,stage,objective,script,objections_json,followup_json,metadata_json) VALUES(?,?,?,?,?,?,?,?)`).bind(id,kit.target_type,kit.stage,kit.objective,kit.opening,JSON.stringify(kit.objections),JSON.stringify(kit.followups),JSON.stringify({benefits:kit.benefits,questions:kit.questions,closing:kit.closing})).run();
  return json({ok:true,version:VERSION,playbook_id:id,playbook:kit},201);
}

async function recruitmentCandidateCreate(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureCommercialRecruitmentSchema(env); const b=await readJson(request); const id=crypto.randomUUID();
  const qualifications=Array.isArray(b?.qualifications)?b.qualifications:[];
  const score=Math.max(0,Math.min(100,Number(b?.score||0)||0));
  await env.DB.prepare(`INSERT INTO recruitment_candidates(id,full_name,email,phone,metier_code,city,radius_km,qualifications_json,score,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,clean(b?.full_name)||null,normalizeEmail(b?.email)||null,clean(b?.phone)||null,clean(b?.metier_code)||null,clean(b?.city)||null,Number.isFinite(Number(b?.radius_km))?Number(b.radius_km):null,JSON.stringify(qualifications),score,clean(b?.notes)||null).run();
  await env.DB.prepare(`INSERT INTO recruitment_tasks(id,candidate_id,metier_code,status,step,priority,notes) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,clean(b?.metier_code)||null,'OPEN','SCREENING',Math.max(10,score),`Qualifier ${clean(b?.full_name)||'le candidat'} puis vérifier identité, qualifications et documents.`).run();
  await journal(env,'gerante',gate.auth.user.id,'RECRUITMENT_CANDIDATE_CREATED','recruitment_candidate',id,'OK',{score});
  return json({ok:true,version:VERSION,candidate_id:id,score,next_step:'SCREENING_AND_DOCUMENT_CHECK'},201);
}

async function recruitmentSheet(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureCommercialRecruitmentSchema(env); const b=await readJson(request);
  const target=clean(b?.metier_code)||'METIER_A_DEFINIR'; const zone=clean(b?.city)||'zone à définir';
  const intro=`PROCHÉLIA recherche des intervenants pour renforcer sa capacité dans ${zone}. Le rôle consiste à réaliser les missions correspondant à votre métier, dans un cadre organisé, avec suivi des documents, des missions et des paiements.`;
  const objections=[{objection:'« Je veux comprendre le fonctionnement avant de m’inscrire. »',answer:'« C’est normal. Nous vous expliquons d’abord le parcours, les documents requis, les règles de mission et le fonctionnement des paiements avant toute activation. »'},{objection:'« Est-ce que je suis obligé d’accepter toutes les missions ? »',answer:'« Les règles exactes dépendent du cadre contractuel et du fonctionnement de la plateforme ; elles sont présentées clairement avant l’activation. »'}];
  return json({ok:true,version:VERSION,recruitment_sheet:{metier_code:target,zone,introduction:intro,profile_recherche:['identité vérifiable','qualifications/documents applicables','disponibilités','secteur géographique','fiabilité et qualité de service'],questions:['Quel est votre métier et votre expérience ?','Dans quelle zone intervenez-vous ?','Quelles sont vos disponibilités ?','Quels types de missions recherchez-vous ?'],objections,closing:'« Si le fonctionnement vous convient, nous pouvons passer à l’étape de vérification et d’intégration. »',compliance_note:'Aucune promesse d’embauche ou d’habilitation n’est faite automatiquement ; les vérifications requises restent nécessaires.'}},200);
}

async function growthDashboard(request,env){
  const gate=await requireAuthRole(request,env,['gerante']); if(gate.error)return gate.error;
  await ensureCommercialRecruitmentSchema(env); await ensureConsolidatedSchema(env);
  const p=await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(AVG(score),0) avg_score FROM commercial_prospects WHERE status='OPEN'`).first();
  const r=await env.DB.prepare(`SELECT COUNT(*) n, COALESCE(AVG(score),0) avg_score FROM recruitment_candidates WHERE status='OPEN'`).first();
  const ct=await env.DB.prepare(`SELECT COUNT(*) n FROM commercial_tasks WHERE status='OPEN'`).first();
  const rt=await env.DB.prepare(`SELECT COUNT(*) n FROM recruitment_tasks WHERE status='OPEN'`).first();
  const top=await env.DB.prepare(`SELECT id,kind,company_name,contact_name,sector,city,score,next_action FROM commercial_prospects WHERE status='OPEN' ORDER BY score DESC,updated_at DESC LIMIT 10`).all();
  const cand=await env.DB.prepare(`SELECT id,full_name,metier_code,city,score,stage FROM recruitment_candidates WHERE status='OPEN' ORDER BY score DESC,updated_at DESC LIMIT 10`).all();
  return json({ok:true,version:VERSION,growth_dashboard:{commercial:{prospects_open:Number(p?.n||0),average_score:Number(p?.avg_score||0),tasks_open:Number(ct?.n||0),top_prospects:top.results||[]},recruitment:{candidates_open:Number(r?.n||0),average_score:Number(r?.avg_score||0),tasks_open:Number(rt?.n||0),top_candidates:cand.results||[]},principle:'Prioriser les actions qui augmentent le chiffre d’affaires et la marge sans dégrader la qualité, la conformité ou la rémunération des intervenants.'}},200);
}


/* ==================== V14.0.0 — COMPTABILITÉ MULTI-ESPACE / EXPORTS / RÉSOLUTION ==================== */
async function ensureFinanceWorkspaceSchema(env) {
  if (!env.DB) throw new Error('DATABASE_REQUIRED');
  const sql = [
    `CREATE TABLE IF NOT EXISTS finance_workspace_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'IN',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      label TEXT,
      reference_type TEXT,
      reference_id TEXT,
      status TEXT NOT NULL DEFAULT 'posted',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_finance_workspace_user ON finance_workspace_entries(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_finance_workspace_ref ON finance_workspace_entries(reference_type, reference_id)`,
    `CREATE TABLE IF NOT EXISTS finance_export_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      format TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      row_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_finance_export_user ON finance_export_log(user_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS finance_resolution_cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      severity TEXT NOT NULL DEFAULT 'LOW',
      description TEXT,
      proposed_solution TEXT,
      resolution TEXT,
      amount_cents INTEGER,
      reference_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_finance_resolution_user ON finance_resolution_cases(user_id, status, created_at DESC)`
  ];
  for (const q of sql) await env.DB.prepare(q).run();
}

function financeRoleAllowed(role) {
  return ['CLIENT','CLIENT_SOCIAL','SOCIETE','COMPANY','INTERVENANT','GERANTE','ADMIN','FINANCE','SUPPORT'].includes(String(role||'').toUpperCase());
}

async function financeAuth(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth) return { response: json({ok:false,error:'UNAUTHENTICATED',version:VERSION},401) };
  if (!financeRoleAllowed(auth.user.role)) return { response: json({ok:false,error:'FORBIDDEN',version:VERSION},403) };
  await ensureFinanceWorkspaceSchema(env);
  return { auth };
}

function financeMoney(cents) {
  return Number(cents || 0) / 100;
}

function financeIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function financeRowsForUser(env, user) {
  const role = String(user.role||'').toUpperCase();
  const uid = user.id;
  const params = [];
  let where = '';
  if (['GERANTE','ADMIN','FINANCE'].includes(role)) {
    where = '1=1';
  } else if (role === 'INTERVENANT') {
    where = 'intervenant_id=?'; params.push(uid);
  } else {
    where = 'client_id=?'; params.push(uid);
  }

  let payments = [];
  try {
    const r = await env.DB.prepare(
      `SELECT id,mission_id,client_id,intervenant_id,type,status,gross_cents,commission_cents,
              provider_fee_cents,refund_cents,net_intervenant_cents,currency,provider,
              provider_payment_id,provider_payout_id,reason,created_at,updated_at
         FROM payment_transactions WHERE ${where}
        ORDER BY created_at DESC LIMIT 5000`
    ).bind(...params).all();
    payments = r.results || [];
  } catch (_) {}

  let ledger = [];
  try {
    if (['GERANTE','ADMIN','FINANCE'].includes(role)) {
      const r = await env.DB.prepare(
        `SELECT id,entry_type,direction,amount_cents,currency,label,reference_type,reference_id,status,created_at
           FROM finance_workspace_entries ORDER BY created_at DESC LIMIT 5000`
      ).all();
      ledger = r.results || [];
    } else {
      const r = await env.DB.prepare(
        `SELECT id,entry_type,direction,amount_cents,currency,label,reference_type,reference_id,status,created_at
           FROM finance_workspace_entries WHERE user_id=? ORDER BY created_at DESC LIMIT 5000`
      ).bind(uid).all();
      ledger = r.results || [];
    }
  } catch (_) {}

  let payouts=[];
  try {
    const q = ['GERANTE','ADMIN','FINANCE'].includes(role)
      ? env.DB.prepare(`SELECT id,user_id,amount_cents,currency,mode,status,provider,provider_payout_id,failure_code,requested_at,completed_at FROM payout_requests ORDER BY requested_at DESC LIMIT 5000`)
      : env.DB.prepare(`SELECT id,user_id,amount_cents,currency,mode,status,provider,provider_payout_id,failure_code,requested_at,completed_at FROM payout_requests WHERE user_id=? ORDER BY requested_at DESC LIMIT 5000`).bind(uid);
    const r=await q.all(); payouts=r.results||[];
  } catch (_) {}
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
  const {auth}=a, rows=await financeRowsForUser(env,auth.user), summary=financeSummaryFromRows(rows,auth.user);
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
  const {auth}=a, url=new URL(request.url);
  const format=String(url.searchParams.get('format')||'csv').toLowerCase();
  const start=url.searchParams.get('from'), end=url.searchParams.get('to');
  const rows=await financeRowsForUser(env,auth.user);
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
  await env.DB.prepare(`INSERT INTO finance_export_log(id,user_id,role,format,period_start,period_end,row_count) VALUES(?,?,?,?,?,?,?)`)
    .bind(id,auth.user.id,auth.user.role,format,start,end,data.length).run();
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
  const {auth}=a, b=await readJson(request)||{};
  const amount=Math.round(Number(b.amount_eur)*100);
  if(!Number.isFinite(amount)||amount<=0||!b.entry_type) return json({ok:false,error:'INVALID_FINANCE_ENTRY',version:VERSION},400);
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO finance_workspace_entries(id,user_id,role,entry_type,direction,amount_cents,currency,label,reference_type,reference_id,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,auth.user.id,auth.user.role,String(b.entry_type),String(b.direction||'IN').toUpperCase()==='OUT'?'OUT':'IN',amount,b.currency||'EUR',clean(b.label)||null,clean(b.reference_type)||null,clean(b.reference_id)||null,JSON.stringify(b.metadata||{})).run();
  await journal(env,auth.user.role,auth.user.id,'FINANCE_ENTRY_CREATE','finance_workspace_entries',id,'OK',{entry_type:b.entry_type});
  return json({ok:true,version:VERSION,id});
}

async function financeProblemCreate(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth}=a,b=await readJson(request)||{}, [issueType,solution]=financeProblemSolution(b.issue_type);
  const severity=['CRITICAL','HIGH','MEDIUM','LOW'].includes(String(b.severity||'').toUpperCase())?String(b.severity).toUpperCase():'LOW';
  const auto=['LOW','MEDIUM'].includes(severity) && ['PAYMENT_FAILED','EXPORT_FAILED','INVOICE_MISSING','UNKNOWN'].includes(issueType);
  const status=auto?'AUTO_RESOLUTION_PROPOSED':'OPEN';
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO finance_resolution_cases(id,user_id,role,issue_type,status,severity,description,proposed_solution,amount_cents,reference_id,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,auth.user.id,auth.user.role,issueType,status,severity,clean(b.description)||null,solution,Number.isFinite(Number(b.amount_cents))?Number(b.amount_cents):null,clean(b.reference_id)||null,JSON.stringify(b.metadata||{})).run();
  await journal(env,auth.user.role,auth.user.id,'FINANCE_PROBLEM_CREATE','finance_resolution_cases',id,status,{issue_type:issueType,auto});
  return json({ok:true,version:VERSION,case:{id,issue_type:issueType,status,severity,automatic_resolution_possible:auto,proposed_solution:solution,requires_human_validation:!auto}});
}

async function financeProblemResolve(request,env) {
  const a=await financeAuth(request,env); if(a.response)return a.response;
  const {auth}=a,b=await readJson(request)||{},id=clean(b.case_id);
  if(!id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const row=await env.DB.prepare('SELECT * FROM finance_resolution_cases WHERE id=? LIMIT 1').bind(id).first();
  if(!row)return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  const role=String(auth.user.role||'').toUpperCase();
  const owner=String(row.user_id)===String(auth.user.id);
  const manager=['GERANTE','ADMIN','FINANCE'].includes(role);
  if(!owner&&!manager)return json({ok:false,error:'FORBIDDEN',version:VERSION},403);
  const approved=Boolean(b.approve);
  const resolution=clean(b.resolution)||row.proposed_solution||'Résolution contrôlée par le Copilote.';
  const status=approved?'RESOLVED':'ESCALATED';
  await env.DB.prepare(`UPDATE finance_resolution_cases SET status=?,resolution=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,resolution,id).run();
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

async function handle(request,env){
  try {
    if(isMutatingMethod(request.method) && !securityOriginAllowed(request,env)) return json({ok:false,error:'ORIGIN_NOT_ALLOWED',version:VERSION},403);
    const url=new URL(request.url);
    // Fail closed before any schema helper touches D1: unauthenticated callers
    // must not use mission validation as an existence oracle for private IDs.
    if (url.pathname === '/api/missions/validate') {
      if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION }, 405);
      return json({ ok: false, error: 'AUTHENTICATED_VALIDATION_REQUIRED', version: VERSION, write_enabled: false }, 403);
    }
    if (url.pathname.startsWith('/api/v7/')) {
      const v7Response = await handleV7Route(request, env, url.pathname);
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

export default {
  fetch(request,env){ return handle(request,env); },
  async scheduled(event,env,ctx){
    if(event?.cron && (event.cron==='0 3 * * *' || event.cron==='0 3 * * 0')){
      ctx.waitUntil(runNationalBackup(env,'AUTOMATIC'));
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
const NATIONAL_SCALE_DEFAULTS = Object.freeze({
  maxPageSize:100, defaultPageSize:50, importBatchSize:500,
  noArtificialUserCap:true, cursorPaginationRecommended:true,
  documentsStorage:'R2', backupFrequency:'DAILY', backupRetentionDays:90
});

async function ensureNationalContinuitySchema(env){
  if(!env.DB) throw new Error('DATABASE_REQUIRED');
  const sqls=[
    `CREATE TABLE IF NOT EXISTS platform_scale_config(id TEXT PRIMARY KEY,key TEXT NOT NULL UNIQUE,value_json TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS backup_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,trigger_type TEXT NOT NULL,storage_provider TEXT,started_at TEXT DEFAULT CURRENT_TIMESTAMP,completed_at TEXT,object_count INTEGER DEFAULT 0,row_count INTEGER DEFAULT 0,error_message TEXT,metadata_json TEXT)`,
    `CREATE TABLE IF NOT EXISTS backup_objects(id TEXT PRIMARY KEY,backup_run_id TEXT NOT NULL,object_key TEXT NOT NULL,table_name TEXT,row_count INTEGER DEFAULT 0,byte_size INTEGER DEFAULT 0,checksum TEXT,encrypted INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_backup_runs_date ON backup_runs(status,started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_backup_objects_run ON backup_objects(backup_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_scale_key ON platform_scale_config(key)`
  ];
  for(const q of sqls) await env.DB.prepare(q).run();
  for(const [k,v] of Object.entries(NATIONAL_SCALE_DEFAULTS))
    await env.DB.prepare(`INSERT OR IGNORE INTO platform_scale_config(id,key,value_json) VALUES(?,?,?)`).bind(crypto.randomUUID(),k,JSON.stringify(v)).run();
}

function b64(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode(...u8.subarray(i,i+0x8000));return btoa(s)}
async function backupEncrypt(text,secret){
  if(!secret) throw new Error('BACKUP_ENCRYPTION_KEY_REQUIRED');
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
  const key=await crypto.subtle.importKey('raw',h,{name:'AES-GCM'},false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));
  return JSON.stringify({v:1,alg:'AES-256-GCM',iv:b64(iv),data:b64(new Uint8Array(data))});
}
async function backupHash(text){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function backupTables(env){
  const r=await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  return (r.results||[]).map(x=>String(x.name));
}
async function runNationalBackup(env,trigger='MANUAL'){
  await ensureNationalContinuitySchema(env);
  if(!env.BACKUP_BUCKET) throw new Error('BACKUP_R2_NOT_CONFIGURED');
  const secret=env.BACKUP_ENCRYPTION_KEY;
  if(!secret) throw new Error('BACKUP_ENCRYPTION_KEY_REQUIRED');
  const runId=crypto.randomUUID(), day=new Date().toISOString().slice(0,10);
  await env.DB.prepare(`INSERT INTO backup_runs(id,status,trigger_type,storage_provider,metadata_json) VALUES(?,?,?,?,?)`).bind(runId,'RUNNING',trigger,'R2',JSON.stringify({version:VERSION,scope:'FULL_LOGICAL_DB'})).run();
  let objects=0,rowsTotal=0;
  try{
    for(const table of await backupTables(env)){
      let offset=0, tableRows=0;
      while(true){
        const safe=table.replace(/"/g,'""');
        const r=await env.DB.prepare(`SELECT * FROM "${safe}" LIMIT ? OFFSET ?`).bind(500,offset).all();
        const rows=r.results||[]; if(!rows.length) break;
        const plain=rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
        const enc=await backupEncrypt(plain,secret);
        const key=`prochelia/backups/${day}/${runId}/${table}/part-${String(offset/500).padStart(8,'0')}.json.enc`;
        await env.BACKUP_BUCKET.put(key,enc,{httpMetadata:{contentType:'application/octet-stream'}});
        await env.DB.prepare(`INSERT INTO backup_objects(id,backup_run_id,object_key,table_name,row_count,byte_size,checksum,encrypted) VALUES(?,?,?,?,?,?,?,1)`).bind(crypto.randomUUID(),runId,key,table,rows.length,new TextEncoder().encode(enc).byteLength,await backupHash(enc)).run();
        objects++; rowsTotal+=rows.length; tableRows+=rows.length; offset+=rows.length;
        if(rows.length<500) break;
      }
      if(!tableRows){
        const key=`prochelia/backups/${day}/${runId}/${table}/empty.json.enc`,enc=await backupEncrypt('',secret);
        await env.BACKUP_BUCKET.put(key,enc,{httpMetadata:{contentType:'application/octet-stream'}});
        await env.DB.prepare(`INSERT INTO backup_objects(id,backup_run_id,object_key,table_name,row_count,byte_size,checksum,encrypted) VALUES(?,?,?,?,?,?,?,1)`).bind(crypto.randomUUID(),runId,key,table,0,new TextEncoder().encode(enc).byteLength,await backupHash(enc)).run();
        objects++;
      }
    }
    await env.DB.prepare(`UPDATE backup_runs SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP,object_count=?,row_count=? WHERE id=?`).bind(objects,rowsTotal,runId).run();
    return {ok:true,runId,status:'COMPLETED',objectCount:objects,rowCount:rowsTotal,storage:'R2',encrypted:true};
  }catch(e){
    await env.DB.prepare(`UPDATE backup_runs SET status='FAILED',completed_at=CURRENT_TIMESTAMP,object_count=?,row_count=?,error_message=? WHERE id=?`).bind(objects,rowsTotal,String(e.message||e),runId).run();
    throw e;
  }
}
async function nationalScaleStatus(env){
  await ensureNationalContinuitySchema(env);
  const c=await env.DB.prepare(`SELECT key,value_json FROM platform_scale_config ORDER BY key`).all();
  const t=await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  return {ok:true,mode:'NATIONAL_SCALE',artificialUserCap:false,unlimitedInBusinessRules:true,database:'D1',documents:'R2_RECOMMENDED',backups:{provider:'R2',automatic:true,encrypted:true},pagination:{cursorRecommended:true,maxPageSize:100},tables:(t.results||[]).map(x=>x.name),config:(c.results||[])};
}
async function backupStatus(env){
  await ensureNationalContinuitySchema(env);
  const r=await env.DB.prepare(`SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 20`).all();
  return {ok:true,configured:!!env.BACKUP_BUCKET&&!!env.BACKUP_ENCRYPTION_KEY,automatic:true,frequency:'DAILY',retentionDays:90,runs:r.results||[]};
}

const __procheliaNationalHandle = handle;
handle = async function(request,env){
  const url=new URL(request.url);
  try{
    if(request.method==='GET'&&url.pathname==='/api/system/scale'){
      const a=await getAuth(request,env).catch(()=>null); if(!a||a.role!=='GERANTE') return json({ok:false,error:'FORBIDDEN'},403);
      return json(await nationalScaleStatus(env));
    }
    if(request.method==='GET'&&url.pathname==='/api/system/backups'){
      const a=await getAuth(request,env).catch(()=>null); if(!a||a.role!=='GERANTE') return json({ok:false,error:'FORBIDDEN'},403);
      return json(await backupStatus(env));
    }
    if(request.method==='POST'&&url.pathname==='/api/system/backup/run'){
      const a=await getAuth(request,env).catch(()=>null); if(!a||a.role!=='GERANTE') return json({ok:false,error:'FORBIDDEN'},403);
      return json(await runNationalBackup(env,'MANUAL'));
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
  const auth=await getAuth(request,env).catch(()=>null);
  if(!auth?.user?.id) return {response:json({ok:false,error:'UNAUTHORIZED',version:VERSION},401)};
  const role=supportRoleNormalize(auth.user.role);
  if(!supportRoleAllowed(role)) return {response:json({ok:false,error:'FORBIDDEN',version:VERSION},403)};
  return {auth,role};
}

async function supportEvent(env,caseId,actorRole,actorId,eventType,details={}){
  await env.DB.prepare(`INSERT INTO support_case_events(id,case_id,actor_role,actor_id,event_type,details_json) VALUES(?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),caseId,actorRole||null,actorId||null,eventType,JSON.stringify(details||{})).run();
}

async function brandIdentityEndpoint(request,env){
  await ensureProcheliaMasterComplementSchema(env);
  const r=await env.DB.prepare(`SELECT * FROM brand_identity WHERE brand_key='PROCHELIA' LIMIT 1`).first();
  const assets=await env.DB.prepare(`SELECT asset_type,asset_name,storage_key,checksum,version,status FROM brand_assets WHERE status='ACTIVE' ORDER BY asset_type,asset_name`).all();
  return json({ok:true,version:VERSION,brand:{name:PROCHELIA_BRAND.name,identity:r||null,assets:assets.results||[],visual:PROCHELIA_BRAND.visual,uniqueness_policy:PROCHELIA_BRAND.uniqueness_policy,note:'L’originalité graphique interne est une spécification de création ; l’exclusivité juridique doit être confirmée par les recherches de similarités et le dépôt de marque.'}});
}

async function brandClearanceRecord(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  if(a.role!=='GERANTE'&&a.role!=='ADMIN') return json({ok:false,error:'FORBIDDEN'},403);
  await ensureProcheliaMasterComplementSchema(env);
  const b=await readJson(request)||{};
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO brand_clearance_log(id,search_type,term,source,result,evidence_ref,notes) VALUES(?,?,?,?,?,?,?)`)
    .bind(id,clean(b.search_type)||'SIMILARITY',clean(b.term)||'PROCHÉLIA',clean(b.source)||'INPI',clean(b.result)||'PENDING',clean(b.evidence_ref)||null,clean(b.notes)||null).run();
  await journal(env,a.role,a.auth.user.id,'BRAND_CLEARANCE_RECORDED','brand_clearance_log',id,'OK',{term:b.term||'PROCHÉLIA',source:b.source||'INPI'});
  return json({ok:true,version:VERSION,id});
}

async function interfaceConfigEndpoint(request,env){
  await ensureProcheliaMasterComplementSchema(env);
  const url=new URL(request.url); const requested=supportRoleNormalize(url.searchParams.get('role')||'');
  if(requested && PROCHELIA_UI[requested]) return json({ok:true,version:VERSION,role:requested,config:PROCHELIA_UI[requested],brand:PROCHELIA_BRAND.visual});
  return json({ok:true,version:VERSION,interfaces:PROCHELIA_UI,brand:PROCHELIA_BRAND.visual});
}

async function supportCreate(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  await ensureProcheliaMasterComplementSchema(env);
  const b=await readJson(request)||{};
  const category=clean(b.category)||'GENERAL';
  const severity=String(b.severity||'LOW').toUpperCase();
  const scenario=supportScenarioFor(category,severity);
  const rule=await env.DB.prepare(`SELECT * FROM copilot_resolution_rules WHERE scenario_key=? LIMIT 1`).bind(scenario).first();
  const auto=Number(rule?.auto_allowed||0)===1 && String(severity)!=='CRITICAL' && String(severity)!=='HIGH';
  const requiresManager=Number(rule?.manager_approval_required||1)===1 || !auto;
  const id=crypto.randomUUID();
  const proposed=rule?JSON.parse(rule.steps_json||'[]'):{steps:['collect_evidence','copilot_analysis','notify','audit']};
  await env.DB.prepare(`INSERT INTO support_cases(id,source_role,requester_id,company_id,mission_id,complaint_id,category,severity,status,description,proposed_resolution,requires_manager) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,a.role,a.auth.user.id,b.company_id||null,b.mission_id||null,b.complaint_id||null,category,severity,auto?'PROCESSING':'OPEN',clean(b.description)||null,JSON.stringify({scenario,steps:proposed.steps||proposed}),requiresManager?1:0).run();
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
  // Sécurité de production : le Copilote ne doit jamais déclarer une résolution
  // simplement parce qu'il a généré une proposition. Une résolution automatique
  // n'est clôturée que lorsqu'une action downstream vérifiable a confirmé son succès.
  const verified=String(context?.execution_verified||'').toLowerCase()==='true' || context?.execution_verified===true;
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
  await ensureProcheliaMasterComplementSchema(env);
  const u=new URL(request.url),status=clean(u.searchParams.get('status')||'');
  const isManager=['GERANTE','ADMIN'].includes(a.role);
  let r;
  if(isManager){
    r=status?await env.DB.prepare(`SELECT * FROM support_cases WHERE status=? ORDER BY created_at DESC LIMIT 200`).bind(status).all():await env.DB.prepare(`SELECT * FROM support_cases ORDER BY created_at DESC LIMIT 200`).all();
  }else{
    r=status?await env.DB.prepare(`SELECT * FROM support_cases WHERE requester_id=? AND status=? ORDER BY created_at DESC LIMIT 200`).bind(a.auth.user.id,status).all():await env.DB.prepare(`SELECT * FROM support_cases WHERE requester_id=? ORDER BY created_at DESC LIMIT 200`).bind(a.auth.user.id).all();
  }
  return json({ok:true,version:VERSION,role:a.role,cases:r.results||[]});
}

async function supportResolve(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  if(a.role!=='GERANTE'&&a.role!=='ADMIN') return json({ok:false,error:'MANAGER_APPROVAL_REQUIRED',version:VERSION},403);
  await ensureProcheliaMasterComplementSchema(env);
  const b=await readJson(request)||{}; const id=clean(b.case_id);
  if(!id)return json({ok:false,error:'CASE_ID_REQUIRED',version:VERSION},400);
  const row=await env.DB.prepare(`SELECT * FROM support_cases WHERE id=? LIMIT 1`).bind(id).first();
  if(!row)return json({ok:false,error:'CASE_NOT_FOUND',version:VERSION},404);
  const resolution=clean(b.resolution)||'Résolution validée par la Gérante après contrôle du dossier.';
  await env.DB.prepare(`UPDATE support_cases SET status='RESOLVED',resolution=?,resolved_at=CURRENT_TIMESTAMP,requires_manager=0 WHERE id=?`).bind(resolution,id).run();
  await supportEvent(env,id,a.role,a.auth.user.id,'MANAGER_RESOLVED',{resolution});
  await journal(env,a.role,a.auth.user.id,'SUPPORT_CASE_MANAGER_RESOLVE','support_cases',id,'RESOLVED',{resolution});
  return json({ok:true,version:VERSION,case_id:id,status:'RESOLVED',resolution});
}

async function supportDashboard(request,env){
  const a=await supportAuth(request,env); if(a.response)return a.response;
  if(a.role!=='GERANTE'&&a.role!=='ADMIN') return json({ok:false,error:'FORBIDDEN'},403);
  await ensureProcheliaMasterComplementSchema(env);
  const rows=await env.DB.prepare(`SELECT status,severity,COUNT(*) AS n FROM support_cases GROUP BY status,severity ORDER BY status,severity`).all();
  const recent=await env.DB.prepare(`SELECT id,source_role,category,severity,status,created_at,resolved_at FROM support_cases ORDER BY created_at DESC LIMIT 30`).all();
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
  await ensureFinalHardeningSchema(env);
  const existing=await env.DB.prepare(`SELECT request_count FROM security_rate_limits WHERE bucket=? AND subject_hash=? AND window_start=? LIMIT 1`).bind(bucket,subject,start).first();
  const count=Number(existing?.request_count||0)+1;
  if(existing){
    await env.DB.prepare(`UPDATE security_rate_limits SET request_count=? WHERE bucket=? AND subject_hash=? AND window_start=?`).bind(count,bucket,subject,start).run();
  }else{
    await env.DB.prepare(`INSERT INTO security_rate_limits(id,bucket,subject_hash,window_start,request_count) VALUES(?,?,?,?,1)`).bind(crypto.randomUUID(),bucket,subject,start).run();
  }
  if(count>limit){
    await productionSafetySchema(env);
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
    {code:'BACKUP_R2',status:env.BACKUP_BUCKET&&finalSecretConfigured(env,'BACKUP_ENCRYPTION_KEY')?'OK':'NOT_CONFIGURED'},
    {code:'NOTIFICATION_PROVIDER',status:finalSecretConfigured(env,'NOTIFICATION_PROVIDER')?'OK':'NOT_CONFIGURED'},
    {code:'MAPS_PROVIDER',status:finalSecretConfigured(env,'MAPS_API_KEY')?'OK':'NOT_CONFIGURED'}
  ];
  const checks=[...(result.checks||[]),...extra];
  const blockingCodes=new Set(['SECRET:PAYMENT_PROVIDER','SECRET:PAYMENT_WEBHOOK_SECRET','SECURITY_CODE_DELIVERY','CORS_ORIGIN','BACKUP_R2']);
  const blocking=checks.filter(x=>blockingCodes.has(x.code)&&x.status!=='OK');
  const overall=blocking.length===0 && result.blocking===0;
  for(const c of extra){
    await env.DB.prepare(`INSERT INTO system_config_checks(id,check_code,status,details_json) VALUES(?,?,?,?)`).bind(crypto.randomUUID(),c.code,c.status,JSON.stringify(c)).run();
  }
  await journal(env,'gerante',gate.auth.user.id,'STRICT_PRODUCTION_AUDIT','system',null,overall?'OK':'ATTENTION',{blocking:blocking.map(x=>x.code)});
  return json({ok:true,version:VERSION,production_gate:overall?'OPEN':'CLOSED',ready_for_real_traffic:overall,checks,blocking:blocking.map(x=>x.code),note:overall?'Configuration gate passed. A real production launch still requires sandbox/acceptance tests for PSP, notifications, identity/security, backups/restore and critical user journeys.':'Production traffic remains blocked until the listed blocking controls are configured and tested.'});
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
