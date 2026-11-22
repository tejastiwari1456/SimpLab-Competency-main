-- Migration 006: Canonical Class Enrollments & Persistent In-App Notifications
-- Ensures fresh databases provisioned for Vercel or external PostgreSQL match the full SimLab schema.

CREATE TABLE IF NOT EXISTS class_enrollments (
  id VARCHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrollment_status VARCHAR(32) NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_enrollments_student_class_unique
  ON class_enrollments(student_id, class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_status
  ON class_enrollments(class_id, enrollment_status);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student
  ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_enrolled_at
  ON class_enrollments(enrolled_at);

-- Backfill any legacy class_students rows into canonical class_enrollments
INSERT INTO class_enrollments (id, student_id, class_id, enrollment_status, enrolled_at, created_at, updated_at)
SELECT
  'enr-bf-' || SUBSTRING(MD5(cs.student_id || ':' || cs.class_id) FROM 1 FOR 24),
  cs.student_id,
  cs.class_id,
  'active',
  cs.enrolled_at,
  cs.enrolled_at,
  NOW()
FROM class_students cs
ON CONFLICT (student_id, class_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  recipient_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_role VARCHAR(32) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read_created
  ON notifications(recipient_user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(type);
