-- PROCHÉLIA — cryptographic device credential and single-use challenge foundation.
-- Additive only. This migration does not enroll devices, trust browser headers,
-- enable mission presence, or authorize mission execution by itself.
CREATE TABLE IF NOT EXISTS trusted_device_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  public_key_jwk TEXT NOT NULL CHECK (json_valid(public_key_jwk)),
  key_thumbprint TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'ECDSA_P256_SHA256'
    CHECK (algorithm = 'ECDSA_P256_SHA256'),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked','expired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  UNIQUE (tenant_id, user_id, key_thumbprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_device_credentials_tenant_user_status
  ON trusted_device_credentials(tenant_id, user_id, status, expires_at);

CREATE TABLE IF NOT EXISTS device_auth_challenges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  credential_id TEXT REFERENCES trusted_device_credentials(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('ENROLL','PROVE')),
  challenge_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_auth_challenges_session_expiry
  ON device_auth_challenges(session_id, user_id, tenant_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_device_auth_challenges_pending
  ON device_auth_challenges(expires_at, consumed_at);
