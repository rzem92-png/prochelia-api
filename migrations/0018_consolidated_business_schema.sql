-- PROCHÉLIA V14.5.7 — consolidated business/pricing/operations schema
-- Seed defaults and FR holiday dates formerly initialized by the Worker helper.
CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS business_profiles (id TEXT PRIMARY KEY, kind TEXT NOT NULL, display_name TEXT, owner_user_id TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS métier_catalog (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, category TEXT, active INTEGER NOT NULL DEFAULT 1, rules_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS metier_suggestions (id TEXT PRIMARY KEY, label TEXT NOT NULL, reason TEXT, source TEXT NOT NULL DEFAULT 'copilot', status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT);

CREATE TABLE IF NOT EXISTS pricing_policies (id TEXT PRIMARY KEY, phase TEXT NOT NULL, service_code TEXT, client_type TEXT NOT NULL, intervenant_floor_cents INTEGER NOT NULL DEFAULT 0, client_ceiling_cents INTEGER NOT NULL DEFAULT 0, platform_fee_fixed_cents INTEGER NOT NULL DEFAULT 0, platform_fee_percent REAL NOT NULL DEFAULT 0, psp_percent REAL NOT NULL DEFAULT 0, psp_fixed_cents INTEGER NOT NULL DEFAULT 0, software_cost_cents INTEGER NOT NULL DEFAULT 0, fuel_cost_per_km_cents INTEGER NOT NULL DEFAULT 0, target_margin_percent REAL NOT NULL DEFAULT 0, market_min_cents INTEGER, market_max_cents INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS pricing_travel_policies (
      id TEXT PRIMARY KEY,
      phase TEXT NOT NULL,
      client_type TEXT NOT NULL CHECK (client_type IN ('B2C','B2B')),
      travel_fee_per_km_cents INTEGER NOT NULL DEFAULT 0 CHECK (travel_fee_per_km_cents >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

DROP INDEX IF EXISTS idx_pricing_travel_policy_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_travel_policy_active
      ON pricing_travel_policies(phase, client_type) WHERE active=1;

CREATE INDEX IF NOT EXISTS idx_pricing_route_owner_expiry
      ON pricing_route_estimates(owner_user_id,status,expires_at);

CREATE TABLE IF NOT EXISTS pricing_route_estimates (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      distance_km REAL NOT NULL CHECK (distance_km >= 0 AND distance_km <= 500),
      status TEXT NOT NULL DEFAULT 'VALID',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS pricing_route_estimate_audit (
      estimate_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      origin_sha256 TEXT NOT NULL,
      destination_sha256 TEXT NOT NULL,
      distance_meters INTEGER NOT NULL,
      duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (estimate_id) REFERENCES pricing_route_estimates(id)
    );

CREATE TABLE IF NOT EXISTS pricing_holidays (
      holiday_date TEXT NOT NULL,
      region_code TEXT NOT NULL DEFAULT 'FR',
      label TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (holiday_date, region_code)
    );

CREATE TABLE IF NOT EXISTS pricing_quotes (id TEXT PRIMARY KEY, phase TEXT NOT NULL, client_type TEXT NOT NULL, service_code TEXT, distance_km REAL NOT NULL DEFAULT 0, duration_minutes INTEGER NOT NULL DEFAULT 0, client_price_cents INTEGER NOT NULL DEFAULT 0, intervenant_amount_cents INTEGER NOT NULL DEFAULT 0, platform_commission_cents INTEGER NOT NULL DEFAULT 0, psp_cost_cents INTEGER NOT NULL DEFAULT 0, software_cost_cents INTEGER NOT NULL DEFAULT 0, fuel_cost_cents INTEGER NOT NULL DEFAULT 0, estimated_margin_cents INTEGER NOT NULL DEFAULT 0, assumptions_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

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
-- National holidays seed set (2026–2030)
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-01-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-04-06','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-05-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-05-08','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-05-14','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-05-25','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-07-14','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-08-15','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-11-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-11-11','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2026-12-25','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-01-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-03-29','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-05-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-05-06','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-05-08','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-05-17','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-07-14','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-08-15','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-11-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-11-11','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2027-12-25','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-01-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-04-17','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-05-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-05-08','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-05-25','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-06-05','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-07-14','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-08-15','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-11-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-11-11','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2028-12-25','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-01-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-04-02','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-05-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-05-08','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-05-10','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-05-21','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-07-14','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-08-15','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-11-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-11-11','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2029-12-25','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-01-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-04-22','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-05-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-05-08','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-05-30','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-06-10','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-07-14','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-08-15','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-11-01','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-11-11','FR','Jour férié national',1);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES('2030-12-25','FR','Jour férié national',1);
-- Default platform settings
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('project_phase','"TEST"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('fuel_cost_per_km_cents','"20"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('default_margin_percent','"15"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('software_monthly_cost_cents','"0"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('automation_policy','"simple_low_impact_auto_sensitive_manager"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('b2b_model','"company_pays_intervenant_platform_bills_commission"');
INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES('b2c_model','"client_pays_platform_platform_pays_intervenant"');
