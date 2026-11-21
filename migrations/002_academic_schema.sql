-- 1. Classes/Courses
CREATE TABLE IF NOT EXISTS classes(
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  department VARCHAR(255) NOT NULL DEFAULT '',
  semester VARCHAR(64) NOT NULL DEFAULT '',
  academic_year VARCHAR(32) NOT NULL,
  teacher_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  average_competencies JSONB NOT NULL DEFAULT 
  '{"setup_adherence": 0, "measurement_precision": 0, "data_interpretation": 0,"troubleshooting_safety": 0,"experimental_design":0}'::jsonb,
  common_misconceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code, academic_year),
  CHECK (jsonb_typeof(average_competencies)=('object')),
  CHECK (jsonb_typeof(common_misconceptions)=('array'))
);

-- 2. Class Membership
CREATE TABLE IF NOT EXISTS class_students(
  class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, student_id)
);

-- 3. Assignments
CREATE TABLE IF NOT EXISTS assignments(
  id VARCHAR(64) PRIMARY KEY,
  class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  experiment_id VARCHAR(128) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  total_marks NUMERIC(10,2) NOT NULL CHECK(total_marks>0),
  weight_towards_internal NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(weight_towards_internal BETWEEN 0 AND 100),
  attempts_allowed INTEGER NOT NULL DEFAULT 1 CHECK(attempts_allowed>=1),
  allow_free_exploration BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_by VARCHAR(64) REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP 
);


-- 4. Student submission
CREATE TABLE IF NOT EXISTS submissions(
  id VARCHAR(64) PRIMARY KEY,
  assignment_id VARCHAR(64) NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  student_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  student_name VARCHAR(255) NOT NULL,
  experiment_id VARCHAR(128) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempt_number INTEGER NOT NULL DEFAuLT 1 CHECK(attempt_number>=1),
  total_score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(total_score>=0),
  max_score NUMERIC(10,2) NOT NULL CHECK(max_score>0),
  competency_scores JSONB NOT NULL DEFAULT '{}' ::jsonb,
  task_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_readings_count INTEGER NOT NULL DEFauLT 0 CHECK (data_readings_count>=0),
  instructor_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(jsonb_typeof(competency_scores)='object'),
  CHECK(jsonb_typeof(task_responses)='object'),
  UNIQUE(assignment_id, student_id, attempt_number)
);

-- 5. LOOKUP indexes 
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status_due ON assignments(status, due_date);
CREATE INDEX IF NOT EXISTS idx_submission_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submission_submitted_at ON submissions(submitted_at);