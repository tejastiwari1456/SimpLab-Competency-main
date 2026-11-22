import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { assignments, classEnrollments, submissions } from "../db/schema.ts";
import { COMPETENCY_DIMENSIONS, CompetencyKey } from "../types.ts";
import {
  ALL_COMPETENCY_KEYS,
  getAllExperiments,
  getExperimentWeights,
} from "./experimentCatalog.ts";
import { getStudentCompetencyReport } from "./submissionService.ts";

export interface RecommendationAssignmentInput {
  id: string;
  experimentId: string;
  title: string;
  dueDate: string;
  attemptsAllowed: number;
  attemptsUsed: number;
}

export interface RecommendationSubmissionInput {
  experimentId: string;
  totalScore: number;
  maxScore: number;
  facultyScore?: number | null;
}

export interface StudentRecommendation {
  experimentId: string;
  title: string;
  code: string;
  subject: string;
  priority: "high" | "medium" | "low";
  priorityScore: number;
  reason: string;
  targetCompetencies: Array<{
    key: CompetencyKey;
    label: string;
    currentScore: number;
    experimentWeight: number;
  }>;
  assignmentId: string | null;
  assignmentTitle: string | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  attemptsUsed: number;
  attemptsAllowed: number | null;
  currentBestScore: number | null;
  estimatedImpact: string;
}

export interface RecommendationEngineInput {
  competencyScores: Record<CompetencyKey, number>;
  weakAreas: CompetencyKey[];
  activeAssignments: RecommendationAssignmentInput[];
  submissions: RecommendationSubmissionInput[];
  now?: Date;
}

/**
 * Pure deterministic personalized experiment recommendation engine.
 * Combines competency gaps (weakest dimensions weighted by experiment competency matrix),
 * active assignment deadlines, and prior attempt mastery to rank next best labs.
 */
export function generatePersonalizedRecommendations(
  input: RecommendationEngineInput
): StudentRecommendation[] {
  const now = input.now ?? new Date();
  const experiments = getAllExperiments();

  // Compute student's best percentage per experiment
  const bestScoreByExperiment = new Map<string, number>();
  for (const sub of input.submissions) {
    const effective =
      sub.facultyScore !== null && sub.facultyScore !== undefined
        ? Number(sub.facultyScore)
        : Number(sub.totalScore);
    const max = Number(sub.maxScore) || 100;
    const pct = Math.round(Math.max(0, Math.min(100, (effective / max) * 100)) * 10) / 10;
    const prev = bestScoreByExperiment.get(sub.experimentId);
    if (prev === undefined || pct > prev) {
      bestScoreByExperiment.set(sub.experimentId, pct);
    }
  }

  // Index active assignments by experimentId (pick most urgent active assignment per experiment)
  const assignmentByExp = new Map<string, RecommendationAssignmentInput>();
  for (const asg of input.activeAssignments) {
    const existing = assignmentByExp.get(asg.experimentId);
    if (!existing) {
      assignmentByExp.set(asg.experimentId, asg);
    } else if (new Date(asg.dueDate).getTime() < new Date(existing.dueDate).getTime()) {
      assignmentByExp.set(asg.experimentId, asg);
    }
  }

  // Identify student's lowest competencies (for growth targeting even when no dimension is <70%)
  const sortedCompetencies = [...ALL_COMPETENCY_KEYS].sort(
    (a, b) => (input.competencyScores[a] ?? 0) - (input.competencyScores[b] ?? 0)
  );
  const focusKeys =
    input.weakAreas.length > 0 ? input.weakAreas : sortedCompetencies.slice(0, 2);

  const recommendations: StudentRecommendation[] = [];

  for (const exp of experiments) {
    const weights = getExperimentWeights(exp.id);
    const activeAsg = assignmentByExp.get(exp.id) ?? null;
    const currentBestScore = bestScoreByExperiment.has(exp.id)
      ? bestScoreByExperiment.get(exp.id)!
      : null;

    // 1. Competency gap alignment score (0..45)
    let gapAlignmentScore = 0;
    for (const key of ALL_COMPETENCY_KEYS) {
      const current = input.competencyScores[key] ?? 0;
      const deficit = Math.max(0, 100 - current); // higher deficit => more room to grow
      gapAlignmentScore += weights[key] * deficit;
    }
    const normalizedGapScore = Math.round(gapAlignmentScore * 0.45 * 10) / 10;

    // 2. Assignment urgency & completion boost (0..40)
    let assignmentBoost = 0;
    let daysUntilDue: number | null = null;
    const attemptsUsed = activeAsg?.attemptsUsed ?? 0;
    const attemptsAllowed = activeAsg?.attemptsAllowed ?? null;
    const hasRemainingAttempts =
      activeAsg !== null && attemptsUsed < activeAsg.attemptsAllowed;

    if (activeAsg) {
      const dueMs = new Date(activeAsg.dueDate).getTime();
      daysUntilDue = Math.ceil((dueMs - now.getTime()) / (1000 * 60 * 60 * 24));
      if (attemptsUsed === 0) {
        if (daysUntilDue <= 0) {
          assignmentBoost = 40; // overdue and not attempted
        } else if (daysUntilDue <= 3) {
          assignmentBoost = 36;
        } else if (daysUntilDue <= 7) {
          assignmentBoost = 28;
        } else {
          assignmentBoost = 20;
        }
      } else if (hasRemainingAttempts && (currentBestScore ?? 0) < 80) {
        assignmentBoost = 15; // retake opportunity to boost score
      } else {
        assignmentBoost = 4; // assigned & completed with solid score
      }
    }

    // 3. Mastery & novelty boost (0..15)
    let masteryBoost = 0;
    if (currentBestScore === null) {
      masteryBoost = 15;
    } else if (currentBestScore < 70) {
      masteryBoost = 12;
    } else if (currentBestScore < 85) {
      masteryBoost = 6;
    } else {
      masteryBoost = 1;
    }

    const priorityScore = Math.round((normalizedGapScore + assignmentBoost + masteryBoost) * 10) / 10;

    // Select top 2 target competencies that this experiment strongly exercises for this student
    const targetCompetencies = [...ALL_COMPETENCY_KEYS]
      .sort((a, b) => {
        const aFocus = focusKeys.includes(a) ? 1 : 0;
        const bFocus = focusKeys.includes(b) ? 1 : 0;
        const aScore = weights[a] * (100 - (input.competencyScores[a] ?? 0)) + aFocus * 15;
        const bScore = weights[b] * (100 - (input.competencyScores[b] ?? 0)) + bFocus * 15;
        return bScore - aScore;
      })
      .slice(0, 2)
      .map((key) => ({
        key,
        label: COMPETENCY_DIMENSIONS[key].shortLabel,
        currentScore: Math.round(input.competencyScores[key] ?? 0),
        experimentWeight: Math.round(weights[key] * 100),
      }));

    // Build clear, human-readable recommendation rationale
    const reasonParts: string[] = [];
    if (activeAsg && attemptsUsed === 0) {
      if (daysUntilDue !== null && daysUntilDue <= 0) {
        reasonParts.push("Overdue assigned lab awaiting your first attempt");
      } else if (daysUntilDue !== null && daysUntilDue <= 7) {
        reasonParts.push(`Assigned lab due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`);
      } else {
        reasonParts.push("Active class assignment not yet submitted");
      }
    } else if (activeAsg && hasRemainingAttempts && currentBestScore !== null && currentBestScore < 80) {
      reasonParts.push(
        `Retake available (${attemptsUsed}/${attemptsAllowed} used, current best ${Math.round(currentBestScore)}%)`
      );
    } else if (currentBestScore === null) {
      reasonParts.push("Unexplored syllabus lab");
    } else if (currentBestScore < 75) {
      reasonParts.push(`Current mastery is ${Math.round(currentBestScore)}% — strong improvement opportunity`);
    } else {
      reasonParts.push(`Completed at ${Math.round(currentBestScore)}% — practice to reinforce mastery`);
    }

    if (targetCompetencies.length > 0) {
      const topTarget = targetCompetencies[0];
      if (topTarget.currentScore > 0) {
        reasonParts.push(
          `targets ${topTarget.label} (${topTarget.currentScore}%, ${topTarget.experimentWeight}% lab weight)`
        );
      } else {
        reasonParts.push(
          `builds foundational ${topTarget.label} (${topTarget.experimentWeight}% lab weight)`
        );
      }
    }

    const priority: "high" | "medium" | "low" =
      priorityScore >= 52 ? "high" : priorityScore >= 32 ? "medium" : "low";

    const topComp = targetCompetencies[0];
    const estimatedImpact =
      currentBestScore === null
        ? `High impact on ${topComp.label}`
        : currentBestScore < 75
        ? `+${Math.min(18, Math.max(5, Math.round((85 - currentBestScore) * 0.4)))}% potential lift in ${topComp.label}`
        : `Reinforces ${topComp.label} & viva readiness`;

    recommendations.push({
      experimentId: exp.id,
      title: exp.title,
      code: exp.code,
      subject: exp.subject,
      priority,
      priorityScore,
      reason: reasonParts.join(" · "),
      targetCompetencies,
      assignmentId: activeAsg?.id ?? null,
      assignmentTitle: activeAsg?.title ?? null,
      dueDate: activeAsg?.dueDate ?? null,
      daysUntilDue,
      attemptsUsed,
      attemptsAllowed,
      currentBestScore,
      estimatedImpact,
    });
  }

  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Database-backed personalized experiment recommendations for an authenticated student.
 */
export async function getStudentRecommendations(
  studentId: string
): Promise<StudentRecommendation[]> {
  try {
    const [competencyReport, assignedRows, studentSubs] = await Promise.all([
      getStudentCompetencyReport(studentId),
      db
        .select({
          id: assignments.id,
          experimentId: assignments.experimentId,
          title: assignments.title,
          dueDate: assignments.dueDate,
          attemptsAllowed: assignments.attemptsAllowed,
          attemptsUsed: sql<number>`count(${submissions.id})::int`,
        })
        .from(assignments)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, assignments.classId))
        .leftJoin(
          submissions,
          and(
            eq(submissions.assignmentId, assignments.id),
            eq(submissions.studentId, classEnrollments.studentId)
          )
        )
        .where(
          and(
            eq(classEnrollments.studentId, studentId),
            eq(classEnrollments.enrollmentStatus, "active"),
            eq(assignments.status, "active")
          )
        )
        .groupBy(assignments.id),
      db
        .select({
          experimentId: submissions.experimentId,
          totalScore: submissions.totalScore,
          maxScore: submissions.maxScore,
          facultyScore: submissions.facultyScore,
        })
        .from(submissions)
        .where(eq(submissions.studentId, studentId))
        .orderBy(desc(submissions.submittedAt)),
    ]);

    return generatePersonalizedRecommendations({
      competencyScores: competencyReport.competencyScores,
      weakAreas: competencyReport.weakAreas,
      activeAssignments: assignedRows.map((a) => ({
        id: a.id,
        experimentId: a.experimentId,
        title: a.title,
        dueDate: a.dueDate.toISOString(),
        attemptsAllowed: a.attemptsAllowed,
        attemptsUsed: a.attemptsUsed,
      })),
      submissions: studentSubs.map((s) => ({
        experimentId: s.experimentId,
        totalScore: Number(s.totalScore),
        maxScore: Number(s.maxScore),
        facultyScore: s.facultyScore !== null ? Number(s.facultyScore) : null,
      })),
    });
  } catch (error) {
    console.error("[RecommendationEngine] Failed generating student recommendations:", error);
    throw new Error("Failed to generate personalized experiment recommendations.", {
      cause: error,
    });
  }
}
