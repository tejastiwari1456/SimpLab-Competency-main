import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateStudentCompetencies,
  calculateSubmissionCompetencies,
  classifyCompetencyStatus,
  computeClassAnalytics,
  DEFAULT_COMPETENCY_CONFIG,
  SubmissionForCompetency,
} from "./competencyEngine.ts";
import { GradedTaskResult } from "./experimentCatalog.ts";

test("classifyCompetencyStatus maps thresholds accurately", () => {
  assert.equal(classifyCompetencyStatus(90), "strong");
  assert.equal(classifyCompetencyStatus(85), "strong");
  assert.equal(classifyCompetencyStatus(75), "proficient");
  assert.equal(classifyCompetencyStatus(60), "developing");
  assert.equal(classifyCompetencyStatus(40), "weak");
});

test("calculateSubmissionCompetencies blends 70% practical + 30% viva transparently", () => {
  const tasks: GradedTaskResult[] = [
    {
      taskId: "t1",
      title: "Setup task",
      type: "mcq",
      competencyDimension: "setup_adherence",
      score: 10,
      maxScore: 10,
      passed: true,
      studentAnswer: "A",
      feedback: "ok",
    },
    {
      taskId: "t2",
      title: "Precision task",
      type: "numeric",
      competencyDimension: "measurement_precision",
      score: 10,
      maxScore: 10,
      passed: true,
      studentAnswer: 50,
      feedback: "ok",
    },
    {
      taskId: "t3",
      title: "Viva task",
      type: "viva_text",
      competencyDimension: "data_interpretation",
      score: 10,
      maxScore: 20, // 50%
      passed: false,
      studentAnswer: "Partial explanation",
      feedback: "Needs more depth",
    },
  ];

  const result = calculateSubmissionCompetencies("exp-ohms-law", tasks, {
    dataReadingsCount: 0,
  });

  // Practical = 100%, Viva = 50% -> Blended = 100*0.7 + 50*0.3 = 85
  assert.equal(result.practicalPercentage, 100);
  assert.equal(result.vivaPercentage, 50);
  assert.equal(result.overallSubmissionScore, 85);
  assert.ok(result.competencyScores.setup_adherence > result.competencyScores.data_interpretation);
});

test("aggregateStudentCompetencies de-duplicates repeated attempts per experiment without double counting", () => {
  const attempt1: SubmissionForCompetency = {
    id: "sub-1",
    experimentId: "exp-ohms-law",
    assignmentId: "asg-1",
    studentId: "stu-1",
    attemptNumber: 1,
    totalScore: 50,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 50,
      measurement_precision: 50,
      data_interpretation: 50,
      troubleshooting_safety: 50,
      experimental_design: 50,
    },
    submittedAt: "2026-10-01T10:00:00.000Z",
  };

  const attempt2: SubmissionForCompetency = {
    id: "sub-2",
    experimentId: "exp-ohms-law",
    assignmentId: "asg-1",
    studentId: "stu-1",
    attemptNumber: 2,
    totalScore: 90,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 90,
      measurement_precision: 90,
      data_interpretation: 90,
      troubleshooting_safety: 90,
      experimental_design: 90,
    },
    submittedAt: "2026-10-02T10:00:00.000Z",
  };

  const attempt3SameScore: SubmissionForCompetency = {
    ...attempt2,
    id: "sub-3",
    attemptNumber: 3,
    submittedAt: "2026-10-03T10:00:00.000Z",
  };

  const reportBest = aggregateStudentCompetencies([attempt1, attempt2, attempt3SameScore]);
  assert.equal(reportBest.experimentsEvaluatedCount, 1);
  assert.equal(reportBest.deduplicatedSubmissions.length, 1);
  assert.equal(reportBest.deduplicatedSubmissions[0].selectedSubmissionId, "sub-3");
  assert.equal(reportBest.overallScore, 90);
  assert.deepEqual(reportBest.strongAreas.length, 5);
  assert.deepEqual(reportBest.weakAreas.length, 0);

  // Adding 10 identical attempts of exp-ohms-law must NOT outweigh a second experiment
  const secondExp: SubmissionForCompetency = {
    id: "sub-titration",
    experimentId: "exp-titration",
    assignmentId: "asg-2",
    studentId: "stu-1",
    attemptNumber: 1,
    totalScore: 50,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 50,
      measurement_precision: 50,
      data_interpretation: 50,
      troubleshooting_safety: 50,
      experimental_design: 50,
    },
    submittedAt: "2026-10-04T10:00:00.000Z",
  };

  const reportSingleEach = aggregateStudentCompetencies([attempt2, secondExp]);
  const reportManyRepeats = aggregateStudentCompetencies([
    attempt1,
    attempt2,
    attempt3SameScore,
    { ...attempt2, id: "sub-4", attemptNumber: 4 },
    { ...attempt2, id: "sub-5", attemptNumber: 5 },
    secondExp,
  ]);

  assert.equal(reportManyRepeats.experimentsEvaluatedCount, 2);
  assert.equal(reportManyRepeats.overallScore, reportSingleEach.overallScore);
  assert.deepEqual(reportManyRepeats.competencyScores, reportSingleEach.competencyScores);
});

test("aggregateStudentCompetencies identifies strong and weak areas accurately", () => {
  const mixedSub: SubmissionForCompetency = {
    id: "sub-mixed",
    experimentId: "exp-photoelectric",
    assignmentId: "asg-3",
    studentId: "stu-2",
    attemptNumber: 1,
    totalScore: 72,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 92,
      measurement_precision: 88,
      data_interpretation: 74,
      troubleshooting_safety: 62,
      experimental_design: 52,
    },
    submittedAt: "2026-10-05T10:00:00.000Z",
  };

  const report = aggregateStudentCompetencies([mixedSub], [], DEFAULT_COMPETENCY_CONFIG);
  assert.deepEqual(report.strongAreas, ["setup_adherence", "measurement_precision"]);
  assert.deepEqual(report.weakAreas, ["troubleshooting_safety", "experimental_design"]);
});

test("computeClassAnalytics de-duplicates per student+experiment and extracts real misconceptions", () => {
  const subs: SubmissionForCompetency[] = [
    {
      id: "s1",
      experimentId: "exp-ohms-law",
      assignmentId: "a1",
      studentId: "stu-1",
      attemptNumber: 1,
      totalScore: 40,
      maxScore: 100,
      competencyScores: {
        setup_adherence: 40,
        measurement_precision: 40,
        data_interpretation: 40,
        troubleshooting_safety: 40,
        experimental_design: 40,
      },
      taskResponses: {
        "ohm-task-1": { score: 0, maxScore: 25 },
      },
      submittedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      id: "s2",
      experimentId: "exp-ohms-law",
      assignmentId: "a1",
      studentId: "stu-1",
      attemptNumber: 2,
      totalScore: 80,
      maxScore: 100,
      competencyScores: {
        setup_adherence: 80,
        measurement_precision: 80,
        data_interpretation: 80,
        troubleshooting_safety: 80,
        experimental_design: 80,
      },
      taskResponses: {
        "ohm-task-1": { score: 25, maxScore: 25 },
        "ohm-task-2": { score: 0, maxScore: 25 },
      },
      submittedAt: "2026-10-02T00:00:00.000Z",
    },
  ];

  const analytics = computeClassAnalytics(subs);
  assert.equal(analytics.averageCompetencies.setup_adherence, 80);
  assert.equal(analytics.commonMisconceptions.length, 1);
  assert.equal(analytics.commonMisconceptions[0].affectedPercentage, 100);
});
