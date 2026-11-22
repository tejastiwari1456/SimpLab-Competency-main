import "dotenv/config";
import crypto from "crypto";
import express, { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { registerPairLabRestRoutes } from "../../pairLabServer";
import { authRouter } from "../../auth.controller";
import { requireAuth, requireRole, AuthenticatedRequest } from "../../auth.middleware";
import { authService } from "../../auth.service";
import {
  checkDatabaseHealth,
  db,
  getDatabaseConfigSummary,
} from "../db/index";
import {
  assignments,
  authEvents,
  classes,
  classEnrollments,
  sessions,
  submissions,
  users,
} from "../db/schema";
import {
  evaluateVivaWithGemini,
  GeminiServiceError,
  generateMentorReplyWithGemini,
  generateSocraticHintWithGemini,
  isGeminiConfigured,
} from "./geminiClient";
import {
  completeVivaSession,
  getStudentVivaSessions,
  getVivaSessionById,
  startVivaSession,
  submitVivaAnswer,
} from "./vivaService";
import {
  createStudentSubmission,
  evaluateSubmissionByFaculty,
  getAdminInstitutionsSummary,
  getAllSubmissionsAdmin,
  getStudentCompetencyReport,
  getStudentExperimentsStatus,
  getStudentSubmissionsList,
  getSubmissionById,
  getTeacherClassStudents,
  getTeacherSubmissionsList,
  syncCompetenciesAfterVivaCompletion,
} from "./submissionService";
import { getExperimentById } from "./experimentCatalog";
import { getStudentRecommendations } from "./recommendationEngine";
import {
  getPersistentNotificationsForUser,
  getStudentNotifications,
  markAllNotificationsRead,
  markAllPersistentNotificationsRead,
  markNotificationRead,
  markPersistentNotificationRead,
} from "./notificationService";
import {
  buildFacultyCsvExport,
  generateFacultyAiInsights,
  getAuthorizedStudentReportForTeacher,
  getFacultyCompetencyAnalytics,
  getFacultyDashboardSummary,
  getFacultyHistoricalReport,
} from "./facultyService";
import {
  assignFacultyToClassByAdmin,
  enrollExistingStudentByAdmin,
  listAvailableClassesForRegistration,
  listClassesForAdmin,
} from "./enrollmentService";

export const app = express();

// Trust Vercel / reverse-proxy forwarded headers so req.ip & rate-limiting work accurately
app.set("trust proxy", 1);

// Security headers compatible with iframe embedding
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(express.json({ limit: "1mb" }));

/**
 * Helper to translate typed service errors into clean HTTP status codes
 */
function handleServiceError(res: Response, error: any, fallbackMessage: string) {
  if (error instanceof GeminiServiceError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      error: error.message,
    });
  }
  const msg = typeof error?.message === "string" ? error.message : fallbackMessage;
  if (msg.startsWith("BAD_REQUEST:")) {
    return res.status(400).json({ success: false, error: msg.replace("BAD_REQUEST:", "").trim() });
  }
  if (msg.startsWith("INVALID_CLASS:")) {
    return res.status(400).json({ success: false, code: "INVALID_CLASS", error: msg.replace("INVALID_CLASS:", "").trim() });
  }
  if (msg.startsWith("FORBIDDEN:")) {
    return res.status(403).json({ success: false, error: msg.replace("FORBIDDEN:", "").trim() });
  }
  if (msg.startsWith("NOT_FOUND:")) {
    return res.status(404).json({ success: false, error: msg.replace("NOT_FOUND:", "").trim() });
  }
  if (msg.startsWith("CONFLICT:")) {
    return res.status(409).json({ success: false, error: msg.replace("CONFLICT:", "").trim() });
  }
  if (msg.startsWith("DUPLICATE_ENROLLMENT:")) {
    return res.status(409).json({ success: false, code: "DUPLICATE_ENROLLMENT", error: msg.replace("DUPLICATE_ENROLLMENT:", "").trim() });
  }
  if (msg.startsWith("UNASSIGNED_FACULTY:")) {
    return res.status(422).json({ success: false, code: "UNASSIGNED_FACULTY", error: msg.replace("UNASSIGNED_FACULTY:", "").trim() });
  }
  console.error(`[API Error] ${fallbackMessage}:`, error);
  return res.status(500).json({ success: false, error: fallbackMessage });
}

// ==============================================================================
// AUTHENTICATION & PUBLIC CATALOG ENDPOINTS
// ==============================================================================
app.use("/api/auth", authRouter);

// Health check (supports ?db=1 to verify live PostgreSQL connectivity without exposing secrets)
app.get("/api/health", async (req: Request, res: Response) => {
  const dbConfig = getDatabaseConfigSummary(process.env);
  const checkDb = req.query.db === "1" || req.query.db === "true";
  const dbHealth = checkDb ? await checkDatabaseHealth() : undefined;

  const statusCode = checkDb && dbHealth && !dbHealth.connected ? 503 : 200;
  res.status(statusCode).json({
    status: statusCode === 200 ? "ok" : "degraded",
    runtime: process.env.VERCEL ? "vercel-serverless" : "node-server",
    geminiConfigured: isGeminiConfigured(),
    jwtSecretConfigured: Boolean(
      process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16
    ),
    database: {
      configured: dbConfig.configured,
      mode: dbConfig.mode,
      sslEnabled: dbConfig.sslEnabled,
      ...(dbHealth ? { connected: dbHealth.connected, latencyMs: dbHealth.latencyMs } : {}),
    },
    timestamp: new Date().toISOString(),
  });
});

// Public list of enrollable classes for student registration dropdown (dynamically loaded from PostgreSQL)
app.get("/api/classes/available", async (_req: Request, res: Response) => {
  try {
    const availableClasses = await listAvailableClassesForRegistration();
    return res.json({ success: true, classes: availableClasses });
  } catch (error) {
    return handleServiceError(res, error, "Failed to load available classes.");
  }
});

// Direct class enrollment mutation endpoint — strictly admin-only (students cannot self-enroll or tamper with enrollments)
app.post(
  "/api/enrollments",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Only administrators may directly create or modify class enrollment records.",
        });
      }
      const { studentId, classId, classCode } = req.body || {};
      const selector = typeof classId === "string" && classId.trim() ? classId.trim() : classCode;
      if (!studentId || typeof studentId !== "string" || !selector) {
        return res.status(400).json({
          success: false,
          error: "studentId and classId (or classCode) are required.",
        });
      }
      const enrollment = await enrollExistingStudentByAdmin(
        { id: req.user!.id, role: req.user!.role },
        { studentId: studentId.trim(), classIdOrCode: selector }
      );
      return res.status(201).json({ success: true, enrollment });
    } catch (error) {
      return handleServiceError(res, error, "Failed to enroll student into class.");
    }
  }
);

// ==============================================================================
// AI VIVA PERSISTENCE & EVALUATION ENDPOINTS (Authenticated + PostgreSQL Backed)
// ==============================================================================

// Start a new AI Viva assessment session (Student)
app.post(
  "/api/viva/sessions",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { experimentId, assignmentId } = req.body || {};
      if (!experimentId || typeof experimentId !== "string") {
        return res.status(400).json({ success: false, error: "experimentId is required." });
      }
      const data = await startVivaSession(req.user!.id, {
        experimentId,
        assignmentId: typeof assignmentId === "string" ? assignmentId : null,
      });
      return res.status(201).json({ success: true, ...data });
    } catch (error) {
      return handleServiceError(res, error, "Failed to start AI Viva session.");
    }
  }
);

// Submit and evaluate an answer inside a persisted AI Viva session (Student)
app.post(
  "/api/viva/sessions/:sessionId/answer",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { taskId, questionIndex, questionText, isAdaptiveFollowUp, studentAnswer } =
        req.body || {};
      if (!studentAnswer || typeof studentAnswer !== "string") {
        return res.status(400).json({ success: false, error: "studentAnswer is required." });
      }
      const result = await submitVivaAnswer(req.user!.id, sessionId, {
        taskId: typeof taskId === "string" ? taskId : undefined,
        questionIndex: typeof questionIndex === "number" ? questionIndex : undefined,
        questionText: typeof questionText === "string" ? questionText : undefined,
        isAdaptiveFollowUp: Boolean(isAdaptiveFollowUp),
        studentAnswer,
      });

      let competencyReport = null;
      if (result.session.status === "completed") {
        competencyReport = await syncCompetenciesAfterVivaCompletion({
          studentId: req.user!.id,
          vivaSessionId: result.session.id,
          experimentId: result.session.experimentId,
          assignmentId: result.session.assignmentId,
          attemptNumber: result.session.attemptNumber,
        });
      }

      return res.status(200).json({
        success: true,
        ...result,
        competencyReport,
        // Backward-compatible top-level fields for panel consumption
        score: result.response.score,
        passed: result.response.passed,
        feedback: result.response.aiFeedback,
        rubricCriterionMet: result.response.rubricCriterionMet,
        missingConcepts: result.response.missingConcepts,
        adaptiveFollowUp: result.response.adaptiveFollowUp,
        difficulty: result.response.difficulty,
        nextDifficulty: result.nextDifficulty,
        source: result.response.aiModel,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to evaluate and save AI Viva answer.");
    }
  }
);

// Finalize / complete an AI Viva session (Student)
app.post(
  "/api/viva/sessions/:sessionId/complete",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const session = await completeVivaSession(req.user!.id, req.params.sessionId);
      const competencyReport = await syncCompetenciesAfterVivaCompletion({
        studentId: req.user!.id,
        vivaSessionId: session.id,
        experimentId: session.experimentId,
        assignmentId: session.assignmentId,
        attemptNumber: session.attemptNumber,
      });
      return res.json({ success: true, session, competencyReport });
    } catch (error) {
      return handleServiceError(res, error, "Failed to finalize AI Viva session.");
    }
  }
);

// List authenticated student's own AI Viva session attempts
app.get(
  "/api/viva/sessions",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const experimentId =
        typeof req.query.experimentId === "string" ? req.query.experimentId : undefined;
      const sessionsList = await getStudentVivaSessions(req.user!.id, experimentId);
      return res.json({ success: true, sessions: sessionsList });
    } catch (error) {
      return handleServiceError(res, error, "Failed to retrieve AI Viva history.");
    }
  }
);

// Retrieve a single AI Viva session report (Student own / Teacher of class / Admin)
app.get(
  "/api/viva/sessions/:sessionId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const session = await getVivaSessionById(
        { id: req.user!.id, role: req.user!.role },
        req.params.sessionId
      );
      return res.json({ success: true, session });
    } catch (error) {
      return handleServiceError(res, error, "Failed to retrieve AI Viva report.");
    }
  }
);

// ==============================================================================
// AUTHENTICATED GEMINI AI ENDPOINTS (Viva Evaluate, Socratic Hint, Lab Mentor)
// ==============================================================================

// Legacy-compatible Viva Evaluation route: requires auth, optionally persists to viva_sessions
app.post(
  "/api/gemini/viva-evaluate",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        sessionId,
        experimentId,
        assignmentId,
        taskId,
        questionIndex,
        question,
        studentAnswer,
        rubric,
        context,
        competencyDimension,
      } = req.body || {};

      if (!studentAnswer || typeof studentAnswer !== "string") {
        return res.status(400).json({ success: false, error: "studentAnswer is required." });
      }

      // If student passes experimentId or sessionId, persist into PostgreSQL viva tables!
      if (req.user!.role === "student" && (sessionId || experimentId)) {
        let activeSessionId = typeof sessionId === "string" ? sessionId : "";
        if (!activeSessionId && typeof experimentId === "string" && getExperimentById(experimentId)) {
          const started = await startVivaSession(req.user!.id, {
            experimentId,
            assignmentId: typeof assignmentId === "string" ? assignmentId : null,
          });
          activeSessionId = started.session.id;
        }

        if (activeSessionId) {
          const persisted = await submitVivaAnswer(req.user!.id, activeSessionId, {
            taskId: typeof taskId === "string" ? taskId : undefined,
            questionIndex: typeof questionIndex === "number" ? questionIndex : undefined,
            questionText: typeof question === "string" ? question : undefined,
            isAdaptiveFollowUp: Boolean(req.body?.isAdaptiveFollowUp),
            studentAnswer,
          });

          return res.json({
            success: true,
            source: persisted.response.aiModel,
            vivaSessionId: persisted.session.id,
            vivaResponseId: persisted.response.id,
            score: persisted.response.score,
            passed: persisted.response.passed,
            rubricCriterionMet: persisted.response.rubricCriterionMet,
            missingConcepts: persisted.response.missingConcepts,
            feedback: persisted.response.aiFeedback,
            adaptiveFollowUp: persisted.response.adaptiveFollowUp,
            difficulty: persisted.response.difficulty,
            nextDifficulty: persisted.nextDifficulty,
            session: persisted.session,
          });
        }
      }

      // Direct evaluation (e.g. scenario viva question) with server-side Gemini validation
      if (!question || typeof question !== "string") {
        return res.status(400).json({ success: false, error: "question is required." });
      }

      const evaluation = await evaluateVivaWithGemini({
        experimentContext: String(context || "Syllabus Laboratory Experiment"),
        competencyDimension: String(competencyDimension || "Data Interpretation & Physical Reasoning"),
        question,
        rubric: String(
          rubric ||
            "Evaluate scientific accuracy, proper terminology, and quantitative/causal reasoning."
        ),
        studentAnswer,
      });

      return res.json({
        success: true,
        source: evaluation.model,
        ...evaluation,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to evaluate viva response.");
    }
  }
);

// Socratic Hint Engine (Authenticated)
app.post(
  "/api/gemini/hint",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { experimentName, currentStep, studentIssue, apparatusState } = req.body || {};
      if (!experimentName || !studentIssue) {
        return res
          .status(400)
          .json({ success: false, error: "experimentName and studentIssue are required." });
      }

      const result = await generateSocraticHintWithGemini({
        experimentName: String(experimentName),
        currentStep: String(currentStep || "Procedure Execution"),
        studentIssue: String(studentIssue),
        apparatusState,
      });

      return res.json({
        success: true,
        source: result.model,
        hint: result.hint,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to generate Socratic hint.");
    }
  }
);

// Context-Aware Lab Mentor Chat (Authenticated)
app.post(
  "/api/gemini/mentor-chat",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        experimentTitle,
        subject,
        syllabusTag,
        apparatusList,
        keyFormulas,
        currentStep,
        apparatusState,
        messages = [],
        question,
      } = req.body || {};

      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ success: false, error: "question is required." });
      }

      const result = await generateMentorReplyWithGemini({
        experimentTitle: String(experimentTitle || "Syllabus Virtual Lab"),
        subject: String(subject || "STEM"),
        syllabusTag: String(syllabusTag || "Laboratory Curriculum"),
        apparatusList: Array.isArray(apparatusList) ? apparatusList.map(String) : [],
        keyFormulas: Array.isArray(keyFormulas) ? keyFormulas : [],
        currentStep: String(currentStep || "Experiment Execution"),
        apparatusState,
        messages: Array.isArray(messages) ? messages : [],
        question: question.trim(),
      });

      return res.json({
        success: true,
        source: result.model,
        reply: result.reply,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to contact Lab Mentor.");
    }
  }
);

// ==============================================================================
// SUBMISSIONS WORKFLOW ENDPOINTS (Strict Ownership & Server-Side Grading)
// ==============================================================================

// Admin: list all submissions across platform
app.get(
  "/api/submissions",
  requireAuth,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await getAllSubmissionsAdmin();
      return res.json({ success: true, submissions: list });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch submissions.");
    }
  }
);

// Student: submit an experiment attempt (server-derived studentId, server-graded tasks & competencies)
app.post(
  "/api/submissions",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        assignmentId,
        experimentId,
        taskAnswers,
        taskResponses,
        observations,
        calculatedResults,
        dataReadingsCount,
        vivaSessionId,
        completionStatus,
      } = req.body || {};

      const result = await createStudentSubmission(
        { id: req.user!.id, name: req.user!.name },
        {
          assignmentId,
          experimentId,
          taskAnswers,
          taskResponses,
          observations,
          calculatedResults,
          dataReadingsCount,
          vivaSessionId,
          completionStatus,
        }
      );

      return res.status(201).json({
        success: true,
        submission: result.submission,
        competencyReport: result.competencyReport,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to save experiment submission.");
    }
  }
);

// Submission detail endpoint with strict RBAC + ownership verification
app.get(
  "/api/submissions/:id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const submission = await getSubmissionById(
        { id: req.user!.id, role: req.user!.role },
        req.params.id
      );
      return res.json({ success: true, submission });
    } catch (error) {
      return handleServiceError(res, error, "Failed to retrieve submission details.");
    }
  }
);

// ==============================================================================
// 1. STUDENT-SCOPED ENDPOINTS (/api/student/*)
// ==============================================================================

app.get(
  "/api/student/experiments",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const experiments = await getStudentExperimentsStatus(req.user!.id);
      return res.json({
        success: true,
        studentId: req.user!.id,
        experiments,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch student experiments.");
    }
  }
);

app.get(
  "/api/student/assignments",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const filterClassId =
        typeof req.query.classId === "string" && req.query.classId.trim()
          ? req.query.classId.trim()
          : undefined;

      // If student passes a classId query parameter, explicitly verify they are enrolled in that class
      if (filterClassId) {
        const membership = await db
          .select({ id: classEnrollments.id })
          .from(classEnrollments)
          .where(
            and(
              eq(classEnrollments.studentId, req.user!.id),
              eq(classEnrollments.classId, filterClassId),
              eq(classEnrollments.enrollmentStatus, "active")
            )
          )
          .limit(1);
        if (membership.length === 0) {
          return res.status(403).json({
            success: false,
            error: "You are not enrolled in the requested class.",
          });
        }
      }

      const whereConditions = [
        eq(classEnrollments.studentId, req.user!.id),
        eq(classEnrollments.enrollmentStatus, "active"),
        eq(assignments.status, "active"),
      ];
      if (filterClassId) {
        whereConditions.push(eq(assignments.classId, filterClassId));
      }

      const rows = await db
        .select({
          id: assignments.id,
          classId: assignments.classId,
          classCode: classes.code,
          className: classes.name,
          title: assignments.title,
          experimentId: assignments.experimentId,
          dueDate: assignments.dueDate,
          totalMarks: assignments.totalMarks,
          weightTowardsInternal: assignments.weightTowardsInternal,
          attemptsAllowed: assignments.attemptsAllowed,
          allowFreeExploration: assignments.allowFreeExploration,
          evaluationCriteria: assignments.evaluationCriteria,
          status: assignments.status,
          attemptsUsed: sql<number>`count(${submissions.id})::int`,
        })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .innerJoin(classEnrollments, eq(classEnrollments.classId, assignments.classId))
        .leftJoin(
          submissions,
          and(
            eq(submissions.assignmentId, assignments.id),
            eq(submissions.studentId, classEnrollments.studentId)
          )
        )
        .where(and(...whereConditions))
        .groupBy(assignments.id, classes.code, classes.name)
        .orderBy(assignments.dueDate);

      return res.json({
        success: true,
        studentId: req.user!.id,
        assignments: rows.map((r) => ({
          ...r,
          dueDate: r.dueDate.toISOString(),
          totalMarks: Number(r.totalMarks),
          weightTowardsInternal: Number(r.weightTowardsInternal),
          completedCount: r.attemptsUsed,
          totalStudents: 1,
        })),
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch student assignments.");
    }
  }
);

app.get(
  "/api/student/submissions",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await getStudentSubmissionsList(req.user!.id);
      return res.json({ success: true, submissions: list });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch student submissions.");
    }
  }
);

app.get(
  "/api/student/submissions/history",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const experimentId =
        typeof req.query.experimentId === "string" ? req.query.experimentId : undefined;
      const list = await getStudentSubmissionsList(req.user!.id);
      const filtered = experimentId
        ? list.filter((s) => s.experimentId === experimentId)
        : list;
      return res.json({ success: true, history: filtered });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch submission history.");
    }
  }
);

app.get(
  "/api/student/classes",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const enrolled = await db
        .select({
          id: classes.id,
          name: classes.name,
          code: classes.code,
          department: classes.department,
          semester: classes.semester,
          academicYear: classes.academicYear,
          averageCompetencies: classes.averageCompetencies,
          commonMisconceptions: classes.commonMisconceptions,
          enrollmentId: classEnrollments.id,
          enrollmentStatus: classEnrollments.enrollmentStatus,
          enrolledAt: classEnrollments.enrolledAt,
          facultyId: classes.teacherId,
          facultyName: users.name,
          facultyEmail: users.email,
          studentCount: sql<number>`(SELECT COUNT(*)::int FROM class_enrollments ce2 WHERE ce2.class_id = "classes"."id" AND ce2.enrollment_status = 'active')`,
          assignmentCount: sql<number>`(SELECT COUNT(*)::int FROM assignments a2 WHERE a2.class_id = "classes"."id" AND a2.status = 'active')`,
        })
        .from(classes)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, classes.id))
        .leftJoin(users, eq(users.id, classes.teacherId))
        .where(
          and(
            eq(classEnrollments.studentId, req.user!.id),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        )
        .orderBy(classes.code, classes.name);

      return res.json({
        success: true,
        classes: enrolled.map((c) => ({
          ...c,
          enrolledAt: c.enrolledAt.toISOString(),
          studentCount: Number(c.studentCount) || 0,
          assignmentCount: Number(c.assignmentCount) || 0,
        })),
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch student classes.");
    }
  }
);

app.get(
  "/api/student/classes/:classId",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({
          id: classes.id,
          name: classes.name,
          code: classes.code,
          department: classes.department,
          semester: classes.semester,
          academicYear: classes.academicYear,
          enrollmentId: classEnrollments.id,
          enrollmentStatus: classEnrollments.enrollmentStatus,
          enrolledAt: classEnrollments.enrolledAt,
          facultyName: users.name,
          facultyEmail: users.email,
          studentCount: sql<number>`(SELECT COUNT(*)::int FROM class_enrollments ce2 WHERE ce2.class_id = "classes"."id" AND ce2.enrollment_status = 'active')`,
        })
        .from(classes)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, classes.id))
        .leftJoin(users, eq(users.id, classes.teacherId))
        .where(
          and(
            eq(classes.id, req.params.classId),
            eq(classEnrollments.studentId, req.user!.id),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        )
        .limit(1);

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: "Access denied. You are not enrolled in this class.",
        });
      }

      return res.json({
        success: true,
        class: {
          ...rows[0],
          enrolledAt: rows[0].enrolledAt.toISOString(),
          studentCount: Number(rows[0].studentCount) || 0,
        },
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load class details.");
    }
  }
);

app.get(
  "/api/student/profile",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const competencyReport = await getStudentCompetencyReport(req.user!.id);
      return res.json({
        success: true,
        profile: {
          id: req.user!.id,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
          institution: req.user!.institution,
          enrollmentCode: req.user!.enrollment_code,
          competencies: competencyReport.competencyScores,
          overallScore: competencyReport.overallScore,
          strongAreas: competencyReport.strongAreas,
          weakAreas: competencyReport.weakAreas,
        },
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch student profile.");
    }
  }
);

app.get(
  "/api/student/competencies",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const report = await getStudentCompetencyReport(req.user!.id);
      return res.json({
        success: true,
        competencyScores: report.competencyScores,
        report,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch competency scores.");
    }
  }
);

app.get(
  "/api/student/recommendations",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recommendations = await getStudentRecommendations(req.user!.id);
      return res.json({
        success: true,
        studentId: req.user!.id,
        recommendations,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load personalized recommendations.");
    }
  }
);

app.get(
  "/api/student/notifications",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await getStudentNotifications(req.user!.id);
      return res.json({
        success: true,
        studentId: req.user!.id,
        ...data,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load student notifications.");
    }
  }
);

app.patch(
  "/api/student/notifications/:key/read",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const key = decodeURIComponent(req.params.key || "");
      await markNotificationRead(req.user!.id, key);
      return res.json({ success: true, notificationKey: key });
    } catch (error) {
      return handleServiceError(res, error, "Failed to mark notification as read.");
    }
  }
);

app.post(
  "/api/student/notifications/read-all",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const count = await markAllNotificationsRead(req.user!.id);
      return res.json({ success: true, markedCount: count });
    } catch (error) {
      return handleServiceError(res, error, "Failed to mark notifications as read.");
    }
  }
);

// ==============================================================================
// 2. TEACHER / FACULTY-SCOPED ENDPOINTS (/api/teacher/*)
// ==============================================================================

app.get(
  "/api/teacher/classes",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({
          id: classes.id,
          name: classes.name,
          code: classes.code,
          department: classes.department,
          semester: classes.semester,
          academicYear: classes.academicYear,
          averageCompetencies: classes.averageCompetencies,
          commonMisconceptions: classes.commonMisconceptions,
          studentCount: sql<number>`(SELECT COUNT(*)::int FROM class_enrollments ce WHERE ce.class_id = "classes"."id" AND ce.enrollment_status = 'active')`,
        })
        .from(classes)
        .where(eq(classes.teacherId, req.user!.id))
        .orderBy(classes.code, classes.name);

      return res.json({
        success: true,
        classes: rows.map((r) => ({ ...r, studentCount: Number(r.studentCount) || 0 })),
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch teacher classes.");
    }
  }
);

app.get(
  "/api/teacher/classes/:classId/students",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const students = await getTeacherClassStudents(req.user!.id, req.params.classId);
      return res.json({ success: true, students });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch enrolled students.");
    }
  }
);

// Faculty persistent notifications (strictly scoped to authenticated faculty member)
app.get(
  "/api/teacher/notifications",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const unreadOnly = req.query.unreadOnly === "true";
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const data = await getPersistentNotificationsForUser(req.user!.id, {
        limit,
        unreadOnly,
      });
      return res.json({
        success: true,
        teacherId: req.user!.id,
        ...data,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load faculty notifications.");
    }
  }
);

app.patch(
  "/api/teacher/notifications/:id/read",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await markPersistentNotificationRead(req.user!.id, req.params.id);
      return res.json({ success: true, notification: updated });
    } catch (error) {
      return handleServiceError(res, error, "Failed to mark faculty notification as read.");
    }
  }
);

app.post(
  "/api/teacher/notifications/read-all",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const markedCount = await markAllPersistentNotificationsRead(req.user!.id);
      return res.json({ success: true, markedCount });
    } catch (error) {
      return handleServiceError(res, error, "Failed to mark faculty notifications as read.");
    }
  }
);

app.get(
  "/api/teacher/assignments",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({
          id: assignments.id,
          classId: assignments.classId,
          title: assignments.title,
          experimentId: assignments.experimentId,
          dueDate: assignments.dueDate,
          totalMarks: assignments.totalMarks,
          weightTowardsInternal: assignments.weightTowardsInternal,
          attemptsAllowed: assignments.attemptsAllowed,
          allowFreeExploration: assignments.allowFreeExploration,
          evaluationCriteria: assignments.evaluationCriteria,
          status: assignments.status,
          completedCount: sql<number>`count(distinct ${submissions.studentId})::int`,
          totalStudents: sql<number>`(SELECT COUNT(*)::int FROM class_enrollments ce WHERE ce.class_id = "assignments"."class_id" AND ce.enrollment_status = 'active')`,
          avgScore: sql<number>`coalesce(round(avg((coalesce(${submissions.facultyScore}, ${submissions.totalScore}) / nullif(${submissions.maxScore}, 0)) * 100)::numeric, 1), 0)::float`,
        })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .leftJoin(submissions, eq(submissions.assignmentId, assignments.id))
        .where(eq(classes.teacherId, req.user!.id))
        .groupBy(assignments.id)
        .orderBy(desc(assignments.createdAt));

      return res.json({
        success: true,
        assignments: rows.map((r) => ({
          ...r,
          dueDate: r.dueDate.toISOString(),
          totalMarks: Number(r.totalMarks),
          weightTowardsInternal: Number(r.weightTowardsInternal),
          avgScore: Number(r.avgScore) || 0,
        })),
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch assignments.");
    }
  }
);

app.post(
  "/api/teacher/assignments",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        classId,
        title,
        experimentId,
        dueDate,
        totalMarks,
        weightTowardsInternal,
        attemptsAllowed,
        allowFreeExploration,
        evaluationCriteria,
      } = req.body || {};

      if (!classId || !title || !experimentId || !dueDate) {
        return res.status(400).json({
          success: false,
          error: "classId, title, experimentId, and dueDate are required.",
        });
      }

      if (!getExperimentById(experimentId)) {
        return res.status(400).json({
          success: false,
          error: "Unknown experimentId selected.",
        });
      }

      const parsedDue = new Date(dueDate);
      if (Number.isNaN(parsedDue.getTime())) {
        return res.status(400).json({ success: false, error: "Invalid dueDate format." });
      }

      const marks = Number(totalMarks ?? 100);
      const weight = Number(weightTowardsInternal ?? 10);
      const attempts = Number(attemptsAllowed ?? 1);
      if (!Number.isFinite(marks) || marks <= 0) {
        return res.status(400).json({ success: false, error: "totalMarks must be positive." });
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
        return res
          .status(400)
          .json({ success: false, error: "weightTowardsInternal must be between 0 and 100." });
      }
      if (!Number.isInteger(attempts) || attempts < 1) {
        return res.status(400).json({ success: false, error: "attemptsAllowed must be >= 1." });
      }

      // Validate and sanitize optional evaluationCriteria
      const rawCriteria =
        evaluationCriteria && typeof evaluationCriteria === "object"
          ? evaluationCriteria
          : {};
      const practicalWeightPct = Math.max(
        0,
        Math.min(100, Math.round(Number(rawCriteria.practicalWeightPct ?? 70)))
      );
      const vivaWeightPct = Math.max(
        0,
        Math.min(100, Math.round(Number(rawCriteria.vivaWeightPct ?? 100 - practicalWeightPct)))
      );
      if (practicalWeightPct + vivaWeightPct !== 100) {
        return res.status(400).json({
          success: false,
          error: "Practical weight and AI Viva weight must sum to 100%.",
        });
      }
      const passingThresholdPct = Math.max(
        30,
        Math.min(100, Math.round(Number(rawCriteria.passingThresholdPct ?? 70)))
      );
      const sanitizedCriteria = {
        practicalWeightPct,
        vivaWeightPct,
        passingThresholdPct,
        requireViva:
          rawCriteria.requireViva !== undefined ? Boolean(rawCriteria.requireViva) : true,
        rubricNotes:
          typeof rawCriteria.rubricNotes === "string"
            ? rawCriteria.rubricNotes.trim().slice(0, 600)
            : "",
      };

      // Enforce class ownership
      const owned = await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.id, classId), eq(classes.teacherId, req.user!.id)))
        .limit(1);

      if (owned.length === 0) {
        return res.status(403).json({
          success: false,
          error: "Class not found or you do not have permission to assign to this class.",
        });
      }

      const id = `asg-${crypto.randomUUID().slice(0, 12)}`;
      const [inserted] = await db
        .insert(assignments)
        .values({
          id,
          classId,
          title: String(title).trim(),
          experimentId,
          dueDate: parsedDue,
          totalMarks: marks.toFixed(2),
          weightTowardsInternal: weight.toFixed(2),
          attemptsAllowed: attempts,
          allowFreeExploration: Boolean(allowFreeExploration),
          evaluationCriteria: sanitizedCriteria,
          status: "active",
          createdBy: req.user!.id,
        })
        .returning();

      const studentCountRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.classId, classId),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        );

      return res.status(201).json({
        success: true,
        assignment: {
          id: inserted.id,
          classId: inserted.classId,
          title: inserted.title,
          experimentId: inserted.experimentId,
          dueDate: inserted.dueDate.toISOString(),
          totalMarks: Number(inserted.totalMarks),
          weightTowardsInternal: Number(inserted.weightTowardsInternal),
          attemptsAllowed: inserted.attemptsAllowed,
          allowFreeExploration: inserted.allowFreeExploration,
          evaluationCriteria: inserted.evaluationCriteria,
          status: inserted.status,
          completedCount: 0,
          totalStudents: studentCountRes[0]?.count ?? 0,
          avgScore: 0,
        },
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to create assignment.");
    }
  }
);

app.patch(
  "/api/teacher/assignments/:id/status",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status } = req.body || {};
      if (status !== "active" && status !== "archived") {
        return res
          .status(400)
          .json({ success: false, error: "status must be 'active' or 'archived'." });
      }

      const owned = await db
        .select({ id: assignments.id })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(and(eq(assignments.id, req.params.id), eq(classes.teacherId, req.user!.id)))
        .limit(1);

      if (owned.length === 0) {
        return res.status(403).json({
          success: false,
          error: "Assignment not found or you are not authorized to modify it.",
        });
      }

      const [updated] = await db
        .update(assignments)
        .set({ status })
        .where(eq(assignments.id, req.params.id))
        .returning();

      return res.json({ success: true, assignment: updated });
    } catch (error) {
      return handleServiceError(res, error, "Failed to update assignment status.");
    }
  }
);

app.get(
  "/api/teacher/submissions",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await getTeacherSubmissionsList(req.user!.id);
      return res.json({ success: true, submissions: list });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch teacher submissions.");
    }
  }
);

// Faculty evaluation endpoint: update evaluation status, feedback, and optional score adjustment
app.patch(
  "/api/teacher/submissions/:id/evaluate",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { evaluationStatus, instructorFeedback, facultyScore } = req.body || {};
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const result = await evaluateSubmissionByFaculty(
        { id: req.user!.id, name: req.user!.name },
        req.params.id,
        {
          evaluationStatus,
          instructorFeedback,
          facultyScore,
        },
        {
          ipAddress: typeof ipAddress === "string" ? ipAddress : undefined,
          userAgent: req.headers["user-agent"],
        }
      );

      return res.json({
        success: true,
        submission: result.submission,
        competencyReport: result.competencyReport,
      });
    } catch (error) {
      return handleServiceError(res, error, "Failed to save faculty evaluation.");
    }
  }
);

// Faculty Dashboard real-time statistics, recent activities, and students requiring attention
app.get(
  "/api/teacher/dashboard-summary",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const summary = await getFacultyDashboardSummary(req.user!.id);
      return res.json({ success: true, summary });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load faculty dashboard summary.");
    }
  }
);

// Authorized individual student profile, experiment history & competency report
app.get(
  "/api/teacher/students/:studentId/report",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const report = await getAuthorizedStudentReportForTeacher(
        req.user!.id,
        req.params.studentId
      );
      return res.json({ success: true, report });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load student report.");
    }
  }
);

// Comprehensive Competency Analytics (class comparisons, skill gaps, experiment perf, trends, remedial)
app.get(
  "/api/teacher/analytics",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const classId =
        typeof req.query.classId === "string" ? req.query.classId : undefined;
      const analytics = await getFacultyCompetencyAnalytics(req.user!.id, classId);
      return res.json({ success: true, analytics });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load competency analytics.");
    }
  }
);

// AI Faculty Insights (advisory only; grounded in real Cloud SQL cohort/student metrics)
app.post(
  "/api/teacher/ai-insights",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const classId =
        typeof req.body?.classId === "string" ? req.body.classId : undefined;
      const insights = await generateFacultyAiInsights(
        { id: req.user!.id, name: req.user!.name },
        classId
      );
      return res.json({ success: true, insights });
    } catch (error) {
      return handleServiceError(res, error, "Failed to generate AI faculty insights.");
    }
  }
);

// Historical assessment report data (filterable by class, experiment, date range)
app.get(
  "/api/teacher/reports/historical",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const report = await getFacultyHistoricalReport(req.user!.id, {
        classId: typeof req.query.classId === "string" ? req.query.classId : undefined,
        experimentId:
          typeof req.query.experimentId === "string" ? req.query.experimentId : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      });
      return res.json({ success: true, report });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load historical assessment report.");
    }
  }
);

// Excel-compatible CSV export for class competency, historical assessments, or individual student
app.get(
  "/api/teacher/reports/export",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rawType = typeof req.query.type === "string" ? req.query.type : "historical";
      const type =
        rawType === "class_competency" || rawType === "student" || rawType === "historical"
          ? rawType
          : "historical";

      const { filename, csv } = await buildFacultyCsvExport(req.user!.id, {
        type,
        classId: typeof req.query.classId === "string" ? req.query.classId : undefined,
        studentId: typeof req.query.studentId === "string" ? req.query.studentId : undefined,
        experimentId:
          typeof req.query.experimentId === "string" ? req.query.experimentId : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    } catch (error) {
      return handleServiceError(res, error, "Failed to generate CSV export.");
    }
  }
);

// ==============================================================================
// 3. ADMIN-SCOPED ENDPOINTS (/api/admin/*)
// ==============================================================================

app.get(
  "/api/admin/users",
  requireAuth,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          status: users.status,
          institution: users.institution,
          enrollment_code: users.enrollmentCode,
          last_login_at: users.lastLoginAt,
          created_at: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      return res.json({ success: true, users: rows });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch users.");
    }
  }
);

app.get(
  "/api/admin/audit-logs",
  requireAuth,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await db
        .select({
          id: authEvents.id,
          user_id: authEvents.userId,
          event_type: authEvents.eventType,
          success: authEvents.success,
          session_id: authEvents.sessionId,
          ip_address: authEvents.ipAddress,
          user_agent: authEvents.userAgent,
          metadata: authEvents.metadata,
          created_at: authEvents.createdAt,
        })
        .from(authEvents)
        .orderBy(desc(authEvents.createdAt))
        .limit(100);

      // Provide both `logs` and `events` keys for complete frontend compatibility
      return res.json({ success: true, logs: rows, events: rows });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch audit logs.");
    }
  }
);

app.get(
  "/api/admin/institutions",
  requireAuth,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const institutions = await getAdminInstitutionsSummary();
      return res.json({ success: true, institutions });
    } catch (error) {
      return handleServiceError(res, error, "Failed to fetch institutions.");
    }
  }
);

app.patch(
  "/api/admin/users/:id/status",
  requireAuth,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUserId = req.params.id;
      const { status } = req.body || {};
      if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status. Must be ACTIVE, SUSPENDED, or DISABLED.",
        });
      }

      if (targetUserId === req.user!.id && status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          error: "Administrators cannot suspend or disable their own active account.",
        });
      }

      await db.transaction(async (tx) => {
        const updated = await tx
          .update(users)
          .set({ status, updatedAt: new Date() })
          .where(eq(users.id, targetUserId))
          .returning({ id: users.id });

        if (updated.length === 0) {
          throw new Error("NOT_FOUND: User not found.");
        }

        if (status !== "ACTIVE") {
          await tx
            .update(sessions)
            .set({ isRevoked: true, status: "REVOKED", revokedAt: new Date() })
            .where(eq(sessions.userId, targetUserId));
        }

        await tx.insert(authEvents).values({
          id: `evt-${crypto.randomUUID()}`,
          userId: req.user!.id,
          eventType: "ACCOUNT_STATUS_UPDATED",
          success: true,
          metadata: { targetUserId, newStatus: status },
        });
      });

      return res.json({ success: true, message: `User status updated to ${status}.` });
    } catch (error) {
      return handleServiceError(res, error, "Failed to update user status.");
    }
  }
);

// Admin class & faculty assignment management (strictly admin-only)
app.get(
  "/api/admin/classes",
  requireAuth,
  requireRole("admin"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await listClassesForAdmin();
      return res.json({ success: true, classes: list });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load classes.");
    }
  }
);

app.patch(
  "/api/admin/classes/:classId/faculty",
  requireAuth,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rawTeacherId = req.body?.teacherId;
      const teacherId =
        rawTeacherId === null || rawTeacherId === ""
          ? null
          : typeof rawTeacherId === "string"
          ? rawTeacherId.trim()
          : undefined;
      if (teacherId === undefined) {
        return res.status(400).json({
          success: false,
          error: "teacherId (string or null) is required.",
        });
      }
      const updated = await assignFacultyToClassByAdmin(
        { id: req.user!.id, role: req.user!.role },
        req.params.classId,
        teacherId
      );
      return res.json({ success: true, class: updated });
    } catch (error) {
      return handleServiceError(res, error, "Failed to update faculty assignment.");
    }
  }
);

app.get(
  "/api/admin/notifications",
  requireAuth,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await getPersistentNotificationsForUser(req.user!.id, {
        limit: 50,
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      return handleServiceError(res, error, "Failed to load administrator alerts.");
    }
  }
);

// ==============================================================================
// PAIR LAB REST ROUTES (SERVERLESS-COMPATIBLE)
// ==============================================================================
registerPairLabRestRoutes(app);

export default app;

