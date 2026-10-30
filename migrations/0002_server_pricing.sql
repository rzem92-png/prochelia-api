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

CREATE TABLE IF NOT EXISTS pricing_travel_policies (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  client_type TEXT NOT NULL CHECK (client_type IN ('B2C','B2B')),
  travel_fee_per_km_cents INTEGER NOT NULL DEFAULT 0 CHECK (travel_fee_per_km_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_travel_policy_active
  ON pricing_travel_policies(phase, client_type, active);

CREATE TABLE IF NOT EXISTS pricing_route_estimates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  distance_km REAL NOT NULL CHECK (distance_km >= 0 AND distance_km <= 500),
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID','EXPIRED','REVOKED')),
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
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  PRIMARY KEY (holiday_date, region_code)
);
INSERT OR IGNORE INTO pricing_holidays(holiday_date,region_code,label,active) VALUES
('2026-01-01','FR','Jour férié national',1),('2026-04-06','FR','Lundi de Pâques',1),('2026-05-01','FR','Fête du Travail',1),('2026-05-08','FR','Victoire 1945',1),('2026-05-14','FR','Ascension',1),('2026-05-25','FR','Lundi de Pentecôte',1),('2026-07-14','FR','Fête nationale',1),('2026-08-15','FR','Assomption',1),('2026-11-01','FR','Toussaint',1),('2026-11-11','FR','Armistice',1),('2026-12-25','FR','Noël',1),
('2027-01-01','FR','Jour férié national',1),('2027-03-29','FR','Lundi de Pâques',1),('2027-05-01','FR','Fête du Travail',1),('2027-05-06','FR','Ascension',1),('2027-05-08','FR','Victoire 1945',1),('2027-05-17','FR','Lundi de Pentecôte',1),('2027-07-14','FR','Fête nationale',1),('2027-08-15','FR','Assomption',1),('2027-11-01','FR','Toussaint',1),('2027-11-11','FR','Armistice',1),('2027-12-25','FR','Noël',1),
('2028-01-01','FR','Jour férié national',1),('2028-04-17','FR','Lundi de Pâques',1),('2028-05-01','FR','Fête du Travail',1),('2028-05-08','FR','Victoire 1945',1),('2028-05-25','FR','Ascension',1),('2028-06-05','FR','Lundi de Pentecôte',1),('2028-07-14','FR','Fête nationale',1),('2028-08-15','FR','Assomption',1),('2028-11-01','FR','Toussaint',1),('2028-11-11','FR','Armistice',1),('2028-12-25','FR','Noël',1),
('2029-01-01','FR','Jour férié national',1),('2029-04-02','FR','Lundi de Pâques',1),('2029-05-01','FR','Fête du Travail',1),('2029-05-08','FR','Victoire 1945',1),('2029-05-10','FR','Ascension',1),('2029-05-21','FR','Lundi de Pentecôte',1),('2029-07-14','FR','Fête nationale',1),('2029-08-15','FR','Assomption',1),('2029-11-01','FR','Toussaint',1),('2029-11-11','FR','Armistice',1),('2029-12-25','FR','Noël',1),
('2030-01-01','FR','Jour férié national',1),('2030-04-22','FR','Lundi de Pâques',1),('2030-05-01','FR','Fête du Travail',1),('2030-05-08','FR','Victoire 1945',1),('2030-05-30','FR','Ascension',1),('2030-06-10','FR','Lundi de Pentecôte',1),('2030-07-14','FR','Fête nationale',1),('2030-08-15','FR','Assomption',1),('2030-11-01','FR','Toussaint',1),('2030-11-11','FR','Armistice',1),('2030-12-25','FR','Noël',1);

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
