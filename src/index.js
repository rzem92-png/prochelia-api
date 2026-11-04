import { handleV7Route } from "./v7-routes.js";
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
  const old=await env.DB.prepare('SELECT * FROM payment_transactions WHERE idempotency_key=? LIMIT 1').bind(idem).first();
  if(old) return json({ok:true,version:VERSION,idempotent_replay:true,transaction:old},200);
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
  if(['paid','refunded','failed'].includes(tx.status) && tx.status!==outcome) return json({ok:false,error:'PAYMENT_STATE_CONFLICT',version:VERSION,status:tx.status},409);
  if(outcome==='paid'){
    const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(tx.intervenant_id).first();
    if(!wallet) return json({ok:false,error:'INTERVENANT_WALLET_NOT_FOUND',version:VERSION},409);
    await env.DB.prepare(`UPDATE payment_transactions SET status='paid',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(txId).run();
    await env.DB.prepare(`UPDATE wallets SET pending_cents=pending_cents+?,available_cents=available_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(0,tx.net_intervenant_cents,wallet.id).run();
  } else if(outcome==='held') {
    await env.DB.prepare(`UPDATE payment_transactions SET status='held',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(txId).run();
  } else {
    await env.DB.prepare(`UPDATE payment_transactions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(outcome,txId).run();
  }
  await paymentAudit(env,'MISSION_PAYMENT_FINALIZED',{transaction_id:txId,mission_id:tx.mission_id,user_id:auth.user.id,metadata:{outcome}},'OK');
  return json({ok:true,version:VERSION,transaction_id:txId,status:outcome},200);
}

async function payoutRequest(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['intervenant'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), amount=moneyCents(body?.amount_eur), mode=clean(body?.mode)||'standard';
  const idem=clean(request.headers.get('idempotency-key'))||clean(body?.idempotency_key);
  if(amount===null||amount<=0||!['standard','express'].includes(mode)||!idem) return json({ok:false,error:'INVALID_PAYOUT_REQUEST',version:VERSION},400);
  const old=await env.DB.prepare('SELECT * FROM payout_requests WHERE idempotency_key=? LIMIT 1').bind(idem).first();
  if(old) return json({ok:true,version:VERSION,idempotent_replay:true,payout:old},200);
  const account=await env.DB.prepare(`SELECT * FROM payment_accounts WHERE user_id=? LIMIT 1`).bind(auth.user.id).first();
  if(!account||Number(account.payouts_enabled)!==1) return json({ok:false,error:'PAYOUT_ACCOUNT_NOT_READY',version:VERSION,message:'Le compte de paiement de l’intervenant doit être vérifié et activé par le PSP.'},409);
  const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(auth.user.id).first();
  if(!wallet||Number(wallet.available_cents)<amount) return json({ok:false,error:'INSUFFICIENT_AVAILABLE_BALANCE',version:VERSION,available_cents:Number(wallet?.available_cents||0)},409);
  const payoutId=crypto.randomUUID();
  await env.DB.prepare(`UPDATE wallets SET available_cents=available_cents-?,reserved_cents=reserved_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(amount,amount,wallet.id).run();
  await env.DB.prepare(`INSERT INTO payout_requests (id,idempotency_key,wallet_id,user_id,amount_cents,mode,provider,status) VALUES (?,?,?,?,?,?,?,'requested')`).bind(payoutId,idem,wallet.id,auth.user.id,amount,mode,paymentProvider(env)).run();
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
  const payloadHash=await sha256Base64url(raw);
  const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO payment_webhook_events (id,provider,event_id,event_type,signature_valid,payload_hash) VALUES (?,?,?,?,1,?)`).bind(crypto.randomUUID(),provider,eventId,type,payloadHash).run();
  if(!inserted.meta?.changes) return json({ok:true,version:VERSION,duplicate:true,event_id:eventId},200);
  const txId=clean(event?.data?.transaction_id), payoutId=clean(event?.data?.payout_id);
  if(txId){
    const tx=await env.DB.prepare('SELECT * FROM payment_transactions WHERE id=? LIMIT 1').bind(txId).first();
    if(tx){
      const statusMap={payment_succeeded:'paid',charge_succeeded:'paid',payment_failed:'failed',charge_failed:'failed',payment_refunded:'refunded'};
      const newStatus=statusMap[type];
      if(newStatus){
        const alreadyFinal = ['paid','failed','refunded'].includes(tx.status);
        if(!alreadyFinal){
          await env.DB.prepare('UPDATE payment_transactions SET status=?,provider_payment_id=COALESCE(?,provider_payment_id),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(newStatus,clean(event?.data?.provider_payment_id)||null,txId).run();
          if(newStatus==='paid'){
            const wallet=await env.DB.prepare('SELECT * FROM wallets WHERE user_id=? LIMIT 1').bind(tx.intervenant_id).first();
            if(wallet) await env.DB.prepare('UPDATE wallets SET available_cents=available_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(tx.net_intervenant_cents,wallet.id).run();
          }
        }
      }
    }
  }
  if(payoutId){
    const payout=await env.DB.prepare('SELECT * FROM payout_requests WHERE id=? LIMIT 1').bind(payoutId).first();
    const statusMap={payout_processing:'processing',payout_paid:'completed',payout_failed:'failed',payout_canceled:'canceled'};
    const newStatus=statusMap[type];
    if(payout&&newStatus){
      const alreadyFinal=['completed','failed','canceled'].includes(payout.status);
      if(!alreadyFinal){
        if(newStatus==='completed') await env.DB.prepare(`UPDATE wallets SET reserved_cents=MAX(0,reserved_cents-?),paid_cents=paid_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(payout.amount_cents,payout.amount_cents,payout.wallet_id).run();
        if(['failed','canceled'].includes(newStatus)) await env.DB.prepare(`UPDATE wallets SET reserved_cents=MAX(0,reserved_cents-?),available_cents=available_cents+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(payout.amount_cents,payout.amount_cents,payout.wallet_id).run();
        await env.DB.prepare(`UPDATE payout_requests SET status=?,provider_payout_id=COALESCE(?,provider_payout_id),failure_code=?,failure_message=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(newStatus,clean(event?.data?.provider_payout_id)||null,clean(event?.data?.failure_code)||null,clean(event?.data?.failure_message)||null,newStatus,payoutId).run();
      }
    }
  }
  await env.DB.prepare('UPDATE payment_webhook_events SET processed=1,processed_at=CURRENT_TIMESTAMP WHERE provider=? AND event_id=?').bind(provider,eventId).run();
  await paymentAudit(env,'PSP_WEBHOOK_PROCESSED',{transaction_id:txId,payout_id:payoutId,metadata:{provider,event_id:eventId,event_type:type}},'OK');
  return json({ok:true,version:VERSION,processed:true,event_id:eventId},200);
}

async function openPaymentDispute(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['client','gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), missionId=clean(body?.mission_id), reason=clean(body?.reason), amount=moneyCents(body?.amount_eur);
  if(!missionId||!reason||reason.length>2000||amount===null||amount<=0) return json({ok:false,error:'INVALID_DISPUTE',version:VERSION},400);
  const tx=await env.DB.prepare(`SELECT * FROM payment_transactions WHERE mission_id=? ORDER BY created_at DESC LIMIT 1`).bind(missionId).first();
  if(!tx) return json({ok:false,error:'PAYMENT_NOT_FOUND_FOR_MISSION',version:VERSION},404);
  // Critical ownership check: a client may dispute only their own transaction.
  if(auth.user.role==='client' && tx.client_id!==auth.user.id) return json({ok:false,error:'FORBIDDEN',version:VERSION},403);
  if(amount>Number(tx.gross_cents||0)) return json({ok:false,error:'DISPUTE_AMOUNT_EXCEEDS_PAYMENT',version:VERSION},400);
  if(!['paid','held'].includes(tx.status)) return json({ok:false,error:'PAYMENT_NOT_DISPUTABLE',version:VERSION,status:tx.status},409);
  const prior=await env.DB.prepare(`SELECT id FROM payment_disputes WHERE transaction_id=? AND status='open' LIMIT 1`).bind(tx.id).first();
  if(prior) return json({ok:false,error:'DISPUTE_ALREADY_OPEN',version:VERSION,dispute_id:prior.id},409);
  if(tx.status==='paid') await env.DB.prepare(`UPDATE payment_transactions SET status='held',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='paid'`).bind(tx.id).run();
  const id=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO payment_disputes (id,mission_id,transaction_id,client_id,intervenant_id,status,reason,amount_cents) VALUES (?,?,?,?,?,?,?,?)`).bind(id,missionId,tx.id,tx.client_id,tx.intervenant_id,'open',reason,amount).run();
  await paymentAudit(env,'PAYMENT_DISPUTE_OPENED',{transaction_id:tx.id,mission_id:missionId,user_id:auth.user.id,metadata:{amount_cents:amount,reason}},'OK');
  return json({ok:true,version:VERSION,dispute_id:id,status:'open',payment_status:'held'},201);
}

async function paymentAdminResolve(request, env) {
  const auth=await getSessionUser(request,env);
  if(!requireRole(auth,['gerante'])) return json({ok:false,error:auth?.user?'FORBIDDEN':'UNAUTHENTICATED',version:VERSION},auth?.user?403:401);
  await ensurePaymentSchema(env);
  const body=await readJson(request), disputeId=clean(body?.dispute_id), resolution=clean(body?.resolution);
  if(!disputeId||!['release','partial_refund','full_refund','cancel'].includes(resolution)) return json({ok:false,error:'INVALID_DISPUTE_RESOLUTION',version:VERSION},400);
  const d=await env.DB.prepare('SELECT * FROM payment_disputes WHERE id=? LIMIT 1').bind(disputeId).first();
  if(!d||d.status==='resolved') return json({ok:false,error:'DISPUTE_NOT_FOUND_OR_ALREADY_RESOLVED',version:VERSION},409);
  await env.DB.prepare(`UPDATE payment_disputes SET status='resolved',resolution=?,resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(resolution,disputeId).run();
  if(d.transaction_id){
    const newStatus=resolution==='release'?'paid':resolution==='full_refund'?'refunded':resolution==='cancel'?'canceled':'held';
    await env.DB.prepare('UPDATE payment_transactions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(newStatus,d.transaction_id).run();
  }
  await paymentAudit(env,'PAYMENT_DISPUTE_RESOLVED',{transaction_id:d.transaction_id,mission_id:d.mission_id,user_id:auth.user.id,metadata:{dispute_id:disputeId,resolution}},'OK');
  return json({ok:true,version:VERSION,dispute_id:disputeId,status:'resolved',resolution},200);
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
      const cols = await getTableColumns(env,'missions');
      if (cols.includes('intervenant_id')) {
        await env.DB.prepare('UPDATE missions SET intervenant_id=? WHERE id=?').bind(replacementId,c.mission_id).run();
        results.push({action:'ASSIGN_REPLACEMENT',mission_id:c.mission_id,intervenant_id:replacementId,status:'EXECUTED'});
      } else {
        const queued=await enqueueAction(env,c.id,'ASSIGN_REPLACEMENT',{mission_id:c.mission_id,intervenant_id:replacementId},`${c.id}:replacement:${replacementId}`);
        results.push({action:'ASSIGN_REPLACEMENT',...queued,reason:'MISSION_SCHEMA_NEEDS_REVIEW'});
      }
    } else {
      const queued=await enqueueAction(env,c.id,'SEARCH_REPLACEMENT',{mission_id:c.mission_id||null,criteria:context.replacement_criteria||{},case_type:c.case_type},`${c.id}:search-replacement`);
      results.push({action:'SEARCH_REPLACEMENT',...queued});
    }
  }

  if (context.reschedule_start_at && c.mission_id) {
    const cols=await getTableColumns(env,'missions');
    const target = cols.includes('start_at') ? 'start_at' : (cols.includes('scheduled_at') ? 'scheduled_at' : null);
    if (target) {
      await env.DB.prepare(`UPDATE missions SET ${target}=? WHERE id=?`).bind(String(context.reschedule_start_at),c.mission_id).run();
      results.push({action:'RESCHEDULE_MISSION',mission_id:c.mission_id,field:target,status:'EXECUTED'});
    } else {
      const queued=await enqueueAction(env,c.id,'RESCHEDULE_MISSION',{mission_id:c.mission_id,start_at:context.reschedule_start_at},`${c.id}:reschedule:${context.reschedule_start_at}`);
      results.push({action:'RESCHEDULE_MISSION',...queued,reason:'MISSION_SCHEMA_NEEDS_REVIEW'});
    }
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
    // Provider-dependent actions stay queued until the corresponding adapter/secret is configured.
    const external = ['PSP_REFUND_REVIEW','NOTIFY_CLIENT','SEARCH_REPLACEMENT','RESCHEDULE_MISSION','ASSIGN_REPLACEMENT'].includes(String(row.action_type));
    if(external) {
      await env.DB.prepare(`UPDATE action_outbox SET status='WAITING_PROVIDER',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind('External adapter/provider required for final execution.',row.id).run();
      processed.push({id:row.id,status:'WAITING_PROVIDER',action_type:row.action_type});
      continue;
    }
    await env.DB.prepare(`UPDATE action_outbox SET status='COMPLETED',processed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id).run();
    processed.push({id:row.id,status:'COMPLETED',action_type:row.action_type,payload});
  }
  await journal(env,'gerante',gate.auth.user.id,'ACTION_OUTBOX_PROCESSED','system',null,'OK',{count:processed.length});
  return json({ok:true,version:VERSION,processed},200);
}

async function executeOperationalCase(env, caseId, approverId=null, automatic=false) {
  const c=await env.DB.prepare('SELECT * FROM operational_cases WHERE id=? LIMIT 1').bind(caseId).first();
  if(!c)return {ok:false,error:'CASE_NOT_FOUND'};
  if(c.status==='RESOLVED')return {ok:true,already:true};
  const rec=c.proposed_solution_json?JSON.parse(c.proposed_solution_json):{};
  if(c.requires_manager && !automatic && !approverId) return {ok:false,error:'MANAGER_APPROVAL_REQUIRED'};
  const businessResults = await executeCaseBusinessAction(env,c,rec,approverId,automatic);
  const resolution={executed:true,automatic,action:rec.action||'RESOLVE',steps:rec.solution?.steps||[],business_results:businessResults,executed_at:new Date().toISOString()};
  await env.DB.prepare(`INSERT INTO case_actions(id,case_id,action_code,mode,status,payload_json,result_json,completed_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
    .bind(crypto.randomUUID(),caseId,rec.action||'RESOLVE',automatic?'AUTO':'MANAGER','COMPLETED',JSON.stringify(rec),JSON.stringify(resolution)).run();
  await env.DB.prepare(`UPDATE operational_cases SET status='RESOLVED',resolution_json=?,requires_manager=0,updated_at=CURRENT_TIMESTAMP,resolved_at=CURRENT_TIMESTAMP WHERE id=?`).bind(JSON.stringify(resolution),caseId).run();
  await env.DB.prepare(`UPDATE copilot_log SET approved_by=COALESCE(?,approved_by),result=? WHERE case_id=? AND id=(SELECT id FROM copilot_log WHERE case_id=? ORDER BY created_at DESC LIMIT 1)`).bind(approverId,JSON.stringify(resolution),caseId,caseId).run();
  await journal(env,automatic?'copilot':'gerante',approverId,automatic?'AUTO_CASE_RESOLVED':'CASE_RESOLVED','operational_case',caseId,'OK',resolution);
  return {ok:true,case_id:caseId,resolution};
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
