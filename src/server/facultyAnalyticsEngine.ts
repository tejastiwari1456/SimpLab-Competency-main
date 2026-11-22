import type { CompetencyKey } from "../types.ts";
import { ALL_COMPETENCY_KEYS } from "./experimentCatalog.ts";

export interface ExperimentMeta {
  id: string;
  code: string;
  title: string;
  subject: string;
}

export interface FacultySubmissionRow {
  id: string;
  studentId: string;
  studentName: string;
  assignmentId: string;
  experimentId: string;
  totalScore: number;
  maxScore: number;
  facultyScore?: number | null;
  evaluationStatus?: string | null;
  competencyScores?: Record<string, number> | null;
  submittedAt: string | Date;
}

export interface ExperimentPerformanceMetric {
  experimentId: string;
  code: string;
  title: string;
  subject: string;
  submissionsCount: number;
  uniqueStudentsCount: number;
  averageScorePct: number;
  passRatePct: number;
  weakestCompetency: CompetencyKey;
  weakestCompetencyAvg: number;
}

export interface SkillGapMetric {
  competencyKey: CompetencyKey;
  label: string;
  averageScore: number;
  benchmark: number;
  gapFromBenchmark: number; // positive means below benchmark
  severity: "critical" | "attention" | "on_track" | "strong";
}

export interface RemedialStudentRecord {
  studentId: string;
  studentName: string;
  email: string;
  enrollmentCode: string | null;
  classIds: string[];
  classCodes: string[];
  overallMastery: number;
  submissionsCount: number;
  weakestCompetency: CompetencyKey;
  weakestCompetencyLabel: string;
  weakestCompetencyScore: number;
  recommendedExperimentId: string;
  recommendedExperimentTitle: string;
  riskLevel: "high" | "moderate";
}

export const COMPETENCY_LABELS: Record<CompetencyKey, string> = {
  setup_adherence: "Apparatus Setup & Calibration",
  measurement_precision: "Measurement Precision & Noise Control",
  data_interpretation: "Data Interpretation & Graphing",
  troubleshooting_safety: "Fault Diagnosis & Lab Safety",
  experimental_design: "Experimental Design & Application",
};

const RECOMMENDED_LAB_BY_COMPETENCY: Record<
  CompetencyKey,
  { id: string; title: string }
> = {
  setup_adherence: {
    id: "exp-convex-lens",
    title: "Focal Length of a Convex Lens (u-v Optical Bench)",
  },
  measurement_precision: {
    id: "exp-ohms-law",
    title: "Verification of Ohm's Law & Internal Resistance",
  },
  data_interpretation: {
    id: "exp-ohms-law",
    title: "Verification of Ohm's Law & Internal Resistance",
  },
  troubleshooting_safety: {
    id: "exp-titration",
    title: "Acid-Base Volumetric Titration (HCl vs NaOH)",
  },
  experimental_design: {
    id: "exp-pcr-gel",
    title: "PCR Amplification & Agarose Gel Electrophoresis",
  },
};

export function effectivePercentage(sub: FacultySubmissionRow): number {
  const max = Number(sub.maxScore) || 100;
  const raw = sub.facultyScore != null ? Number(sub.facultyScore) : Number(sub.totalScore);
  if (!Number.isFinite(raw) || max <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, (raw / max) * 100)) * 10) / 10;
}

export function computeExperimentPerformance(
  subs: FacultySubmissionRow[],
  experimentsMeta: ExperimentMeta[]
): ExperimentPerformanceMetric[] {
  const metaMap = new Map(experimentsMeta.map((e) => [e.id, e]));
  const grouped = new Map<string, FacultySubmissionRow[]>();

  for (const s of subs) {
    const arr = grouped.get(s.experimentId) || [];
    arr.push(s);
    grouped.set(s.experimentId, arr);
  }

  const results: ExperimentPerformanceMetric[] = [];
  for (const [experimentId, list] of grouped.entries()) {
    const meta = metaMap.get(experimentId) || {
      id: experimentId,
      code: experimentId.toUpperCase(),
      title: experimentId,
      subject: "STEM",
    };

    const pcts = list.map(effectivePercentage);
    const avgScore =
      Math.round((pcts.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
    const passCount = pcts.filter((p) => p >= 70).length;
    const passRate = Math.round((passCount / list.length) * 1000) / 10;
    const uniqueStudents = new Set(list.map((s) => s.studentId)).size;

    let weakestKey: CompetencyKey = "setup_adherence";
    let weakestAvg = 101;
    for (const k of ALL_COMPETENCY_KEYS) {
      const vals = list.map((s) => Number(s.competencyScores?.[k] ?? 0));
      const dimAvg =
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      if (dimAvg < weakestAvg) {
        weakestAvg = dimAvg;
        weakestKey = k;
      }
    }

    results.push({
      experimentId,
      code: meta.code,
      title: meta.title,
      subject: meta.subject,
      submissionsCount: list.length,
      uniqueStudentsCount: uniqueStudents,
      averageScorePct: avgScore,
      passRatePct: passRate,
      weakestCompetency: weakestKey,
      weakestCompetencyAvg: Math.round(weakestAvg * 10) / 10,
    });
  }

  return results.sort((a, b) => a.averageScorePct - b.averageScorePct);
}

export function computeSkillGaps(
  avgCompetencies: Record<CompetencyKey, number>,
  benchmark = 75
): SkillGapMetric[] {
  return ALL_COMPETENCY_KEYS.map((key) => {
    const score = Math.round(Number(avgCompetencies?.[key] ?? 0) * 10) / 10;
    const gap = Math.round((benchmark - score) * 10) / 10;
    let severity: SkillGapMetric["severity"] = "on_track";
    if (score < 60) severity = "critical";
    else if (score < benchmark) severity = "attention";
    else if (score >= 85) severity = "strong";

    return {
      competencyKey: key,
      label: COMPETENCY_LABELS[key],
      averageScore: score,
      benchmark,
      gapFromBenchmark: gap,
      severity,
    };
  }).sort((a, b) => b.gapFromBenchmark - a.gapFromBenchmark);
}

export function computeClassComparisonMatrix(
  classList: Array<{
    id: string;
    code: string;
    name: string;
    studentCount: number;
    averageCompetencies: Record<CompetencyKey, number>;
  }>
) {
  return classList.map((cls) => {
    const comp = cls.averageCompetencies || ({} as Record<CompetencyKey, number>);
    const overall =
      Math.round(
        (ALL_COMPETENCY_KEYS.reduce((s, k) => s + Number(comp[k] ?? 0), 0) /
          ALL_COMPETENCY_KEYS.length) *
          10
      ) / 10;
    return {
      classId: cls.id,
      code: cls.code,
      name: cls.name,
      studentCount: cls.studentCount,
      overallAverage: overall,
      setup_adherence: Math.round(Number(comp.setup_adherence ?? 0)),
      measurement_precision: Math.round(Number(comp.measurement_precision ?? 0)),
      data_interpretation: Math.round(Number(comp.data_interpretation ?? 0)),
      troubleshooting_safety: Math.round(Number(comp.troubleshooting_safety ?? 0)),
      experimental_design: Math.round(Number(comp.experimental_design ?? 0)),
    };
  });
}

export function identifyRemedialStudents(
  students: Array<{
    studentId: string;
    studentName: string;
    email: string;
    enrollmentCode: string | null;
    classIds: string[];
    classCodes: string[];
    overallMastery: number;
    submissionsCount: number;
    competencyScores: Record<CompetencyKey, number>;
  }>,
  threshold = 75
): RemedialStudentRecord[] {
  const flagged: RemedialStudentRecord[] = [];

  for (const st of students) {
    let weakestKey: CompetencyKey = "setup_adherence";
    let weakestScore = 101;
    for (const k of ALL_COMPETENCY_KEYS) {
      const v = Number(st.competencyScores?.[k] ?? 0);
      if (v < weakestScore) {
        weakestScore = v;
        weakestKey = k;
      }
    }

    const needsRemedial =
      st.submissionsCount === 0 ||
      st.overallMastery < threshold ||
      weakestScore < 70;

    if (!needsRemedial) continue;

    const recLab = RECOMMENDED_LAB_BY_COMPETENCY[weakestKey];
    const riskLevel: "high" | "moderate" =
      st.submissionsCount === 0 || st.overallMastery < 65 || weakestScore < 60
        ? "high"
        : "moderate";

    flagged.push({
      studentId: st.studentId,
      studentName: st.studentName,
      email: st.email,
      enrollmentCode: st.enrollmentCode,
      classIds: st.classIds,
      classCodes: st.classCodes,
      overallMastery: Math.round(st.overallMastery * 10) / 10,
      submissionsCount: st.submissionsCount,
      weakestCompetency: weakestKey,
      weakestCompetencyLabel: COMPETENCY_LABELS[weakestKey],
      weakestCompetencyScore: Math.round(weakestScore * 10) / 10,
      recommendedExperimentId: recLab.id,
      recommendedExperimentTitle: recLab.title,
      riskLevel,
    });
  }

  return flagged.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return a.riskLevel === "high" ? -1 : 1;
    return a.overallMastery - b.overallMastery;
  });
}

/**
 * Escapes a single CSV cell per RFC-4180 and neutralizes spreadsheet formula injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Neutralize Excel/Sheets formula triggers (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvDocument(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  // UTF-8 BOM ensures Microsoft Excel renders symbols/accents cleanly
  return `\uFEFF${[headerLine, ...dataLines].join("\r\n")}`;
}
