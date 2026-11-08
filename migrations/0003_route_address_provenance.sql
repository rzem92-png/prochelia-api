-- PROCHÉLIA V14.5.6 — origine de déplacement vérifiée des intervenants
-- Table additive et rejouable ; aucune adresse n'est inventée ni préremplie.
CREATE TABLE IF NOT EXISTS intervenant_route_origins (
  id TEXT PRIMARY KEY,
  intervenant_id TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED','REJECTED')),
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (intervenant_id) REFERENCES intervenants(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_intervenant_route_origin_status
  ON intervenant_route_origins(status, intervenant_id);
