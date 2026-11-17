-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — commercial/recruitment schema
-- Runtime DDL removed; schema managed through migrations.
CREATE TABLE IF NOT EXISTS commercial_prospects (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'B2B', company_name TEXT, contact_name TEXT,
      email TEXT, phone TEXT, website TEXT, sector TEXT, city TEXT, postal_code TEXT,
      source TEXT, need TEXT, estimated_potential_cents INTEGER, score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'QUALIFICATION', status TEXT NOT NULL DEFAULT 'OPEN',
      next_action TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_commercial_prospects_priority ON commercial_prospects(status,score DESC,updated_at);

CREATE TABLE IF NOT EXISTS commercial_playbooks (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, stage TEXT NOT NULL,
      objective TEXT NOT NULL, script TEXT NOT NULL, objections_json TEXT NOT NULL DEFAULT '[]',
      followup_json TEXT NOT NULL DEFAULT '[]', metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS recruitment_candidates (
      id TEXT PRIMARY KEY, full_name TEXT, email TEXT, phone TEXT, metier_code TEXT,
      city TEXT, radius_km REAL, qualifications_json TEXT NOT NULL DEFAULT '[]',
      documents_status TEXT NOT NULL DEFAULT 'TO_VERIFY', identity_status TEXT NOT NULL DEFAULT 'TO_VERIFY',
      score INTEGER NOT NULL DEFAULT 0, stage TEXT NOT NULL DEFAULT 'SOURCING',
      status TEXT NOT NULL DEFAULT 'OPEN', notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates ON recruitment_candidates(status,score DESC,updated_at);

CREATE TABLE IF NOT EXISTS copilot_growth_actions (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, target_type TEXT NOT NULL, title TEXT NOT NULL,
      recommendation TEXT NOT NULL, expected_impact_json TEXT NOT NULL DEFAULT '{}',
      priority INTEGER NOT NULL DEFAULT 10, status TEXT NOT NULL DEFAULT 'PROPOSED',
      approved_by TEXT, executed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS sales_results (
      id TEXT PRIMARY KEY, prospect_id TEXT, stage TEXT NOT NULL, outcome TEXT NOT NULL,
      amount_cents INTEGER, margin_cents INTEGER, source TEXT, notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
