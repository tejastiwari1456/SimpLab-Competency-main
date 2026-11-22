import { CompetencyKey, COMPETENCY_DIMENSIONS } from "../types.ts";
import {
  ALL_COMPETENCY_KEYS,
  getExperimentById,
  getExperimentWeights,
  GradedTaskResult,
} from "./experimentCatalog.ts";
import type { CompetencyScoresJson, MisconceptionJson } from "../db/schema.ts";

export interface CompetencyEngineConfig {
  /** Weight of practical/auto-graded experiment tasks (default 0.70) */
  practicalWeight: number;
  /** Weight of AI Viva evaluation scores (default 0.30) */
  vivaWeight: number;
  /** De-duplication strategy when a student submits multiple attempts for the same experiment */
  attemptAggregationPolicy: "best" | "latest";
  /** Overall mastery weights across the 5 competency dimensions */
  dimensionWeights: Record<CompetencyKey, number>;
  /** Thresholds for classifying competency mastery levels */
  thresholds: {
    strong: number;
    proficient: number;
    developing: number;
  };
}

export const DEFAULT_COMPETENCY_CONFIG: CompetencyEngineConfig = {
  practicalWeight: 0.7,
  vivaWeight: 0.3,
  attemptAggregationPolicy: "best",
  dimensionWeights: {
    setup_adherence: 0.2,
    measurement_precision: 0.2,
    data_interpretation: 0.2,
    troubleshooting_safety: 0.2,
    experimental_design: 0.2,
  },
  thresholds: {
    strong: 85,
    proficient: 70,
    developing: 55,
  },
};

export type CompetencyStatus = "strong" | "proficient" | "developing" | "weak";

export interface CompetencyDimensionBreakdown {
  key: CompetencyKey;
  label: string;
  score: number;
  experimentContribution: number;
  vivaContribution: number;
  experimentsEvaluated: number;
  status: CompetencyStatus;
}

export interface SubmissionForCompetency {
  id: string;
  experimentId: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  totalScore: number;
  maxScore: number;
  facultyScore?: number | null;
  competencyScores: CompetencyScoresJson;
  taskResponses?: Record<string, any>;
  vivaSessionId?: string | null;
  submittedAt: string | Date;
}

export interface VivaSessionForCompetency {
  id: string;
  experimentId: string;
  overallScore: number;
  status: string;
  responses?: Array<{
    competencyDimension: string;
    score: number;
  }>;
}

export interface AggregatedCompetencyReport {
  competencyScores: CompetencyScoresJson;
  overallScore: number;
  dimensions: CompetencyDimensionBreakdown[];
  strongAreas: CompetencyKey[];
  weakAreas: CompetencyKey[];
  experimentsEvaluatedCount: number;
  deduplicatedSubmissions: Array<{
    experimentId: string;
    selectedSubmissionId: string;
    attemptNumber: number;
    effectivePercentage: number;
  }>;
  methodology: {
    practicalWeight: number;
    vivaWeight: number;
    attemptAggregationPolicy: "best" | "latest";
    dimensionWeights: Record<CompetencyKey, number>;
    thresholds: CompetencyEngineConfig["thresholds"];
  };
}

export function classifyCompetencyStatus(
  score: number,
  thresholds = DEFAULT_COMPETENCY_CONFIG.thresholds
): CompetencyStatus {
  if (score >= thresholds.strong) return "strong";
  if (score >= thresholds.proficient) return "proficient";
  if (score >= thresholds.developing) return "developing";
  return "weak";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}

/**
 * Calculates transparent per-competency scores (0-100) for a single experiment submission,
 * integrating practical auto-graded tasks, persisted AI viva responses, and observation readings.
 */
export function calculateSubmissionCompetencies(
  experimentId: string,
  taskList: GradedTaskResult[],
  options?: {
    dataReadingsCount?: number;
    facultyScoreOverride?: number | null;
    maxScore?: number;
    config?: CompetencyEngineConfig;
  }
): {
  competencyScores: CompetencyScoresJson;
  practicalPercentage: number;
  vivaPercentage: number | null;
  overallSubmissionScore: number;
} {
  const config = options?.config || DEFAULT_COMPETENCY_CONFIG;
  const expWeights = getExperimentWeights(experimentId);

  const practicalTasks = taskList.filter((t) => t.type !== "viva_text");
  const vivaTasks = taskList.filter((t) => t.type === "viva_text");

  const practicalEarned = practicalTasks.reduce((acc, t) => acc + t.score, 0);
  const practicalMax = practicalTasks.reduce((acc, t) => acc + t.maxScore, 0);
  const practicalPercentage =
    practicalMax > 0 ? clampScore((practicalEarned / practicalMax) * 100) : 0;

  const vivaEarned = vivaTasks.reduce((acc, t) => acc + t.score, 0);
  const vivaMax = vivaTasks.reduce((acc, t) => acc + t.maxScore, 0);
  const vivaPercentage =
    vivaMax > 0 ? clampScore((vivaEarned / vivaMax) * 100) : null;

  // Compute blended overall score for the submission
  let blendedOverall =
    vivaPercentage !== null
      ? practicalPercentage * config.practicalWeight +
        vivaPercentage * config.vivaWeight
      : practicalPercentage;

  // If faculty overrode the submission score, incorporate the faculty-evaluated ratio
  if (
    options?.facultyScoreOverride != null &&
    options?.maxScore &&
    options.maxScore > 0
  ) {
    const facultyPct = clampScore(
      (Number(options.facultyScoreOverride) / Number(options.maxScore)) * 100
    );
    blendedOverall = facultyPct;
  }

  // Group direct task evidence per competency dimension
  const dimBuckets: Record<
    CompetencyKey,
    { practicalEarned: number; practicalMax: number; vivaEarned: number; vivaMax: number }
  > = {
    setup_adherence: { practicalEarned: 0, practicalMax: 0, vivaEarned: 0, vivaMax: 0 },
    measurement_precision: { practicalEarned: 0, practicalMax: 0, vivaEarned: 0, vivaMax: 0 },
    data_interpretation: { practicalEarned: 0, practicalMax: 0, vivaEarned: 0, vivaMax: 0 },
    troubleshooting_safety: { practicalEarned: 0, practicalMax: 0, vivaEarned: 0, vivaMax: 0 },
    experimental_design: { practicalEarned: 0, practicalMax: 0, vivaEarned: 0, vivaMax: 0 },
  };

  for (const task of taskList) {
    const bucket = dimBuckets[task.competencyDimension];
    if (!bucket) continue;
    if (task.type === "viva_text") {
      bucket.vivaEarned += task.score;
      bucket.vivaMax += task.maxScore;
    } else {
      bucket.practicalEarned += task.score;
      bucket.practicalMax += task.maxScore;
    }
  }

  // Observation logging bonus (up to +5% on measurement_precision when >= 3 lab readings logged)
  const readingsBonus =
    (options?.dataReadingsCount ?? 0) >= 3 ? 5 : (options?.dataReadingsCount ?? 0) > 0 ? 2 : 0;

  const scores = {} as CompetencyScoresJson;

  for (const key of ALL_COMPETENCY_KEYS) {
    const bucket = dimBuckets[key];
    const hasPractical = bucket.practicalMax > 0;
    const hasViva = bucket.vivaMax > 0;

    let dimScore: number;
    if (hasPractical && hasViva) {
      const pPct = (bucket.practicalEarned / bucket.practicalMax) * 100;
      const vPct = (bucket.vivaEarned / bucket.vivaMax) * 100;
      dimScore = pPct * config.practicalWeight + vPct * config.vivaWeight;
    } else if (hasPractical) {
      const pPct = (bucket.practicalEarned / bucket.practicalMax) * 100;
      // Blend direct practical dimension evidence (80%) with overall viva/experiment rigor (20%)
      dimScore =
        vivaPercentage !== null
          ? pPct * 0.8 + vivaPercentage * 0.2
          : pPct;
    } else if (hasViva) {
      const vPct = (bucket.vivaEarned / bucket.vivaMax) * 100;
      // Blend direct viva dimension evidence (75%) with overall practical execution (25%)
      dimScore = vPct * 0.75 + practicalPercentage * 0.25;
    } else {
      // Dimension not directly tested by a standalone question in this experiment:
      // derive proportionally from blended submission performance weighted by experiment relevance
      const weightFactor = Math.min(1, Math.max(0.85, 0.85 + expWeights[key]));
      dimScore = blendedOverall * weightFactor;
    }

    if (key === "measurement_precision" && readingsBonus > 0 && dimScore > 0) {
      dimScore = Math.min(100, dimScore + readingsBonus);
    }

    // Apply faculty score scaling if faculty explicitly adjusted the grade
    if (
      options?.facultyScoreOverride != null &&
      options?.maxScore &&
      options.maxScore > 0
    ) {
      const rawPct =
        vivaPercentage !== null
          ? practicalPercentage * config.practicalWeight +
            vivaPercentage * config.vivaWeight
          : practicalPercentage;
      const facultyPct = (Number(options.facultyScoreOverride) / Number(options.maxScore)) * 100;
      if (rawPct > 0) {
        dimScore = dimScore * (facultyPct / rawPct);
      } else {
        dimScore = facultyPct;
      }
    }

    scores[key] = clampScore(dimScore);
  }

  return {
    competencyScores: scores,
    practicalPercentage,
    vivaPercentage,
    overallSubmissionScore: clampScore(blendedOverall),
  };
}

/**
 * Aggregates a student's overall competencies across all their experiments and viva sessions.
 * De-duplicates repeated attempts per experiment (using 'best' or 'latest' policy) so
 * repeating the same experiment never double-counts its weight.
 */
export function aggregateStudentCompetencies(
  submissions: SubmissionForCompetency[],
  vivaSessions: VivaSessionForCompetency[] = [],
  config: CompetencyEngineConfig = DEFAULT_COMPETENCY_CONFIG
): AggregatedCompetencyReport {
  // 1. De-duplicate repeated attempts per experimentId
  const byExperiment = new Map<string, SubmissionForCompetency[]>();
  for (const sub of submissions) {
    const list = byExperiment.get(sub.experimentId) || [];
    list.push(sub);
    byExperiment.set(sub.experimentId, list);
  }

  const selectedPerExperiment: Array<{
    submission: SubmissionForCompetency;
    effectivePercentage: number;
  }> = [];

  for (const [, attempts] of byExperiment.entries()) {
    const withPct = attempts.map((sub) => {
      const effScore =
        sub.facultyScore != null ? Number(sub.facultyScore) : Number(sub.totalScore);
      const max = Number(sub.maxScore) || 100;
      return {
        submission: sub,
        effectivePercentage: clampScore((effScore / max) * 100),
      };
    });

    if (config.attemptAggregationPolicy === "latest") {
      withPct.sort(
        (a, b) =>
          new Date(b.submission.submittedAt).getTime() -
          new Date(a.submission.submittedAt).getTime()
      );
    } else {
      // 'best' policy: pick highest effective score, tie-breaking by latest submission
      withPct.sort((a, b) => {
        if (b.effectivePercentage !== a.effectivePercentage) {
          return b.effectivePercentage - a.effectivePercentage;
        }
        return (
          new Date(b.submission.submittedAt).getTime() -
          new Date(a.submission.submittedAt).getTime()
        );
      });
    }

    selectedPerExperiment.push(withPct[0]);
  }

  // 2. De-duplicate standalone completed viva sessions per experiment (if not already linked)
  const bestVivaByExp = new Map<string, VivaSessionForCompetency>();
  for (const vs of vivaSessions) {
    if (vs.status !== "completed" && (!vs.responses || vs.responses.length === 0)) {
      continue;
    }
    const existing = bestVivaByExp.get(vs.experimentId);
    if (!existing || Number(vs.overallScore) > Number(existing.overallScore)) {
      bestVivaByExp.set(vs.experimentId, vs);
    }
  }

  // 3. Weighted accumulation across distinct experiments
  const aggregatedScores: CompetencyScoresJson = {
    setup_adherence: 0,
    measurement_precision: 0,
    data_interpretation: 0,
    troubleshooting_safety: 0,
    experimental_design: 0,
  };

  const dimensions: CompetencyDimensionBreakdown[] = [];

  for (const key of ALL_COMPETENCY_KEYS) {
    let weightedSum = 0;
    let totalWeight = 0;
    let expContribSum = 0;
    let vivaContribSum = 0;
    let expCount = 0;

    for (const { submission } of selectedPerExperiment) {
      const expWeights = getExperimentWeights(submission.experimentId);
      const weight = expWeights[key] || 0.2;
      const subDimScore = clampScore(Number(submission.competencyScores?.[key] ?? 0));

      // Check if a linked or matching viva session exists for this experiment
      const matchedViva =
        vivaSessions.find((v) => v.id === submission.vivaSessionId) ||
        bestVivaByExp.get(submission.experimentId);

      let vivaDimScore: number | null = null;
      if (matchedViva) {
        const dimResponses = (matchedViva.responses || []).filter(
          (r) => r.competencyDimension === key
        );
        if (dimResponses.length > 0) {
          vivaDimScore =
            dimResponses.reduce((sum, r) => sum + Number(r.score), 0) /
            dimResponses.length;
        } else if (Number(matchedViva.overallScore) > 0) {
          vivaDimScore = Number(matchedViva.overallScore);
        }
      }

      // Submission competency_scores already incorporate tasks; blend with viva contribution transparently
      const combinedScore =
        vivaDimScore !== null
          ? subDimScore * config.practicalWeight + vivaDimScore * config.vivaWeight
          : subDimScore;

      weightedSum += combinedScore * weight;
      totalWeight += weight;
      expContribSum += subDimScore;
      vivaContribSum += vivaDimScore ?? 0;
      expCount += 1;
    }

    // Include standalone completed viva sessions for experiments without a submission yet
    for (const [expId, vs] of bestVivaByExp.entries()) {
      if (byExperiment.has(expId)) continue;
      const expWeights = getExperimentWeights(expId);
      const weight = (expWeights[key] || 0.2) * config.vivaWeight;
      const vivaScore = clampScore(Number(vs.overallScore));
      weightedSum += vivaScore * weight;
      totalWeight += weight;
      vivaContribSum += vivaScore;
      expCount += 1;
    }

    const finalScore = totalWeight > 0 ? clampScore(weightedSum / totalWeight) : 0;
    aggregatedScores[key] = finalScore;

    dimensions.push({
      key,
      label: COMPETENCY_DIMENSIONS[key].label,
      score: finalScore,
      experimentContribution:
        selectedPerExperiment.length > 0
          ? clampScore(expContribSum / selectedPerExperiment.length)
          : 0,
      vivaContribution:
        expCount > 0 ? clampScore(vivaContribSum / expCount) : 0,
      experimentsEvaluated: expCount,
      status: classifyCompetencyStatus(finalScore, config.thresholds),
    });
  }

  // 4. Overall weighted mastery score
  let overallWeighted = 0;
  let overallWeightSum = 0;
  for (const key of ALL_COMPETENCY_KEYS) {
    const w = config.dimensionWeights[key] ?? 0.2;
    overallWeighted += aggregatedScores[key] * w;
    overallWeightSum += w;
  }
  const overallScore =
    overallWeightSum > 0 ? clampScore(overallWeighted / overallWeightSum) : 0;

  // 5. Identify strong (>= strong threshold) and weak (< proficient threshold) areas
  const hasEvaluations = selectedPerExperiment.length > 0 || bestVivaByExp.size > 0;
  const strongAreas = hasEvaluations
    ? ALL_COMPETENCY_KEYS.filter(
        (k) => aggregatedScores[k] >= config.thresholds.strong
      )
    : [];
  const weakAreas = hasEvaluations
    ? ALL_COMPETENCY_KEYS.filter(
        (k) => aggregatedScores[k] < config.thresholds.proficient
      )
    : [];

  return {
    competencyScores: aggregatedScores,
    overallScore,
    dimensions,
    strongAreas,
    weakAreas,
    experimentsEvaluatedCount: new Set([
      ...selectedPerExperiment.map((s) => s.submission.experimentId),
      ...bestVivaByExp.keys(),
    ]).size,
    deduplicatedSubmissions: selectedPerExperiment.map((s) => ({
      experimentId: s.submission.experimentId,
      selectedSubmissionId: s.submission.id,
      attemptNumber: s.submission.attemptNumber,
      effectivePercentage: s.effectivePercentage,
    })),
    methodology: {
      practicalWeight: config.practicalWeight,
      vivaWeight: config.vivaWeight,
      attemptAggregationPolicy: config.attemptAggregationPolicy,
      dimensionWeights: config.dimensionWeights,
      thresholds: config.thresholds,
    },
  };
}

/**
 * Computes live class-level average competencies and data-driven misconceptions
 * from actual PostgreSQL student submissions (de-duplicated per student + experiment).
 */
export function computeClassAnalytics(
  submissions: SubmissionForCompetency[]
): {
  averageCompetencies: CompetencyScoresJson;
  commonMisconceptions: MisconceptionJson[];
} {
  if (submissions.length === 0) {
    return {
      averageCompetencies: {
        setup_adherence: 0,
        measurement_precision: 0,
        data_interpretation: 0,
        troubleshooting_safety: 0,
        experimental_design: 0,
      },
      commonMisconceptions: [],
    };
  }

  // De-duplicate: best attempt per (studentId, experimentId)
  const bestByStudentExp = new Map<string, SubmissionForCompetency>();
  for (const sub of submissions) {
    const key = `${sub.studentId}::${sub.experimentId}`;
    const existing = bestByStudentExp.get(key);
    const subPct =
      (Number(sub.facultyScore ?? sub.totalScore) / (Number(sub.maxScore) || 100)) * 100;
    const existingPct = existing
      ? (Number(existing.facultyScore ?? existing.totalScore) /
          (Number(existing.maxScore) || 100)) *
        100
      : -1;
    if (!existing || subPct >= existingPct) {
      bestByStudentExp.set(key, sub);
    }
  }

  const deduped = Array.from(bestByStudentExp.values());
  const totals: Record<CompetencyKey, number> = {
    setup_adherence: 0,
    measurement_precision: 0,
    data_interpretation: 0,
    troubleshooting_safety: 0,
    experimental_design: 0,
  };

  for (const sub of deduped) {
    for (const key of ALL_COMPETENCY_KEYS) {
      totals[key] += Number(sub.competencyScores?.[key] ?? 0);
    }
  }

  const averageCompetencies = {} as CompetencyScoresJson;
  for (const key of ALL_COMPETENCY_KEYS) {
    averageCompetencies[key] = clampScore(totals[key] / deduped.length);
  }

  // Derive real misconceptions from failed tasks / low competency scores
  const taskFailureCounts = new Map<
    string,
    { title: string; experimentId: string; failed: number; total: number; remediation: string }
  >();

  for (const sub of deduped) {
    const exp = getExperimentById(sub.experimentId);
    const responses = sub.taskResponses || {};
    for (const [taskId, resp] of Object.entries(responses)) {
      if (!resp || typeof resp !== "object" || taskId === "vivaResponses") continue;
      const r = resp as { score?: number; maxScore?: number; feedback?: string };
      if (typeof r.maxScore !== "number" || r.maxScore <= 0) continue;
      const ratio = (Number(r.score) || 0) / r.maxScore;
      const taskDef = exp?.tasks.find((t) => t.id === taskId);
      const mapKey = `${sub.experimentId}::${taskId}`;
      const entry = taskFailureCounts.get(mapKey) || {
        title: taskDef?.title || taskId,
        experimentId: sub.experimentId,
        failed: 0,
        total: 0,
        remediation:
          taskDef?.explanation ||
          "Review underlying experimental methodology and run guided troubleshooting practice.",
      };
      entry.total += 1;
      if (ratio < 0.7) {
        entry.failed += 1;
      }
      taskFailureCounts.set(mapKey, entry);
    }
  }

  const commonMisconceptions: MisconceptionJson[] = Array.from(
    taskFailureCounts.values()
  )
    .filter((m) => m.failed > 0 && m.total > 0)
    .map((m) => ({
      title: m.title,
      affectedPercentage: Math.round((m.failed / m.total) * 100),
      relatedExperiment: m.experimentId,
      recommendedRemediation: m.remediation,
    }))
    .sort((a, b) => b.affectedPercentage - a.affectedPercentage)
    .slice(0, 5);

  return {
    averageCompetencies,
    commonMisconceptions,
  };
}
