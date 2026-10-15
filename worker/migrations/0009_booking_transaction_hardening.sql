-- Migration 0009: Booking Transaction Hardening, Idempotency & Revenue Reconciliation (Phase 8.3.1 Additive)

-- 1. Database constraint: Mỗi báo giá chỉ được tạo tối đa một đơn đặt
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_bookings_quote_unique ON tour_bookings(quote_id);

-- 2. Database constraint: Mỗi đơn đặt chỉ được có tối đa một giao dịch thành công
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_success_unique ON mock_payment_attempts(booking_id) WHERE status = 'success';

-- 3. Append-only Immutable Refund Ledger
CREATE TABLE IF NOT EXISTS mock_payment_refunds (
  id TEXT PRIMARY KEY,
  payment_attempt_id TEXT NOT NULL REFERENCES mock_payment_attempts(id),
  booking_id TEXT NOT NULL REFERENCES tour_bookings(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  reason TEXT,
  actor TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_attempt ON mock_payment_refunds(payment_attempt_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_booking ON mock_payment_refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_created ON mock_payment_refunds(created_at);

-- 4. Idempotency Records with payload fingerprinting and user-scoping
CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  resource_id TEXT,
  request_hash TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_records(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_user_op ON idempotency_records(user_id, operation);

-- 5. Safe & Idempotent Historical Backfill for existing refunds
INSERT OR IGNORE INTO mock_payment_refunds (id, payment_attempt_id, booking_id, amount, currency, reason, actor, created_at)
SELECT 'rf-backfill-' || id, id, booking_id, refunded_amount, currency, 'Backfill historical refund', 'system', created_at
FROM mock_payment_attempts
WHERE refunded_amount > 0;

