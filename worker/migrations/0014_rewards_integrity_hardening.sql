-- Migration 0014: Reward Integrity, Gift Claims & Quota Hardening (Phase 8.5.1 Additive)

-- 1. Add total_spins_count to reward_campaigns for atomic CAS quota enforcement
ALTER TABLE reward_campaigns ADD COLUMN total_spins_count INTEGER NOT NULL DEFAULT 0;

-- 2. Reward Gift Claims Table for gift_item fulfillment lifecycle
CREATE TABLE IF NOT EXISTS reward_gift_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
  wheel_id TEXT NOT NULL REFERENCES reward_spin_wheels(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES reward_spin_segments(id) ON DELETE RESTRICT,
  spin_attempt_id TEXT NOT NULL UNIQUE REFERENCES reward_spin_attempts(id) ON DELETE CASCADE,
  claim_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'revoked')),
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT,
  fulfilled_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gift_claims_user_status ON reward_gift_claims(user_id, status);
CREATE INDEX IF NOT EXISTS idx_gift_claims_code ON reward_gift_claims(claim_code);
CREATE INDEX IF NOT EXISTS idx_gift_claims_spin ON reward_gift_claims(spin_attempt_id);

-- 3. Backfill total_spins_count from existing reward_spin_attempts if any
UPDATE reward_campaigns
SET total_spins_count = (
  SELECT COUNT(*)
  FROM reward_spin_attempts rsa
  JOIN reward_spin_wheels rsw ON rsa.wheel_id = rsw.id
  WHERE rsw.campaign_id = reward_campaigns.id AND rsa.status = 'completed'
);

