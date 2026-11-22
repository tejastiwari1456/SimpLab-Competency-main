import assert from "node:assert/strict";
import "dotenv/config";
import { getExperimentById } from "../src/server/experimentCatalog.ts";
import { pool } from "../src/db/index.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function apiJson(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = {};
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email: string, password: string): Promise<{ token: string; user: any }> {
  const { status, data } = await apiJson("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(status, 200, `Login failed for ${email}: ${JSON.stringify(data)}`);
  assert.ok(data.token, "Missing token");
  return { token: data.token, user: data.user };
}

async function runVerificationOnly(submissionId: string) {
  console.log(`[Persistence Verify] Checking submission ${submissionId} after server restart...`);
  const teacher = await login("dr.ananya.sen@university.edu", "password123");
  const student = await login("aarav.sharma@university.edu", "password123");

  const detail = await apiJson(`/api/submissions/${encodeURIComponent(submissionId)}`, {
    token: student.token,
  });
  assert.equal(detail.status, 200, `Expected 200 fetching persisted submission, got ${detail.status}`);
  assert.equal(detail.data.submission.id, submissionId);
  assert.equal(detail.data.submission.evaluationStatus, "faculty_reviewed");
  assert.equal(
    detail.data.submission.instructorFeedback,
    "Integration test faculty feedback verified."
  );

  // Clean up the temporary test submission & related rows so seeded data stays pristine
  const subRow = detail.data.submission;
  await pool.query("DELETE FROM competency_history WHERE submission_id = $1", [submissionId]);
  await pool.query("DELETE FROM submissions WHERE id = $1", [submissionId]);
  if (subRow.vivaSessionId) {
    await pool.query("DELETE FROM viva_sessions WHERE id = $1", [subRow.vivaSessionId]);
  }
  // Verify teacher login works post-restart too
  const tClasses = await apiJson("/api/teacher/classes", { token: teacher.token });
  assert.equal(tClasses.status, 200);
  console.log("[PASS] Data persisted across server restart and temporary test records cleaned up.");
  await pool.end();
}

async function runFullIntegrationSuite() {
  console.log("==================================================================");
  console.log("SIMLAB COMPETENCY HUB — LIVE POSTGRESQL INTEGRATION TEST SUITE");
  console.log("==================================================================");

  let passed = 0;
  let total = 0;
  async function check(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  [PASS] ${name}`);
    } catch (err: any) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err?.message || err}`);
      throw err;
    }
  }

  // Authenticate test personas
  const studentAarav = await login("aarav.sharma@university.edu", "password123");
  const studentPriya = await login("priya.patel@university.edu", "password123");
  const teacherAnanya = await login("dr.ananya.sen@university.edu", "password123");
  const teacherRajesh = await login("prof.rajesh.iyer@university.edu", "password123");
  const adminLead = await login("admin.lead@university.edu", "Admin@SimLab2026!");

  await check("1. Unauthenticated access to protected routes returns 401", async () => {
    const r1 = await apiJson("/api/student/submissions");
    const r2 = await apiJson("/api/teacher/classes");
    const r3 = await apiJson("/api/admin/users");
    const r4 = await apiJson("/api/viva/sessions");
    assert.equal(r1.status, 401);
    assert.equal(r2.status, 401);
    assert.equal(r3.status, 401);
    assert.equal(r4.status, 401);
  });

  await check("2. Strict RBAC denies cross-role access (403)", async () => {
    const stuToTeacher = await apiJson("/api/teacher/submissions", { token: studentAarav.token });
    const stuToAdmin = await apiJson("/api/admin/users", { token: studentAarav.token });
    const teacherToAdmin = await apiJson("/api/admin/institutions", { token: teacherAnanya.token });
    assert.equal(stuToTeacher.status, 403);
    assert.equal(stuToAdmin.status, 403);
    assert.equal(teacherToAdmin.status, 403);
  });

  await check("3. Student dashboard endpoints return live PostgreSQL data", async () => {
    const [asgs, subs, cls, comps, vivas] = await Promise.all([
      apiJson("/api/student/assignments", { token: studentAarav.token }),
      apiJson("/api/student/submissions", { token: studentAarav.token }),
      apiJson("/api/student/classes", { token: studentAarav.token }),
      apiJson("/api/student/competencies", { token: studentAarav.token }),
      apiJson("/api/viva/sessions", { token: studentAarav.token }),
    ]);
    assert.equal(asgs.status, 200);
    assert.ok(asgs.data.assignments.length >= 2);
    assert.equal(subs.status, 200);
    assert.ok(subs.data.submissions.length >= 1);
    assert.equal(cls.status, 200);
    assert.ok(cls.data.classes.length >= 1);
    assert.equal(comps.status, 200);
    assert.ok(comps.data.report.overallScore > 0);
    assert.equal(vivas.status, 200);
    assert.ok(vivas.data.sessions.length >= 1);
  });

  // 4. Create an AI Viva session & persist an evaluated answer
  let createdVivaSessionId = "";
  await check("4. AI Viva session creation & retrieval persists in PostgreSQL", async () => {
    // Non-enrolled / unknown assignmentId must return 403 (not 500)
    const invalidAsgRes = await apiJson("/api/viva/sessions", {
      method: "POST",
      token: studentAarav.token,
      body: {
        experimentId: "exp-ohms-law",
        assignmentId: "asg-does-not-exist",
      },
    });
    assert.equal(invalidAsgRes.status, 403, "Unknown/un-enrolled assignmentId must return 403");

    const createRes = await apiJson("/api/viva/sessions", {
      method: "POST",
      token: studentAarav.token,
      body: {
        experimentId: "exp-ohms-law",
        assignmentId: "asg-1",
      },
    });
    assert.equal(createRes.status, 201, `Expected 201, got ${createRes.status}: ${JSON.stringify(createRes.data)}`);
    createdVivaSessionId = createRes.data.session.id;
    assert.ok(createdVivaSessionId);

    // Cross-student IDOR protection on viva session
    const otherStudentGet = await apiJson(`/api/viva/sessions/${createdVivaSessionId}`, {
      token: studentPriya.token,
    });
    assert.equal(otherStudentGet.status, 403, "Other student must get 403 on someone else's viva session");

    // Own student can retrieve it
    const ownGet = await apiJson(`/api/viva/sessions/${createdVivaSessionId}`, {
      token: studentAarav.token,
    });
    assert.equal(ownGet.status, 200);
    assert.equal(ownGet.data.session.id, createdVivaSessionId);
  });

  // 5. Submit an experiment with spoofed client fields to verify anti-tampering
  let createdSubmissionId = "";
  await check("5. Student submission workflow derives studentId server-side and ignores spoofed scores/status", async () => {
    const exp = getExperimentById("exp-ohms-law");
    assert.ok(exp);

    const taskAnswers: Record<string, unknown> = {};
    for (const t of exp.tasks) {
      if (t.type === "mcq" || t.type === "parameter_select") {
        taskAnswers[t.id] = t.correctAnswer;
      } else if (t.type === "numeric") {
        taskAnswers[t.id] = Number(t.correctAnswer);
      } else {
        // Viva task without server evaluation -> server must award 0, NOT spoofed 100
        taskAnswers[t.id] = "Unverified client answer";
      }
    }

    const submitRes = await apiJson("/api/submissions", {
      method: "POST",
      token: studentAarav.token,
      body: {
        assignmentId: "asg-1",
        experimentId: "exp-ohms-law",
        // Spoofed fields that server MUST ignore:
        studentId: studentPriya.user.id,
        totalScore: 100,
        evaluationStatus: "faculty_reviewed",
        competencyScores: {
          setup_adherence: 100,
          measurement_precision: 100,
          data_interpretation: 100,
          troubleshooting_safety: 100,
          experimental_design: 100,
        },
        taskAnswers,
        observations: { voltageV: 5.0, currentMa: 100, calculatedResistanceOhm: 50 },
        calculatedResults: { slopeResistanceOhm: 50.0, linearR2: 0.999 },
        dataReadingsCount: 5,
        vivaSessionId: createdVivaSessionId,
      },
    });

    assert.equal(
      submitRes.status,
      201,
      `Expected 201 submitting experiment, got ${submitRes.status}: ${JSON.stringify(submitRes.data)}`
    );
    const sub = submitRes.data.submission;
    createdSubmissionId = sub.id;

    // Anti-tampering assertions:
    assert.equal(sub.studentId, studentAarav.user.id, "Server must derive studentId from auth session");
    assert.notEqual(sub.evaluationStatus, "faculty_reviewed", "Student must not spoof evaluationStatus");
    assert.ok(sub.totalScore < 100, "Unverified viva task must not grant spoofed 100 score");
    assert.ok(sub.attemptNumber >= 2, "Attempt number should auto-increment cleanly");
    assert.deepEqual(sub.observations.voltageV, 5.0);
    assert.deepEqual(sub.calculatedResults.slopeResistanceOhm, 50.0);
  });

  await check("6. Cross-student IDOR protection on GET /api/submissions/:id returns 403", async () => {
    const otherRes = await apiJson(`/api/submissions/${createdSubmissionId}`, {
      token: studentPriya.token,
    });
    assert.equal(otherRes.status, 403);
  });

  await check("7. Non-owning teacher gets 403 on student submission detail & faculty evaluation", async () => {
    // Prof. Rajesh teaches BIO-302, NOT PHY-101 (Dr. Ananya's class)
    const detailRes = await apiJson(`/api/submissions/${createdSubmissionId}`, {
      token: teacherRajesh.token,
    });
    assert.equal(detailRes.status, 403, "Non-owning teacher must get 403 on submission detail");

    const evalRes = await apiJson(`/api/teacher/submissions/${createdSubmissionId}/evaluate`, {
      method: "PATCH",
      token: teacherRajesh.token,
      body: {
        evaluationStatus: "faculty_reviewed",
        instructorFeedback: "Unauthorized faculty review attempt",
      },
    });
    assert.equal(evalRes.status, 403, "Non-owning teacher must get 403 on faculty evaluation");

    const studentEvalAttempt = await apiJson(`/api/teacher/submissions/${createdSubmissionId}/evaluate`, {
      method: "PATCH",
      token: studentAarav.token,
      body: { evaluationStatus: "faculty_reviewed" },
    });
    assert.equal(studentEvalAttempt.status, 403, "Student must get 403 on faculty evaluation");
  });

  await check("8. Owning teacher (Dr. Ananya) can inspect submission, evaluate it, and read class roster", async () => {
    const rosterRes = await apiJson("/api/teacher/classes/cls-1/students", {
      token: teacherAnanya.token,
    });
    assert.equal(rosterRes.status, 200);
    assert.ok(rosterRes.data.students.length >= 2);

    const evalRes = await apiJson(`/api/teacher/submissions/${createdSubmissionId}/evaluate`, {
      method: "PATCH",
      token: teacherAnanya.token,
      body: {
        evaluationStatus: "faculty_reviewed",
        instructorFeedback: "Integration test faculty feedback verified.",
        facultyScore: 91,
      },
    });
    assert.equal(evalRes.status, 200, `Expected 200, got ${evalRes.status}: ${JSON.stringify(evalRes.data)}`);
    assert.equal(evalRes.data.submission.evaluationStatus, "faculty_reviewed");
    assert.equal(evalRes.data.submission.facultyScore, 91);
    assert.equal(
      evalRes.data.submission.instructorFeedback,
      "Integration test faculty feedback verified."
    );
  });

  await check("9. Competency history & deduplicated report updated in PostgreSQL", async () => {
    const comps = await apiJson("/api/student/competencies", { token: studentAarav.token });
    assert.equal(comps.status, 200);
    assert.ok(Array.isArray(comps.data.report.history));
    assert.ok(comps.data.report.history.length >= 2);
    // Repeated attempts of exp-ohms-law must still only count once in deduplicatedSubmissions
    const ohmsEntries = comps.data.report.deduplicatedSubmissions.filter(
      (d: any) => d.experimentId === "exp-ohms-law"
    );
    assert.equal(ohmsEntries.length, 1, "exp-ohms-law must not be double-counted");
  });

  await check("10. Admin endpoints return live database users, institutions, and audit logs", async () => {
    const [uRes, iRes, aRes] = await Promise.all([
      apiJson("/api/admin/users", { token: adminLead.token }),
      apiJson("/api/admin/institutions", { token: adminLead.token }),
      apiJson("/api/admin/audit-logs", { token: adminLead.token }),
    ]);
    assert.equal(uRes.status, 200);
    assert.ok(uRes.data.users.length >= 6);
    assert.equal(iRes.status, 200);
    assert.ok(iRes.data.institutions.length >= 1);
    assert.equal(aRes.status, 200);
    assert.ok(aRes.data.events.some((e: any) => e.event_type === "FACULTY_EVALUATION"));
  });

  await check("11. Personalized experiment recommendations endpoint returns ranked labs with student-only RBAC", async () => {
    const teacherAttempt = await apiJson("/api/student/recommendations", {
      token: teacherAnanya.token,
    });
    assert.equal(teacherAttempt.status, 403, "Teacher must receive 403 on student recommendations");

    const recRes = await apiJson("/api/student/recommendations", {
      token: studentAarav.token,
    });
    assert.equal(recRes.status, 200);
    assert.ok(Array.isArray(recRes.data.recommendations));
    assert.ok(recRes.data.recommendations.length >= 3, "Should rank multiple syllabus experiments");
    const first = recRes.data.recommendations[0];
    assert.ok(first.experimentId && first.reason && Array.isArray(first.targetCompetencies));
  });

  await check("12. Student notifications derive live alerts and persist read status in PostgreSQL", async () => {
    const notifRes = await apiJson("/api/student/notifications", {
      token: studentAarav.token,
    });
    assert.equal(notifRes.status, 200);
    assert.ok(Array.isArray(notifRes.data.notifications));
    assert.ok(notifRes.data.notifications.length >= 1, "Student should have live notifications");

    const sampleKey = notifRes.data.notifications[0].id;
    const markRes = await apiJson(
      `/api/student/notifications/${encodeURIComponent(sampleKey)}/read`,
      { method: "PATCH", token: studentAarav.token }
    );
    assert.equal(markRes.status, 200);

    const afterMark = await apiJson("/api/student/notifications", {
      token: studentAarav.token,
    });
    const matched = afterMark.data.notifications.find((n: any) => n.id === sampleKey);
    assert.ok(matched && matched.isRead === true, "Notification read state must persist in DB");

    // Clean up temporary read row so seeded notifications stay fresh
    await pool.query(
      "DELETE FROM notification_reads WHERE user_id = $1 AND notification_key = $2",
      [studentAarav.user.id, sampleKey]
    );
  });

  await check("13. Multi-turn Adaptive AI Viva persists Q1 + adaptive follow-up Q2 and updates competencies", async () => {
    const asgsRes = await apiJson("/api/student/assignments", { token: studentAarav.token });
    assert.equal(asgsRes.status, 200);
    const lensAsg = (asgsRes.data.assignments || []).find(
      (a: any) => a.experimentId === "exp-convex-lens"
    );
    const targetExpId = lensAsg ? "exp-convex-lens" : "exp-ohms-law";
    const targetAsgId = lensAsg ? lensAsg.id : "asg-1";

    const startRes = await apiJson("/api/viva/sessions", {
      method: "POST",
      token: studentAarav.token,
      body: { experimentId: targetExpId, assignmentId: targetAsgId },
    });
    assert.equal(startRes.status, 201, `Start viva failed: ${JSON.stringify(startRes.data)}`);
    const adaptiveSessionId = startRes.data.session.id;
    const exp = getExperimentById(targetExpId)!;
    const vivaTask = exp.tasks.find((t) => t.type === "viva_text")!;

    // Q1 initial defense
    const q1Res = await apiJson(`/api/viva/sessions/${adaptiveSessionId}/answer`, {
      method: "POST",
      token: studentAarav.token,
      body: {
        taskId: vivaTask.id,
        questionIndex: 0,
        studentAnswer:
          "The convex lens cannot form a real image on the screen when u is less than f because refracted rays diverge after passing through the lens and only appear to meet behind the object, forming a virtual upright magnified image.",
      },
    });
    assert.equal(q1Res.status, 200, `Q1 viva evaluation failed: ${JSON.stringify(q1Res.data)}`);
    assert.ok(q1Res.data.response.aiFeedback, "Gemini must return examiner feedback");
    assert.ok(q1Res.data.response.difficulty, "Response must record adaptive difficulty");
    assert.ok(
      ["foundation", "intermediate", "advanced"].includes(q1Res.data.nextDifficulty),
      "Server must compute next adaptive difficulty"
    );
    assert.ok(q1Res.data.response.adaptiveFollowUp, "Q1 must generate an adaptive follow-up question");
    assert.equal(q1Res.data.session.status, "in_progress", "Session stays in_progress for adaptive follow-up");

    // Q2 adaptive defense strictly verified against server-generated adaptiveFollowUp
    const q2Res = await apiJson(`/api/viva/sessions/${adaptiveSessionId}/answer`, {
      method: "POST",
      token: studentAarav.token,
      body: {
        isAdaptiveFollowUp: true,
        questionIndex: 1,
        studentAnswer:
          "Using the thin lens formula 1/f = 1/v - 1/u with New Cartesian sign convention, as u approaches f from above, v tends toward infinity, and once |u| < f, v becomes negative indicating a virtual image on the same side as the object.",
      },
    });
    assert.equal(q2Res.status, 200, `Q2 adaptive viva failed: ${JSON.stringify(q2Res.data)}`);
    assert.equal(q2Res.data.session.status, "completed", "Session completes after adaptive follow-up");
    assert.equal(q2Res.data.session.responses.length, 2, "Both Q1 and adaptive Q2 must be persisted");
    assert.equal(
      q2Res.data.response.difficulty,
      q1Res.data.nextDifficulty,
      "Q2 difficulty must match computed adaptive nextDifficulty"
    );

    // Clean up temporary adaptive viva session and its competency history row
    await pool.query("DELETE FROM competency_history WHERE viva_session_id = $1", [adaptiveSessionId]);
    await pool.query("DELETE FROM viva_sessions WHERE id = $1", [adaptiveSessionId]);
  });

  console.log("==================================================================");
  console.log(`INTEGRATION RESULTS: ${passed} / ${total} CHECKS PASSED`);
  console.log(`CREATED_SUBMISSION_ID=${createdSubmissionId}`);
  console.log("==================================================================");
  await pool.end();
}

const verifyIdx = process.argv.indexOf("--verify-persistence");
if (verifyIdx !== -1 && process.argv[verifyIdx + 1]) {
  runVerificationOnly(process.argv[verifyIdx + 1]).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  runFullIntegrationSuite().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
