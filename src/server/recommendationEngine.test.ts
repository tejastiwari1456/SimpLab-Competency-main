import test from "node:test";
import assert from "node:assert/strict";
import { generatePersonalizedRecommendations } from "./recommendationEngine.ts";

test("Prioritizes uncompleted active assignment due soon over already mastered labs", () => {
  const now = new Date("2026-04-10T12:00:00Z");
  const recs = generatePersonalizedRecommendations({
    now,
    competencyScores: {
      setup_adherence: 90,
      measurement_precision: 88,
      data_interpretation: 62,
      troubleshooting_safety: 85,
      experimental_design: 80,
    },
    weakAreas: ["data_interpretation"],
    activeAssignments: [
      {
        id: "asg-optics",
        experimentId: "exp-convex-lens",
        title: "Optics Bench u-v Method",
        dueDate: "2026-04-12T23:59:00Z", // 2 days away
        attemptsAllowed: 3,
        attemptsUsed: 0,
      },
      {
        id: "asg-ohms",
        experimentId: "exp-ohms-law",
        title: "Ohm's Law Lab",
        dueDate: "2026-04-20T23:59:00Z",
        attemptsAllowed: 2,
        attemptsUsed: 1,
      },
    ],
    submissions: [
      {
        experimentId: "exp-ohms-law",
        totalScore: 92,
        maxScore: 100,
      },
    ],
  });

  assert.equal(recs.length, 5);
  assert.equal(recs[0].experimentId, "exp-convex-lens");
  assert.equal(recs[0].priority, "high");
  assert.equal(recs[0].assignmentId, "asg-optics");
  assert.ok(recs[0].targetCompetencies.some((c) => c.key === "data_interpretation"));
  assert.ok(recs[0].priorityScore > recs.find((r) => r.experimentId === "exp-ohms-law")!.priorityScore);
});

test("Targets weakest competency dimensions when no assignments are pending", () => {
  const recs = generatePersonalizedRecommendations({
    now: new Date("2026-04-10T12:00:00Z"),
    competencyScores: {
      setup_adherence: 92,
      measurement_precision: 90,
      data_interpretation: 91,
      troubleshooting_safety: 88,
      experimental_design: 54,
    },
    weakAreas: ["experimental_design"],
    activeAssignments: [],
    submissions: [
      { experimentId: "exp-ohms-law", totalScore: 94, maxScore: 100 },
      { experimentId: "exp-convex-lens", totalScore: 91, maxScore: 100 },
    ],
  });

  // Photoelectric (0.20 weight on experimental_design) and Titration (0.18 weight) should outrank already-mastered Ohm's Law (0.10)
  const topIds = recs.slice(0, 2).map((r) => r.experimentId);
  assert.ok(topIds.includes("exp-photoelectric"));
  assert.ok(recs[0].targetCompetencies[0].key === "experimental_design");
  const ohmsRec = recs.find((r) => r.experimentId === "exp-ohms-law")!;
  assert.ok(recs[0].priorityScore > ohmsRec.priorityScore);
});

test("Handles fresh student with zero submissions cleanly without NaN", () => {
  const recs = generatePersonalizedRecommendations({
    now: new Date("2026-04-10T12:00:00Z"),
    competencyScores: {
      setup_adherence: 0,
      measurement_precision: 0,
      data_interpretation: 0,
      troubleshooting_safety: 0,
      experimental_design: 0,
    },
    weakAreas: [],
    activeAssignments: [
      {
        id: "asg-1",
        experimentId: "exp-ohms-law",
        title: "DC Circuit Verification",
        dueDate: "2026-04-15T23:59:00Z",
        attemptsAllowed: 2,
        attemptsUsed: 0,
      },
    ],
    submissions: [],
  });

  assert.equal(recs.length, 5);
  assert.equal(recs[0].experimentId, "exp-ohms-law");
  assert.equal(recs[0].currentBestScore, null);
  for (const r of recs) {
    assert.ok(Number.isFinite(r.priorityScore));
    assert.ok(r.reason.length > 0);
    assert.ok(r.targetCompetencies.length === 2);
  }
});
