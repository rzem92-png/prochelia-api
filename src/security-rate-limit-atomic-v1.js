/**
 * PROCHÉLIA — Atomic D1 rate-limit primitive (PREPRODUCTION ONLY)
 *
 * This module is intentionally not wired into the Worker entry point yet.
 * Integrate only after schema/route tests and review.
 *
 * Requirements:
 * - trusted Cloudflare edge only (CF-Connecting-IP); never trust X-Forwarded-For
 * - include authenticated subject/session hash in key, not raw credentials
 * - one atomic SQLite UPSERT per request to avoid SELECT/UPDATE races
 * - fail closed when D1 is unavailable
 */

const LIMIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS security_rate_limits_v2 (
  bucket TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (bucket, subject_hash, window_start)
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_v2_expiry
  ON security_rate_limits_v2(expires_at);
`;

const encoder = new TextEncoder();

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export async function ensureAtomicRateLimitSchema(db) {
  if (!db) throw new Error('DATABASE_REQUIRED');
  // D1 batch is used so schema setup is deterministic; run at controlled
  // preproduction initialization, not as a per-request migration.
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS security_rate_limits_v2 (
      bucket TEXT NOT NULL,
      subject_hash TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (bucket, subject_hash, window_start)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_security_rate_limits_v2_expiry
    ON security_rate_limits_v2(expires_at)
  `).run();
}

/**
 * @param {object} options
 * @param {D1Database} options.db
 * @param {Request} options.request
 * @param {string} options.bucket Stable route/operation bucket
 * @param {number} options.limit Maximum requests per window
 * @param {number} [options.windowSeconds=60]
 * @param {string|null} [options.userId] Authenticated user ID, if available
 * @param {string|null} [options.sessionHash] Hash of session identifier, never raw session
 * @param {number} [options.nowSeconds] Test-only clock injection
 */
export async function enforceAtomicRateLimit({
  db, request, bucket, limit, windowSeconds = 60,
  userId = null, sessionHash = null, nowSeconds = Math.floor(Date.now() / 1000)
}) {
  try {
    if (!db) return { ok: false, response: jsonResponse({ ok: false, error: 'RATE_LIMIT_UNAVAILABLE' }, 503) };
    if (typeof bucket !== 'string' || bucket.length < 1 || bucket.length > 128 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 1000000 ||
        !Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400 ||
        !Number.isSafeInteger(nowSeconds) || nowSeconds < 0 ||
        nowSeconds > Number.MAX_SAFE_INTEGER - windowSeconds - 86400 ||
        (userId !== null && (typeof userId !== 'string' || userId.length < 1 || userId.length > 256)) ||
        (sessionHash !== null && (typeof sessionHash !== 'string' || sessionHash.length < 1 || sessionHash.length > 256))) {
      return { ok: false, response: jsonResponse({ ok: false, error: 'RATE_LIMIT_CONFIG_INVALID' }, 503) };
    }

    // Cloudflare overwrites CF-Connecting-IP at its edge. This Worker must not
    // be directly exposed behind arbitrary proxies that can spoof this header.
    if (!(request instanceof Request)) {
      return { ok: false, response: jsonResponse({ ok: false, error: 'RATE_LIMIT_REQUEST_INVALID' }, 503) };
    }
    const edgeIp = request.headers.get('CF-Connecting-IP');
    // Missing edge identity must never collapse unrelated clients into a shared
    // "unknown" bucket. Fail closed instead of granting or misapplying quota.
    if (!edgeIp || edgeIp.trim() === '' || edgeIp.length > 64 || edgeIp !== edgeIp.trim() ||
        !/^[0-9a-fA-F:.]+$/.test(edgeIp) || (!edgeIp.includes('.') && !edgeIp.includes(':'))) {
      return { ok: false, response: jsonResponse({ ok: false, error: 'RATE_LIMIT_CLIENT_ID_UNAVAILABLE' }, 503) };
    }
    // Enforce independent IP and authenticated-subject quotas. Composite keys
    // alone are insufficient: changing IP must not reset an account quota.
    const subject = typeof userId === 'string' && userId.length > 0 ? `user:${userId}`
      : typeof sessionHash === 'string' && sessionHash.length > 0 ? `session:${sessionHash}`
      : null;
    const ipHash = await sha256Hex(`ip:${edgeIp.trim()}`);
    const subjectHash = subject ? await sha256Hex(subject) : null;
    const start = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
    const expiresAt = start + windowSeconds + 86400; // 24h cleanup grace

    const makeStatement = (hash) => db.prepare(`
      INSERT INTO security_rate_limits_v2
        (bucket, subject_hash, window_start, request_count, expires_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(bucket, subject_hash, window_start)
      DO UPDATE SET request_count = CASE
                      WHEN request_count <= ? THEN request_count + 1
                      ELSE request_count
                    END,
                    expires_at = excluded.expires_at
      RETURNING request_count
    `).bind(bucket, hash, start, expiresAt, limit);

    // D1 batch runs the independent counters atomically. IP quota protects
    // shared/anonymous traffic; subject quota follows a user across IP changes.
    const statements = [makeStatement(ipHash)];
    if (subjectHash) statements.push(makeStatement(subjectHash));
    const batchResults = await db.batch(statements);
    const counts = batchResults.map(result => Number(result?.results?.[0]?.request_count));
    if (counts.length !== statements.length ||
        counts.some(count => !Number.isSafeInteger(count) || count < 1)) {
      return { ok: false, response: jsonResponse({ ok: false, error: 'RATE_LIMIT_UNAVAILABLE' }, 503) };
    }
    const count = Math.max(...counts);

    if (count > limit) {
      const retryAfter = Math.max(1, start + windowSeconds - nowSeconds);
      return {
        ok: false,
        response: jsonResponse(
          { ok: false, error: 'RATE_LIMITED', retry_after_seconds: retryAfter },
          429,
          { 'retry-after': String(retryAfter) }
        )
      };
    }

    return { ok: true, count, remaining: Math.max(0, limit - count) };
  } catch {
    // Fail closed: never allow a sensitive write when quota enforcement failed.
    return { ok: false, response: jsonResponse({ ok: false, error: 'RATE_LIMIT_UNAVAILABLE' }, 503) };
  }
}
