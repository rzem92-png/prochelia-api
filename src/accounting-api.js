const REQUIRED_TABLES = [
  "accounting_entities",
  "accounting_accounts",
  "accounting_journals",
  "accounting_journal_lines"
];

const READ_ROLES = ["OWNER", "ADMIN", "MANAGER", "FINANCE", "READ_ONLY"];
const WRITE_ROLES = ["OWNER", "ADMIN", "FINANCE"];
const POST_ROLES = ["OWNER", "ADMIN"];
const ACCOUNT_TYPES = new Set(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);
const NORMAL_BALANCES = new Set(["DEBIT", "CREDIT"]);
const SOURCE_TYPES = new Set(["MANUAL", "ADJUSTMENT", "REVERSAL"]);

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function roleAllowed(auth, roles) {
  return Boolean(auth?.user?.id && roles.includes(String(auth?.tenant?.role || "").toUpperCase()));
}

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validCurrency(value) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function validCountry(value) {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

async function boundedJson(request, maxBytes = 65536) {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, tooLarge: false };
    return { ok: true, value };
  } catch {
    return { ok: false, tooLarge: false };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

export function validateJournalPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "INVALID_BODY" };
  const entityId = cleanText(body.entity_id, 128);
  const idempotencyKey = cleanText(body.idempotency_key, 200);
  const journalDate = body.journal_date;
  const currency = body.currency;
  const sourceType = String(body.source_type || "MANUAL").toUpperCase();
  const description = cleanText(body.description, 500);
  const sourceId = cleanText(body.source_id || idempotencyKey, 200);
  if (!entityId) return { ok: false, error: "ENTITY_ID_REQUIRED" };
  if (!idempotencyKey) return { ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" };
  if (!validIsoDate(journalDate)) return { ok: false, error: "JOURNAL_DATE_INVALID" };
  if (!validCurrency(currency)) return { ok: false, error: "CURRENCY_INVALID" };
  if (!SOURCE_TYPES.has(sourceType) || sourceType === "REVERSAL") return { ok: false, error: "SOURCE_TYPE_INVALID" };
  if (!sourceId) return { ok: false, error: "SOURCE_ID_REQUIRED" };
  if (!Array.isArray(body.lines) || body.lines.length < 2 || body.lines.length > 100) {
    return { ok: false, error: "JOURNAL_LINES_INVALID" };
  }
  const lines = [];
  let debit = 0;
  let credit = 0;
  for (const item of body.lines) {
    const accountId = cleanText(item?.account_id, 128);
    const side = String(item?.side || "").toUpperCase();
    const amount = item?.amount_cents;
    if (!accountId || !["DEBIT", "CREDIT"].includes(side) ||
        !Number.isSafeInteger(amount) || amount <= 0) {
      return { ok: false, error: "JOURNAL_LINE_INVALID" };
    }
    if (side === "DEBIT") debit += amount;
    else credit += amount;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) {
      return { ok: false, error: "JOURNAL_TOTAL_OUT_OF_RANGE" };
    }
    lines.push({
      account_id: accountId,
      side,
      amount_cents: amount,
      currency,
      description: cleanText(item.description, 300) || null
    });
  }
  if (debit !== credit) return { ok: false, error: "JOURNAL_NOT_BALANCED", debit_cents: debit, credit_cents: credit };
  return {
    ok: true,
    value: { entityId, idempotencyKey, journalDate, currency, sourceType, sourceId, description, lines, debit, credit }
  };
}

export function validateAccountPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "INVALID_BODY" };
  const entityId = cleanText(body.entity_id, 128);
  const idempotencyKey = cleanText(body.idempotency_key, 200);
  const accountCode = cleanText(body.account_code, 40);
  const accountName = cleanText(body.account_name, 200);
  const accountType = String(body.account_type || "").toUpperCase();
  const normalBalance = String(body.normal_balance || "").toUpperCase();
  if (!entityId) return { ok: false, error: "ENTITY_ID_REQUIRED" };
  if (!idempotencyKey) return { ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" };
  if (!accountCode || !accountName) return { ok: false, error: "ACCOUNT_IDENTITY_REQUIRED" };
  if (!ACCOUNT_TYPES.has(accountType)) return { ok: false, error: "ACCOUNT_TYPE_INVALID" };
  if (!NORMAL_BALANCES.has(normalBalance)) return { ok: false, error: "NORMAL_BALANCE_INVALID" };
  return { ok: true, value: { entityId, idempotencyKey, accountCode, accountName, accountType, normalBalance } };
}

async function deterministicId(prefix, input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
  return prefix + hex.slice(0, 32);
}

async function schemaReadiness(env) {
  if (!env?.DB?.prepare || typeof env.DB.batch !== "function") {
    return { ok: false, response: reply({ ok: false, error: "ACCOUNTING_DATABASE_UNAVAILABLE", write_enabled: false }, 503) };
  }
  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?,?,?,?)"
    ).bind(...REQUIRED_TABLES).all();
    if (result?.success !== true || !Array.isArray(result.results)) {
      return { ok: false, response: reply({
        ok: false, error: "ACCOUNTING_SCHEMA_UNAVAILABLE", write_enabled: false
      }, 503) };
    }
    const found = new Set(result.results.map(row => row.name));
    const missing = REQUIRED_TABLES.filter(name => !found.has(name));
    if (missing.length) {
      return { ok: false, response: reply({
        ok: false, error: "ACCOUNTING_SCHEMA_NOT_MIGRATED", missing, write_enabled: false
      }, 503) };
    }
    return { ok: true };
  } catch {
    return { ok: false, response: reply({ ok: false, error: "ACCOUNTING_SCHEMA_UNAVAILABLE", write_enabled: false }, 503) };
  }
}

async function getEntity(env, tenantId, entityId) {
  return env.DB.prepare(
    "SELECT id,tenant_id,legal_name,country_code,base_currency,status,created_at,updated_at FROM accounting_entities WHERE id=? AND tenant_id=? LIMIT 1"
  ).bind(entityId, tenantId).first();
}

async function requireEntity(env, tenantId, entityId) {
  const entity = await getEntity(env, tenantId, entityId);
  if (!entity) return { ok: false, response: reply({ ok: false, error: "ACCOUNTING_ENTITY_NOT_FOUND" }, 404) };
  if (entity.status !== "ACTIVE") return { ok: false, response: reply({ ok: false, error: "ACCOUNTING_ENTITY_INACTIVE" }, 409) };
  return { ok: true, entity };
}

async function listEntities(env, tenantId) {
  const result = await env.DB.prepare(
    "SELECT id,legal_name,country_code,base_currency,status,created_at,updated_at FROM accounting_entities WHERE tenant_id=? ORDER BY legal_name,id LIMIT 100"
  ).bind(tenantId).all();
  return reply({ ok: true, entities: result.results || [] });
}

async function createEntity(request, env, auth) {
  if (!roleAllowed(auth, ["OWNER", "ADMIN"])) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const parsed = await boundedJson(request, 8192);
  if (!parsed.ok) return reply({ ok: false, error: parsed.tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON" }, parsed.tooLarge ? 413 : 400);
  const body = parsed.value;
  const legalName = cleanText(body.legal_name, 200);
  const countryCode = body.country_code;
  const baseCurrency = body.base_currency;
  const idempotencyKey = cleanText(body.idempotency_key, 200);
  if (legalName.length < 2) return reply({ ok: false, error: "LEGAL_NAME_REQUIRED" }, 400);
  if (!validCountry(countryCode)) return reply({ ok: false, error: "COUNTRY_CODE_INVALID" }, 400);
  if (!validCurrency(baseCurrency)) return reply({ ok: false, error: "BASE_CURRENCY_INVALID" }, 400);
  if (!idempotencyKey) return reply({ ok: false, error: "IDEMPOTENCY_KEY_REQUIRED" }, 400);
  const tenantId = auth.tenant.id;
  const id = await deterministicId("acctent_", tenantId + "\0" + idempotencyKey);
  const existing = await getEntity(env, tenantId, id);
  if (existing) {
    const same = existing.legal_name === legalName && existing.country_code === countryCode && existing.base_currency === baseCurrency;
    return same
      ? reply({ ok: true, entity: existing, idempotent_replay: true })
      : reply({ ok: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409);
  }
  try {
    await env.DB.prepare(
      "INSERT INTO accounting_entities(id,tenant_id,legal_name,country_code,base_currency,status) VALUES(?,?,?,?,?,'ACTIVE')"
    ).bind(id, tenantId, legalName, countryCode, baseCurrency).run();
    const entity = await getEntity(env, tenantId, id);
    return reply({ ok: true, entity, idempotent_replay: false }, 201);
  } catch {
    return reply({ ok: false, error: "ACCOUNTING_ENTITY_CREATE_REJECTED" }, 409);
  }
}

async function listAccounts(request, env, auth) {
  if (!roleAllowed(auth, READ_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const url = new URL(request.url);
  const entityId = cleanText(url.searchParams.get("entity_id"), 128);
  if (!entityId) return reply({ ok: false, error: "ENTITY_ID_REQUIRED" }, 400);
  const entity = await requireEntity(env, auth.tenant.id, entityId);
  if (!entity.ok) return entity.response;
  const result = await env.DB.prepare(
    "SELECT id,entity_id,account_code,account_name,account_type,normal_balance,is_active,created_at FROM accounting_accounts WHERE tenant_id=? AND entity_id=? ORDER BY account_code,id LIMIT 500"
  ).bind(auth.tenant.id, entityId).all();
  return reply({ ok: true, accounts: result.results || [] });
}

async function createAccount(request, env, auth) {
  if (!roleAllowed(auth, WRITE_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const parsed = await boundedJson(request, 8192);
  if (!parsed.ok) return reply({ ok: false, error: parsed.tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON" }, parsed.tooLarge ? 413 : 400);
  const validated = validateAccountPayload(parsed.value);
  if (!validated.ok) return reply({ ok: false, error: validated.error }, 400);
  const v = validated.value;
  const entity = await requireEntity(env, auth.tenant.id, v.entityId);
  if (!entity.ok) return entity.response;
  const id = await deterministicId("acctacc_", auth.tenant.id + "\0" + v.entityId + "\0" + v.idempotencyKey);
  const existing = await env.DB.prepare(
    "SELECT id,entity_id,account_code,account_name,account_type,normal_balance,is_active FROM accounting_accounts WHERE id=? AND tenant_id=? LIMIT 1"
  ).bind(id, auth.tenant.id).first();
  if (existing) {
    const same = existing.account_code === v.accountCode && existing.account_name === v.accountName &&
      existing.account_type === v.accountType && existing.normal_balance === v.normalBalance;
    return same ? reply({ ok: true, account: existing, idempotent_replay: true }) :
      reply({ ok: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409);
  }
  try {
    await env.DB.prepare(
      "INSERT INTO accounting_accounts(id,tenant_id,entity_id,account_code,account_name,account_type,normal_balance,is_active) VALUES(?,?,?,?,?,?,?,1)"
    ).bind(id, auth.tenant.id, v.entityId, v.accountCode, v.accountName, v.accountType, v.normalBalance).run();
    return reply({ ok: true, account: { id, entity_id: v.entityId, account_code: v.accountCode, account_name: v.accountName, account_type: v.accountType, normal_balance: v.normalBalance, is_active: 1 } }, 201);
  } catch {
    return reply({ ok: false, error: "ACCOUNT_CODE_ALREADY_EXISTS_OR_SCOPE_INVALID" }, 409);
  }
}

async function accountRowsForLines(env, tenantId, entityId, lines) {
  const ids = [...new Set(lines.map(line => line.account_id))];
  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT id,is_active FROM accounting_accounts WHERE tenant_id=? AND entity_id=? AND id IN (${placeholders})`
  ).bind(tenantId, entityId, ...ids).all();
  const rows = result.results || [];
  if (rows.length !== ids.length) return { ok: false, error: "ACCOUNT_NOT_FOUND_OR_TENANT_MISMATCH" };
  if (rows.some(row => Number(row.is_active) !== 1)) return { ok: false, error: "ACCOUNT_INACTIVE" };
  return { ok: true };
}

async function findJournalByIdempotency(env, tenantId, key) {
  return env.DB.prepare(
    "SELECT * FROM accounting_journals WHERE tenant_id=? AND idempotency_key=? LIMIT 1"
  ).bind(tenantId, key).first();
}

async function getJournal(env, tenantId, journalId) {
  return env.DB.prepare(
    "SELECT * FROM accounting_journals WHERE id=? AND tenant_id=? LIMIT 1"
  ).bind(journalId, tenantId).first();
}

async function getJournalLines(env, tenantId, journalId) {
  const result = await env.DB.prepare(
    "SELECT id,account_id,line_number,side,amount_cents,currency,description FROM accounting_journal_lines WHERE journal_id=? AND tenant_id=? ORDER BY line_number"
  ).bind(journalId, tenantId).all();
  return result.results || [];
}

async function sameJournalPayload(env, tenantId, existing, value) {
  const lines = await getJournalLines(env, tenantId, existing.id);
  const sameHeader = existing.entity_id === value.entityId &&
    existing.journal_date === value.journalDate && existing.currency === value.currency &&
    existing.source_type === value.sourceType && existing.source_id === value.sourceId &&
    (existing.description || "") === value.description;
  const sameLines = lines.length === value.lines.length && lines.every((line, i) =>
    line.account_id === value.lines[i].account_id && line.side === value.lines[i].side &&
    Number(line.amount_cents) === value.lines[i].amount_cents && line.currency === value.currency
  );
  return sameHeader && sameLines;
}

async function createJournal(request, env, auth) {
  if (!roleAllowed(auth, WRITE_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const parsed = await boundedJson(request, 65536);
  if (!parsed.ok) return reply({ ok: false, error: parsed.tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON" }, parsed.tooLarge ? 413 : 400);
  const validated = validateJournalPayload(parsed.value);
  if (!validated.ok) return reply({ ok: false, error: validated.error, ...(validated.debit_cents !== undefined ? { debit_cents: validated.debit_cents, credit_cents: validated.credit_cents } : {}) }, 400);
  const v = validated.value;
  const tenantId = auth.tenant.id;
  const entity = await requireEntity(env, tenantId, v.entityId);
  if (!entity.ok) return entity.response;
  if (entity.entity.base_currency !== v.currency) {
    return reply({ ok: false, error: "FOREIGN_CURRENCY_REQUIRES_APPROVED_FX_MODULE" }, 409);
  }
  const accounts = await accountRowsForLines(env, tenantId, v.entityId, v.lines);
  if (!accounts.ok) return reply({ ok: false, error: accounts.error }, 409);
  const existing = await findJournalByIdempotency(env, tenantId, v.idempotencyKey);
  if (existing) {
    if (await sameJournalPayload(env, tenantId, existing, v)) {
      return reply({ ok: true, journal: existing, idempotent_replay: true });
    }
    return reply({ ok: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409);
  }
  const journalId = crypto.randomUUID();
  const statements = [
    env.DB.prepare(
      "INSERT INTO accounting_journals(id,tenant_id,entity_id,journal_code,journal_date,currency,source_type,source_id,idempotency_key,description,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,'DRAFT',?)"
    ).bind(journalId, tenantId, v.entityId, v.sourceType, v.journalDate, v.currency, v.sourceType, v.sourceId, v.idempotencyKey, v.description || null, auth.user.id)
  ];
  for (let i = 0; i < v.lines.length; i++) {
    const line = v.lines[i];
    statements.push(env.DB.prepare(
      "INSERT INTO accounting_journal_lines(id,tenant_id,entity_id,journal_id,account_id,line_number,side,amount_cents,currency,description) VALUES(?,?,?,?,?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(), tenantId, v.entityId, journalId, line.account_id, i + 1, line.side, line.amount_cents, line.currency, line.description));
  }
  try {
    await env.DB.batch(statements);
    const journal = await getJournal(env, tenantId, journalId);
    return reply({ ok: true, journal, idempotent_replay: false }, 201);
  } catch {
    const raced = await findJournalByIdempotency(env, tenantId, v.idempotencyKey).catch(() => null);
    if (raced && await sameJournalPayload(env, tenantId, raced, v)) {
      return reply({ ok: true, journal: raced, idempotent_replay: true });
    }
    return reply({ ok: false, error: "ACCOUNTING_DRAFT_CREATE_REJECTED" }, 409);
  }
}

async function listJournals(request, env, auth) {
  if (!roleAllowed(auth, READ_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const url = new URL(request.url);
  const entityId = cleanText(url.searchParams.get("entity_id"), 128);
  if (!entityId) return reply({ ok: false, error: "ENTITY_ID_REQUIRED" }, 400);
  const entity = await requireEntity(env, auth.tenant.id, entityId);
  if (!entity.ok) return entity.response;
  const status = url.searchParams.get("status");
  if (status && !["DRAFT", "POSTED"].includes(status)) return reply({ ok: false, error: "JOURNAL_STATUS_INVALID" }, 400);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Math.min(10000, Number(url.searchParams.get("offset") || 0)));
  const sql = status
    ? "SELECT id,entity_id,journal_code,journal_date,currency,source_type,source_id,idempotency_key,description,status,created_by,created_at,posted_by,posted_at,reversal_of_journal_id FROM accounting_journals WHERE tenant_id=? AND entity_id=? AND status=? ORDER BY journal_date DESC,id DESC LIMIT ? OFFSET ?"
    : "SELECT id,entity_id,journal_code,journal_date,currency,source_type,source_id,idempotency_key,description,status,created_by,created_at,posted_by,posted_at,reversal_of_journal_id FROM accounting_journals WHERE tenant_id=? AND entity_id=? ORDER BY journal_date DESC,id DESC LIMIT ? OFFSET ?";
  const result = status
    ? await env.DB.prepare(sql).bind(auth.tenant.id, entityId, status, limit, offset).all()
    : await env.DB.prepare(sql).bind(auth.tenant.id, entityId, limit, offset).all();
  return reply({ ok: true, journals: result.results || [], limit, offset });
}

async function readJournal(request, env, auth, journalId) {
  if (!roleAllowed(auth, READ_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const journal = await getJournal(env, auth.tenant.id, journalId);
  if (!journal) return reply({ ok: false, error: "JOURNAL_NOT_FOUND" }, 404);
  const lines = await getJournalLines(env, auth.tenant.id, journalId);
  return reply({ ok: true, journal, lines });
}

async function postJournal(request, env, auth, journalId) {
  if (!roleAllowed(auth, POST_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const journal = await getJournal(env, auth.tenant.id, journalId);
  if (!journal) return reply({ ok: false, error: "JOURNAL_NOT_FOUND" }, 404);
  if (journal.status !== "DRAFT") return reply({ ok: false, error: "JOURNAL_NOT_DRAFT" }, 409);
  if (journal.created_by === auth.user.id) {
    return reply({ ok: false, error: "SEGREGATION_OF_DUTIES_REQUIRED" }, 409);
  }
  try {
    const result = await env.DB.prepare(
      "UPDATE accounting_journals SET status='POSTED',posted_by=?,posted_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND status='DRAFT'"
    ).bind(auth.user.id, journalId, auth.tenant.id).run();
    if (result?.success !== true || Number(result?.meta?.changes || 0) !== 1) {
      return reply({ ok: false, error: "JOURNAL_POSTING_NOT_CONFIRMED" }, 503);
    }
    return reply({ ok: true, status: "POSTED", journal_id: journalId });
  } catch {
    return reply({ ok: false, error: "JOURNAL_POSTING_REJECTED", write_enabled: false }, 409);
  }
}

async function reverseJournal(request, env, auth, journalId) {
  if (!roleAllowed(auth, WRITE_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const parsed = await boundedJson(request, 8192);
  if (!parsed.ok) return reply({ ok: false, error: parsed.tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON" }, parsed.tooLarge ? 413 : 400);
  const reason = cleanText(parsed.value.reason, 500);
  const idempotencyKey = cleanText(parsed.value.idempotency_key, 200);
  if (!reason || !idempotencyKey) return reply({ ok: false, error: "REVERSAL_REASON_AND_IDEMPOTENCY_REQUIRED" }, 400);
  const original = await getJournal(env, auth.tenant.id, journalId);
  if (!original) return reply({ ok: false, error: "JOURNAL_NOT_FOUND" }, 404);
  if (original.status !== "POSTED") return reply({ ok: false, error: "ONLY_POSTED_JOURNALS_CAN_BE_REVERSED" }, 409);
  const prior = await findJournalByIdempotency(env, auth.tenant.id, idempotencyKey);
  if (prior) return reply({ ok: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409);
  const already = await env.DB.prepare(
    "SELECT id FROM accounting_journals WHERE tenant_id=? AND reversal_of_journal_id=? LIMIT 1"
  ).bind(auth.tenant.id, journalId).first();
  if (already) return reply({ ok: false, error: "REVERSAL_ALREADY_EXISTS" }, 409);
  const originalLines = await getJournalLines(env, auth.tenant.id, journalId);
  if (originalLines.length < 2) return reply({ ok: false, error: "ORIGINAL_JOURNAL_LINES_MISSING" }, 409);
  const reversalId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const statements = [
    env.DB.prepare(
      "INSERT INTO accounting_journals(id,tenant_id,entity_id,journal_code,journal_date,currency,source_type,source_id,idempotency_key,description,status,created_by,reversal_of_journal_id) VALUES(?,?,?,?,?,?,?,?,?,?,'DRAFT',?,?)"
    ).bind(reversalId, auth.tenant.id, original.entity_id, "REVERSAL", today, original.currency, "REVERSAL", journalId, idempotencyKey, reason, auth.user.id, journalId)
  ];
  for (let i = 0; i < originalLines.length; i++) {
    const line = originalLines[i];
    statements.push(env.DB.prepare(
      "INSERT INTO accounting_journal_lines(id,tenant_id,entity_id,journal_id,account_id,line_number,side,amount_cents,currency,description) VALUES(?,?,?,?,?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(), auth.tenant.id, original.entity_id, reversalId, line.account_id, i + 1,
      line.side === "DEBIT" ? "CREDIT" : "DEBIT", Number(line.amount_cents), original.currency, "Reversal of " + journalId));
  }
  try {
    await env.DB.batch(statements);
    return reply({ ok: true, reversal_journal_id: reversalId, status: "DRAFT", requires_separate_posting: true }, 201);
  } catch {
    return reply({ ok: false, error: "REVERSAL_DRAFT_CREATE_REJECTED" }, 409);
  }
}

async function trialBalance(request, env, auth) {
  if (!roleAllowed(auth, READ_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
  const url = new URL(request.url);
  const entityId = cleanText(url.searchParams.get("entity_id"), 128);
  const asOf = url.searchParams.get("as_of") || new Date().toISOString().slice(0, 10);
  if (!entityId) return reply({ ok: false, error: "ENTITY_ID_REQUIRED" }, 400);
  if (!validIsoDate(asOf)) return reply({ ok: false, error: "AS_OF_DATE_INVALID" }, 400);
  const entity = await requireEntity(env, auth.tenant.id, entityId);
  if (!entity.ok) return entity.response;
  const result = await env.DB.prepare(`
    SELECT a.id AS account_id,a.account_code,a.account_name,a.account_type,a.normal_balance,
           COALESCE(SUM(CASE WHEN j.id IS NOT NULL AND l.side='DEBIT' THEN l.amount_cents ELSE 0 END),0) AS debit_cents,
           COALESCE(SUM(CASE WHEN j.id IS NOT NULL AND l.side='CREDIT' THEN l.amount_cents ELSE 0 END),0) AS credit_cents
      FROM accounting_accounts a
      LEFT JOIN accounting_journal_lines l
        ON l.account_id=a.id AND l.tenant_id=a.tenant_id AND l.entity_id=a.entity_id
      LEFT JOIN accounting_journals j
        ON j.id=l.journal_id AND j.tenant_id=l.tenant_id AND j.entity_id=l.entity_id
       AND j.status='POSTED' AND j.journal_date<=?
     WHERE a.tenant_id=? AND a.entity_id=?
     GROUP BY a.id,a.account_code,a.account_name,a.account_type,a.normal_balance
     ORDER BY a.account_code,a.id
  `).bind(asOf, auth.tenant.id, entityId).all();
  const accounts = (result.results || []).map(row => {
    const debit = Number(row.debit_cents || 0);
    const credit = Number(row.credit_cents || 0);
    return { ...row, debit_cents: debit, credit_cents: credit, balance_cents: row.normal_balance === "DEBIT" ? debit - credit : credit - debit };
  });
  const debitTotal = accounts.reduce((sum, row) => sum + row.debit_cents, 0);
  const creditTotal = accounts.reduce((sum, row) => sum + row.credit_cents, 0);
  return reply({ ok: true, entity_id: entityId, as_of: asOf, accounts, totals: {
    debit_cents: debitTotal, credit_cents: creditTotal, balanced: debitTotal === creditTotal
  }});
}

export async function handleAccountingRoute(request, env, auth) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/accounting/")) return null;
  if (!auth?.user?.id || !auth?.tenant?.id) return reply({ ok: false, error: "TENANT_CONTEXT_REQUIRED" }, 403);
  // Ledger reads are available only after tenant/schema checks. Every mutation
  // remains blocked until explicit human approval and professional accounting review
  // are represented by a separately audited authorization workflow.
  if (request.method !== "GET") {
    return reply({
      ok: false,
      error: "ACCOUNTING_WRITES_DISABLED_PENDING_HUMAN_AND_EXPERT_REVIEW",
      write_enabled: false
    }, 405);
  }
  const readiness = await schemaReadiness(env);
  if (!readiness.ok) return readiness.response;

  if (url.pathname === "/api/accounting/health" && request.method === "GET") {
    return reply({ ok: true, schema_ready: true, scope: "TENANT_SCOPED_DOUBLE_ENTRY_LEDGER", money_movement: false });
  }
  if (url.pathname === "/api/accounting/entities") {
    if (request.method === "GET") {
      if (!roleAllowed(auth, READ_ROLES)) return reply({ ok: false, error: "FORBIDDEN" }, 403);
      return listEntities(env, auth.tenant.id);
    }
    if (request.method === "POST") return createEntity(request, env, auth);
    return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (url.pathname === "/api/accounting/accounts") {
    if (request.method === "GET") return listAccounts(request, env, auth);
    if (request.method === "POST") return createAccount(request, env, auth);
    return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (url.pathname === "/api/accounting/journals") {
    if (request.method === "GET") return listJournals(request, env, auth);
    if (request.method === "POST") return createJournal(request, env, auth);
    return reply({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (url.pathname === "/api/accounting/trial-balance" && request.method === "GET") {
    return trialBalance(request, env, auth);
  }
  const postMatch = url.pathname.match(/^\/api\/accounting\/journals\/([^/]+)\/post$/);
  if (postMatch && request.method === "POST") return postJournal(request, env, auth, postMatch[1]);
  const reverseMatch = url.pathname.match(/^\/api\/accounting\/journals\/([^/]+)\/reverse$/);
  if (reverseMatch && request.method === "POST") return reverseJournal(request, env, auth, reverseMatch[1]);
  const detailMatch = url.pathname.match(/^\/api\/accounting\/journals\/([^/]+)$/);
  if (detailMatch && request.method === "GET") return readJournal(request, env, auth, detailMatch[1]);
  return reply({ ok: false, error: "ACCOUNTING_ROUTE_NOT_FOUND" }, 404);
}
