-- PROCHÉLIA V14.5.6 — socle métier D1
-- Migration additive et rejouable : aucune suppression, aucun DROP, aucune réinitialisation.
-- Précondition : users et sessions sont déjà créées par le socle d'authentification.
-- À appliquer uniquement sur la base D1 de préproduction après revue du diff.

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS intervenants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  professional_status TEXT,
  description TEXT,
  service_area TEXT,
  hourly_rate REAL,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS prestations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  intervenant_id TEXT,
  prestation_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  address TEXT,
  price_client REAL NOT NULL DEFAULT 0,
  price_intervenant REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (intervenant_id) REFERENCES intervenants(id),
  FOREIGN KEY (prestation_id) REFERENCES prestations(id)
);

CREATE TABLE IF NOT EXISTS tarifs (
  id TEXT PRIMARY KEY,
  prestation_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('habituel','fidelite','negocie')),
  client_price REAL NOT NULL,
  intervenant_price REAL NOT NULL,
  commission REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prestation_id) REFERENCES prestations(id)
);

CREATE TABLE IF NOT EXISTS paiements (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS disponibilites (
  id TEXT PRIMARY KEY,
  intervenant_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  FOREIGN KEY (intervenant_id) REFERENCES intervenants(id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES missions(id),
  FOREIGN KEY (author_user_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS conflits (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS journal (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_intervenants_user ON intervenants(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_client ON missions(client_id);
CREATE INDEX IF NOT EXISTS idx_missions_intervenant ON missions(intervenant_id);
CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(start_at);
CREATE INDEX IF NOT EXISTS idx_disponibilites_intervenant ON disponibilites(intervenant_id);
CREATE INDEX IF NOT EXISTS idx_paiements_mission ON paiements(mission_id);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal(user_id);
