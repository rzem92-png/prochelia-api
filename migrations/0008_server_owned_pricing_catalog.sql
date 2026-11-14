-- PROCHÉLIA — serveur-owned pricing catalog
-- All monetary values are integer EUR cents. No implicit conversion from legacy REAL columns.
-- Apply only after review to an isolated validation database first.
CREATE TABLE IF NOT EXISTS pricing_catalog (
  id TEXT PRIMARY KEY,
  prestation_id TEXT NOT NULL,
  service_code TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('TEST','PILOT','PRODUCTION')),
  client_type TEXT NOT NULL CHECK (client_type IN ('B2C','B2B')),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  client_price_cents INTEGER NOT NULL CHECK (client_price_cents BETWEEN 0 AND 100000000),
  intervenant_amount_cents INTEGER NOT NULL CHECK (intervenant_amount_cents BETWEEN 0 AND 100000000),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  effective_from TEXT,
  effective_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prestation_id) REFERENCES prestations(id),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);
CREATE INDEX IF NOT EXISTS idx_pricing_catalog_lookup
  ON pricing_catalog(id, phase, client_type, active, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_pricing_catalog_service
  ON pricing_catalog(service_code, phase, client_type, active);
