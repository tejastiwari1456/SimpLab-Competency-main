-- SimLab Competency Hub Database Migration: 003_viva_competency_evaluation.sql
-- Adds Firebase UID linking, AI Viva persistence, expanded submission evaluation metadata,
-- and student competency aggregation + history tables.

ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

CREATE TABLE IF NOT EXISTS viva_sessions (
  id VARCHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experiment_id VARCHAR(128) NOT NULL,
  assignment_id VARCHAR(64) REFERENCES assignments(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  status VARCHAR(24) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  overall_score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (overall_score >= 0),
  max_score NUMERIC(10,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  questions_count INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  summary_feedback TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS viva_responses (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES viva_sessions(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL DEFAULT 0,
  task_id VARCHAR(64),
  question_text TEXT NOT NULL,
  competency_dimension VARCHAR(64) NOT NULL,
  rubric TEXT,
  student_answer TEXT NOT NULL,
  score NUMERIC(10,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  max_points NUMERIC(10,2) NOT NULL DEFAULT 30,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  ai_feedback TEXT NOT NULL,
  rubric_criteria_met JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  adaptive_follow_up TEXT,
  ai_model VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS observations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS calculated_results JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS completion_status VARCHAR(24) NOT NULL DEFAULT 'completed';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(32) NOT NULL DEFAULT 'auto_graded';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS viva_session_id VARCHAR(64) REFERENCES viva_sessions(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS faculty_score NUMERIC(10,2);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS student_competencies (
  id VARCHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competency_key VARCHAR(64) NOT NULL,
  score NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  experiment_contribution NUMERIC(6,2) NOT NULL DEFAULT 0,
  viva_contribution NUMERIC(6,2) NOT NULL DEFAULT 0,
  experiments_evaluated INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'developing',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, competency_key)
);

CREATE TABLE IF NOT EXISTS competency_history (
  id VARCHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id VARCHAR(64) REFERENCES submissions(id) ON DELETE SET NULL,
  viva_session_id VARCHAR(64) REFERENCES viva_sessions(id) ON DELETE SET NULL,
  experiment_id VARCHAR(128) NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  competency_scores JSONB NOT NULL,
  overall_score NUMERIC(6,2) NOT NULL,
  delta_overall NUMERIC(6,2) NOT NULL DEFAULT 0,
  calculation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_viva_sessions_student ON viva_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_viva_sessions_student_exp ON viva_sessions(student_id, experiment_id);
CREATE INDEX IF NOT EXISTS idx_viva_sessions_assignment ON viva_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_viva_responses_session ON viva_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_submission_eval_status ON submissions(evaluation_status);
CREATE INDEX IF NOT EXISTS idx_student_comp_student ON student_competencies(student_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_student ON competency_history(student_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_recorded_at ON competency_history(recorded_at);
