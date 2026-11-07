-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — finance workspace schema
-- Runtime DDL removed; schema managed through migrations.
CREATE TABLE IF NOT EXISTS finance_workspace_entries (
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
    );

CREATE INDEX IF NOT EXISTS idx_finance_workspace_user ON finance_workspace_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_workspace_ref ON finance_workspace_entries(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS finance_export_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      format TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      row_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_finance_export_user ON finance_export_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_resolution_cases (
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
    );

CREATE INDEX IF NOT EXISTS idx_finance_resolution_user ON finance_resolution_cases(user_id, status, created_at DESC);
