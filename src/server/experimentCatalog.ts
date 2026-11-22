import { EXPERIMENTS } from "../data/mockData.ts";
import { AutoGradedTask, CompetencyKey, Experiment } from "../types.ts";

export const ALL_COMPETENCY_KEYS: CompetencyKey[] = [
  "setup_adherence",
  "measurement_precision",
  "data_interpretation",
  "troubleshooting_safety",
  "experimental_design",
];

/**
 * Configurable experiment-to-competency weight matrix.
 * Each experiment emphasizes specific laboratory competencies while maintaining
 * full 5-dimension coverage. Weights sum to 1.0 per experiment.
 */
export const EXPERIMENT_COMPETENCY_WEIGHTS: Record<
  string,
  Record<CompetencyKey, number>
> = {
  "exp-ohms-law": {
    setup_adherence: 0.22,
    measurement_precision: 0.25,
    data_interpretation: 0.23,
    troubleshooting_safety: 0.20,
    experimental_design: 0.10,
  },
  "exp-titration": {
    setup_adherence: 0.20,
    measurement_precision: 0.25,
    data_interpretation: 0.25,
    troubleshooting_safety: 0.12,
    experimental_design: 0.18,
  },
  "exp-photoelectric": {
    setup_adherence: 0.15,
    measurement_precision: 0.25,
    data_interpretation: 0.25,
    troubleshooting_safety: 0.15,
    experimental_design: 0.20,
  },
  "exp-convex-lens": {
    setup_adherence: 0.22,
    measurement_precision: 0.24,
    data_interpretation: 0.26,
    troubleshooting_safety: 0.18,
    experimental_design: 0.10,
  },
  "exp-pcr-gel": {
    setup_adherence: 0.22,
    measurement_precision: 0.18,
    data_interpretation: 0.22,
    troubleshooting_safety: 0.22,
    experimental_design: 0.16,
  },
};

export const DEFAULT_EXPERIMENT_WEIGHTS: Record<CompetencyKey, number> = {
  setup_adherence: 0.2,
  measurement_precision: 0.2,
  data_interpretation: 0.2,
  troubleshooting_safety: 0.2,
  experimental_design: 0.2,
};

export function getExperimentById(experimentId: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.id === experimentId);
}

export function getAllExperiments(): Experiment[] {
  return EXPERIMENTS;
}

export function getExperimentWeights(
  experimentId: string
): Record<CompetencyKey, number> {
  return EXPERIMENT_COMPETENCY_WEIGHTS[experimentId] || DEFAULT_EXPERIMENT_WEIGHTS;
}

export function getExperimentVivaTasks(experimentId: string): AutoGradedTask[] {
  const exp = getExperimentById(experimentId);
  if (!exp) return [];
  return exp.tasks.filter((t) => t.type === "viva_text");
}

export interface RawTaskAnswerInput {
  studentAnswer: unknown;
}

export interface PersistedVivaGradeInput {
  taskId?: string | null;
  questionText: string;
  competencyDimension: CompetencyKey;
  studentAnswer: string;
  score: number; // 0..100 percentage
  maxPoints: number;
  passed: boolean;
  aiFeedback: string;
  rubricCriteriaMet: string[];
  missingConcepts: string[];
}

export interface GradedTaskResult {
  taskId: string;
  title: string;
  type: AutoGradedTask["type"];
  competencyDimension: CompetencyKey;
  score: number;
  maxScore: number;
  passed: boolean;
  studentAnswer: unknown;
  feedback: string;
  rubricCriterionMet?: string[];
  missingConcepts?: string[];
}

export interface ServerGradingSummary {
  totalScore: number;
  maxScore: number;
  percentage: number;
  gradedTasks: Record<string, GradedTaskResult>;
  taskList: GradedTaskResult[];
}

/**
 * Server-side authoritative grading for experiment tasks.
 * Never trusts client-supplied scores, maxScores, or pass flags.
 * For viva_text tasks, scores are sourced strictly from server-persisted viva_responses.
 */
export function gradeExperimentTasks(
  experimentId: string,
  submittedAnswers: Record<string, unknown>,
  persistedVivaResponses: PersistedVivaGradeInput[] = []
): ServerGradingSummary {
  const experiment = getExperimentById(experimentId);
  if (!experiment) {
    throw new Error(`Unknown experiment ID: ${experimentId}`);
  }

  const gradedTasks: Record<string, GradedTaskResult> = {};
  const taskList: GradedTaskResult[] = [];
  let totalScore = 0;
  let maxScore = 0;

  for (const task of experiment.tasks) {
    maxScore += task.points;
    const rawEntry = submittedAnswers[task.id];
    const studentAnswer =
      rawEntry && typeof rawEntry === "object" && "studentAnswer" in (rawEntry as Record<string, unknown>)
        ? (rawEntry as RawTaskAnswerInput).studentAnswer
        : rawEntry;

    if (task.type === "viva_text") {
      // Match strictly against server-persisted viva evaluations (including adaptive follow-ups in the session)
      const matchedPrimary =
        persistedVivaResponses.find((v) => v.taskId && v.taskId === task.id) ||
        persistedVivaResponses.find(
          (v) => v.questionText.trim().toLowerCase() === task.prompt.trim().toLowerCase()
        ) ||
        persistedVivaResponses[0];

      if (matchedPrimary) {
        const sessionScores = persistedVivaResponses
          .map((v) => Math.max(0, Math.min(100, Number(v.score) || 0)))
          .filter((n) => Number.isFinite(n));
        const clampedPct =
          sessionScores.length > 0
            ? Math.round(
                (sessionScores.reduce((sum, s) => sum + s, 0) / sessionScores.length) * 100
              ) / 100
            : Math.max(0, Math.min(100, Number(matchedPrimary.score) || 0));
        const earned = Math.round((clampedPct / 100) * task.points * 100) / 100;
        const allCriteria = Array.from(
          new Set(persistedVivaResponses.flatMap((v) => v.rubricCriteriaMet || []))
        );
        const latestMissing =
          persistedVivaResponses[persistedVivaResponses.length - 1]?.missingConcepts || [];
        const result: GradedTaskResult = {
          taskId: task.id,
          title: task.title,
          type: task.type,
          competencyDimension: task.competencyDimension,
          score: earned,
          maxScore: task.points,
          passed: clampedPct >= 70,
          studentAnswer: matchedPrimary.studentAnswer,
          feedback:
            persistedVivaResponses.length > 1
              ? `${matchedPrimary.aiFeedback} (Adaptive defense average across ${persistedVivaResponses.length} questions: ${clampedPct}%.)`
              : matchedPrimary.aiFeedback,
          rubricCriterionMet: allCriteria,
          missingConcepts: latestMissing,
        };
        gradedTasks[task.id] = result;
        taskList.push(result);
        totalScore += earned;
      } else {
        const result: GradedTaskResult = {
          taskId: task.id,
          title: task.title,
          type: task.type,
          competencyDimension: task.competencyDimension,
          score: 0,
          maxScore: task.points,
          passed: false,
          studentAnswer: typeof studentAnswer === "string" ? studentAnswer : "",
          feedback: "AI Viva response has not been evaluated and persisted on the server.",
          rubricCriterionMet: [],
          missingConcepts: ["Persisted AI Viva evaluation required"],
        };
        gradedTasks[task.id] = result;
        taskList.push(result);
      }
      continue;
    }

    if (task.type === "numeric") {
      const numericVal =
        typeof studentAnswer === "number"
          ? studentAnswer
          : typeof studentAnswer === "string" && studentAnswer.trim() !== ""
          ? Number(studentAnswer.trim())
          : NaN;
      const target = Number(task.correctAnswer);
      const tolerance = task.numericTolerance ?? 0.5;
      const isValid = Number.isFinite(numericVal) && Math.abs(numericVal - target) <= tolerance;
      const earned = isValid ? task.points : 0;

      const result: GradedTaskResult = {
        taskId: task.id,
        title: task.title,
        type: task.type,
        competencyDimension: task.competencyDimension,
        score: earned,
        maxScore: task.points,
        passed: isValid,
        studentAnswer: Number.isFinite(numericVal) ? numericVal : studentAnswer ?? "",
        feedback: isValid
          ? `Accurate calculation within ±${tolerance} tolerance. ${task.explanation}`
          : `Expected ${target} (±${tolerance}). ${task.explanation}`,
      };
      gradedTasks[task.id] = result;
      taskList.push(result);
      totalScore += earned;
      continue;
    }

    // mcq or parameter_select
    const normalizedAnswer = typeof studentAnswer === "string" ? studentAnswer.trim() : "";
    const expectedAnswer = String(task.correctAnswer ?? "").trim();
    const isCorrect = normalizedAnswer !== "" && normalizedAnswer === expectedAnswer;
    const earned = isCorrect ? task.points : 0;

    const result: GradedTaskResult = {
      taskId: task.id,
      title: task.title,
      type: task.type,
      competencyDimension: task.competencyDimension,
      score: earned,
      maxScore: task.points,
      passed: isCorrect,
      studentAnswer: normalizedAnswer,
      feedback: isCorrect
        ? `Correct! ${task.explanation}`
        : `Incorrect selection. ${task.explanation}`,
    };
    gradedTasks[task.id] = result;
    taskList.push(result);
    totalScore += earned;
  }

  totalScore = Math.round(totalScore * 100) / 100;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

  return {
    totalScore,
    maxScore,
    percentage,
    gradedTasks,
    taskList,
  };
}
