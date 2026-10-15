-- Migration 0013: Rewards Management, Voucher Wallet & Lucky Spin (Phase 8.5 Additive)

-- 1. Reward Campaigns
CREATE TABLE IF NOT EXISTS reward_campaigns (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'standard' CHECK (campaign_type IN ('standard', 'lucky_spin', 'quiz_reward', 'seasonal')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'closed', 'archived')),
  start_at TEXT NOT NULL DEFAULT (datetime('now')),
  end_at TEXT,
  total_quota INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 0,
  eligibility_rules_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_campaigns_status ON reward_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_reward_campaigns_code ON reward_campaigns(code);

-- 2. Reward Voucher Templates (DEMO Coupons)
CREATE TABLE IF NOT EXISTS reward_voucher_templates (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES reward_campaigns(id) ON DELETE SET NULL,
  code_prefix TEXT NOT NULL,
  title TEXT NOT NULL,
  discount_display TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_service', 'gift')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  min_order_value INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'all' CHECK (category IN ('all', 'food', 'stay', 'tour', 'gift')),
  category_label TEXT NOT NULL DEFAULT 'Ưu đãi',
  description TEXT NOT NULL,
  terms_conditions TEXT NOT NULL,
  validity_days INTEGER NOT NULL DEFAULT 30,
  total_stock INTEGER NOT NULL DEFAULT -1, -- -1 = unlimited, >= 0 = finite stock
  issued_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_templates_campaign ON reward_voucher_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_templates_status ON reward_voucher_templates(status);

-- 3. Reward Wallet Items (User Issued Vouchers)
CREATE TABLE IF NOT EXISTS reward_wallet_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES reward_voucher_templates(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES reward_campaigns(id) ON DELETE SET NULL,
  voucher_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  discount_display TEXT NOT NULL,
  category TEXT NOT NULL,
  terms_conditions_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'redeemed', 'expired', 'revoked')),
  source_type TEXT NOT NULL CHECK (source_type IN ('lucky_spin', 'quiz_completed', 'admin_grant', 'campaign_claim')),
  source_reference_id TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_wallet_user_status ON reward_wallet_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reward_wallet_code ON reward_wallet_items(voucher_code);
CREATE INDEX IF NOT EXISTS idx_reward_wallet_source ON reward_wallet_items(source_type, source_reference_id);

-- 4. Reward Spin Wheels
CREATE TABLE IF NOT EXISTS reward_spin_wheels (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  cost_entitlement_count INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_spin_wheels_campaign ON reward_spin_wheels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_spin_wheels_status ON reward_spin_wheels(status);

-- 5. Reward Spin Segments (Wheel Prizes)
CREATE TABLE IF NOT EXISTS reward_spin_segments (
  id TEXT PRIMARY KEY,
  wheel_id TEXT NOT NULL REFERENCES reward_spin_wheels(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('voucher', 'no_win', 'gift_item')),
  voucher_template_id TEXT REFERENCES reward_voucher_templates(id) ON DELETE SET NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0),
  total_inventory INTEGER NOT NULL DEFAULT -1, -- -1 = unlimited, >= 0 = finite stock
  awarded_count INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (awarded_count <= total_inventory OR total_inventory = -1)
);
CREATE INDEX IF NOT EXISTS idx_reward_spin_segments_wheel ON reward_spin_segments(wheel_id);

-- 6. Reward Entitlements (User Spin Quotas)
CREATE TABLE IF NOT EXISTS reward_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
  wheel_id TEXT REFERENCES reward_spin_wheels(id) ON DELETE SET NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('free_daily', 'quiz_completed', 'admin_grant', 'campaign_claim')),
  source_event_key TEXT,
  total_granted INTEGER NOT NULL DEFAULT 1 CHECK (total_granted > 0),
  consumed_count INTEGER NOT NULL DEFAULT 0 CHECK (consumed_count >= 0 AND consumed_count <= total_granted),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_entitlements_source_event ON reward_entitlements(user_id, source_event_key) WHERE source_event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reward_entitlements_user_campaign ON reward_entitlements(user_id, campaign_id, grant_type);

-- 7. Reward Spin Attempts (Immutable Spin Ledger)
CREATE TABLE IF NOT EXISTS reward_spin_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wheel_id TEXT NOT NULL REFERENCES reward_spin_wheels(id) ON DELETE CASCADE,
  entitlement_id TEXT REFERENCES reward_entitlements(id) ON DELETE SET NULL,
  segment_id TEXT NOT NULL REFERENCES reward_spin_segments(id) ON DELETE RESTRICT,
  result_type TEXT NOT NULL CHECK (result_type IN ('voucher', 'no_win', 'gift_item')),
  voucher_id TEXT REFERENCES reward_wallet_items(id) ON DELETE SET NULL,
  result_snapshot_json TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_spin_attempts_user ON reward_spin_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reward_spin_attempts_wheel ON reward_spin_attempts(wheel_id);

-- 8. Reward Redemptions (Admin Verification of DEMO Vouchers)
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES reward_wallet_items(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  reason TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_redemptions_voucher_success ON reward_redemptions(voucher_id) WHERE status = 'success';
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_actor ON reward_redemptions(actor, created_at);

-- 9. Reward Audit Events
CREATE TABLE IF NOT EXISTS reward_audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'tourist', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reward_audit_resource ON reward_audit_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_reward_audit_created ON reward_audit_events(created_at);

-- 10. Initial DEMO Seed Data (Clearly marked as DEMO, no real partner commitments)
INSERT OR IGNORE INTO reward_campaigns (
  id, code, title, description, campaign_type, status, start_at, total_quota, per_user_limit, eligibility_rules_json, created_by
) VALUES (
  'cmp-dak-song-2026',
  'DAK_SONG_2026',
  'Du lịch Thông minh Đắk Song 2026 (DEMO)',
  'Chiến dịch ưu đãi và vòng quay may mắn trải nghiệm du lịch Đắk Song (Dữ liệu mô phỏng DEMO).',
  'lucky_spin',
  'published',
  datetime('now', '-1 day'),
  1000,
  5,
  '{"allow_free_daily": true, "quiz_reward_min_score": 20}',
  'system'
);

INSERT OR IGNORE INTO reward_voucher_templates (
  id, campaign_id, code_prefix, title, discount_display, discount_type, discount_value, min_order_value, category, category_label, description, terms_conditions, validity_days, total_stock, status
) VALUES
(
  'tpl-coffee-20',
  'cmp-dak-song-2026',
  'CF-DS20',
  'Thưởng thức Cà phê Đắk Song (DEMO)',
  'Giảm 20%',
  'percentage',
  20,
  100000,
  'food',
  'Ẩm thực',
  'Ưu đãi dùng thử tại các điểm dừng chân cà phê liên kết Đắk Song (Mô phỏng).',
  'Áp dụng đơn từ 100.000đ. Mã ưu đãi DEMO không có giá trị quy đổi tiền mặt.',
  30,
  100,
  'active'
),
(
  'tpl-stay-100k',
  'cmp-dak-song-2026',
  'STAY-100K',
  'Homestay Sinh thái M’nông (DEMO)',
  'Giảm 100K',
  'fixed_amount',
  100000,
  500000,
  'stay',
  'Lưu trú',
  'Ưu đãi lưu trú trải nghiệm văn hóa bản địa Đắk Song (Mô phỏng).',
  'Áp dụng đơn từ 500.000đ. Mỗi đơn áp dụng tối đa 1 voucher DEMO.',
  30,
  50,
  'active'
),
(
  'tpl-vr360-free',
  'cmp-dak-song-2026',
  'VR360-FREE',
  'Trải nghiệm Thực tế ảo VR360 (DEMO)',
  'Miễn phí',
  'free_service',
  0,
  0,
  'tour',
  'Tour & Vé',
  'Vé trải nghiệm tham quan thực tế ảo 3D các danh thắng Đắk Song (Mô phỏng).',
  'Miễn phí trải nghiệm tại trung tâm hỗ trợ du khách. Không quy đổi tiền mặt.',
  60,
  200,
  'active'
);

INSERT OR IGNORE INTO reward_spin_wheels (
  id, campaign_id, title, description, status, cost_entitlement_count
) VALUES (
  'wheel-dak-song-lucky',
  'cmp-dak-song-2026',
  'Vòng quay May mắn Đắk Song (DEMO)',
  'Quay thưởng nhận voucher ẩm thực, lưu trú và quà lưu niệm du lịch Đắk Song.',
  'active',
  1
);

INSERT OR IGNORE INTO reward_spin_segments (
  id, wheel_id, order_index, label, segment_type, voucher_template_id, weight, total_inventory, color
) VALUES
('seg-1', 'wheel-dak-song-lucky', 1, 'Cà phê Giảm 20%', 'voucher', 'tpl-coffee-20', 30, 100, '#10b981'),
('seg-2', 'wheel-dak-song-lucky', 2, 'Chúc bạn may mắn lần sau', 'no_win', NULL, 40, -1, '#94a3b8'),
('seg-3', 'wheel-dak-song-lucky', 3, 'Homestay Giảm 100K', 'voucher', 'tpl-stay-100k', 15, 50, '#f59e0b'),
('seg-4', 'wheel-dak-song-lucky', 4, 'Vé VR360 Miễn phí', 'voucher', 'tpl-vr360-free', 25, 200, '#3b82f6'),
('seg-5', 'wheel-dak-song-lucky', 5, 'Quà lưu niệm Đắk Song', 'gift_item', NULL, 10, 30, '#8b5cf6'),
('seg-6', 'wheel-dak-song-lucky', 6, 'Thêm một chút may mắn', 'no_win', NULL, 40, -1, '#64748b');

