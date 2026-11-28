/**
 * Atomically claims one pending background job for a single processor.
 * A false result means the job is not eligible or another worker already claimed it.
 * This helper intentionally does not execute the job or recover stale RUNNING jobs.
 */
export async function claimBackgroundJob(db, jobId) {
  if (!db || typeof db.prepare !== "function" || typeof jobId !== "string" || !jobId.trim()) {
    return false;
  }
  try {
    const result = await db.prepare(`UPDATE background_jobs
      SET status='RUNNING', locked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='PENDING'
        AND run_after<=CURRENT_TIMESTAMP
        AND attempts<max_attempts`)
      .bind(jobId).run();
    return Number(result?.meta?.changes) === 1;
  } catch {
    return false;
  }
}
