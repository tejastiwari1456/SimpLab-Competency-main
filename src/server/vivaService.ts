import crypto from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  assignments,
  classes,
  classEnrollments,
  vivaResponses,
  vivaSessions,
} from "../db/schema.ts";
import {
  getExperimentById,
  getExperimentVivaTasks,
} from "./experimentCatalog.ts";
import {
  computeNextVivaDifficulty,
  evaluateVivaWithGemini,
  VivaDifficulty,
} from "./geminiClient.ts";

export interface VivaSessionDTO {
  id: string;
  studentId: string;
  experimentId: string;
  assignmentId: string | null;
  attemptNumber: number;
  status: "in_progress" | "completed";
  overallScore: number;
  maxScore: number;
  questionsCount: number;
  answeredCount: number;
  summaryFeedback: string | null;
  startedAt: string;
  completedAt: string | null;
  responses: VivaResponseDTO[];
}

export interface VivaResponseDTO {
  id: string;
  sessionId: string;
  questionIndex: number;
  taskId: string | null;
  questionText: string;
  competencyDimension: string;
  studentAnswer: string;
  score: number;
  maxPoints: number;
  passed: boolean;
  aiFeedback: string;
  rubricCriterionMet: string[];
  missingConcepts: string[];
  adaptiveFollowUp: string | null;
  difficulty: VivaDifficulty;
  aiModel: string;
  createdAt: string;
}

function mapResponseRow(r: typeof vivaResponses.$inferSelect): VivaResponseDTO {
  const diff =
    r.difficulty === "foundation" || r.difficulty === "advanced"
      ? r.difficulty
      : "intermediate";
  return {
    id: r.id,
    sessionId: r.sessionId,
    questionIndex: r.questionIndex,
    taskId: r.taskId,
    questionText: r.questionText,
    competencyDimension: r.competencyDimension,
    studentAnswer: r.studentAnswer,
    score: Number(r.score),
    maxPoints: Number(r.maxPoints),
    passed: r.passed,
    aiFeedback: r.aiFeedback,
    rubricCriterionMet: Array.isArray(r.rubricCriteriaMet) ? r.rubricCriteriaMet : [],
    missingConcepts: Array.isArray(r.missingConcepts) ? r.missingConcepts : [],
    adaptiveFollowUp: r.adaptiveFollowUp,
    difficulty: diff,
    aiModel: r.aiModel,
    createdAt: r.createdAt.toISOString(),
  };
}

function mapSessionRow(
  s: typeof vivaSessions.$inferSelect,
  responses: (typeof vivaResponses.$inferSelect)[] = []
): VivaSessionDTO {
  return {
    id: s.id,
    studentId: s.studentId,
    experimentId: s.experimentId,
    assignmentId: s.assignmentId,
    attemptNumber: s.attemptNumber,
    status: (s.status as "in_progress" | "completed") || "in_progress",
    overallScore: Number(s.overallScore),
    maxScore: Number(s.maxScore),
    questionsCount: s.questionsCount,
    answeredCount: s.answeredCount,
    summaryFeedback: s.summaryFeedback,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    responses: responses.map(mapResponseRow),
  };
}

/**
 * Starts and persists a new AI Viva session for an authenticated student.
 */
export async function startVivaSession(
  studentId: string,
  params: { experimentId: string; assignmentId?: string | null }
): Promise<{
  session: VivaSessionDTO;
  questions: Array<{
    taskId: string;
    questionIndex: number;
    title: string;
    prompt: string;
    competencyDimension: string;
    points: number;
  }>;
}> {
  const experiment = getExperimentById(params.experimentId);
  if (!experiment) {
    throw new Error("BAD_REQUEST: Invalid experimentId provided.");
  }

  let verifiedAssignmentId: string | null = null;
  if (params.assignmentId) {
    try {
      const enrolled = await db
        .select({ id: assignments.id, experimentId: assignments.experimentId })
        .from(assignments)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, assignments.classId))
        .where(
          and(
            eq(assignments.id, params.assignmentId),
            eq(classEnrollments.studentId, studentId),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        )
        .limit(1);

      if (enrolled.length === 0) {
        throw new Error("FORBIDDEN: Assignment not found or you are not enrolled in its class.");
      }
      if (enrolled[0].experimentId !== params.experimentId) {
        throw new Error("BAD_REQUEST: Assignment does not correspond to the selected experiment.");
      }
      verifiedAssignmentId = enrolled[0].id;
    } catch (error: any) {
      if (
        error?.message?.startsWith("FORBIDDEN:") ||
        error?.message?.startsWith("BAD_REQUEST:")
      ) {
        throw error;
      }
      console.error("[VivaService] Failed verifying assignment:", error);
      throw new Error("Failed to verify assignment enrollment.", { cause: error });
    }
  }

  const vivaTasks = getExperimentVivaTasks(params.experimentId);
  const sessionId = `viva-${crypto.randomUUID()}`;

  try {
    const created = await db.transaction(async (tx) => {
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(vivaSessions)
        .where(
          and(
            eq(vivaSessions.studentId, studentId),
            eq(vivaSessions.experimentId, params.experimentId)
          )
        );
      const attemptNumber = (countResult[0]?.count ?? 0) + 1;

      const [inserted] = await tx
        .insert(vivaSessions)
        .values({
          id: sessionId,
          studentId,
          experimentId: params.experimentId,
          assignmentId: verifiedAssignmentId,
          attemptNumber,
          status: "in_progress",
          overallScore: "0",
          maxScore: "100",
          // Base question(s) + 1 adaptive follow-up defense question
          questionsCount: Math.max(2, vivaTasks.length + 1),
          answeredCount: 0,
        })
        .returning();

      return inserted;
    });

    return {
      session: mapSessionRow(created, []),
      questions: vivaTasks.map((t, idx) => ({
        taskId: t.id,
        questionIndex: idx,
        title: t.title,
        prompt: t.prompt,
        competencyDimension: t.competencyDimension,
        points: t.points,
      })),
    };
  } catch (error) {
    console.error("[VivaService] Failed to create viva session:", error);
    throw new Error("Failed to start AI Viva session.", { cause: error });
  }
}

/**
 * Evaluates a student's Viva answer server-side via Gemini and persists it atomically.
 * Students cannot provide or override scores, rubrics, or pass statuses.
 */
export async function submitVivaAnswer(
  studentId: string,
  sessionId: string,
  params: {
    taskId?: string;
    questionIndex?: number;
    questionText?: string;
    isAdaptiveFollowUp?: boolean;
    studentAnswer: string;
  }
): Promise<{
  response: VivaResponseDTO;
  session: VivaSessionDTO;
  nextDifficulty: VivaDifficulty;
}> {
  const trimmedAnswer = (params.studentAnswer || "").trim();
  if (trimmedAnswer.length < 3) {
    throw new Error("BAD_REQUEST: Please provide a substantive answer before submitting.");
  }
  if (trimmedAnswer.length > 4000) {
    throw new Error("BAD_REQUEST: Viva answer exceeds maximum allowed length (4000 characters).");
  }

  let sessionRow: typeof vivaSessions.$inferSelect;
  let existingResponses: (typeof vivaResponses.$inferSelect)[] = [];
  try {
    const rows = await db
      .select()
      .from(vivaSessions)
      .where(eq(vivaSessions.id, sessionId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error("NOT_FOUND: Viva session not found.");
    }
    sessionRow = rows[0];

    existingResponses = await db
      .select()
      .from(vivaResponses)
      .where(eq(vivaResponses.sessionId, sessionId))
      .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt);
  } catch (error: any) {
    if (error?.message?.startsWith("NOT_FOUND:")) throw error;
    console.error("[VivaService] Failed loading viva session:", error);
    throw new Error("Failed to retrieve viva session.", { cause: error });
  }

  // Strict ownership check
  if (sessionRow.studentId !== studentId) {
    throw new Error("FORBIDDEN: You can only submit answers to your own viva session.");
  }

  if (sessionRow.status === "completed") {
    throw new Error("CONFLICT: This viva session is already completed and locked.");
  }

  const experiment = getExperimentById(sessionRow.experimentId);
  const vivaTasks = getExperimentVivaTasks(sessionRow.experimentId);
  const latestPrevious =
    existingResponses.length > 0 ? existingResponses[existingResponses.length - 1] : null;

  const isFollowUpTurn =
    Boolean(params.isAdaptiveFollowUp) ||
    (typeof params.questionIndex === "number" &&
      params.questionIndex >= vivaTasks.length &&
      Boolean(latestPrevious?.adaptiveFollowUp));

  let authoritativeQuestion: string;
  let authoritativeRubric: string;
  let authoritativeCompetency: string;
  let authoritativeMaxPoints: number;
  let authoritativeTaskId: string | null;
  let questionIndex: number;
  let difficulty: VivaDifficulty = "intermediate";
  let previousExchange: { question: string; studentAnswer: string; score: number } | null = null;

  if (isFollowUpTurn) {
    if (!latestPrevious || !latestPrevious.adaptiveFollowUp) {
      throw new Error(
        "BAD_REQUEST: No server-generated adaptive follow-up question is available for this session."
      );
    }
    const baseTask = vivaTasks[0];
    // Strictly use the server-generated follow-up prompt so clients cannot tamper with the question
    authoritativeQuestion = latestPrevious.adaptiveFollowUp;
    authoritativeCompetency =
      latestPrevious.competencyDimension || baseTask?.competencyDimension || "troubleshooting_safety";
    authoritativeMaxPoints = baseTask?.points ?? 30;
    authoritativeTaskId = `adaptive-followup-${existingResponses.length}`;
    questionIndex = existingResponses.length;
    difficulty = computeNextVivaDifficulty(Number(latestPrevious.score));
    previousExchange = {
      question: latestPrevious.questionText,
      studentAnswer: latestPrevious.studentAnswer,
      score: Number(latestPrevious.score),
    };
    authoritativeRubric = `Adaptive ${difficulty.toUpperCase()}-level follow-up building on ${
      experiment?.title || sessionRow.experimentId
    }. Base rubric context: ${
      baseTask?.rubric ||
      "Evaluate physical/chemical mechanism, scientific accuracy, and experimental reasoning."
    } Verify the student accurately addresses the specific follow-up question with clear cause-and-effect reasoning.`;
  } else {
    // Authoritatively resolve base catalog question, rubric, competency dimension, and points
    const matchedTask =
      (params.taskId && vivaTasks.find((t) => t.id === params.taskId)) ||
      (typeof params.questionIndex === "number" && vivaTasks[params.questionIndex]) ||
      vivaTasks[0];

    authoritativeQuestion =
      matchedTask?.prompt ||
      params.questionText ||
      "Explain the physical principles observed in this experiment.";
    authoritativeRubric =
      matchedTask?.rubric ||
      "Evaluate accuracy of underlying scientific principle, use of correct technical terminology, and clear cause-effect explanation.";
    authoritativeCompetency = matchedTask?.competencyDimension || "troubleshooting_safety";
    authoritativeMaxPoints = matchedTask?.points ?? 30;
    authoritativeTaskId = matchedTask?.id || params.taskId || null;
    questionIndex =
      typeof params.questionIndex === "number"
        ? params.questionIndex
        : matchedTask
        ? Math.max(0, vivaTasks.indexOf(matchedTask))
        : 0;
    difficulty = latestPrevious
      ? computeNextVivaDifficulty(Number(latestPrevious.score))
      : "intermediate";
  }

  // Call Gemini server-side (throws GeminiServiceError if unconfigured or upstream fails)
  const evaluation = await evaluateVivaWithGemini({
    experimentContext: experiment
      ? `${experiment.title} (${experiment.subject} — ${experiment.syllabusTag})`
      : sessionRow.experimentId,
    competencyDimension: authoritativeCompetency,
    question: authoritativeQuestion,
    rubric: authoritativeRubric,
    studentAnswer: trimmedAnswer,
    difficulty,
    previousExchange,
  });

  const responseId = `vresp-${crypto.randomUUID()}`;

  try {
    const result = await db.transaction(async (tx) => {
      const [insertedResponse] = await tx
        .insert(vivaResponses)
        .values({
          id: responseId,
          sessionId,
          questionIndex,
          taskId: authoritativeTaskId,
          questionText: authoritativeQuestion,
          competencyDimension: authoritativeCompetency,
          rubric: authoritativeRubric,
          studentAnswer: trimmedAnswer,
          score: evaluation.score.toFixed(2),
          maxPoints: authoritativeMaxPoints.toFixed(2),
          passed: evaluation.passed,
          aiFeedback: evaluation.feedback,
          rubricCriteriaMet: evaluation.rubricCriterionMet,
          missingConcepts: evaluation.missingConcepts,
          adaptiveFollowUp: evaluation.adaptiveFollowUp,
          difficulty: evaluation.difficulty,
          aiModel: evaluation.model,
        })
        .returning();

      const allResponses = await tx
        .select()
        .from(vivaResponses)
        .where(eq(vivaResponses.sessionId, sessionId))
        .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt);

      // Compute authoritative session overall score across unique question slots
      const latestBySlot = new Map<string, typeof vivaResponses.$inferSelect>();
      for (const r of allResponses) {
        const key = r.taskId || `q-${r.questionIndex}`;
        latestBySlot.set(key, r);
      }
      const uniqueResponses = Array.from(latestBySlot.values());
      const avgScore =
        uniqueResponses.length > 0
          ? Math.round(
              (uniqueResponses.reduce((sum, r) => sum + Number(r.score), 0) /
                uniqueResponses.length) *
                100
            ) / 100
          : 0;

      const targetQuestions = Math.max(2, sessionRow.questionsCount || 2);
      const isNowComplete = uniqueResponses.length >= targetQuestions;
      const summaryFeedback = isNowComplete
        ? `Adaptive AI Viva completed with ${avgScore}% overall mastery across ${uniqueResponses.length} question(s) (final level: ${evaluation.difficulty}).`
        : `Question ${uniqueResponses.length} of ${targetQuestions} evaluated (${evaluation.score}%). Adaptive ${evaluation.nextDifficulty}-level follow-up ready.`;

      const [updatedSession] = await tx
        .update(vivaSessions)
        .set({
          overallScore: avgScore.toFixed(2),
          answeredCount: uniqueResponses.length,
          status: isNowComplete ? "completed" : "in_progress",
          completedAt: isNowComplete ? new Date() : null,
          summaryFeedback,
        })
        .where(eq(vivaSessions.id, sessionId))
        .returning();

      return { insertedResponse, updatedSession, allResponses };
    });

    return {
      response: mapResponseRow(result.insertedResponse),
      session: mapSessionRow(result.updatedSession, result.allResponses),
      nextDifficulty: evaluation.nextDifficulty,
    };
  } catch (error) {
    console.error("[VivaService] Failed persisting viva response:", error);
    throw new Error("Failed to save AI Viva evaluation.", { cause: error });
  }
}

/**
 * Explicitly marks a student's viva session as completed and locks further edits.
 */
export async function completeVivaSession(
  studentId: string,
  sessionId: string
): Promise<VivaSessionDTO> {
  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(vivaSessions)
        .where(eq(vivaSessions.id, sessionId))
        .limit(1);

      if (rows.length === 0) {
        throw new Error("NOT_FOUND: Viva session not found.");
      }
      const session = rows[0];
      if (session.studentId !== studentId) {
        throw new Error("FORBIDDEN: You can only complete your own viva session.");
      }

      const responses = await tx
        .select()
        .from(vivaResponses)
        .where(eq(vivaResponses.sessionId, sessionId))
        .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt);

      const latestByTask = new Map<string, typeof vivaResponses.$inferSelect>();
      for (const r of responses) {
        latestByTask.set(r.taskId || `q-${r.questionIndex}`, r);
      }
      const unique = Array.from(latestByTask.values());
      const overall =
        unique.length > 0
          ? Math.round(
              (unique.reduce((sum, r) => sum + Number(r.score), 0) / unique.length) *
                100
            ) / 100
          : 0;

      const summary =
        unique.length > 0
          ? `Assessment finalized: ${overall}% across ${unique.length} evaluated response(s).`
          : "Session closed without evaluated responses.";

      const [updated] = await tx
        .update(vivaSessions)
        .set({
          status: "completed",
          overallScore: overall.toFixed(2),
          answeredCount: unique.length,
          summaryFeedback: summary,
          completedAt: session.completedAt || new Date(),
        })
        .where(eq(vivaSessions.id, sessionId))
        .returning();

      return mapSessionRow(updated, responses);
    });

    return result;
  } catch (error: any) {
    if (error?.message?.startsWith("NOT_FOUND:") || error?.message?.startsWith("FORBIDDEN:")) {
      throw error;
    }
    console.error("[VivaService] Failed completing viva session:", error);
    throw new Error("Failed to complete AI Viva session.", { cause: error });
  }
}

/**
 * Retrieves all persisted AI Viva attempts and responses for a student.
 */
export async function getStudentVivaSessions(
  studentId: string,
  experimentId?: string
): Promise<VivaSessionDTO[]> {
  try {
    const conditions = experimentId
      ? and(
          eq(vivaSessions.studentId, studentId),
          eq(vivaSessions.experimentId, experimentId)
        )
      : eq(vivaSessions.studentId, studentId);

    const sessionsList = await db
      .select()
      .from(vivaSessions)
      .where(conditions)
      .orderBy(desc(vivaSessions.startedAt));

    if (sessionsList.length === 0) return [];

    const results: VivaSessionDTO[] = [];
    for (const s of sessionsList) {
      const responses = await db
        .select()
        .from(vivaResponses)
        .where(eq(vivaResponses.sessionId, s.id))
        .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt);
      results.push(mapSessionRow(s, responses));
    }
    return results;
  } catch (error) {
    console.error("[VivaService] Failed fetching student viva sessions:", error);
    throw new Error("Failed to retrieve AI Viva history.", { cause: error });
  }
}

/**
 * Retrieves a single AI Viva session report with strict RBAC + resource ownership checks.
 */
export async function getVivaSessionById(
  requester: { id: string; role: string },
  sessionId: string
): Promise<VivaSessionDTO> {
  try {
    const rows = await db
      .select()
      .from(vivaSessions)
      .where(eq(vivaSessions.id, sessionId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error("NOT_FOUND: Viva session not found.");
    }
    const session = rows[0];

    // Enforce resource ownership
    if (requester.role === "student" && session.studentId !== requester.id) {
      throw new Error("FORBIDDEN: You do not have permission to view this viva session.");
    }

    if (requester.role === "teacher") {
      // Teacher must teach at least one class where this student is enrolled
      const authorized = await db
        .select({ classId: classes.id })
        .from(classes)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, classes.id))
        .where(
          and(
            eq(classes.teacherId, requester.id),
            eq(classEnrollments.studentId, session.studentId),
            eq(classEnrollments.enrollmentStatus, "active")
          )
        )
        .limit(1);

      if (authorized.length === 0) {
        throw new Error("FORBIDDEN: This student is not enrolled in any of your classes.");
      }
    }

    const responses = await db
      .select()
      .from(vivaResponses)
      .where(eq(vivaResponses.sessionId, sessionId))
      .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt);

    return mapSessionRow(session, responses);
  } catch (error: any) {
    if (error?.message?.startsWith("NOT_FOUND:") || error?.message?.startsWith("FORBIDDEN:")) {
      throw error;
    }
    console.error("[VivaService] Failed loading viva session details:", error);
    throw new Error("Failed to load viva assessment report.", { cause: error });
  }
}
