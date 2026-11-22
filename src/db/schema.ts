import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export type CompetencyScoresJson = {
  setup_adherence: number;
  measurement_precision: number;
  data_interpretation: number;
  troubleshooting_safety: number;
  experimental_design: number;
};

export type MisconceptionJson = {
  title: string;
  affectedPercentage: number;
  relatedExperiment: string;
  recommendedRemediation: string;
};

export type AssignmentEvaluationCriteriaJson = {
  practicalWeightPct: number;
  vivaWeightPct: number;
  passingThresholdPct: number;
  requireViva: boolean;
  rubricNotes?: string;
};

export type NotificationMetadataJson = {
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  studentEnrollmentCode?: string | null;
  classId?: string;
  classCode?: string;
  className?: string;
  enrollmentId?: string;
  enrolledAt?: string;
  actionPath?: string;
  severity?: "info" | "success" | "warning" | "urgent";
};

// 1. Users Table
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    firebaseUid: varchar("firebase_uid", { length: 128 }).unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull(), // 'student' | 'teacher' | 'admin'
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
    institution: varchar("institution", { length: 255 }).notNull().default(""),
    enrollmentCode: varchar("enrollment_code", { length: 128 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_role").on(table.role),
    index("idx_users_status").on(table.status),
    index("idx_users_firebase_uid").on(table.firebaseUid),
  ]
);

// 2. Sessions Table
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"), // 'ACTIVE' | 'LOGGED_OUT' | 'REVOKED' | 'EXPIRED'
    isRevoked: boolean("is_revoked").notNull().default(false),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_status").on(table.status),
    index("idx_sessions_expires_at").on(table.expiresAt),
    uniqueIndex("idx_sessions_token_hash_unique").on(table.tokenHash),
    index("idx_sessions_refresh_hash").on(table.refreshTokenHash),
  ]
);

// 3. Authentication & Security Audit Events Table
export const authEvents = pgTable(
  "auth_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    success: boolean("success").notNull(),
    sessionId: varchar("session_id", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_auth_events_user_id").on(table.userId),
    index("idx_auth_events_created_at").on(table.createdAt),
    index("idx_auth_events_event_type").on(table.eventType),
  ]
);

// 4. Password Resets Table
export const passwordResets = pgTable(
  "password_resets",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_password_resets_token_hash").on(table.tokenHash)]
);

// 5. Classes / Batches Table
export const classes = pgTable(
  "classes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    department: varchar("department", { length: 255 }).notNull().default(""),
    semester: varchar("semester", { length: 64 }).notNull().default(""),
    academicYear: varchar("academic_year", { length: 32 }).notNull(),
    teacherId: varchar("teacher_id", { length: 64 }).references(() => users.id, {
      onDelete: "set null",
    }),
    averageCompetencies: jsonb("average_competencies")
      .$type<CompetencyScoresJson>()
      .notNull()
      .default({
        setup_adherence: 0,
        measurement_precision: 0,
        data_interpretation: 0,
        troubleshooting_safety: 0,
        experimental_design: 0,
      }),
    commonMisconceptions: jsonb("common_misconceptions")
      .$type<MisconceptionJson[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_classes_code_year_unique").on(table.code, table.academicYear),
    index("idx_classes_teacher").on(table.teacherId),
  ]
);

// 6. Legacy Class Membership Table (retained for safe migration; canonical source is class_enrollments)
export const classStudents = pgTable(
  "class_students",
  {
    classId: varchar("class_id", { length: 64 })
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.classId, table.studentId] }),
    index("idx_class_students_student").on(table.studentId),
  ]
);

// 6b. Canonical Class Enrollments Table (Single Source of Truth for Student-Class Rosters)
export const classEnrollments = pgTable(
  "class_enrollments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    studentId: varchar("student_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 64 })
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    enrollmentStatus: varchar("enrollment_status", { length: 32 })
      .notNull()
      .default("active"), // 'active' | 'dropped' | 'completed'
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_class_enrollments_student_class_unique").on(
      table.studentId,
      table.classId
    ),
    index("idx_class_enrollments_class_status").on(table.classId, table.enrollmentStatus),
    index("idx_class_enrollments_student").on(table.studentId),
    index("idx_class_enrollments_enrolled_at").on(table.enrolledAt),
  ]
);

// 7. Experiment Assignments Table
export const assignments = pgTable(
  "assignments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    classId: varchar("class_id", { length: 64 })
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    experimentId: varchar("experiment_id", { length: 128 }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    totalMarks: numeric("total_marks", { precision: 10, scale: 2 }).notNull(),
    weightTowardsInternal: numeric("weight_towards_internal", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("0"),
    attemptsAllowed: integer("attempts_allowed").notNull().default(1),
    allowFreeExploration: boolean("allow_free_exploration").notNull().default(false),
    evaluationCriteria: jsonb("evaluation_criteria")
      .$type<AssignmentEvaluationCriteriaJson>()
      .notNull()
      .default({
        practicalWeightPct: 70,
        vivaWeightPct: 30,
        passingThresholdPct: 70,
        requireViva: true,
        rubricNotes: "",
      }),
    status: varchar("status", { length: 16 }).notNull().default("active"), // 'active' | 'archived'
    createdBy: varchar("created_by", { length: 64 }).references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_assignments_class").on(table.classId),
    index("idx_assignments_status_due").on(table.status, table.dueDate),
  ]
);

// 8. AI Viva Sessions Table
export const vivaSessions = pgTable(
  "viva_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    studentId: varchar("student_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    experimentId: varchar("experiment_id", { length: 128 }).notNull(),
    assignmentId: varchar("assignment_id", { length: 64 }).references(() => assignments.id, {
      onDelete: "set null",
    }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: varchar("status", { length: 24 }).notNull().default("in_progress"), // 'in_progress' | 'completed'
    overallScore: numeric("overall_score", { precision: 10, scale: 2 }).notNull().default("0"),
    maxScore: numeric("max_score", { precision: 10, scale: 2 }).notNull().default("100"),
    questionsCount: integer("questions_count").notNull().default(0),
    answeredCount: integer("answered_count").notNull().default(0),
    summaryFeedback: text("summary_feedback"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_viva_sessions_student").on(table.studentId),
    index("idx_viva_sessions_student_exp").on(table.studentId, table.experimentId),
    index("idx_viva_sessions_assignment").on(table.assignmentId),
  ]
);

// 9. AI Viva Question & Answer Evaluations Table
export const vivaResponses = pgTable(
  "viva_responses",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    sessionId: varchar("session_id", { length: 64 })
      .notNull()
      .references(() => vivaSessions.id, { onDelete: "cascade" }),
    questionIndex: integer("question_index").notNull().default(0),
    taskId: varchar("task_id", { length: 64 }),
    questionText: text("question_text").notNull(),
    competencyDimension: varchar("competency_dimension", { length: 64 }).notNull(),
    rubric: text("rubric"),
    studentAnswer: text("student_answer").notNull(),
    score: numeric("score", { precision: 10, scale: 2 }).notNull(), // 0-100 percentage score
    maxPoints: numeric("max_points", { precision: 10, scale: 2 }).notNull().default("30"),
    passed: boolean("passed").notNull().default(false),
    aiFeedback: text("ai_feedback").notNull(),
    rubricCriteriaMet: jsonb("rubric_criteria_met").$type<string[]>().notNull().default([]),
    missingConcepts: jsonb("missing_concepts").$type<string[]>().notNull().default([]),
    adaptiveFollowUp: text("adaptive_follow_up"),
    difficulty: varchar("difficulty", { length: 24 }).notNull().default("intermediate"), // 'foundation' | 'intermediate' | 'advanced'
    aiModel: varchar("ai_model", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_viva_responses_session").on(table.sessionId)]
);

// 10. Student Experiment Submissions Table
export const submissions = pgTable(
  "submissions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    assignmentId: varchar("assignment_id", { length: 64 })
      .notNull()
      .references(() => assignments.id, { onDelete: "restrict" }),
    studentId: varchar("student_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    studentName: varchar("student_name", { length: 255 }).notNull(),
    experimentId: varchar("experiment_id", { length: 128 }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    totalScore: numeric("total_score", { precision: 10, scale: 2 }).notNull().default("0"),
    maxScore: numeric("max_score", { precision: 10, scale: 2 }).notNull(),
    competencyScores: jsonb("competency_scores")
      .$type<CompetencyScoresJson>()
      .notNull(),
    taskResponses: jsonb("task_responses")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    observations: jsonb("observations")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    calculatedResults: jsonb("calculated_results")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    dataReadingsCount: integer("data_readings_count").notNull().default(0),
    completionStatus: varchar("completion_status", { length: 24 })
      .notNull()
      .default("completed"), // 'draft' | 'submitted' | 'completed'
    evaluationStatus: varchar("evaluation_status", { length: 32 })
      .notNull()
      .default("auto_graded"), // 'pending' | 'auto_graded' | 'ai_evaluated' | 'faculty_reviewed' | 'needs_revision'
    vivaSessionId: varchar("viva_session_id", { length: 64 }).references(() => vivaSessions.id, {
      onDelete: "set null",
    }),
    facultyScore: numeric("faculty_score", { precision: 10, scale: 2 }),
    instructorFeedback: text("instructor_feedback"),
    evaluatedBy: varchar("evaluated_by", { length: 64 }).references(() => users.id, {
      onDelete: "set null",
    }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_submissions_assignment_student_attempt").on(
      table.assignmentId,
      table.studentId,
      table.attemptNumber
    ),
    index("idx_submission_assignment").on(table.assignmentId),
    index("idx_submission_student").on(table.studentId),
    index("idx_submission_submitted_at").on(table.submittedAt),
    index("idx_submission_eval_status").on(table.evaluationStatus),
  ]
);

// 11. Aggregated Student Competencies Table
export const studentCompetencies = pgTable(
  "student_competencies",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    studentId: varchar("student_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    competencyKey: varchar("competency_key", { length: 64 }).notNull(),
    score: numeric("score", { precision: 6, scale: 2 }).notNull().default("0"),
    experimentContribution: numeric("experiment_contribution", {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default("0"),
    vivaContribution: numeric("viva_contribution", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    experimentsEvaluated: integer("experiments_evaluated").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("developing"), // 'strong' | 'proficient' | 'developing' | 'weak'
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_student_comp_unique").on(table.studentId, table.competencyKey),
    index("idx_student_comp_student").on(table.studentId),
  ]
);

// 12. Competency Progression History Table
export const competencyHistory = pgTable(
  "competency_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    studentId: varchar("student_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submissionId: varchar("submission_id", { length: 64 }).references(() => submissions.id, {
      onDelete: "set null",
    }),
    vivaSessionId: varchar("viva_session_id", { length: 64 }).references(() => vivaSessions.id, {
      onDelete: "set null",
    }),
    experimentId: varchar("experiment_id", { length: 128 }).notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    competencyScores: jsonb("competency_scores")
      .$type<CompetencyScoresJson>()
      .notNull(),
    overallScore: numeric("overall_score", { precision: 6, scale: 2 }).notNull(),
    deltaOverall: numeric("delta_overall", { precision: 6, scale: 2 }).notNull().default("0"),
    calculationMetadata: jsonb("calculation_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_comp_history_student").on(table.studentId),
    index("idx_comp_history_recorded_at").on(table.recordedAt),
  ]
);

// 13. Student Notification Read-State Table
export const notificationReads = pgTable(
  "notification_reads",
  {
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationKey: varchar("notification_key", { length: 160 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.notificationKey] }),
    index("idx_notification_reads_user").on(table.userId),
  ]
);

// 14. Faculty Submission Evaluation History Table
export const evaluationHistory = pgTable(
  "evaluation_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    submissionId: varchar("submission_id", { length: 64 })
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    evaluatorId: varchar("evaluator_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    evaluatorName: varchar("evaluator_name", { length: 255 }).notNull(),
    previousStatus: varchar("previous_status", { length: 32 }),
    newStatus: varchar("new_status", { length: 32 }).notNull(),
    previousScore: numeric("previous_score", { precision: 10, scale: 2 }),
    newScore: numeric("new_score", { precision: 10, scale: 2 }),
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_eval_history_submission").on(table.submissionId),
    index("idx_eval_history_evaluator").on(table.evaluatorId),
    index("idx_eval_history_created_at").on(table.createdAt),
  ]
);

// 15. Persistent In-App Notifications Table (Faculty Enrollments, Admin Alerts, etc.)
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    recipientUserId: varchar("recipient_user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientRole: varchar("recipient_role", { length: 32 }).notNull(), // 'teacher' | 'admin' | 'student'
    type: varchar("type", { length: 64 }).notNull(), // 'student_enrolled' | 'missing_faculty_assignment'
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata")
      .$type<NotificationMetadataJson>()
      .notNull()
      .default({}),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notifications_recipient_read_created").on(
      table.recipientUserId,
      table.isRead,
      table.createdAt
    ),
    index("idx_notifications_recipient_created").on(
      table.recipientUserId,
      table.createdAt
    ),
    index("idx_notifications_type").on(table.type),
  ]
);

// --- Drizzle ORM Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  authEvents: many(authEvents),
  taughtClasses: many(classes),
  enrollments: many(classEnrollments),
  legacyEnrollments: many(classStudents),
  submissions: many(submissions),
  vivaSessions: many(vivaSessions),
  competencies: many(studentCompetencies),
  competencyHistory: many(competencyHistory),
  notificationReads: many(notificationReads),
  notifications: many(notifications),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classes.teacherId],
    references: [users.id],
  }),
  enrollments: many(classEnrollments),
  students: many(classStudents),
  assignments: many(assignments),
}));

export const classStudentsRelations = relations(classStudents, ({ one }) => ({
  course: one(classes, {
    fields: [classStudents.classId],
    references: [classes.id],
  }),
  student: one(users, {
    fields: [classStudents.studentId],
    references: [users.id],
  }),
}));

export const classEnrollmentsRelations = relations(classEnrollments, ({ one }) => ({
  course: one(classes, {
    fields: [classEnrollments.classId],
    references: [classes.id],
  }),
  student: one(users, {
    fields: [classEnrollments.studentId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  course: one(classes, {
    fields: [assignments.classId],
    references: [classes.id],
  }),
  submissions: many(submissions),
  vivaSessions: many(vivaSessions),
}));

export const vivaSessionsRelations = relations(vivaSessions, ({ one, many }) => ({
  student: one(users, {
    fields: [vivaSessions.studentId],
    references: [users.id],
  }),
  assignment: one(assignments, {
    fields: [vivaSessions.assignmentId],
    references: [assignments.id],
  }),
  responses: many(vivaResponses),
}));

export const vivaResponsesRelations = relations(vivaResponses, ({ one }) => ({
  session: one(vivaSessions, {
    fields: [vivaResponses.sessionId],
    references: [vivaSessions.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, {
    fields: [submissions.studentId],
    references: [users.id],
  }),
  vivaSession: one(vivaSessions, {
    fields: [submissions.vivaSessionId],
    references: [vivaSessions.id],
  }),
}));
