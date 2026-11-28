const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeComplaintIdempotencyKey(value) {
  if (typeof value !== "string" || !UUID_V4.test(value)) return null;
  return value.toLowerCase();
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildComplaintIdempotencyIdentity(actor, key, draft, scope) {
  if (!actor || typeof actor.id !== "string" || !actor.id || !["client", "gerante", "entreprise"].includes(actor.role)) return null;
  const normalizedKey = normalizeComplaintIdempotencyKey(key);
  if (!normalizedKey) return null;
  const scopeKey = `complaint:${actor.role}:${actor.id}`;
  return {
    scope: scopeKey,
    keyHash: await sha256Hex(normalizedKey),
    requestHash: await sha256Hex(stableJson({ actorId: actor.id, actorRole: actor.role, draft, scope }))
  };
}

/**
 * Claims a complaint idempotency key and inserts the complaint in the same D1
 * batch. The existing idempotency_records unique(scope, idem_key) constraint
 * arbitrates concurrent requests. The complaint INSERT only runs when this
 * request's exact claim was inserted; a replay cannot create a second row.
 */
export async function reserveComplaintIntake(db, identity, complaintId, complaint) {
  if (!db || typeof db.batch !== "function" || !identity || !complaintId || !complaint) {
    return { ok: false, error: "IDEMPOTENCY_STORAGE_UNAVAILABLE" };
  }
  const initialResponse = JSON.stringify({
    complaint_id: complaintId,
    resolution_case_id: null,
    case_link_status: "PENDING_MANUAL_REVIEW"
  });
  try {
    await db.batch([
      db.prepare(`INSERT INTO idempotency_records
        (id,scope,idem_key,request_hash,response_json,status_code)
        VALUES(?,?,?,?,?,202)
        ON CONFLICT(scope,idem_key) DO NOTHING`)
        .bind(crypto.randomUUID(), identity.scope, identity.keyHash, identity.requestHash, initialResponse),
      db.prepare(`INSERT INTO complaints
        (id,client_type,client_id,company_id,mission_id,category,severity,description)
        SELECT ?,?,?,?,?,?,?,?
        WHERE EXISTS (
          SELECT 1 FROM idempotency_records
          WHERE scope=? AND idem_key=? AND request_hash=? AND response_json=?
        )`)
        .bind(
          complaintId, complaint.client_type, complaint.client_id, complaint.company_id,
          complaint.mission_id, complaint.category, complaint.severity, complaint.description,
          identity.scope, identity.keyHash, identity.requestHash, initialResponse
        )
    ]);
    const record = await db.prepare(`SELECT request_hash,response_json,status_code
      FROM idempotency_records WHERE scope=? AND idem_key=? LIMIT 1`)
      .bind(identity.scope, identity.keyHash).first();
    if (!record) return { ok: false, error: "IDEMPOTENCY_RECORD_MISSING" };
    if (record.request_hash !== identity.requestHash) return { ok: false, error: "IDEMPOTENCY_KEY_REUSED" };
    let response;
    try { response = JSON.parse(record.response_json || ""); } catch { return { ok: false, error: "IDEMPOTENCY_RECORD_INVALID" }; }
    if (!response || typeof response.complaint_id !== "string") return { ok: false, error: "IDEMPOTENCY_RECORD_INVALID" };
    const existingComplaint = await db.prepare("SELECT id,resolution_case_id FROM complaints WHERE id=? LIMIT 1")
      .bind(response.complaint_id).first();
    if (!existingComplaint) return { ok: false, error: "COMPLAINT_RECORD_MISSING" };
    return {
      ok: true,
      created: response.complaint_id === complaintId,
      complaintId: response.complaint_id,
      resolutionCaseId: existingComplaint.resolution_case_id || null
    };
  } catch {
    return { ok: false, error: "IDEMPOTENCY_STORAGE_UNAVAILABLE" };
  }
}

export async function persistComplaintCaseLink(db, identity, complaintId, caseId) {
  if (!db || typeof db.batch !== "function" || !identity || !complaintId || !caseId) return false;
  const responseJson = JSON.stringify({
    complaint_id: complaintId,
    resolution_case_id: caseId,
    case_link_status: "LINKED"
  });
  try {
    await db.batch([
      db.prepare("UPDATE complaints SET resolution_case_id=? WHERE id=?")
        .bind(caseId, complaintId),
      db.prepare(`UPDATE idempotency_records SET response_json=?,status_code=201
        WHERE scope=? AND idem_key=? AND request_hash=?`)
        .bind(responseJson, identity.scope, identity.keyHash, identity.requestHash)
    ]);
    const complaint = await db.prepare("SELECT resolution_case_id FROM complaints WHERE id=? LIMIT 1")
      .bind(complaintId).first();
    const record = await db.prepare("SELECT response_json,status_code FROM idempotency_records WHERE scope=? AND idem_key=? LIMIT 1")
      .bind(identity.scope, identity.keyHash).first();
    return complaint?.resolution_case_id === caseId && record?.status_code === 201 &&
      record?.response_json === responseJson;
  } catch {
    return false;
  }
}
