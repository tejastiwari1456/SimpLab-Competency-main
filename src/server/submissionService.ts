import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  assignments,
  authEvents,
  classes,
  classEnrollments,
  competencyHistory,
  CompetencyScoresJson,
  evaluationHistory,
  studentCompetencies,
  submissions,
  users,
  vivaResponses,
  vivaSessions,
} from "../db/schema.ts";
import {
  ALL_COMPETENCY_KEYS,
  getAllExperiments,
  getExperimentById,
  gradeExperimentTasks,
  PersistedVivaGradeInput,
} from "./experimentCatalog.ts";
import {
  aggregateStudentCompetencies,
  calculateSubmissionCompetencies,
  computeClassAnalytics,
  DEFAULT_COMPETENCY_CONFIG,
  SubmissionForCompetency,
  VivaSessionForCompetency,
} from "./competencyEngine.ts";
import type { CompetencyKey } from "../types.ts";

export interface SubmissionDTO {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  experimentId: string;
  submittedAt: string;
  attemptNumber: number;
  totalScore: number;
  maxScore: number;
  facultyScore: number | null;
  competencyScores: CompetencyScoresJson;
  taskResponses: Record<string, any>;
  observations: Record<string, any>;
  calculatedResults: Record<string, any>;
  dataReadingsCount: number;
  completionStatus: "draft" | "submitted" | "completed";
  evaluationStatus:
    | "pending"
    | "auto_graded"
    | "ai_evaluated"
    | "faculty_reviewed"
    | "needs_revision";
  vivaSessionId: string | null;
  instructorFeedback: string | null;
  evaluatedBy: string | null;
  evaluatedAt: string | null;
}

function mapSubmissionRow(row: typeof submissions.$inferSelect): SubmissionDTO {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    studentName: row.studentName,
    experimentId: row.experimentId,
    submittedAt: row.submittedAt.toISOString(),
    attemptNumber: row.attemptNumber,
    totalScore: Number(row.totalScore),
    maxScore: Number(row.maxScore),
    facultyScore: row.facultyScore != null ? Number(row.facultyScore) : null,
    competencyScores: row.competencyScores,
    taskResponses: (row.taskResponses || {}) as Record<string, any>,
    observations: (row.observations || {}) as Record<string, any>,
    calculatedResults: (row.calculatedResults || {}) as Record<string, any>,
    dataReadingsCount: row.dataReadingsCount,
    completionStatus: (row.completionStatus as SubmissionDTO["completionStatus"]) || "completed",
    evaluationStatus: (row.evaluationStatus as SubmissionDTO["evaluationStatus"]) || "auto_graded",
    vivaSessionId: row.vivaSessionId,
    instructorFeedback: row.instructorFeedback,
    evaluatedBy: row.evaluatedBy,
    evaluatedAt: row.evaluatedAt ? row.evaluatedAt.toISOString() : null,
  };
}

/**
 * Recomputes and persists a student's aggregated competencies, history snapshot,
 * and class-level average competencies inside an active Drizzle transaction.
 */
async function syncStudentAndClassCompetenciesTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    studentId: string;
    classId: string | null;
    triggerSubmissionId: string | null;
    triggerVivaSessionId: string | null;
    experimentId: string;
    attemptNumber: number;
    triggerType: "submission" | "faculty_evaluation" | "viva_completion";
  }
) {
  const allStudentSubs = await tx
    .select()
    .from(submissions)
    .where(eq(submissions.studentId, params.studentId))
    .orderBy(desc(submissions.submittedAt));

  const allStudentVivas = await tx
    .select()
    .from(vivaSessions)
    .where(eq(vivaSessions.studentId, params.studentId))
    .orderBy(desc(vivaSessions.startedAt));

  const vivaIds = allStudentVivas.map((v) => v.id);
  const allVivaResps =
    vivaIds.length > 0
      ? await tx
          .select()
          .from(vivaResponses)
          .where(inArray(vivaResponses.sessionId, vivaIds))
      : [];

  const vivaForEngine: VivaSessionForCompetency[] = allStudentVivas.map((v) => ({
    id: v.id,
    experimentId: v.experimentId,
    overallScore: Number(v.overallScore),
    status: v.status,
    responses: allVivaResps
      .filter((r) => r.sessionId === v.id)
      .map((r) => ({
        competencyDimension: r.competencyDimension,
        score: Number(r.score),
      })),
  }));

  const subsForEngine: SubmissionForCompetency[] = allStudentSubs.map((s) => ({
    id: s.id,
    experimentId: s.experimentId,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    attemptNumber: s.attemptNumber,
    totalScore: Number(s.totalScore),
    maxScore: Number(s.maxScore),
    facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
    competencyScores: s.competencyScores,
    taskResponses: (s.taskResponses || {}) as Record<string, any>,
    vivaSessionId: s.vivaSessionId,
    submittedAt: s.submittedAt,
  }));

  const report = aggregateStudentCompetencies(
    subsForEngine,
    vivaForEngine,
    DEFAULT_COMPETENCY_CONFIG
  );

  // Determine previous overall score for delta calculation
  const prevHistory = await tx
    .select({ overallScore: competencyHistory.overallScore })
    .from(competencyHistory)
    .where(eq(competencyHistory.studentId, params.studentId))
    .orderBy(desc(competencyHistory.recordedAt))
    .limit(1);

  const prevOverall = prevHistory.length > 0 ? Number(prevHistory[0].overallScore) : 0;
  const deltaOverall =
    Math.round((report.overallScore - prevOverall) * 100) / 100;

  // Upsert student_competencies rows for all 5 dimensions
  for (const dim of report.dimensions) {
    const compId = `scomp-${params.studentId}-${dim.key}`.slice(0, 64);
    await tx
      .insert(studentCompetencies)
      .values({
        id: compId,
        studentId: params.studentId,
        competencyKey: dim.key,
        score: dim.score.toFixed(2),
        experimentContribution: dim.experimentContribution.toFixed(2),
        vivaContribution: dim.vivaContribution.toFixed(2),
        experimentsEvaluated: dim.experimentsEvaluated,
        status: dim.status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [studentCompetencies.studentId, studentCompetencies.competencyKey],
        set: {
          score: dim.score.toFixed(2),
          experimentContribution: dim.experimentContribution.toFixed(2),
          vivaContribution: dim.vivaContribution.toFixed(2),
          experimentsEvaluated: dim.experimentsEvaluated,
          status: dim.status,
          updatedAt: new Date(),
        },
      });
  }

  // Insert immutable competency_history record
  await tx.insert(competencyHistory).values({
    id: `chist-${crypto.randomUUID()}`,
    studentId: params.studentId,
    submissionId: params.triggerSubmissionId,
    vivaSessionId: params.triggerVivaSessionId,
    experimentId: params.experimentId,
    attemptNumber: params.attemptNumber,
    competencyScores: report.competencyScores,
    overallScore: report.overallScore.toFixed(2),
    deltaOverall: deltaOverall.toFixed(2),
    calculationMetadata: {
      triggerType: params.triggerType,
      methodology: report.methodology,
      deduplicatedCount: report.deduplicatedSubmissions.length,
    },
  });

  // Recompute class-wide average competencies & real common misconceptions when classId is available
  if (!params.classId) {
    return report;
  }
  const classAssignments = await tx
    .select({ id: assignments.id })
    .from(assignments)
    .where(eq(assignments.classId, params.classId));

  const assignmentIds = classAssignments.map((a) => a.id);
  if (assignmentIds.length > 0) {
    const classSubs = await tx
      .select()
      .from(submissions)
      .where(inArray(submissions.assignmentId, assignmentIds));

    const classSubsForEngine: SubmissionForCompetency[] = classSubs.map((s) => ({
      id: s.id,
      experimentId: s.experimentId,
      assignmentId: s.assignmentId,
      studentId: s.studentId,
      attemptNumber: s.attemptNumber,
      totalScore: Number(s.totalScore),
      maxScore: Number(s.maxScore),
      facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
      competencyScores: s.competencyScores,
      taskResponses: (s.taskResponses || {}) as Record<string, any>,
      vivaSessionId: s.vivaSessionId,
      submittedAt: s.submittedAt,
    }));

    const analytics = computeClassAnalytics(classSubsForEngine);
    await tx
      .update(classes)
      .set({
        averageCompetencies: analytics.averageCompetencies,
        commonMisconceptions: analytics.commonMisconceptions,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, params.classId));
  }

  return report;
}

/**
 * Complete Student Experiment Submission Workflow.
 * - Derives studentId strictly from authenticated session (never trusts client).
 * - Rejects or ignores client-manipulated scores, studentId, competencyScores, or evaluationStatus.
 * - Re-grades all tasks server-side from experimentCatalog.ts and links server-persisted AI Viva responses.
 * - Runs atomically inside a PostgreSQL transaction.
 */
export async function createStudentSubmission(
  student: { id: string; name: string },
  payload: {
    assignmentId: string;
    experimentId: string;
    taskAnswers?: Record<string, unknown>;
    taskResponses?: Record<string, unknown>;
    observations?: Record<string, unknown>;
    calculatedResults?: Record<string, unknown>;
    dataReadingsCount?: number;
    vivaSessionId?: string | null;
    completionStatus?: string;
  }
) {
  if (!payload.assignmentId || !payload.experimentId) {
    throw new Error("BAD_REQUEST: assignmentId and experimentId are required.");
  }

  const experiment = getExperimentById(payload.experimentId);
  if (!experiment) {
    throw new Error("BAD_REQUEST: Invalid experimentId.");
  }

  // Merge taskAnswers / taskResponses (extracting only studentAnswer values — never client scores!)
  const rawTaskInputs: Record<string, unknown> = {
    ...(payload.taskResponses && typeof payload.taskResponses === "object"
      ? payload.taskResponses
      : {}),
    ...(payload.taskAnswers && typeof payload.taskAnswers === "object"
      ? payload.taskAnswers
      : {}),
  };

  const observations =
    payload.observations && typeof payload.observations === "object"
      ? payload.observations
      : {};
  const calculatedResults =
    payload.calculatedResults && typeof payload.calculatedResults === "object"
      ? payload.calculatedResults
      : {};
  const dataReadingsCount = Math.max(
    0,
    Math.min(500, Math.floor(Number(payload.dataReadingsCount) || 0))
  );

  try {
    return await db.transaction(async (tx) => {
      // 1. Verify active assignment & student class enrollment
      const assignmentRows = await tx
        .select({
          id: assignments.id,
          classId: assignments.classId,
          experimentId: assignments.experimentId,
          attemptsAllowed: assignments.attemptsAllowed,
          totalMarks: assignments.totalMarks,
          status: assignments.status,
        })
        .from(assignments)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, assignments.classId))
        .where(
          and(
            eq(assignments.id, payload.assignmentId),
            eq(classEnrollments.studentId, student.id),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        )
        .limit(1);

      if (assignmentRows.length === 0) {
        throw new Error(
          "FORBIDDEN: Assignment not found or not assigned to your enrolled classes."
        );
      }

      const assignment = assignmentRows[0];
      if (assignment.status !== "active") {
        throw new Error("BAD_REQUEST: This assignment is archived and no longer accepting submissions.");
      }
      if (assignment.experimentId !== payload.experimentId) {
        throw new Error("BAD_REQUEST: Experiment does not match the assignment.");
      }

      // 2. Enforce attempt limit atomically
      const existingAttempts = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(submissions)
        .where(
          and(
            eq(submissions.assignmentId, assignment.id),
            eq(submissions.studentId, student.id)
          )
        );
      const attemptNumber = (existingAttempts[0]?.count ?? 0) + 1;
      if (attemptNumber > assignment.attemptsAllowed) {
        throw new Error(
          `CONFLICT: You have used all ${assignment.attemptsAllowed} allowed attempt(s) for this assignment.`
        );
      }

      // 3. Resolve server-persisted AI Viva session (if provided or latest for this student + experiment)
      let resolvedVivaSessionId: string | null = null;
      let persistedVivaInputs: PersistedVivaGradeInput[] = [];

      if (payload.vivaSessionId) {
        const vsRows = await tx
          .select()
          .from(vivaSessions)
          .where(eq(vivaSessions.id, payload.vivaSessionId))
          .limit(1);

        if (vsRows.length === 0) {
          throw new Error("BAD_REQUEST: Specified vivaSessionId does not exist.");
        }
        if (vsRows[0].studentId !== student.id) {
          throw new Error("FORBIDDEN: Cannot attach another student's AI Viva session.");
        }
        if (vsRows[0].experimentId !== payload.experimentId) {
          throw new Error("BAD_REQUEST: AI Viva session belongs to a different experiment.");
        }
        resolvedVivaSessionId = vsRows[0].id;
      } else {
        // Auto-link student's most recent viva session for this experiment if one exists
        const latestVs = await tx
          .select()
          .from(vivaSessions)
          .where(
            and(
              eq(vivaSessions.studentId, student.id),
              eq(vivaSessions.experimentId, payload.experimentId)
            )
          )
          .orderBy(desc(vivaSessions.startedAt))
          .limit(1);
        if (latestVs.length > 0) {
          resolvedVivaSessionId = latestVs[0].id;
        }
      }

      if (resolvedVivaSessionId) {
        const vResps = await tx
          .select()
          .from(vivaResponses)
          .where(eq(vivaResponses.sessionId, resolvedVivaSessionId))
          .orderBy(vivaResponses.questionIndex, desc(vivaResponses.createdAt));

        // Keep latest response per taskId/questionIndex
        const deduped = new Map<string, typeof vivaResponses.$inferSelect>();
        for (const r of vResps) {
          const key = r.taskId || `q-${r.questionIndex}`;
          if (!deduped.has(key)) deduped.set(key, r);
        }

        persistedVivaInputs = Array.from(deduped.values()).map((r) => ({
          taskId: r.taskId,
          questionText: r.questionText,
          competencyDimension: (r.competencyDimension as CompetencyKey) || "troubleshooting_safety",
          studentAnswer: r.studentAnswer,
          score: Number(r.score),
          maxPoints: Number(r.maxPoints),
          passed: r.passed,
          aiFeedback: r.aiFeedback,
          rubricCriteriaMet: Array.isArray(r.rubricCriteriaMet) ? r.rubricCriteriaMet : [],
          missingConcepts: Array.isArray(r.missingConcepts) ? r.missingConcepts : [],
        }));
      }

      // 4. Authoritative server-side grading
      const grading = gradeExperimentTasks(
        payload.experimentId,
        rawTaskInputs,
        persistedVivaInputs
      );

      // Scale score cleanly to assignment.totalMarks if different from raw sum of task points
      const assignmentMaxMarks = Number(assignment.totalMarks) || grading.maxScore;
      const scaledTotalScore =
        grading.maxScore > 0
          ? Math.round((grading.totalScore / grading.maxScore) * assignmentMaxMarks * 100) / 100
          : 0;

      // 5. Calculate transparent submission competency scores
      const compCalc = calculateSubmissionCompetencies(
        payload.experimentId,
        grading.taskList,
        {
          dataReadingsCount,
          config: DEFAULT_COMPETENCY_CONFIG,
        }
      );

      const completionStatus =
        payload.completionStatus === "draft" ? "draft" : "completed";
      const evaluationStatus =
        persistedVivaInputs.length > 0 ? "ai_evaluated" : "auto_graded";

      const submissionId = `sub-${crypto.randomUUID()}`;

      // Include vivaResponses summary alongside graded task responses for full transparency
      const persistedTaskResponses: Record<string, unknown> = {
        ...grading.gradedTasks,
        vivaResponses: persistedVivaInputs.map((v) => ({
          taskId: v.taskId,
          question: v.questionText,
          studentAnswer: v.studentAnswer,
          score: v.score,
          feedback: v.aiFeedback,
          rubricCriterionMet: v.rubricCriteriaMet,
          missingConcepts: v.missingConcepts,
        })),
      };

      const [inserted] = await tx
        .insert(submissions)
        .values({
          id: submissionId,
          assignmentId: assignment.id,
          studentId: student.id,
          studentName: student.name,
          experimentId: payload.experimentId,
          attemptNumber,
          totalScore: scaledTotalScore.toFixed(2),
          maxScore: assignmentMaxMarks.toFixed(2),
          competencyScores: compCalc.competencyScores,
          taskResponses: persistedTaskResponses,
          observations,
          calculatedResults,
          dataReadingsCount,
          completionStatus,
          evaluationStatus,
          vivaSessionId: resolvedVivaSessionId,
        })
        .returning();

      // 6. Sync student_competencies, competency_history, and class analytics
      const competencyReport = await syncStudentAndClassCompetenciesTx(tx, {
        studentId: student.id,
        classId: assignment.classId,
        triggerSubmissionId: inserted.id,
        triggerVivaSessionId: resolvedVivaSessionId,
        experimentId: payload.experimentId,
        attemptNumber,
        triggerType: "submission",
      });

      return {
        submission: mapSubmissionRow(inserted),
        competencyReport,
      };
    });
  } catch (error: any) {
    if (
      error?.message?.startsWith("BAD_REQUEST:") ||
      error?.message?.startsWith("FORBIDDEN:") ||
      error?.message?.startsWith("CONFLICT:")
    ) {
      throw error;
    }
    console.error("[SubmissionService] Failed creating submission:", error);
    throw new Error("Failed to save experiment submission.", { cause: error });
  }
}

/**
 * Retrieves detailed submission record with strict RBAC and resource ownership checks.
 */
export async function getSubmissionById(
  requester: { id: string; role: string },
  submissionId: string
): Promise<SubmissionDTO & { vivaSession?: any; evaluationHistory?: any[] }> {
  try {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error("NOT_FOUND: Submission not found.");
    }
    const sub = rows[0];

    if (requester.role === "student" && sub.studentId !== requester.id) {
      throw new Error("FORBIDDEN: You can only view your own submissions.");
    }

    if (requester.role === "teacher") {
      const ownsClass = await db
        .select({ classId: classes.id })
        .from(assignments)
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(
          and(
            eq(assignments.id, sub.assignmentId),
            eq(classes.teacherId, requester.id)
          )
        )
        .limit(1);

      if (ownsClass.length === 0) {
        throw new Error(
          "FORBIDDEN: You are not authorized to access submissions for this class."
        );
      }
    }

    let vivaSessionDetail: any = null;
    if (sub.vivaSessionId) {
      const vsRows = await db
        .select()
        .from(vivaSessions)
        .where(eq(vivaSessions.id, sub.vivaSessionId))
        .limit(1);
      if (vsRows.length > 0) {
        const resps = await db
          .select()
          .from(vivaResponses)
          .where(eq(vivaResponses.sessionId, vsRows[0].id))
          .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt);
        vivaSessionDetail = {
          id: vsRows[0].id,
          status: vsRows[0].status,
          overallScore: Number(vsRows[0].overallScore),
          summaryFeedback: vsRows[0].summaryFeedback,
          completedAt: vsRows[0].completedAt?.toISOString() || null,
          responses: resps.map((r) => ({
            id: r.id,
            taskId: r.taskId,
            questionText: r.questionText,
            studentAnswer: r.studentAnswer,
            score: Number(r.score),
            passed: r.passed,
            aiFeedback: r.aiFeedback,
            rubricCriterionMet: r.rubricCriteriaMet,
            missingConcepts: r.missingConcepts,
            adaptiveFollowUp: r.adaptiveFollowUp,
            aiModel: r.aiModel,
          })),
        };
      }
    }

    const evalHistoryRows = await db
      .select()
      .from(evaluationHistory)
      .where(eq(evaluationHistory.submissionId, sub.id))
      .orderBy(desc(evaluationHistory.createdAt));

    return {
      ...mapSubmissionRow(sub),
      vivaSession: vivaSessionDetail,
      evaluationHistory: evalHistoryRows.map((ev) => ({
        id: ev.id,
        submissionId: ev.submissionId,
        evaluatorId: ev.evaluatorId,
        evaluatorName: ev.evaluatorName,
        previousStatus: ev.previousStatus,
        newStatus: ev.newStatus,
        previousScore: ev.previousScore != null ? Number(ev.previousScore) : null,
        newScore: ev.newScore != null ? Number(ev.newScore) : null,
        feedback: ev.feedback,
        createdAt: ev.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    if (error?.message?.startsWith("NOT_FOUND:") || error?.message?.startsWith("FORBIDDEN:")) {
      throw error;
    }
    console.error("[SubmissionService] Failed fetching submission detail:", error);
    throw new Error("Failed to fetch submission details.", { cause: error });
  }
}

/**
 * Faculty evaluation workflow: verifies teacher ownership of the submission's class,
 * updates evaluation status, optional score adjustment, and instructor feedback,
 * logs an audit record, and recalculates competencies atomically.
 */
export async function evaluateSubmissionByFaculty(
  teacher: { id: string; name: string },
  submissionId: string,
  payload: {
    evaluationStatus?: string;
    instructorFeedback?: string;
    facultyScore?: number | null;
  },
  auditMeta?: { ipAddress?: string; userAgent?: string }
) {
  const allowedStatuses = [
    "pending",
    "auto_graded",
    "ai_evaluated",
    "faculty_reviewed",
    "needs_revision",
    "rejected",
  ];

  const targetStatus = payload.evaluationStatus || "faculty_reviewed";
  if (!allowedStatuses.includes(targetStatus)) {
    throw new Error(
      `BAD_REQUEST: Invalid evaluationStatus. Must be one of: ${allowedStatuses.join(", ")}.`
    );
  }

  try {
    return await db.transaction(async (tx) => {
      const subRows = await tx
        .select({
          submission: submissions,
          classId: assignments.classId,
          teacherId: classes.teacherId,
        })
        .from(submissions)
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .innerJoin(classes, eq(classes.id, assignments.classId))
        .where(eq(submissions.id, submissionId))
        .limit(1);

      if (subRows.length === 0) {
        throw new Error("NOT_FOUND: Submission not found.");
      }

      const { submission, classId, teacherId } = subRows[0];
      if (teacherId !== teacher.id) {
        throw new Error(
          "FORBIDDEN: You can only evaluate submissions belonging to your own classes."
        );
      }

      const maxScore = Number(submission.maxScore);
      let validatedFacultyScore: string | null = submission.facultyScore;
      let updatedCompetencyScores = submission.competencyScores;

      if (payload.facultyScore !== undefined && payload.facultyScore !== null) {
        const numericScore = Number(payload.facultyScore);
        if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > maxScore) {
          throw new Error(
            `BAD_REQUEST: facultyScore must be between 0 and ${maxScore}.`
          );
        }
        validatedFacultyScore = numericScore.toFixed(2);

        // Scale submission competency scores proportionally to faculty override
        const prevEffective = Number(submission.facultyScore ?? submission.totalScore);
        const targetPct = (numericScore / maxScore) * 100;
        const ratio =
          prevEffective > 0 ? numericScore / prevEffective : null;

        const scaled = { ...submission.competencyScores };
        for (const key of ALL_COMPETENCY_KEYS) {
          const base = Number(submission.competencyScores?.[key] ?? 0);
          const next = ratio !== null ? base * ratio : targetPct;
          scaled[key] = Math.round(Math.max(0, Math.min(100, next)) * 100) / 100;
        }
        updatedCompetencyScores = scaled;
      }

      const feedbackText =
        typeof payload.instructorFeedback === "string"
          ? payload.instructorFeedback.trim()
          : submission.instructorFeedback;

      const [updated] = await tx
        .update(submissions)
        .set({
          evaluationStatus: targetStatus,
          instructorFeedback: feedbackText,
          facultyScore: validatedFacultyScore,
          competencyScores: updatedCompetencyScores,
          evaluatedBy: teacher.id,
          evaluatedAt: new Date(),
        })
        .where(eq(submissions.id, submissionId))
        .returning();

      // Persist immutable evaluation history audit entry
      const prevScoreNum =
        submission.facultyScore != null
          ? Number(submission.facultyScore)
          : Number(submission.totalScore);
      const nextScoreNum =
        validatedFacultyScore != null
          ? Number(validatedFacultyScore)
          : Number(updated.totalScore);

      await tx.insert(evaluationHistory).values({
        id: `ehist-${crypto.randomUUID()}`,
        submissionId,
        evaluatorId: teacher.id,
        evaluatorName: teacher.name,
        previousStatus: submission.evaluationStatus,
        newStatus: targetStatus,
        previousScore: prevScoreNum.toFixed(2),
        newScore: nextScoreNum.toFixed(2),
        feedback: feedbackText || null,
      });

      // Log faculty evaluation audit event
      await tx.insert(authEvents).values({
        id: `evt-${crypto.randomUUID()}`,
        userId: teacher.id,
        eventType: "FACULTY_EVALUATION",
        success: true,
        ipAddress: auditMeta?.ipAddress || null,
        userAgent: auditMeta?.userAgent || null,
        metadata: {
          submissionId,
          studentId: submission.studentId,
          evaluationStatus: targetStatus,
          facultyScore: validatedFacultyScore ? Number(validatedFacultyScore) : null,
        },
      });

      const competencyReport = await syncStudentAndClassCompetenciesTx(tx, {
        studentId: submission.studentId,
        classId,
        triggerSubmissionId: updated.id,
        triggerVivaSessionId: updated.vivaSessionId,
        experimentId: updated.experimentId,
        attemptNumber: updated.attemptNumber,
        triggerType: "faculty_evaluation",
      });

      return {
        submission: mapSubmissionRow(updated),
        competencyReport,
      };
    });
  } catch (error: any) {
    if (
      error?.message?.startsWith("BAD_REQUEST:") ||
      error?.message?.startsWith("NOT_FOUND:") ||
      error?.message?.startsWith("FORBIDDEN:")
    ) {
      throw error;
    }
    console.error("[SubmissionService] Failed faculty evaluation:", error);
    throw new Error("Failed to save faculty evaluation.", { cause: error });
  }
}

/**
 * Returns live database-backed competency profile, history, strong/weak areas,
 * and calculation methodology for a student.
 */
export async function getStudentCompetencyReport(studentId: string) {
  try {
    const [studentSubs, studentVivas, historyRows] = await Promise.all([
      db
        .select()
        .from(submissions)
        .where(eq(submissions.studentId, studentId))
        .orderBy(desc(submissions.submittedAt)),
      db
        .select()
        .from(vivaSessions)
        .where(eq(vivaSessions.studentId, studentId))
        .orderBy(desc(vivaSessions.startedAt)),
      db
        .select()
        .from(competencyHistory)
        .where(eq(competencyHistory.studentId, studentId))
        .orderBy(desc(competencyHistory.recordedAt))
        .limit(20),
    ]);

    const vivaIds = studentVivas.map((v) => v.id);
    const vivaResps =
      vivaIds.length > 0
        ? await db
            .select()
            .from(vivaResponses)
            .where(inArray(vivaResponses.sessionId, vivaIds))
        : [];

    const report = aggregateStudentCompetencies(
      studentSubs.map((s) => ({
        id: s.id,
        experimentId: s.experimentId,
        assignmentId: s.assignmentId,
        studentId: s.studentId,
        attemptNumber: s.attemptNumber,
        totalScore: Number(s.totalScore),
        maxScore: Number(s.maxScore),
        facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
        competencyScores: s.competencyScores,
        taskResponses: (s.taskResponses || {}) as Record<string, any>,
        vivaSessionId: s.vivaSessionId,
        submittedAt: s.submittedAt,
      })),
      studentVivas.map((v) => ({
        id: v.id,
        experimentId: v.experimentId,
        overallScore: Number(v.overallScore),
        status: v.status,
        responses: vivaResps
          .filter((r) => r.sessionId === v.id)
          .map((r) => ({
            competencyDimension: r.competencyDimension,
            score: Number(r.score),
          })),
      })),
      DEFAULT_COMPETENCY_CONFIG
    );

    const history = historyRows.map((h) => ({
      id: h.id,
      submissionId: h.submissionId,
      vivaSessionId: h.vivaSessionId,
      experimentId: h.experimentId,
      attemptNumber: h.attemptNumber,
      competencyScores: h.competencyScores,
      overallScore: Number(h.overallScore),
      deltaOverall: Number(h.deltaOverall),
      recordedAt: h.recordedAt.toISOString(),
    }));

    const latestDelta = history.length > 0 ? history[0].deltaOverall : 0;

    return {
      ...report,
      latestDelta,
      history,
    };
  } catch (error) {
    console.error("[SubmissionService] Failed fetching competency report:", error);
    throw new Error("Failed to calculate competency profile.", { cause: error });
  }
}

export async function getStudentSubmissionsList(studentId: string): Promise<SubmissionDTO[]> {
  try {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.studentId, studentId))
      .orderBy(desc(submissions.submittedAt));
    return rows.map(mapSubmissionRow);
  } catch (error) {
    console.error("[SubmissionService] Failed fetching student submissions:", error);
    throw new Error("Failed to fetch student submissions.", { cause: error });
  }
}

export async function getStudentExperimentsStatus(studentId: string) {
  try {
    const [studentAssignments, studentSubs, studentVivas] = await Promise.all([
      db
        .select({
          id: assignments.id,
          title: assignments.title,
          experimentId: assignments.experimentId,
          dueDate: assignments.dueDate,
          status: assignments.status,
        })
        .from(assignments)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, assignments.classId))
        .where(
          and(
            eq(classEnrollments.studentId, studentId),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        ),
      db
        .select()
        .from(submissions)
        .where(eq(submissions.studentId, studentId))
        .orderBy(desc(submissions.submittedAt)),
      db
        .select()
        .from(vivaSessions)
        .where(eq(vivaSessions.studentId, studentId))
        .orderBy(desc(vivaSessions.startedAt)),
    ]);

    return getAllExperiments().map((exp) => {
      const assigned = studentAssignments.find(
        (a) => a.experimentId === exp.id && a.status === "active"
      );
      const expSubs = studentSubs.filter((s) => s.experimentId === exp.id);
      const expVivas = studentVivas.filter((v) => v.experimentId === exp.id);

      let status: "completed" | "in-progress" | "assigned" | "available" = "available";
      if (expSubs.length > 0) status = "completed";
      else if (expVivas.length > 0) status = "in-progress";
      else if (assigned) status = "assigned";

      const bestScore =
        expSubs.length > 0
          ? Math.max(
              ...expSubs.map((s) =>
                Math.round(
                  (Number(s.facultyScore ?? s.totalScore) / (Number(s.maxScore) || 100)) * 100
                )
              )
            )
          : null;

      return {
        id: exp.id,
        code: exp.code,
        title: exp.title,
        subject: exp.subject,
        syllabusTag: exp.syllabusTag,
        durationMinutes: exp.durationMinutes,
        status,
        dueDate: assigned ? assigned.dueDate.toISOString() : null,
        assignmentId: assigned ? assigned.id : null,
        attemptsCount: expSubs.length,
        bestScorePercentage: bestScore,
        vivaAttemptsCount: expVivas.length,
      };
    });
  } catch (error) {
    console.error("[SubmissionService] Failed fetching student experiments:", error);
    throw new Error("Failed to load student experiments.", { cause: error });
  }
}

export async function getTeacherClassStudents(teacherId: string, classId: string) {
  try {
    // Verify teacher owns class
    const cls = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
      .limit(1);

    if (cls.length === 0) {
      throw new Error("FORBIDDEN: Class not found or you do not teach this class.");
    }

    const roster = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        enrollmentCode: users.enrollmentCode,
        institution: users.institution,
        enrollmentId: classEnrollments.id,
        enrollmentStatus: classEnrollments.enrollmentStatus,
        enrolledAt: classEnrollments.enrolledAt,
      })
      .from(classEnrollments)
      .innerJoin(users, eq(users.id, classEnrollments.studentId))
      .where(
        and(
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.enrollmentStatus, "active")
        )
      )
      .orderBy(desc(classEnrollments.enrolledAt), users.name);

    const classAssignments = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.classId, classId));
    const asgIds = classAssignments.map((a) => a.id);

    const classSubs =
      asgIds.length > 0
        ? await db
            .select()
            .from(submissions)
            .where(inArray(submissions.assignmentId, asgIds))
            .orderBy(desc(submissions.submittedAt))
        : [];

    return roster.map((student) => {
      const stuSubs = classSubs.filter((s) => s.studentId === student.id);
      const report = aggregateStudentCompetencies(
        stuSubs.map((s) => ({
          id: s.id,
          experimentId: s.experimentId,
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          attemptNumber: s.attemptNumber,
          totalScore: Number(s.totalScore),
          maxScore: Number(s.maxScore),
          facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
          competencyScores: s.competencyScores,
          submittedAt: s.submittedAt,
        }))
      );

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        enrollmentCode: student.enrollmentCode,
        institution: student.institution,
        enrollmentId: student.enrollmentId,
        enrollmentStatus: student.enrollmentStatus,
        enrolledAt: student.enrolledAt.toISOString(),
        submissionsCount: stuSubs.length,
        overallMastery: report.overallScore,
        competencyScores: report.competencyScores,
        weakAreas: report.weakAreas,
        strongAreas: report.strongAreas,
        latestSubmittedAt: stuSubs[0]?.submittedAt.toISOString() || null,
      };
    });
  } catch (error: any) {
    if (error?.message?.startsWith("FORBIDDEN:")) throw error;
    console.error("[SubmissionService] Failed fetching class roster:", error);
    throw new Error("Failed to fetch class student roster.", { cause: error });
  }
}

export async function getTeacherSubmissionsList(teacherId: string): Promise<SubmissionDTO[]> {
  try {
    const rows = await db
      .select({ submission: submissions })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .innerJoin(classes, eq(classes.id, assignments.classId))
      .where(eq(classes.teacherId, teacherId))
      .orderBy(desc(submissions.submittedAt));

    return rows.map((r) => mapSubmissionRow(r.submission));
  } catch (error) {
    console.error("[SubmissionService] Failed fetching teacher submissions:", error);
    throw new Error("Failed to fetch teacher submissions.", { cause: error });
  }
}

export async function getAllSubmissionsAdmin(): Promise<SubmissionDTO[]> {
  try {
    const rows = await db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.submittedAt));
    return rows.map(mapSubmissionRow);
  } catch (error) {
    console.error("[SubmissionService] Failed fetching admin submissions:", error);
    throw new Error("Failed to fetch submissions.", { cause: error });
  }
}

export async function getAdminInstitutionsSummary() {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        institution: users.institution,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users);

    const allClasses = await db
      .select({ id: classes.id, teacherId: classes.teacherId, department: classes.department })
      .from(classes);

    const grouped = new Map<
      string,
      {
        name: string;
        students: number;
        teachers: number;
        admins: number;
        activeUsers: number;
        totalUsers: number;
        departments: Set<string>;
        classCount: number;
      }
    >();

    const userInstById = new Map<string, string>();
    for (const u of allUsers) {
      const inst = (u.institution || "Unassigned Institution").trim() || "Unassigned Institution";
      userInstById.set(u.id, inst);
      const entry = grouped.get(inst) || {
        name: inst,
        students: 0,
        teachers: 0,
        admins: 0,
        activeUsers: 0,
        totalUsers: 0,
        departments: new Set<string>(),
        classCount: 0,
      };
      entry.totalUsers += 1;
      if (u.status === "ACTIVE") entry.activeUsers += 1;
      if (u.role === "student") entry.students += 1;
      else if (u.role === "teacher") entry.teachers += 1;
      else if (u.role === "admin") entry.admins += 1;
      grouped.set(inst, entry);
    }

    for (const c of allClasses) {
      const inst = userInstById.get(c.teacherId);
      if (inst && grouped.has(inst)) {
        const entry = grouped.get(inst)!;
        entry.classCount += 1;
        if (c.department) entry.departments.add(c.department);
      }
    }

    return Array.from(grouped.values()).map((g, idx) => ({
      id: `inst-${idx + 1}`,
      name: g.name,
      students: g.students,
      teachers: g.teachers,
      admins: g.admins,
      activeUsers: g.activeUsers,
      totalUsers: g.totalUsers,
      classCount: g.classCount,
      departments: Array.from(g.departments),
      status: g.activeUsers > 0 ? "ACTIVE" : "INACTIVE",
    }));
  } catch (error) {
    console.error("[SubmissionService] Failed aggregating institutions:", error);
    throw new Error("Failed to load institutional metrics.", { cause: error });
  }
}

/**
 * Recalculates and persists a student's competency profile and history snapshot
 * when an AI Viva session is completed (even independently of a new submission).
 */
export async function syncCompetenciesAfterVivaCompletion(params: {
  studentId: string;
  vivaSessionId: string;
  experimentId: string;
  assignmentId?: string | null;
  attemptNumber: number;
}) {
  try {
    await db.transaction(async (tx) => {
      let classId: string | null = null;
      if (params.assignmentId) {
        const asgRows = await tx
          .select({ classId: assignments.classId })
          .from(assignments)
          .where(eq(assignments.id, params.assignmentId))
          .limit(1);
        classId = asgRows[0]?.classId ?? null;
      }

      await syncStudentAndClassCompetenciesTx(tx, {
        studentId: params.studentId,
        classId,
        triggerSubmissionId: null,
        triggerVivaSessionId: params.vivaSessionId,
        experimentId: params.experimentId,
        attemptNumber: params.attemptNumber,
        triggerType: "viva_completion",
      });
    });

    return await getStudentCompetencyReport(params.studentId);
  } catch (error) {
    console.error("[SubmissionService] Failed syncing competencies after viva:", error);
    return null;
  }
}

