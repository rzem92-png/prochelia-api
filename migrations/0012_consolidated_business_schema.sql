-- PROCHÉLIA — consolidated business and operations schema v1
-- Additive/idempotent schema extracted from ensureConsolidatedSchema. Pricing tables are owned by migration 0002.
-- Includes default platform settings formerly seeded at request time.
-- Reconcile each environment before applying; do not run from request handlers.

CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS business_profiles (id TEXT PRIMARY KEY, kind TEXT NOT NULL, display_name TEXT, owner_user_id TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS métier_catalog (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, category TEXT, active INTEGER NOT NULL DEFAULT 1, rules_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS metier_suggestions (id TEXT PRIMARY KEY, label TEXT NOT NULL, reason TEXT, source TEXT NOT NULL DEFAULT 'copilot', status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT);



CREATE TABLE IF NOT EXISTS operational_cases (id TEXT PRIMARY KEY, case_type TEXT NOT NULL, source TEXT NOT NULL, phase TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 10, status TEXT NOT NULL DEFAULT 'OPEN', auto_mode TEXT NOT NULL DEFAULT 'PROPOSE', client_id TEXT, company_id TEXT, intervenant_id TEXT, mission_id TEXT, impact_level TEXT NOT NULL DEFAULT 'LOW', description TEXT, context_json TEXT NOT NULL DEFAULT '{}', proposed_solution_json TEXT, resolution_json TEXT, requires_manager INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT);

CREATE INDEX IF NOT EXISTS idx_cases_status ON operational_cases(status, priority, created_at);

CREATE TABLE IF NOT EXISTS case_actions (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, action_code TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PROPOSED', payload_json TEXT NOT NULL DEFAULT '{}', result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);

CREATE TABLE IF NOT EXISTS copilot_log (id TEXT PRIMARY KEY, case_id TEXT, action_type TEXT NOT NULL, recommendation TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0, mode TEXT NOT NULL, approved_by TEXT, result TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS activity_journal (id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, result TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS commercial_tasks (id TEXT PRIMARY KEY, company_id TEXT, client_id TEXT, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', due_at TEXT, priority INTEGER NOT NULL DEFAULT 10, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);

CREATE TABLE IF NOT EXISTS recruitment_tasks (id TEXT PRIMARY KEY, candidate_id TEXT, metier_code TEXT, status TEXT NOT NULL DEFAULT 'OPEN', step TEXT NOT NULL DEFAULT 'SCREENING', priority INTEGER NOT NULL DEFAULT 10, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);

CREATE TABLE IF NOT EXISTS complaints (id TEXT PRIMARY KEY, client_type TEXT NOT NULL, client_id TEXT, company_id TEXT, mission_id TEXT, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', severity TEXT NOT NULL DEFAULT 'LOW', description TEXT, resolution_case_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT);

CREATE TABLE IF NOT EXISTS accounting_ledger (id TEXT PRIMARY KEY, reference_type TEXT NOT NULL, reference_id TEXT NOT NULL, account_code TEXT NOT NULL, direction TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', label TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_ledger_ref ON accounting_ledger(reference_type, reference_id, created_at);

CREATE TABLE IF NOT EXISTS business_expenses (id TEXT PRIMARY KEY, category TEXT NOT NULL, supplier TEXT, amount_cents INTEGER NOT NULL, recurring INTEGER NOT NULL DEFAULT 0, period TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS notification_outbox (id TEXT PRIMARY KEY, channel TEXT NOT NULL, recipient_ref TEXT NOT NULL, template TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT);

CREATE TABLE IF NOT EXISTS compliance_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, severity TEXT NOT NULL, entity_type TEXT, entity_id TEXT, status TEXT NOT NULL DEFAULT 'OPEN', details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT);

-- Preserve existing values; only initialize missing settings.
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('project_phase','"TEST"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('fuel_cost_per_km_cents','"20"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('default_margin_percent','"15"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('software_monthly_cost_cents','"0"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('automation_policy','"simple_low_impact_auto_sensitive_manager"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('b2b_model','"company_pays_intervenant_platform_bills_commission"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('b2c_model','"client_pays_platform_platform_pays_intervenant"');
