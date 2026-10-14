-- Migration 0015: Atomic Per-User Campaign Quota & Time Hardening (Phase 8.5.2 Additive)

-- 1. Atomic Per-User Completed Spins Tracking Table
CREATE TABLE IF NOT EXISTS reward_user_campaign_spins (
  campaign_id TEXT NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_spins INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_campaign_spins_user ON reward_user_campaign_spins(user_id);

-- 2. Authoritative Backfill from Completed Spin Attempts Ledger
INSERT OR IGNORE INTO reward_user_campaign_spins (campaign_id, user_id, completed_spins, updated_at)
SELECT
  rsw.campaign_id,
  rsa.user_id,
  COUNT(*),
  MAX(rsa.created_at)
FROM reward_spin_attempts rsa
JOIN reward_spin_wheels rsw ON rsa.wheel_id = rsw.id
WHERE rsa.status = 'completed'
GROUP BY rsw.campaign_id, rsa.user_id;

