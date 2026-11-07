-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — operational schema
CREATE TABLE IF NOT EXISTS action_outbox (
 id TEXT PRIMARY KEY, case_id TEXT, action_type TEXT NOT NULL, entity_type TEXT, entity_id TEXT,
 idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'PENDING', payload_json TEXT NOT NULL DEFAULT '{}',
 result_json TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, executed_at TEXT, processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_action_outbox_status ON action_outbox(status,created_at);
CREATE TABLE IF NOT EXISTS copilot_briefings (
 id TEXT PRIMARY KEY, phase TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 10, category TEXT NOT NULL, title TEXT NOT NULL,
 recommendation TEXT NOT NULL, action_type TEXT, entity_type TEXT, entity_id TEXT, impact_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_copilot_briefings_open ON copilot_briefings(status,priority,created_at);
CREATE TABLE IF NOT EXISTS loyalty_events (
 id TEXT PRIMARY KEY, client_id TEXT, company_id TEXT, event_type TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
 amount_cents INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS loyalty_balances (
 id TEXT PRIMARY KEY, client_id TEXT, company_id TEXT, points INTEGER NOT NULL DEFAULT 0, tier TEXT NOT NULL DEFAULT 'STANDARD',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(client_id,company_id)
);
CREATE TABLE IF NOT EXISTS quality_events (
 id TEXT PRIMARY KEY, mission_id TEXT, client_id TEXT, company_id TEXT, intervenant_id TEXT, rating REAL, category TEXT,
 comment TEXT, severity TEXT NOT NULL DEFAULT 'LOW', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS b2b_leads (
 id TEXT PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT, email TEXT, phone TEXT, source TEXT,
 status TEXT NOT NULL DEFAULT 'NEW', estimated_value_cents INTEGER DEFAULT 0, next_action TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS capacity_snapshots (
 id TEXT PRIMARY KEY, zone_code TEXT, service_code TEXT, snapshot_date TEXT NOT NULL, demand_count INTEGER NOT NULL DEFAULT 0,
 supply_count INTEGER NOT NULL DEFAULT 0, fill_rate REAL NOT NULL DEFAULT 0, unused_capacity INTEGER NOT NULL DEFAULT 0,
 recommendation TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_capacity_date ON capacity_snapshots(snapshot_date,zone_code,service_code);
CREATE TABLE IF NOT EXISTS finance_forecasts (
 id TEXT PRIMARY KEY, period TEXT NOT NULL, scenario TEXT NOT NULL, revenue_cents INTEGER NOT NULL DEFAULT 0,
 commission_cents INTEGER NOT NULL DEFAULT 0, payout_cents INTEGER NOT NULL DEFAULT 0, provider_fee_cents INTEGER NOT NULL DEFAULT 0,
 refund_cents INTEGER NOT NULL DEFAULT 0, estimated_margin_cents INTEGER NOT NULL DEFAULT 0, confidence REAL NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS system_checks (
 id TEXT PRIMARY KEY, check_type TEXT NOT NULL, status TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}',
 checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
