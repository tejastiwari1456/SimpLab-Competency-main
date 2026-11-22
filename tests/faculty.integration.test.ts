/**
 * SimLab Competency Hub — Faculty Module Integration & Authorization Test Suite
 * Tests all 7 faculty API capabilities against live Cloud SQL PostgreSQL and live Gemini API,
 * including strict cross-teacher authorization (403) enforcement.
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { assignments, evaluationHistory, submissions } from "../src/db/schema.ts";

const BASE = "http://localhost:3000";

async function login(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  assert.equal(res.status, 200, `Login failed for ${email}: ${JSON.stringify(data)}`);
  assert.ok(data.token, `Missing token for ${email}`);
  return { token: data.token, user: data.user };
}

async function run() {
  console.log("=== Faculty Module Backend & Authorization Verification ===");

  // 1. Login as Faculty 1 (Dr. Ananya Sen — teaches PHY101-A & SCI204-B)
  //    and Faculty 2 (Prof. Rajesh Iyer — teaches BIO-302 only)
  //    and Student (Aarav Sharma — enrolled in Dr. Ananya's classes)
  const [drAnanya, profRajesh, studentAarav] = await Promise.all([
    login("dr.ananya.sen@university.edu", "password123"),
    login("prof.rajesh.iyer@university.edu", "password123"),
    login("aarav.sharma@university.edu", "password123"),
  ]);
  const authAnanya = { Authorization: `Bearer ${drAnanya.token}` };
  const authRajesh = { Authorization: `Bearer ${profRajesh.token}` };
  const authStudent = { Authorization: `Bearer ${studentAarav.token}` };
  console.log("✓ Check 1: Authenticated Dr. Ananya, Prof. Rajesh, and Student Aarav");

  // 2. Dashboard Summary (Real PostgreSQL statistics)
  const dashRes = await fetch(`${BASE}/api/teacher/dashboard-summary`, { headers: authAnanya });
  const dashJson = await dashRes.json();
  assert.equal(dashRes.status, 200);
  assert.equal(dashJson.success, true);
  assert.ok(dashJson.summary.totalAssignedStudents >= 1, "Expected assigned students > 0");
  assert.ok(dashJson.summary.totalClasses >= 1, "Expected assigned classes > 0");
  assert.ok(Array.isArray(dashJson.summary.recentActivities));
  assert.ok(Array.isArray(dashJson.summary.studentsRequiringAttention));
  console.log(
    `✓ Check 2: Dashboard summary live — ${dashJson.summary.totalAssignedStudents} students, ${dashJson.summary.pendingSubmissionsCount} pending, ${dashJson.summary.completedExperimentsCount} completed, ${dashJson.summary.classAverageCompetency}% avg`
  );

  // Student must be blocked (403) from teacher dashboard summary
  const stuDashRes = await fetch(`${BASE}/api/teacher/dashboard-summary`, { headers: authStudent });
  assert.equal(stuDashRes.status, 403, "Student should receive 403 on teacher endpoint");
  console.log("✓ Check 3: Student blocked (403) from /api/teacher/dashboard-summary");

  // 4. Individual Student Report + Cross-Teacher 403 Boundary
  const studentId = studentAarav.user.id;
  const stuRepRes = await fetch(`${BASE}/api/teacher/students/${studentId}/report`, {
    headers: authAnanya,
  });
  const stuRepJson = await stuRepRes.json();
  assert.equal(stuRepRes.status, 200);
  assert.equal(stuRepJson.report.student.id, studentId);
  assert.ok(Array.isArray(stuRepJson.report.submissions));
  assert.ok(Array.isArray(stuRepJson.report.vivaSessions));
  assert.ok(Array.isArray(stuRepJson.report.evaluationHistory));
  console.log(
    `✓ Check 4: Authorized student report loaded for ${stuRepJson.report.student.name} (${stuRepJson.report.submissions.length} submissions)`
  );

  // Prof. Rajesh does NOT teach Aarav -> MUST receive 403
  const unauthStuRes = await fetch(`${BASE}/api/teacher/students/${studentId}/report`, {
    headers: authRajesh,
  });
  assert.equal(
    unauthStuRes.status,
    403,
    "Unauthorized faculty must get 403 when accessing another teacher's student"
  );
  console.log("✓ Check 5: Cross-teacher student report blocked (403) for Prof. Rajesh");

  // 5. Create Experiment Assignment with Evaluation Criteria + Cleanup
  const classesRes = await fetch(`${BASE}/api/teacher/classes`, { headers: authAnanya });
  const classesJson = await classesRes.json();
  const targetClassId = classesJson.classes[0].id;

  const createAsgRes = await fetch(`${BASE}/api/teacher/assignments`, {
    method: "POST",
    headers: { ...authAnanya, "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: targetClassId,
      title: "Integration Test: Ohm's Law Criteria Check",
      experimentId: "exp-ohms-law",
      dueDate: new Date(Date.now() + 7 * 86400_000).toISOString(),
      totalMarks: 100,
      weightTowardsInternal: 20,
      attemptsAllowed: 3,
      allowFreeExploration: true,
      evaluationCriteria: {
        practicalWeightPct: 65,
        vivaWeightPct: 35,
        passingThresholdPct: 75,
        requireViva: true,
        rubricNotes: "Verify slope within 3% tolerance.",
      },
    }),
  });
  const createAsgJson = await createAsgRes.json();
  assert.equal(createAsgRes.status, 201, `Create assignment failed: ${JSON.stringify(createAsgJson)}`);
  const createdAsgId = createAsgJson.assignment.id;
  assert.equal(createAsgJson.assignment.evaluationCriteria.practicalWeightPct, 65);
  assert.equal(createAsgJson.assignment.evaluationCriteria.vivaWeightPct, 35);
  assert.equal(createAsgJson.assignment.evaluationCriteria.passingThresholdPct, 75);
  console.log(`✓ Check 6: Created assignment ${createdAsgId} with persisted evaluationCriteria`);

  // Cross-teacher assignment creation in Dr. Ananya's class -> MUST be 403
  const crossAsgRes = await fetch(`${BASE}/api/teacher/assignments`, {
    method: "POST",
    headers: { ...authRajesh, "Content-Type": "application/json" },
    body: JSON.stringify({
      classId: targetClassId,
      title: "Unauthorized Assignment",
      experimentId: "exp-ohms-law",
      dueDate: new Date(Date.now() + 7 * 86400_000).toISOString(),
    }),
  });
  assert.equal(crossAsgRes.status, 403, "Cross-teacher assignment creation must return 403");
  console.log("✓ Check 7: Cross-teacher assignment creation blocked (403)");

  // Clean up the temporary test assignment
  await db.delete(assignments).where(eq(assignments.id, createdAsgId));

  // 6. Submission Evaluation (rejected -> faculty_reviewed) + Evaluation History Verification
  const subsRes = await fetch(`${BASE}/api/teacher/submissions`, { headers: authAnanya });
  const subsJson = await subsRes.json();
  assert.equal(subsRes.status, 200);
  assert.ok(subsJson.submissions.length > 0, "Expected at least 1 submission to evaluate");
  const targetSub = subsJson.submissions[0];
  const origStatus = targetSub.evaluationStatus;
  const origFeedback = targetSub.instructorFeedback;
  const origFacultyScore = targetSub.facultyScore;

  // Test rejecting a submission, then restoring original state cleanly
  const evalRejectRes = await fetch(
    `${BASE}/api/teacher/submissions/${targetSub.id}/evaluate`,
    {
      method: "PATCH",
      headers: { ...authAnanya, "Content-Type": "application/json" },
      body: JSON.stringify({
        evaluationStatus: "rejected",
        instructorFeedback: "Integration test audit check — will restore.",
        facultyScore: origFacultyScore,
      }),
    }
  );
  const evalRejectJson = await evalRejectRes.json();
  assert.equal(evalRejectRes.status, 200);
  assert.equal(evalRejectJson.submission.evaluationStatus, "rejected");

  // Verify immutable evaluationHistory is returned on GET /api/submissions/:id
  const detailRes = await fetch(`${BASE}/api/submissions/${targetSub.id}`, {
    headers: authAnanya,
  });
  const detailJson = await detailRes.json();
  assert.equal(detailRes.status, 200);
  assert.ok(
    Array.isArray(detailJson.submission.evaluationHistory) &&
      detailJson.submission.evaluationHistory.length >= 1,
    "Expected persisted evaluationHistory entry"
  );
  assert.equal(detailJson.submission.evaluationHistory[0].newStatus, "rejected");
  const testHistoryId = detailJson.submission.evaluationHistory[0].id;

  // Cross-teacher evaluation attempt -> MUST be 403
  const crossEvalRes = await fetch(
    `${BASE}/api/teacher/submissions/${targetSub.id}/evaluate`,
    {
      method: "PATCH",
      headers: { ...authRajesh, "Content-Type": "application/json" },
      body: JSON.stringify({ evaluationStatus: "faculty_reviewed" }),
    }
  );
  assert.equal(crossEvalRes.status, 403, "Cross-teacher evaluation must return 403");

  // Restore submission state & remove synthetic evaluation_history row
  await db
    .update(submissions)
    .set({
      evaluationStatus: origStatus,
      instructorFeedback: origFeedback ?? null,
      facultyScore: origFacultyScore != null ? String(origFacultyScore) : null,
    })
    .where(eq(submissions.id, targetSub.id));
  await db.delete(evaluationHistory).where(eq(evaluationHistory.id, testHistoryId));
  console.log("✓ Check 8: Submission evaluation (including rejected + evaluationHistory) & 403 guard verified");

  // 7. Competency Analytics + Cross-Teacher 403 Guard
  const analyticsRes = await fetch(
    `${BASE}/api/teacher/analytics?classId=${encodeURIComponent(targetClassId)}`,
    { headers: authAnanya }
  );
  const analyticsJson = await analyticsRes.json();
  assert.equal(analyticsRes.status, 200);
  assert.ok(Array.isArray(analyticsJson.analytics.classComparison));
  assert.ok(analyticsJson.analytics.skillGaps.length === 5);
  assert.ok(Array.isArray(analyticsJson.analytics.experimentPerformance));
  assert.ok(Array.isArray(analyticsJson.analytics.improvementTrends));
  assert.ok(Array.isArray(analyticsJson.analytics.remedialStudents));

  const crossAnalyticsRes = await fetch(
    `${BASE}/api/teacher/analytics?classId=${encodeURIComponent(targetClassId)}`,
    { headers: authRajesh }
  );
  assert.equal(crossAnalyticsRes.status, 403);
  console.log("✓ Check 9: Competency analytics & cross-teacher 403 guard verified");

  // 8. AI Faculty Insights (Live Gemini call + Cross-Teacher 403 Guard)
  const crossAiRes = await fetch(`${BASE}/api/teacher/ai-insights`, {
    method: "POST",
    headers: { ...authRajesh, "Content-Type": "application/json" },
    body: JSON.stringify({ classId: targetClassId }),
  });
  assert.equal(crossAiRes.status, 403);

  const aiRes = await fetch(`${BASE}/api/teacher/ai-insights`, {
    method: "POST",
    headers: { ...authAnanya, "Content-Type": "application/json" },
    body: JSON.stringify({ classId: targetClassId }),
  });
  const aiJson = await aiRes.json();
  assert.equal(aiRes.status, 200, `AI Insights failed: ${JSON.stringify(aiJson)}`);
  assert.ok(aiJson.insights.classPerformanceSummary.length > 20);
  assert.ok(Array.isArray(aiJson.insights.commonMistakes));
  assert.ok(Array.isArray(aiJson.insights.frequentlyObservedGaps));
  assert.ok(Array.isArray(aiJson.insights.teachingRecommendations));
  assert.ok(Array.isArray(aiJson.insights.studentInterventions));
  assert.ok(aiJson.insights.advisoryNotice.toLowerCase().includes("advisory"));
  console.log(`✓ Check 10: Live Gemini AI Faculty Insights verified (model: ${aiJson.insights.model})`);

  // 9. Historical Reports & Excel CSV Exports + Cross-Teacher 403 Guard
  const histRes = await fetch(
    `${BASE}/api/teacher/reports/historical?classId=${encodeURIComponent(targetClassId)}`,
    { headers: authAnanya }
  );
  const histJson = await histRes.json();
  assert.equal(histRes.status, 200);
  assert.ok(Array.isArray(histJson.report.records));
  assert.ok(typeof histJson.report.summary.totalSubmissions === "number");

  const csvRes = await fetch(
    `${BASE}/api/teacher/reports/export?type=class_competency&classId=${encodeURIComponent(targetClassId)}`,
    { headers: authAnanya }
  );
  assert.equal(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.startsWith("\uFEFF"), "Expected UTF-8 BOM for Excel compatibility");
  assert.ok(csvText.includes("Class Code"), "Expected CSV header row");

  const crossCsvRes = await fetch(
    `${BASE}/api/teacher/reports/export?type=student&studentId=${encodeURIComponent(studentId)}`,
    { headers: authRajesh }
  );
  assert.equal(crossCsvRes.status, 403);
  console.log("✓ Check 11: Historical assessment report & Excel CSV export (+ 403 guard) verified");

  console.log("\nALL 11 FACULTY MODULE INTEGRATION & SECURITY CHECKS PASSED!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Faculty integration test failed:", err);
  process.exit(1);
});
