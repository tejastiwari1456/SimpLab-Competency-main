-- Migration 005: Faculty Module Enhancements
-- Adds configurable evaluation_criteria JSONB to assignments and immutable evaluation_history audit log.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS evaluation_criteria JSONB NOT NULL DEFAULT '{"practicalWeightPct":70,"vivaWeightPct":30,"passingThresholdPct":70,"requireViva":true,"rubricNotes":""}'::jsonb;

CREATE TABLE IF NOT EXISTS evaluation_history (
  id VARCHAR(64) PRIMARY KEY,
  submission_id VARCHAR(64) NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  evaluator_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  evaluator_name VARCHAR(255) NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  previous_score NUMERIC(10,2),
  new_score NUMERIC(10,2),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_history_submission ON evaluation_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_eval_history_evaluator ON evaluation_history(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_eval_history_created_at ON evaluation_history(created_at);
