import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCsvDocument,
  computeClassComparisonMatrix,
  computeExperimentPerformance,
  computeSkillGaps,
  identifyRemedialStudents,
  sanitizeCsvCell,
} from "./facultyAnalyticsEngine.ts";

test("computeExperimentPerformance aggregates scores, pass rates, and weakest dimension accurately", () => {
  const result = computeExperimentPerformance(
    [
      {
        id: "s1",
        studentId: "stu-1",
        studentName: "Aarav",
        assignmentId: "asg-1",
        experimentId: "exp-ohms-law",
        totalScore: 80,
        maxScore: 100,
        facultyScore: 90,
        competencyScores: {
          setup_adherence: 90,
          measurement_precision: 85,
          data_interpretation: 60,
          troubleshooting_safety: 88,
          experimental_design: 82,
        },
        submittedAt: "2026-10-01T10:00:00Z",
      },
      {
        id: "s2",
        studentId: "stu-2",
        studentName: "Priya",
        assignmentId: "asg-1",
        experimentId: "exp-ohms-law",
        totalScore: 60,
        maxScore: 100,
        facultyScore: null,
        competencyScores: {
          setup_adherence: 70,
          measurement_precision: 65,
          data_interpretation: 50,
          troubleshooting_safety: 75,
          experimental_design: 72,
        },
        submittedAt: "2026-10-02T10:00:00Z",
      },
    ],
    [{ id: "exp-ohms-law", code: "PHY-101", title: "Ohm's Law", subject: "Electronics" }]
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].averageScorePct, 75);
  assert.equal(result[0].passRatePct, 50);
  assert.equal(result[0].uniqueStudentsCount, 2);
  assert.equal(result[0].weakestCompetency, "data_interpretation");
  assert.equal(result[0].weakestCompetencyAvg, 55);
});

test("computeSkillGaps orders deficits by distance below benchmark", () => {
  const gaps = computeSkillGaps(
    {
      setup_adherence: 88,
      measurement_precision: 78,
      data_interpretation: 54,
      troubleshooting_safety: 68,
      experimental_design: 75,
    },
    75
  );

  assert.equal(gaps[0].competencyKey, "data_interpretation");
  assert.equal(gaps[0].severity, "critical");
  assert.equal(gaps[0].gapFromBenchmark, 21);
  assert.equal(gaps[1].competencyKey, "troubleshooting_safety");
  assert.equal(gaps[1].severity, "attention");
  assert.equal(gaps[gaps.length - 1].competencyKey, "setup_adherence");
  assert.equal(gaps[gaps.length - 1].severity, "strong");
});

test("computeClassComparisonMatrix computes overall average per class", () => {
  const matrix = computeClassComparisonMatrix([
    {
      id: "cls-1",
      code: "PHY101-A",
      name: "Physics",
      studentCount: 12,
      averageCompetencies: {
        setup_adherence: 80,
        measurement_precision: 70,
        data_interpretation: 90,
        troubleshooting_safety: 80,
        experimental_design: 80,
      },
    },
  ]);

  assert.equal(matrix[0].overallAverage, 80);
  assert.equal(matrix[0].data_interpretation, 90);
});

test("identifyRemedialStudents prioritizes high-risk and low-mastery students", () => {
  const remedial = identifyRemedialStudents(
    [
      {
        studentId: "stu-high",
        studentName: "High Performer",
        email: "high@u.edu",
        enrollmentCode: "E1",
        classIds: ["cls-1"],
        classCodes: ["PHY101"],
        overallMastery: 92,
        submissionsCount: 3,
        competencyScores: {
          setup_adherence: 90,
          measurement_precision: 92,
          data_interpretation: 95,
          troubleshooting_safety: 91,
          experimental_design: 92,
        },
      },
      {
        studentId: "stu-risk",
        studentName: "Needs Help",
        email: "risk@u.edu",
        enrollmentCode: "E2",
        classIds: ["cls-1"],
        classCodes: ["PHY101"],
        overallMastery: 58,
        submissionsCount: 2,
        competencyScores: {
          setup_adherence: 65,
          measurement_precision: 52,
          data_interpretation: 60,
          troubleshooting_safety: 58,
          experimental_design: 55,
        },
      },
    ],
    75
  );

  assert.equal(remedial.length, 1);
  assert.equal(remedial[0].studentId, "stu-risk");
  assert.equal(remedial[0].riskLevel, "high");
  assert.equal(remedial[0].weakestCompetency, "measurement_precision");
});

test("sanitizeCsvCell and buildCsvDocument escape quotes and neutralize Excel formulas", () => {
  assert.equal(sanitizeCsvCell("=SUM(A1:A5)"), "'=SUM(A1:A5)");
  assert.equal(sanitizeCsvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(sanitizeCsvCell('Hello, "World"'), '"Hello, ""World"""');
  const csv = buildCsvDocument(["Name", "Formula"], [["Alice", "=1+1"]]);
  assert.ok(csv.startsWith("\uFEFFName,Formula\r\nAlice,'=1+1"));
});
