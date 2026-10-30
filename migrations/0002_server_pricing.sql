-- PROCHÉLIA V14.5.6 — tarification serveur uniquement
-- Migration additive, rejouable et destinée à la préproduction après validation.
-- Ne crée aucune mission, aucun paiement et ne modifie aucune donnée existante.

CREATE TABLE IF NOT EXISTS pricing_policies (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  service_code TEXT,
  client_type TEXT NOT NULL CHECK (client_type IN ('B2C','B2B')),
  intervenant_floor_cents INTEGER NOT NULL DEFAULT 0 CHECK (intervenant_floor_cents >= 0),
  client_ceiling_cents INTEGER NOT NULL DEFAULT 0 CHECK (client_ceiling_cents >= 0),
  platform_fee_fixed_cents INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_fixed_cents >= 0),
  platform_fee_percent REAL NOT NULL DEFAULT 0 CHECK (platform_fee_percent BETWEEN 0 AND 100),
  psp_percent REAL NOT NULL DEFAULT 0 CHECK (psp_percent BETWEEN 0 AND 100),
  psp_fixed_cents INTEGER NOT NULL DEFAULT 0 CHECK (psp_fixed_cents >= 0),
  software_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (software_cost_cents >= 0),
  fuel_cost_per_km_cents INTEGER NOT NULL DEFAULT 0 CHECK (fuel_cost_per_km_cents >= 0),
  target_margin_percent REAL NOT NULL DEFAULT 0 CHECK (target_margin_percent BETWEEN 0 AND 100),
  market_min_cents INTEGER,
  market_max_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_policy_lookup
  ON pricing_policies(active, phase, client_type, service_code);

CREATE TABLE IF NOT EXISTS pricing_service_rates (
  id TEXT PRIMARY KEY,
  prestation_id TEXT NOT NULL,
  service_code TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('B2C','B2B')),
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents > 0),
  intervenant_floor_cents INTEGER NOT NULL CHECK (intervenant_floor_cents >= 0),
  travel_fee_per_km_cents INTEGER NOT NULL DEFAULT 0 CHECK (travel_fee_per_km_cents >= 0),
  regulated_max_cents INTEGER CHECK (regulated_max_cents IS NULL OR regulated_max_cents > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  valid_from TEXT,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prestation_id) REFERENCES prestations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_service_rate_active
  ON pricing_service_rates(prestation_id, client_type, active);

CREATE TABLE IF NOT EXISTS pricing_route_estimates (
  id TEXT PRIMARY KEY,
  distance_km REAL NOT NULL CHECK (distance_km >= 0 AND distance_km <= 500),
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID','EXPIRED','REVOKED')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_holidays (
  holiday_date TEXT NOT NULL,
  region_code TEXT NOT NULL DEFAULT 'FR',
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  PRIMARY KEY (holiday_date, region_code)
);

CREATE TABLE IF NOT EXISTS pricing_quotes (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  client_type TEXT NOT NULL,
  service_code TEXT,
  distance_km REAL NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  client_price_cents INTEGER NOT NULL DEFAULT 0,
  intervenant_amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_commission_cents INTEGER NOT NULL DEFAULT 0,
  psp_cost_cents INTEGER NOT NULL DEFAULT 0,
  software_cost_cents INTEGER NOT NULL DEFAULT 0,
  fuel_cost_cents INTEGER NOT NULL DEFAULT 0,
  estimated_margin_cents INTEGER NOT NULL DEFAULT 0,
  assumptions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
