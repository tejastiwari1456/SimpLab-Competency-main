-- Migration 004: Student Module Enhancements
-- Adds adaptive difficulty tracking to AI Viva responses and persistent read state for student notifications.

ALTER TABLE viva_responses
  ADD COLUMN IF NOT EXISTS difficulty VARCHAR(24) NOT NULL DEFAULT 'intermediate';

CREATE TABLE IF NOT EXISTS notification_reads (
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key VARCHAR(160) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);
