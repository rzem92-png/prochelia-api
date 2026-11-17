-- PROCHÉLIA V14.5.7-EXPERT-PREPRODUCTION — strategic schema
-- Runtime DDL removed; schema managed through migrations.
CREATE TABLE IF NOT EXISTS promotions (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, type TEXT NOT NULL, phase TEXT NOT NULL,
 client_type TEXT NOT NULL DEFAULT 'ALL', service_code TEXT, zone_code TEXT, discount_type TEXT NOT NULL DEFAULT 'PERCENT',
 discount_value REAL NOT NULL DEFAULT 0, min_amount_cents INTEGER NOT NULL DEFAULT 0, max_discount_cents INTEGER,
 budget_cents INTEGER, used_cents INTEGER NOT NULL DEFAULT 0, target_margin_percent REAL NOT NULL DEFAULT 0,
 intervenant_protection_cents INTEGER NOT NULL DEFAULT 0, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT', auto_apply INTEGER NOT NULL DEFAULT 0, requires_manager INTEGER NOT NULL DEFAULT 1,
 rationale TEXT, rules_json TEXT NOT NULL DEFAULT '{}', created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(status, phase, client_type, starts_at, ends_at);
CREATE TABLE IF NOT EXISTS promotion_recommendations (
 id TEXT PRIMARY KEY, promotion_id TEXT, phase TEXT NOT NULL, service_code TEXT, client_type TEXT NOT NULL, zone_code TEXT,
 recommendation_type TEXT NOT NULL, suggested_discount_type TEXT NOT NULL, suggested_discount_value REAL NOT NULL,
 expected_conversion REAL, expected_revenue_cents INTEGER, expected_margin_cents INTEGER, risk_level TEXT NOT NULL DEFAULT 'LOW',
 rationale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PROPOSED', approved_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_promotion_reco_status ON promotion_recommendations(status, created_at);
CREATE TABLE IF NOT EXISTS commercial_events (
 id TEXT PRIMARY KEY, event_type TEXT NOT NULL, client_id TEXT, company_id TEXT, promotion_id TEXT, service_code TEXT, zone_code TEXT,
 amount_cents INTEGER, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commercial_events ON commercial_events(event_type, created_at);
CREATE TABLE IF NOT EXISTS market_signals (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, signal_type TEXT NOT NULL, service_code TEXT, zone_code TEXT, observed_value REAL,
 unit TEXT, confidence REAL NOT NULL DEFAULT 0, observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_market_signals ON market_signals(signal_type, service_code, zone_code, observed_at);
CREATE TABLE IF NOT EXISTS client_value_scores (
 id TEXT PRIMARY KEY, client_id TEXT, company_id TEXT, segment TEXT NOT NULL, score REAL NOT NULL DEFAULT 0,
 churn_risk REAL NOT NULL DEFAULT 0, lifetime_value_cents INTEGER NOT NULL DEFAULT 0, last_activity_at TEXT,
 next_best_action TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(client_id, company_id)
);
CREATE TABLE IF NOT EXISTS strategic_alerts (
 id TEXT PRIMARY KEY, alert_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'MEDIUM', entity_type TEXT, entity_id TEXT,
 recommendation TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT
);
