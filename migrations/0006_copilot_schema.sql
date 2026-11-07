-- PROCHÉLIA V14.5.7 — Copilot persistence schema
-- Runtime schema creation is prohibited; apply through the migration pipeline only.
CREATE TABLE IF NOT EXISTS copilot_interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  scenario_key TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_copilot_interactions_user_date
  ON copilot_interactions(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS copilot_action_plans (
  id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  scenario_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROPOSED',
  approval_required INTEGER NOT NULL DEFAULT 0,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_copilot_plans_user_date
  ON copilot_action_plans(user_id,created_at DESC);
