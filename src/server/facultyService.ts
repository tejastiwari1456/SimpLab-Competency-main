import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  assignments,
  classes,
  classEnrollments,
  competencyHistory,
  evaluationHistory,
  submissions,
  users,
  vivaResponses,
  vivaSessions,
} from "../db/schema.ts";
import { getPersistentNotificationsForUser } from "./notificationService.ts";
import type { CompetencyKey } from "../types.ts";
import {
  DEFAULT_COMPETENCY_CONFIG,
  aggregateStudentCompetencies,
} from "./competencyEngine.ts";
import {
  ALL_COMPETENCY_KEYS,
  getAllExperiments,
  getExperimentById,
} from "./experimentCatalog.ts";
import {
  COMPETENCY_LABELS,
  buildCsvDocument,
  computeClassComparisonMatrix,
  computeExperimentPerformance,
  computeSkillGaps,
  effectivePercentage,
  identifyRemedialStudents,
} from "./facultyAnalyticsEngine.ts";
import { generateFacultyInsightsWithGemini } from "./geminiClient.ts";

async function loadTeacherClasses(teacherId: string, filterClassId?: string) {
  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.teacherId, teacherId))
    .orderBy(classes.name);

  if (filterClassId && filterClassId !== "all") {
    const matched = rows.filter((c) => c.id === filterClassId);
    if (matched.length === 0) {
      throw new Error(
        "FORBIDDEN: Class not found or you are not authorized to access this class."
      );
    }
    return { allTeacherClasses: rows, scopedClasses: matched };
  }

  return { allTeacherClasses: rows, scopedClasses: rows };
}

async function loadAggregatedRosterForClasses(
  classRows: (typeof classes.$inferSelect)[]
) {
  const classIds = classRows.map((c) => c.id);
  if (classIds.length === 0) {
    return {
      enrollments: [],
      classAssignments: [],
      classSubmissions: [],
      studentsAggregated: [],
    };
  }

  const [enrollments, classAssignments] = await Promise.all([
    db
      .select({
        enrollmentId: classEnrollments.id,
        classId: classEnrollments.classId,
        enrollmentStatus: classEnrollments.enrollmentStatus,
        studentId: users.id,
        name: users.name,
        email: users.email,
        enrollmentCode: users.enrollmentCode,
        institution: users.institution,
        enrolledAt: classEnrollments.enrolledAt,
      })
      .from(classEnrollments)
      .innerJoin(users, eq(users.id, classEnrollments.studentId))
      .where(
        and(
          inArray(classEnrollments.classId, classIds),
          eq(classEnrollments.enrollmentStatus, "active")
        )
      )
      .orderBy(desc(classEnrollments.enrolledAt), users.name),
    db
      .select()
      .from(assignments)
      .where(inArray(assignments.classId, classIds))
      .orderBy(desc(assignments.createdAt)),
  ]);

  const asgIds = classAssignments.map((a) => a.id);
  const classSubmissions =
    asgIds.length > 0
      ? await db
          .select()
          .from(submissions)
          .where(inArray(submissions.assignmentId, asgIds))
          .orderBy(desc(submissions.submittedAt))
      : [];

  const classCodeById = new Map(classRows.map((c) => [c.id, c.code]));
  const studentMap = new Map<
    string,
    {
      studentId: string;
      studentName: string;
      email: string;
      enrollmentCode: string | null;
      institution: string;
      classIds: string[];
      classCodes: string[];
    }
  >();

  for (const e of enrollments) {
    const existing = studentMap.get(e.studentId);
    const code = classCodeById.get(e.classId) || e.classId;
    if (!existing) {
      studentMap.set(e.studentId, {
        studentId: e.studentId,
        studentName: e.name,
        email: e.email,
        enrollmentCode: e.enrollmentCode,
        institution: e.institution,
        classIds: [e.classId],
        classCodes: [code],
      });
    } else if (!existing.classIds.includes(e.classId)) {
      existing.classIds.push(e.classId);
      existing.classCodes.push(code);
    }
  }

  const studentsAggregated = Array.from(studentMap.values()).map((st) => {
    const stuSubs = classSubmissions.filter((s) => s.studentId === st.studentId);
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
      })),
      [],
      DEFAULT_COMPETENCY_CONFIG
    );

    return {
      ...st,
      submissionsCount: stuSubs.length,
      overallMastery: report.overallScore,
      competencyScores: report.competencyScores,
      strongAreas: report.strongAreas,
      weakAreas: report.weakAreas,
      latestSubmittedAt: stuSubs[0]?.submittedAt.toISOString() || null,
    };
  });

  return {
    enrollments,
    classAssignments,
    classSubmissions,
    studentsAggregated,
  };
}

/**
 * 1. Faculty Dashboard Summary: real student counts, pending submissions, completed
 *    experiments, class average competency, recent activities, and attention list.
 */
export async function getFacultyDashboardSummary(teacherId: string) {
  const { allTeacherClasses } = await loadTeacherClasses(teacherId);
  const { enrollments, classAssignments, classSubmissions, studentsAggregated } =
    await loadAggregatedRosterForClasses(allTeacherClasses);

  const asgIds = classAssignments.map((a) => a.id);
  const subIds = classSubmissions.map((s) => s.id);

  const [recentVivas, recentEvals, persistentNotifs] = await Promise.all([
    asgIds.length > 0
      ? db
          .select({
            id: vivaSessions.id,
            studentId: vivaSessions.studentId,
            studentName: users.name,
            experimentId: vivaSessions.experimentId,
            overallScore: vivaSessions.overallScore,
            status: vivaSessions.status,
            startedAt: vivaSessions.startedAt,
            completedAt: vivaSessions.completedAt,
          })
          .from(vivaSessions)
          .innerJoin(users, eq(users.id, vivaSessions.studentId))
          .where(inArray(vivaSessions.assignmentId, asgIds))
          .orderBy(desc(vivaSessions.startedAt))
          .limit(8)
      : Promise.resolve([]),
    subIds.length > 0
      ? db
          .select()
          .from(evaluationHistory)
          .where(inArray(evaluationHistory.submissionId, subIds))
          .orderBy(desc(evaluationHistory.createdAt))
          .limit(8)
      : Promise.resolve([]),
    getPersistentNotificationsForUser(teacherId, { limit: 12 }),
  ]);

  const pendingStatuses = new Set(["pending", "auto_graded", "ai_evaluated"]);
  const pendingSubmissionsCount = classSubmissions.filter((s) =>
    pendingStatuses.has(s.evaluationStatus)
  ).length;

  const completedExperimentsCount = classSubmissions.filter(
    (s) => s.completionStatus === "completed" || s.completionStatus === "submitted"
  ).length;

  // Overall average competency across teacher's classes that have evaluated submissions
  const evaluatedStudents = studentsAggregated.filter((s) => s.submissionsCount > 0);
  const classAverageCompetency =
    evaluatedStudents.length > 0
      ? Math.round(
          (evaluatedStudents.reduce((sum, s) => sum + s.overallMastery, 0) /
            evaluatedStudents.length) *
            10
        ) / 10
      : 0;

  const studentsRequiringAttention = identifyRemedialStudents(
    studentsAggregated,
    75
  ).slice(0, 8);

  const subById = new Map(classSubmissions.map((s) => [s.id, s]));

  // Build unified chronological recent activity stream
  const activities: Array<{
    id: string;
    type: "submission" | "viva" | "evaluation";
    title: string;
    subtitle: string;
    studentId?: string;
    studentName: string;
    experimentId?: string;
    scorePct?: number;
    status?: string;
    timestamp: string;
  }> = [];

  for (const s of classSubmissions.slice(0, 8)) {
    const exp = getExperimentById(s.experimentId);
    activities.push({
      id: `act-sub-${s.id}`,
      type: "submission",
      title: `${s.studentName} submitted ${exp?.title || s.experimentId}`,
      subtitle: `Attempt #${s.attemptNumber} • ${s.evaluationStatus.replace(/_/g, " ")}`,
      studentId: s.studentId,
      studentName: s.studentName,
      experimentId: s.experimentId,
      scorePct: effectivePercentage({
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName,
        assignmentId: s.assignmentId,
        experimentId: s.experimentId,
        totalScore: Number(s.totalScore),
        maxScore: Number(s.maxScore),
        facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
        submittedAt: s.submittedAt,
      }),
      status: s.evaluationStatus,
      timestamp: s.submittedAt.toISOString(),
    });
  }

  for (const v of recentVivas) {
    const exp = getExperimentById(v.experimentId);
    activities.push({
      id: `act-viva-${v.id}`,
      type: "viva",
      title: `${v.studentName} ${v.status === "completed" ? "completed" : "started"} AI Viva`,
      subtitle: `${exp?.title || v.experimentId}`,
      studentId: v.studentId,
      studentName: v.studentName,
      experimentId: v.experimentId,
      scorePct: Math.round(Number(v.overallScore)),
      status: v.status,
      timestamp: (v.completedAt || v.startedAt).toISOString(),
    });
  }

  for (const ev of recentEvals) {
    const sub = subById.get(ev.submissionId);
    const exp = sub ? getExperimentById(sub.experimentId) : null;
    activities.push({
      id: `act-eval-${ev.id}`,
      type: "evaluation",
      title: `${ev.evaluatorName} marked ${sub?.studentName || "submission"} as ${ev.newStatus.replace(/_/g, " ")}`,
      subtitle: exp?.title || sub?.experimentId || "Lab Submission",
      studentId: sub?.studentId,
      studentName: sub?.studentName || "Student",
      experimentId: sub?.experimentId,
      scorePct: ev.newScore != null ? Math.round(Number(ev.newScore)) : undefined,
      status: ev.newStatus,
      timestamp: ev.createdAt.toISOString(),
    });
  }

  activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const classById = new Map(allTeacherClasses.map((c) => [c.id, c]));

  const recentlyEnrolledStudents = enrollments.slice(0, 10).map((e) => {
    const cls = classById.get(e.classId);
    return {
      enrollmentId: e.enrollmentId,
      studentId: e.studentId,
      studentName: e.name,
      email: e.email,
      enrollmentCode: e.enrollmentCode,
      classId: e.classId,
      classCode: cls?.code || e.classId,
      className: cls?.name || e.classId,
      enrollmentStatus: e.enrollmentStatus,
      enrolledAt: e.enrolledAt.toISOString(),
    };
  });

  const classDistribution = allTeacherClasses.map((cls) => ({
    classId: cls.id,
    code: cls.code,
    name: cls.name,
    studentCount: enrollments.filter((e) => e.classId === cls.id).length,
  }));

  return {
    totalAssignedStudents: studentsAggregated.length,
    totalClasses: allTeacherClasses.length,
    activeAssignmentsCount: classAssignments.filter((a) => a.status === "active").length,
    pendingSubmissionsCount,
    completedExperimentsCount,
    totalSubmissionsCount: classSubmissions.length,
    classAverageCompetency,
    recentActivities: activities.slice(0, 10),
    studentsRequiringAttention,
    recentlyEnrolledStudents,
    classDistribution,
    unreadNotificationsCount: persistentNotifs.unreadCount,
    latestEnrollmentNotifications: persistentNotifs.notifications.slice(0, 6),
  };
}

/**
 * 2. Authorized Individual Student Profile, Experiment History & Competency Report.
 *    Strictly verifies the student is enrolled in at least one class taught by teacherId.
 */
export async function getAuthorizedStudentReportForTeacher(
  teacherId: string,
  studentId: string
) {
  const authorizedEnrollments = await db
    .select({
      classId: classes.id,
      classCode: classes.code,
      className: classes.name,
      semester: classes.semester,
      academicYear: classes.academicYear,
      enrolledAt: classEnrollments.enrolledAt,
    })
    .from(classEnrollments)
    .innerJoin(classes, eq(classes.id, classEnrollments.classId))
    .where(
      and(
        eq(classEnrollments.studentId, studentId),
        eq(classEnrollments.enrollmentStatus, "active"),
        eq(classes.teacherId, teacherId)
      )
    );

  if (authorizedEnrollments.length === 0) {
    throw new Error(
      "FORBIDDEN: Student is not enrolled in any of your assigned classes."
    );
  }

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      institution: users.institution,
      enrollmentCode: users.enrollmentCode,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  if (userRows.length === 0) {
    throw new Error("NOT_FOUND: Student profile not found.");
  }
  const student = userRows[0];

  const authorizedClassIds = authorizedEnrollments.map((e) => e.classId);
  const authorizedAssignments = await db
    .select()
    .from(assignments)
    .where(inArray(assignments.classId, authorizedClassIds));
  const asgIds = authorizedAssignments.map((a) => a.id);

  const [studentSubs, studentVivas, historyRows] = await Promise.all([
    asgIds.length > 0
      ? db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.studentId, studentId),
              inArray(submissions.assignmentId, asgIds)
            )
          )
          .orderBy(desc(submissions.submittedAt))
      : Promise.resolve([]),
    asgIds.length > 0
      ? db
          .select()
          .from(vivaSessions)
          .where(
            and(
              eq(vivaSessions.studentId, studentId),
              inArray(vivaSessions.assignmentId, asgIds)
            )
          )
          .orderBy(desc(vivaSessions.startedAt))
      : Promise.resolve([]),
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
          .orderBy(vivaResponses.questionIndex, vivaResponses.createdAt)
      : [];

  const subIds = studentSubs.map((s) => s.id);
  const evalHistRows =
    subIds.length > 0
      ? await db
          .select()
          .from(evaluationHistory)
          .where(inArray(evaluationHistory.submissionId, subIds))
          .orderBy(desc(evaluationHistory.createdAt))
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

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      institution: student.institution,
      enrollmentCode: student.enrollmentCode,
      lastLoginAt: student.lastLoginAt?.toISOString() || null,
      enrolledClasses: authorizedEnrollments.map((e) => ({
        classId: e.classId,
        code: e.classCode,
        name: e.className,
        semester: e.semester,
        academicYear: e.academicYear,
      })),
    },
    competencyReport: {
      ...report,
      latestDelta: historyRows.length > 0 ? Number(historyRows[0].deltaOverall) : 0,
      history: historyRows.map((h) => ({
        id: h.id,
        submissionId: h.submissionId,
        vivaSessionId: h.vivaSessionId,
        experimentId: h.experimentId,
        attemptNumber: h.attemptNumber,
        competencyScores: h.competencyScores,
        overallScore: Number(h.overallScore),
        deltaOverall: Number(h.deltaOverall),
        recordedAt: h.recordedAt.toISOString(),
      })),
    },
    submissions: studentSubs.map((s) => ({
      id: s.id,
      assignmentId: s.assignmentId,
      experimentId: s.experimentId,
      experimentTitle: getExperimentById(s.experimentId)?.title || s.experimentId,
      attemptNumber: s.attemptNumber,
      totalScore: Number(s.totalScore),
      maxScore: Number(s.maxScore),
      facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
      evaluationStatus: s.evaluationStatus,
      instructorFeedback: s.instructorFeedback,
      competencyScores: s.competencyScores,
      observations: s.observations,
      calculatedResults: s.calculatedResults,
      dataReadingsCount: s.dataReadingsCount,
      submittedAt: s.submittedAt.toISOString(),
      evaluatedAt: s.evaluatedAt?.toISOString() || null,
    })),
    vivaSessions: studentVivas.map((v) => ({
      id: v.id,
      experimentId: v.experimentId,
      experimentTitle: getExperimentById(v.experimentId)?.title || v.experimentId,
      attemptNumber: v.attemptNumber,
      status: v.status,
      overallScore: Number(v.overallScore),
      answeredCount: v.answeredCount,
      questionsCount: v.questionsCount,
      summaryFeedback: v.summaryFeedback,
      startedAt: v.startedAt.toISOString(),
      completedAt: v.completedAt?.toISOString() || null,
      responses: vivaResps
        .filter((r) => r.sessionId === v.id)
        .map((r) => ({
          id: r.id,
          questionText: r.questionText,
          studentAnswer: r.studentAnswer,
          score: Number(r.score),
          passed: r.passed,
          difficulty: r.difficulty,
          aiFeedback: r.aiFeedback,
          rubricCriterionMet: r.rubricCriteriaMet,
          missingConcepts: r.missingConcepts,
        })),
    })),
    evaluationHistory: evalHistRows.map((ev) => ({
      id: ev.id,
      submissionId: ev.submissionId,
      evaluatorName: ev.evaluatorName,
      previousStatus: ev.previousStatus,
      newStatus: ev.newStatus,
      previousScore: ev.previousScore != null ? Number(ev.previousScore) : null,
      newScore: ev.newScore != null ? Number(ev.newScore) : null,
      feedback: ev.feedback,
      createdAt: ev.createdAt.toISOString(),
    })),
  };
}

/**
 * 5. Faculty Competency Analytics: class comparisons, skill gaps, experiment performance,
 *    competency improvement trends, and deduplicated students requiring remedial practice.
 */
export async function getFacultyCompetencyAnalytics(
  teacherId: string,
  classId?: string
) {
  const { allTeacherClasses, scopedClasses } = await loadTeacherClasses(
    teacherId,
    classId
  );

  const allClassIds = allTeacherClasses.map((c) => c.id);
  const allEnrollments =
    allClassIds.length > 0
      ? await db
          .select({
            classId: classEnrollments.classId,
            studentId: classEnrollments.studentId,
          })
          .from(classEnrollments)
          .where(
            and(
              inArray(classEnrollments.classId, allClassIds),
              eq(classEnrollments.enrollmentStatus, "active")
            )
          )
      : [];

  const countByClassId = new Map<string, number>();
  for (const e of allEnrollments) {
    countByClassId.set(e.classId, (countByClassId.get(e.classId) || 0) + 1);
  }

  const classComparison = computeClassComparisonMatrix(
    allTeacherClasses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      studentCount: countByClassId.get(c.id) || 0,
      averageCompetencies: c.averageCompetencies,
    }))
  );

  const { classSubmissions, studentsAggregated } =
    await loadAggregatedRosterForClasses(scopedClasses);

  // Scoped average competencies across selected class(es)
  const avgCompetencies: Record<CompetencyKey, number> = {
    setup_adherence: 0,
    measurement_precision: 0,
    data_interpretation: 0,
    troubleshooting_safety: 0,
    experimental_design: 0,
  };

  if (scopedClasses.length === 1) {
    for (const k of ALL_COMPETENCY_KEYS) {
      avgCompetencies[k] = Number(scopedClasses[0].averageCompetencies?.[k] ?? 0);
    }
  } else if (scopedClasses.length > 1) {
    for (const k of ALL_COMPETENCY_KEYS) {
      const avg =
        scopedClasses.reduce(
          (sum, c) => sum + Number(c.averageCompetencies?.[k] ?? 0),
          0
        ) / scopedClasses.length;
      avgCompetencies[k] = Math.round(avg * 10) / 10;
    }
  }

  const skillGaps = computeSkillGaps(avgCompetencies, 75);

  const experimentPerformance = computeExperimentPerformance(
    classSubmissions.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      assignmentId: s.assignmentId,
      experimentId: s.experimentId,
      totalScore: Number(s.totalScore),
      maxScore: Number(s.maxScore),
      facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
      evaluationStatus: s.evaluationStatus,
      competencyScores: s.competencyScores,
      submittedAt: s.submittedAt,
    })),
    getAllExperiments().map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      subject: e.subject,
    }))
  );

  // Competency improvement trends from competency_history for scoped students
  const scopedStudentIds = studentsAggregated.map((s) => s.studentId);
  const historyRows =
    scopedStudentIds.length > 0
      ? await db
          .select()
          .from(competencyHistory)
          .where(inArray(competencyHistory.studentId, scopedStudentIds))
          .orderBy(competencyHistory.recordedAt)
          .limit(100)
      : [];

  // Bucket by date label for clean trend visualization
  const bucketMap = new Map<
    string,
    { dateLabel: string; scores: number[]; deltas: number[]; count: number }
  >();
  for (const h of historyRows) {
    const dayKey = h.recordedAt.toISOString().slice(0, 10);
    const label = h.recordedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const entry = bucketMap.get(dayKey) || {
      dateLabel: label,
      scores: [],
      deltas: [],
      count: 0,
    };
    entry.scores.push(Number(h.overallScore));
    entry.deltas.push(Number(h.deltaOverall));
    entry.count += 1;
    bucketMap.set(dayKey, entry);
  }

  const improvementTrends = Array.from(bucketMap.entries()).map(([isoDate, b]) => ({
    isoDate,
    label: b.dateLabel,
    averageOverall:
      Math.round((b.scores.reduce((a, c) => a + c, 0) / b.scores.length) * 10) / 10,
    averageDelta:
      Math.round((b.deltas.reduce((a, c) => a + c, 0) / b.deltas.length) * 10) / 10,
    checkpointsCount: b.count,
  }));

  const remedialStudents = identifyRemedialStudents(studentsAggregated, 75);

  return {
    scope:
      classId && classId !== "all"
        ? {
            classId: scopedClasses[0].id,
            code: scopedClasses[0].code,
            name: scopedClasses[0].name,
          }
        : { classId: "all", code: "ALL", name: "All Assigned Cohorts" },
    averageCompetencies: avgCompetencies,
    classComparison,
    skillGaps,
    experimentPerformance,
    improvementTrends,
    remedialStudents,
    studentsSummary: studentsAggregated.map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      enrollmentCode: s.enrollmentCode,
      classCodes: s.classCodes,
      overallMastery: s.overallMastery,
      submissionsCount: s.submissionsCount,
    })),
  };
}

/**
 * 6. AI Faculty Insights backed by live Cloud SQL metrics + Gemini structured output.
 */
export async function generateFacultyAiInsights(
  teacher: { id: string; name: string },
  classId?: string
) {
  const analytics = await getFacultyCompetencyAnalytics(teacher.id, classId);
  const { scopedClasses } = await loadTeacherClasses(teacher.id, classId);
  const { classAssignments, classSubmissions } =
    await loadAggregatedRosterForClasses(scopedClasses);

  const asgIds = classAssignments.map((a) => a.id);
  const vivaSessionRows =
    asgIds.length > 0
      ? await db
          .select({ id: vivaSessions.id })
          .from(vivaSessions)
          .where(inArray(vivaSessions.assignmentId, asgIds))
      : [];
  const vIds = vivaSessionRows.map((v) => v.id);
  const vResps =
    vIds.length > 0
      ? await db
          .select({ missingConcepts: vivaResponses.missingConcepts })
          .from(vivaResponses)
          .where(inArray(vivaResponses.sessionId, vIds))
      : [];

  const observedMissingConcepts: string[] = [];
  for (const r of vResps) {
    if (Array.isArray(r.missingConcepts)) {
      for (const mc of r.missingConcepts) {
        if (mc && !observedMissingConcepts.includes(mc)) {
          observedMissingConcepts.push(mc);
        }
      }
    }
  }
  for (const cls of scopedClasses) {
    for (const m of cls.commonMisconceptions || []) {
      if (m.title && !observedMissingConcepts.includes(m.title)) {
        observedMissingConcepts.push(m.title);
      }
    }
  }

  const aiResult = await generateFacultyInsightsWithGemini({
    facultyName: teacher.name,
    scopeLabel: `${analytics.scope.code} — ${analytics.scope.name}`,
    totalStudents: analytics.studentsSummary.length,
    totalSubmissions: classSubmissions.length,
    averageCompetencies: analytics.averageCompetencies,
    experimentPerformance: analytics.experimentPerformance.map((ep) => ({
      title: ep.title,
      averageScorePct: ep.averageScorePct,
      passRatePct: ep.passRatePct,
      submissionsCount: ep.submissionsCount,
      weakestCompetency: COMPETENCY_LABELS[ep.weakestCompetency],
    })),
    observedMissingConcepts,
    studentsNeedingSupport: analytics.remedialStudents.map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      overallMastery: r.overallMastery,
      weakestCompetency: r.weakestCompetencyLabel,
      weakestScore: r.weakestCompetencyScore,
      submissionsCount: r.submissionsCount,
    })),
  });

  return {
    scope: analytics.scope,
    generatedAt: new Date().toISOString(),
    advisoryNotice:
      "AI-generated advisory insights based on live database metrics. These recommendations support faculty decision-making and never modify student grades or evaluations.",
    ...aiResult,
  };
}

/**
 * 7a. Historical Assessment Report (filterable by classId, experimentId, date range).
 */
export async function getFacultyHistoricalReport(
  teacherId: string,
  filters: {
    classId?: string;
    experimentId?: string;
    from?: string;
    to?: string;
  }
) {
  const { scopedClasses } = await loadTeacherClasses(teacherId, filters.classId);
  const classIds = scopedClasses.map((c) => c.id);
  if (classIds.length === 0) {
    return {
      records: [],
      evaluationLogs: [],
      summary: {
        totalSubmissions: 0,
        uniqueStudents: 0,
        averageScorePct: 0,
        approvedCount: 0,
        needsRevisionCount: 0,
        rejectedCount: 0,
        pendingReviewCount: 0,
      },
    };
  }

  const asgs = await db
    .select()
    .from(assignments)
    .where(inArray(assignments.classId, classIds));
  const asgMap = new Map(asgs.map((a) => [a.id, a]));
  const classMap = new Map(scopedClasses.map((c) => [c.id, c]));
  const asgIds = asgs.map((a) => a.id);

  if (asgIds.length === 0) {
    return {
      records: [],
      evaluationLogs: [],
      summary: {
        totalSubmissions: 0,
        uniqueStudents: 0,
        averageScorePct: 0,
        approvedCount: 0,
        needsRevisionCount: 0,
        rejectedCount: 0,
        pendingReviewCount: 0,
      },
    };
  }

  const conditions = [inArray(submissions.assignmentId, asgIds)];
  if (filters.experimentId && filters.experimentId !== "all") {
    conditions.push(eq(submissions.experimentId, filters.experimentId));
  }
  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(submissions.submittedAt, fromDate));
    }
  }
  if (filters.to) {
    const toDate = new Date(filters.to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(submissions.submittedAt, toDate));
    }
  }

  const subRows = await db
    .select()
    .from(submissions)
    .where(and(...conditions))
    .orderBy(desc(submissions.submittedAt));

  const subIds = subRows.map((s) => s.id);
  const evalRows =
    subIds.length > 0
      ? await db
          .select()
          .from(evaluationHistory)
          .where(inArray(evaluationHistory.submissionId, subIds))
          .orderBy(desc(evaluationHistory.createdAt))
      : [];

  const records = subRows.map((s) => {
    const asg = asgMap.get(s.assignmentId);
    const cls = asg ? classMap.get(asg.classId) : undefined;
    const exp = getExperimentById(s.experimentId);
    const scorePct = effectivePercentage({
      id: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      assignmentId: s.assignmentId,
      experimentId: s.experimentId,
      totalScore: Number(s.totalScore),
      maxScore: Number(s.maxScore),
      facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
      submittedAt: s.submittedAt,
    });
    return {
      submissionId: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      classId: cls?.id || "",
      classCode: cls?.code || "",
      className: cls?.name || "",
      assignmentTitle: asg?.title || s.assignmentId,
      experimentId: s.experimentId,
      experimentTitle: exp?.title || s.experimentId,
      attemptNumber: s.attemptNumber,
      autoScore: Number(s.totalScore),
      facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
      maxScore: Number(s.maxScore),
      effectiveScorePct: scorePct,
      evaluationStatus: s.evaluationStatus,
      instructorFeedback: s.instructorFeedback || "",
      competencyScores: s.competencyScores,
      submittedAt: s.submittedAt.toISOString(),
      evaluatedAt: s.evaluatedAt?.toISOString() || null,
    };
  });

  const avgScore =
    records.length > 0
      ? Math.round(
          (records.reduce((acc, r) => acc + r.effectiveScorePct, 0) /
            records.length) *
            10
        ) / 10
      : 0;

  return {
    records,
    evaluationLogs: evalRows.map((ev) => ({
      id: ev.id,
      submissionId: ev.submissionId,
      evaluatorName: ev.evaluatorName,
      previousStatus: ev.previousStatus,
      newStatus: ev.newStatus,
      previousScore: ev.previousScore != null ? Number(ev.previousScore) : null,
      newScore: ev.newScore != null ? Number(ev.newScore) : null,
      feedback: ev.feedback || "",
      createdAt: ev.createdAt.toISOString(),
    })),
    summary: {
      totalSubmissions: records.length,
      uniqueStudents: new Set(records.map((r) => r.studentId)).size,
      averageScorePct: avgScore,
      approvedCount: records.filter((r) => r.evaluationStatus === "faculty_reviewed")
        .length,
      needsRevisionCount: records.filter(
        (r) => r.evaluationStatus === "needs_revision"
      ).length,
      rejectedCount: records.filter((r) => r.evaluationStatus === "rejected").length,
      pendingReviewCount: records.filter((r) =>
        ["pending", "auto_graded", "ai_evaluated"].includes(r.evaluationStatus)
      ).length,
    },
  };
}

/**
 * 7b. Server-side Excel-compatible CSV export with strict teacher authorization.
 */
export async function buildFacultyCsvExport(
  teacherId: string,
  params: {
    type: "class_competency" | "historical" | "student";
    classId?: string;
    studentId?: string;
    experimentId?: string;
    from?: string;
    to?: string;
  }
): Promise<{ filename: string; csv: string }> {
  if (params.type === "student") {
    if (!params.studentId) {
      throw new Error("BAD_REQUEST: studentId is required for student CSV export.");
    }
    const report = await getAuthorizedStudentReportForTeacher(
      teacherId,
      params.studentId
    );
    const headers = [
      "Student Name",
      "Enrollment Code",
      "Experiment",
      "Attempt",
      "Auto Score",
      "Faculty Score",
      "Max Score",
      "Evaluation Status",
      "Setup & Calibration (%)",
      "Measurement Precision (%)",
      "Data Interpretation (%)",
      "Troubleshooting & Safety (%)",
      "Experimental Design (%)",
      "Submitted At",
      "Instructor Feedback",
    ];
    const rows = report.submissions.map((s) => [
      report.student.name,
      report.student.enrollmentCode || report.student.id,
      s.experimentTitle,
      s.attemptNumber,
      s.totalScore,
      s.facultyScore ?? "",
      s.maxScore,
      s.evaluationStatus,
      s.competencyScores?.setup_adherence ?? 0,
      s.competencyScores?.measurement_precision ?? 0,
      s.competencyScores?.data_interpretation ?? 0,
      s.competencyScores?.troubleshooting_safety ?? 0,
      s.competencyScores?.experimental_design ?? 0,
      s.submittedAt,
      s.instructorFeedback || "",
    ]);
    const safeSlug = report.student.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    return {
      filename: `SimLab_Student_Report_${safeSlug}.csv`,
      csv: buildCsvDocument(headers, rows),
    };
  }

  if (params.type === "class_competency") {
    const { scopedClasses } = await loadTeacherClasses(teacherId, params.classId);
    const { studentsAggregated } = await loadAggregatedRosterForClasses(scopedClasses);
    const headers = [
      "Student ID",
      "Student Name",
      "Email",
      "Enrollment Code",
      "Classes",
      "Submissions Count",
      "Overall Mastery (%)",
      "Setup & Calibration (%)",
      "Measurement Precision (%)",
      "Data Interpretation (%)",
      "Troubleshooting & Safety (%)",
      "Experimental Design (%)",
      "Strong Areas",
      "Weak Areas",
      "Latest Submission",
    ];
    const rows = studentsAggregated.map((st) => [
      st.studentId,
      st.studentName,
      st.email,
      st.enrollmentCode || "",
      st.classCodes.join("; "),
      st.submissionsCount,
      st.overallMastery,
      st.competencyScores.setup_adherence,
      st.competencyScores.measurement_precision,
      st.competencyScores.data_interpretation,
      st.competencyScores.troubleshooting_safety,
      st.competencyScores.experimental_design,
      st.strongAreas.map((k) => COMPETENCY_LABELS[k]).join("; "),
      st.weakAreas.map((k) => COMPETENCY_LABELS[k]).join("; "),
      st.latestSubmittedAt || "",
    ]);
    const code =
      scopedClasses.length === 1 ? scopedClasses[0].code : "ALL_COHORTS";
    return {
      filename: `SimLab_Class_Competency_${code.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`,
      csv: buildCsvDocument(headers, rows),
    };
  }

  // Historical assessment report CSV
  const hist = await getFacultyHistoricalReport(teacherId, {
    classId: params.classId,
    experimentId: params.experimentId,
    from: params.from,
    to: params.to,
  });
  const headers = [
    "Submission ID",
    "Class Code",
    "Student Name",
    "Assignment",
    "Experiment",
    "Attempt",
    "Auto Score",
    "Faculty Score",
    "Effective (%)",
    "Evaluation Status",
    "Submitted At",
    "Evaluated At",
    "Instructor Feedback",
  ];
  const rows = hist.records.map((r) => [
    r.submissionId,
    r.classCode,
    r.studentName,
    r.assignmentTitle,
    r.experimentTitle,
    r.attemptNumber,
    r.autoScore,
    r.facultyScore ?? "",
    r.effectiveScorePct,
    r.evaluationStatus,
    r.submittedAt,
    r.evaluatedAt || "",
    r.instructorFeedback,
  ]);
  return {
    filename: `SimLab_Historical_Assessment_${new Date().toISOString().slice(0, 10)}.csv`,
    csv: buildCsvDocument(headers, rows),
  };
}
