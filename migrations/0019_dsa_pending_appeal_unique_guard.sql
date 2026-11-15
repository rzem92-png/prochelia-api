-- Repair DSA appeal uniqueness for databases where migration 0018
-- was applied before the partial unique index was added to its source.
-- Additive and idempotent; never execute from request handlers.
CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_appeals_pending
ON moderation_appeals(decision_id, appellant_user_id)
WHERE status IN ('SUBMITTED','UNDER_REVIEW');
