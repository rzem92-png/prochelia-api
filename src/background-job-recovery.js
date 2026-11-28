/**
 * Conservative quarantine for expired background jobs.
 * This never replays work: uncertain side effects must be reconciled by a human.
 */
export async function quarantineStaleBackgroundJobs(db, options = {}) {
  const staleMinutes = options.staleMinutes ?? 120;
  const limit = options.limit ?? 25;
  const audit = options.audit;
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function" ||
      !Number.isInteger(staleMinutes) || staleMinutes < 60 || staleMinutes > 1440 ||
      !Number.isInteger(limit) || limit < 1 || limit > 25 ||
      !audit || typeof audit.actorType !== "string" || !audit.actorType.trim() ||
      typeof audit.actorId !== "string" || !audit.actorId.trim()) {
    return { ok: false, error: "STALE_JOB_QUARANTINE_INPUT_INVALID" };
  }

  try {
    const query = await db.prepare(`SELECT id, COALESCE(locked_at, updated_at) AS stale_marker
      FROM background_jobs
      WHERE status='RUNNING'
        AND COALESCE(locked_at, updated_at)<=datetime('now', ?)
      ORDER BY COALESCE(locked_at, updated_at) ASC
      LIMIT ?`).bind(`-${staleMinutes} minutes`, limit).all();
    if (!Array.isArray(query?.results) || query.results.length > limit) {
      return { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" };
    }
    const candidates = query.results;
    if (candidates.some(row => !row || typeof row.id !== "string" || !row.id ||
        typeof row.stale_marker !== "string" || !row.stale_marker)) {
      return { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" };
    }

    const updates = candidates.map(row => db.prepare(`UPDATE background_jobs
      SET status='FAILED',
          attempts=CASE WHEN attempts<max_attempts THEN attempts+1 ELSE attempts END,
          locked_at=NULL,
          last_error='LEASE_EXPIRED_REQUIRES_MANUAL_RECONCILIATION',
          updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='RUNNING'
        AND COALESCE(locked_at, updated_at)=?
        AND COALESCE(locked_at, updated_at)<=datetime('now', ?)`).bind(
          row.id, row.stale_marker, `-${staleMinutes} minutes`
        ));

    // The audit insert is in the same D1 batch as the conditional updates.
    // Candidate IDs and job payloads are intentionally not written to the audit metadata.
    const auditStatement = db.prepare(`INSERT INTO activity_journal
      (id,actor_type,actor_id,action,entity_type,entity_id,result,metadata_json)
      VALUES(?,?,?,?,?,?,?,?)`).bind(
        crypto.randomUUID(),
        audit.actorType,
        audit.actorId,
        "BACKGROUND_JOBS_STALE_QUARANTINE",
        "background_jobs",
        null,
        "ATTEMPTED",
        JSON.stringify({
          candidateCount: candidates.length,
          staleMinutes,
          limit,
          automaticRetry: false,
          humanReconciliationRequired: true
        })
      );

    const results = await db.batch([...updates, auditStatement]);
    if (!Array.isArray(results) || results.length !== updates.length + 1) {
      return { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" };
    }
    const auditChanges = Number(results[results.length - 1]?.meta?.changes);
    if (auditChanges !== 1) return { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" };
    let quarantined = 0;
    for (const result of results.slice(0, updates.length)) {
      const changes = Number(result?.meta?.changes);
      if (changes === 1) quarantined += 1;
      else if (changes !== 0) return { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" };
    }
    return {
      ok: true,
      readOnlyReplayPolicy: "NO_AUTOMATIC_RETRY",
      scanned: candidates.length,
      quarantined,
      skipped: candidates.length - quarantined,
      staleMinutes,
      limit,
      automaticRetry: false,
      humanReconciliationRequired: true
    };
  } catch {
    return { ok: false, error: "STALE_JOB_QUARANTINE_UNAVAILABLE" };
  }
}
