/**
 * Read-only operational summary for the background_jobs queue.
 * Does not expose job IDs, payloads, error text, or execute/retry work.
 */
export async function getBackgroundJobHealth(db, staleMinutes = 15) {
  if (!db || typeof db.prepare !== "function" ||
      !Number.isInteger(staleMinutes) || staleMinutes < 1 || staleMinutes > 1440) {
    return { ok: false, error: "QUEUE_HEALTH_INPUT_INVALID" };
  }
  try {
    const row = await db.prepare(`SELECT
      CURRENT_TIMESTAMP AS snapshot_at,
      COUNT(*) AS total,
      SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='PENDING' AND run_after<=CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS pending_due,
      SUM(CASE WHEN status='PENDING' AND run_after>CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS pending_future,
      SUM(CASE WHEN status='RUNNING' THEN 1 ELSE 0 END) AS running,
      SUM(CASE WHEN status='RUNNING' AND locked_at IS NULL THEN 1 ELSE 0 END) AS running_unlocked,
      SUM(CASE WHEN status='RUNNING' AND locked_at IS NOT NULL AND locked_at<=datetime('now', ?) THEN 1 ELSE 0 END) AS stale_running,
      SUM(CASE WHEN status='WAITING_PROVIDER' THEN 1 ELSE 0 END) AS waiting_provider,
      SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status='DONE' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status='PENDING' AND attempts>=max_attempts THEN 1 ELSE 0 END) AS exhausted_pending,
      SUM(CASE WHEN status NOT IN ('PENDING','RUNNING','WAITING_PROVIDER','FAILED','DONE') THEN 1 ELSE 0 END) AS unknown_status,
      MIN(CASE WHEN status='PENDING' AND run_after<=CURRENT_TIMESTAMP THEN created_at END) AS oldest_due_pending_at,
      MAX(updated_at) AS last_updated_at
      FROM background_jobs`).bind(`-${staleMinutes} minutes`).first();
    if (!row) return { ok: false, error: "QUEUE_HEALTH_UNAVAILABLE" };
    const count = value => {
      const n = Number(value);
      return Number.isSafeInteger(n) && n >= 0 ? n : 0;
    };
    const counts = {
      total: count(row.total),
      pending: count(row.pending),
      pendingDue: count(row.pending_due),
      pendingFuture: count(row.pending_future),
      running: count(row.running),
      runningUnlocked: count(row.running_unlocked),
      staleRunning: count(row.stale_running),
      waitingProvider: count(row.waiting_provider),
      failed: count(row.failed),
      done: count(row.done),
      exhaustedPending: count(row.exhausted_pending),
      unknownStatus: count(row.unknown_status)
    };
    const attention = [];
    if (counts.staleRunning) attention.push("STALE_RUNNING_JOBS");
    if (counts.runningUnlocked) attention.push("RUNNING_WITHOUT_LOCK");
    if (counts.failed) attention.push("FAILED_JOBS");
    if (counts.exhaustedPending) attention.push("EXHAUSTED_PENDING_JOBS");
    if (counts.unknownStatus) attention.push("UNKNOWN_JOB_STATUS");
    if (counts.pendingDue) attention.push("DUE_PENDING_BACKLOG");
    if (counts.waitingProvider) attention.push("WAITING_PROVIDER");
    const status = attention.some(code => [
      "STALE_RUNNING_JOBS", "RUNNING_WITHOUT_LOCK", "FAILED_JOBS",
      "EXHAUSTED_PENDING_JOBS", "UNKNOWN_JOB_STATUS"
    ].includes(code)) ? "NEEDS_REVIEW" : attention.length ? "BACKLOG" : "CLEAR";
    return {
      ok: true,
      readOnly: true,
      status,
      snapshotAt: row.snapshot_at || null,
      staleThresholdMinutes: staleMinutes,
      counts,
      oldestDuePendingAt: row.oldest_due_pending_at || null,
      lastUpdatedAt: row.last_updated_at || null,
      attention
    };
  } catch {
    return { ok: false, error: "QUEUE_HEALTH_UNAVAILABLE" };
  }
}
