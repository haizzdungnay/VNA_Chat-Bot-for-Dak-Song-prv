-- Migration 0004: Admin Dashboard extension (Additive and forward-only)

CREATE TABLE IF NOT EXISTS admin_ai_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'openai-compatible',
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  reasoning_effort TEXT DEFAULT 'low',
  json_mode INTEGER NOT NULL DEFAULT 0,
  encrypted_api_key TEXT NOT NULL,
  key_suffix TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  test_status TEXT NOT NULL DEFAULT 'untested',
  test_error TEXT,
  last_tested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_profiles_active ON admin_ai_profiles(is_active);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at);

CREATE TABLE IF NOT EXISTS visitor_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  address_as TEXT,
  age_group TEXT,
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_visitor_profiles_deleted ON visitor_profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_visitor_profiles_consented ON visitor_profiles(consented_at);

CREATE TABLE IF NOT EXISTS admin_telemetry_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER,
  tokens_used INTEGER,
  error_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_telemetry_created ON admin_telemetry_events(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_telemetry_type ON admin_telemetry_events(event_type);

