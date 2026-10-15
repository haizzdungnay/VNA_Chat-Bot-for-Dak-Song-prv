-- Migration 0012: Quiz Scoring Config Snapshot & Schedule Hardening

ALTER TABLE quiz_attempts ADD COLUMN score_per_question INTEGER NOT NULL DEFAULT 10;
