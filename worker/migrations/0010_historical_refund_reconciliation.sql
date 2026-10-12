-- Migration 0010: Historical Refund Timestamp Reconciliation (Phase 8.3.2 Additive)

ALTER TABLE mock_payment_refunds ADD COLUMN timestamp_provenance TEXT DEFAULT 'exact';

-- Reconcile backfilled records that have a verified booking_state_event
UPDATE mock_payment_refunds
SET
  created_at = (
    SELECT bse.created_at
    FROM booking_state_events bse
    WHERE bse.booking_id = mock_payment_refunds.booking_id
      AND bse.event_type = 'refunded'
    ORDER BY bse.created_at DESC
    LIMIT 1
  ),
  timestamp_provenance = 'state_event_recovered'
WHERE id LIKE 'rf-backfill-%'
  AND EXISTS (
    SELECT 1
    FROM booking_state_events bse
    WHERE bse.booking_id = mock_payment_refunds.booking_id
      AND bse.event_type = 'refunded'
  );

-- For any backfilled record without state event, explicitly mark provenance as uncertain
UPDATE mock_payment_refunds
SET timestamp_provenance = 'uncertain_payment_fallback'
WHERE id LIKE 'rf-backfill-%'
  AND timestamp_provenance = 'exact';
