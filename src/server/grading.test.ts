import test from "node:test";
import assert from "node:assert/strict";
import { getExperimentById, gradeExperimentTasks } from "./experimentCatalog.ts";

test("gradeExperimentTasks grades MCQ, parameter_select, numeric tolerance, and persisted viva authoritatively", () => {
  const exp = getExperimentById("exp-ohms-law");
  assert.ok(exp, "exp-ohms-law must exist in catalog");

  const answers: Record<string, unknown> = {};
  const persistedVivas = [];

  for (const task of exp.tasks) {
    if (task.type === "viva_text") {
      persistedVivas.push({
        taskId: task.id,
        questionText: task.prompt,
        competencyDimension: task.competencyDimension,
        studentAnswer: "Increasing voltage proportionally increases current when resistance is constant.",
        score: 80,
        maxPoints: task.points,
        passed: true,
        aiFeedback: "Accurate statement of Ohm's Law.",
        rubricCriteriaMet: ["Linear V-I proportionality"],
        missingConcepts: [],
      });
      // Attempt client-side score spoofing (must be ignored by server grader)
      answers[task.id] = { studentAnswer: "fake", score: 999, maxScore: 1, passed: true };
    } else if (task.type === "numeric") {
      const target = Number(task.correctAnswer);
      const tol = task.numericTolerance ?? 0.5;
      // Within tolerance
      answers[task.id] = { studentAnswer: target + tol * 0.5, score: 999 };
    } else {
      answers[task.id] = { studentAnswer: task.correctAnswer, score: 999 };
    }
  }

  const summary = gradeExperimentTasks("exp-ohms-law", answers, persistedVivas);
  assert.equal(summary.maxScore, 100);
  // Every non-viva task got full points, viva task got 80% of its points
  const vivaTask = exp.tasks.find((t) => t.type === "viva_text");
  const expectedScore = vivaTask ? 100 - vivaTask.points * 0.2 : 100;
  assert.equal(summary.totalScore, expectedScore);
});

test("gradeExperimentTasks awards 0 for viva_text when no server-persisted viva response exists", () => {
  const exp = getExperimentById("exp-ohms-law");
  assert.ok(exp);

  const vivaTask = exp.tasks.find((t) => t.type === "viva_text");
  assert.ok(vivaTask, "exp-ohms-law must have a viva_text task");

  // Client tries to claim 100% on viva without server-persisted evaluation
  const summary = gradeExperimentTasks(
    "exp-ohms-law",
    {
      [vivaTask.id]: {
        studentAnswer: "Tampered answer",
        score: 100,
        passed: true,
      },
    },
    []
  );

  assert.equal(summary.gradedTasks[vivaTask.id].score, 0);
  assert.equal(summary.gradedTasks[vivaTask.id].passed, false);
});

test("gradeExperimentTasks rejects numeric answers outside tolerance", () => {
  const exp = getExperimentById("exp-ohms-law");
  assert.ok(exp);

  const numericTask = exp.tasks.find((t) => t.type === "numeric");
  assert.ok(numericTask, "exp-ohms-law must have a numeric task");

  const farOff = Number(numericTask.correctAnswer) + (numericTask.numericTolerance ?? 0.5) * 10;
  const summary = gradeExperimentTasks("exp-ohms-law", {
    [numericTask.id]: farOff,
  });

  assert.equal(summary.gradedTasks[numericTask.id].score, 0);
  assert.equal(summary.gradedTasks[numericTask.id].passed, false);
});
