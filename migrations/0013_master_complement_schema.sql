-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — master complement schema
CREATE TABLE IF NOT EXISTS brand_identity (
 id TEXT PRIMARY KEY, brand_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, visual_json TEXT NOT NULL,
 uniqueness_policy_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS brand_assets (
 id TEXT PRIMARY KEY, asset_type TEXT NOT NULL, asset_name TEXT NOT NULL, storage_key TEXT, checksum TEXT, version TEXT,
 status TEXT NOT NULL DEFAULT 'ACTIVE', metadata_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS brand_clearance_log (
 id TEXT PRIMARY KEY, search_type TEXT NOT NULL, term TEXT NOT NULL, source TEXT, result TEXT, evidence_ref TEXT,
 checked_at TEXT DEFAULT CURRENT_TIMESTAMP, notes TEXT
);
CREATE TABLE IF NOT EXISTS interface_profiles (
 id TEXT PRIMARY KEY, role TEXT NOT NULL UNIQUE, config_json TEXT NOT NULL, version TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS support_cases (
 id TEXT PRIMARY KEY, source_role TEXT NOT NULL, requester_id TEXT, company_id TEXT, mission_id TEXT, complaint_id TEXT,
 category TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'LOW', status TEXT NOT NULL DEFAULT 'OPEN', description TEXT,
 proposed_resolution TEXT, resolution TEXT, requires_manager INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS support_case_events (
 id TEXT PRIMARY KEY, case_id TEXT NOT NULL, actor_role TEXT, actor_id TEXT, event_type TEXT NOT NULL, details_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS copilot_resolution_rules (
 id TEXT PRIMARY KEY, scenario_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL, severity TEXT NOT NULL,
 auto_allowed INTEGER NOT NULL DEFAULT 0, manager_approval_required INTEGER NOT NULL DEFAULT 1, steps_json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_cases_status ON support_cases(status,severity,created_at);
CREATE INDEX IF NOT EXISTS idx_support_case_events_case ON support_case_events(case_id,created_at);
CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON brand_assets(asset_type,status);
CREATE INDEX IF NOT EXISTS idx_clearance_term ON brand_clearance_log(term,checked_at);
