-- Migration: 0007_optimistic_lock_guard.sql
-- Optimistic locking assertion table for atomic D1 batch transactions.
-- Enforces rollback of D1 batch if compare-and-swap UPDATE affected 0 rows.

CREATE TABLE IF NOT EXISTS optimistic_lock_guard (
  guard_id INTEGER PRIMARY KEY CHECK (guard_id = 1)
);

