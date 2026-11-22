import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/index.ts";
import {
  assignments,
  classes,
  classEnrollments,
  competencyHistory,
  studentCompetencies,
  submissions,
  users,
  vivaResponses,
  vivaSessions,
} from "../db/schema.ts";
import {
  aggregateStudentCompetencies,
  calculateSubmissionCompetencies,
  computeClassAnalytics,
  DEFAULT_COMPETENCY_CONFIG,
} from "../server/competencyEngine.ts";
import { gradeExperimentTasks } from "../server/experimentCatalog.ts";

async function seed() {
  console.log("[Seed] Seeding SimLab Competency Hub into Cloud SQL PostgreSQL...");

  const salt = await bcrypt.genSalt(10);
  const demoPassHash = await bcrypt.hash("password123", salt);
  const adminPassHash = await bcrypt.hash("Admin@SimLab2026!", salt);

  // 1. Seed Users (Students, Teachers, Admin)
  const seedUsers = [
    {
      id: "usr-student-1",
      email: "aarav.sharma@university.edu",
      passwordHash: demoPassHash,
      name: "Aarav Sharma",
      role: "student",
      status: "ACTIVE",
      institution: "National Institute of Science & Technology",
      enrollmentCode: "PHYS-2026-081",
    },
    {
      id: "usr-student-2",
      email: "priya.patel@university.edu",
      passwordHash: demoPassHash,
      name: "Priya Patel",
      role: "student",
      status: "ACTIVE",
      institution: "National Institute of Science & Technology",
      enrollmentCode: "PHYS-2026-082",
    },
    {
      id: "usr-student-3",
      email: "rahul.verma@university.edu",
      passwordHash: demoPassHash,
      name: "Rahul Verma",
      role: "student",
      status: "ACTIVE",
      institution: "National Institute of Science & Technology",
      enrollmentCode: "PHYS-2026-083",
    },
    {
      id: "usr-teacher-1",
      email: "dr.ananya.sen@university.edu",
      passwordHash: demoPassHash,
      name: "Dr. Ananya Sen",
      role: "teacher",
      status: "ACTIVE",
      institution: "National Institute of Science & Technology",
      enrollmentCode: "DEPT-PHYS-LEAD",
    },
    {
      id: "usr-teacher-2",
      email: "prof.rajesh.iyer@university.edu",
      passwordHash: demoPassHash,
      name: "Prof. Rajesh Iyer",
      role: "teacher",
      status: "ACTIVE",
      institution: "Indian Institute of Applied Sciences",
      enrollmentCode: "DEPT-CHEM-02",
    },
    {
      id: "usr-admin-1",
      email: "admin.lead@university.edu",
      passwordHash: adminPassHash,
      name: "Central Administrator",
      role: "admin",
      status: "ACTIVE",
      institution: "SimLab Central Institutional Administration",
      enrollmentCode: "SYS-ADMIN-CORE",
    },
  ];

  for (const u of seedUsers) {
    await db
      .insert(users)
      .values(u)
      .onConflictDoNothing({ target: users.email });
  }

  // 2. Seed Classes
  const seedClasses = [
    {
      id: "cls-1",
      name: "B.Tech Sem 1 — Engineering Physics & Optics Lab (Batch A)",
      code: "PHY101-A",
      department: "Department of Physics & Applied Sciences",
      semester: "Semester 1",
      academicYear: "2026-27",
      teacherId: "usr-teacher-1",
    },
    {
      id: "cls-2",
      name: "B.Tech Sem 2 — Analytical Chemistry & Molecular Bio Lab",
      code: "SCI204-B",
      department: "Department of Applied Sciences",
      semester: "Semester 2",
      academicYear: "2026-27",
      teacherId: "usr-teacher-2",
    },
    {
      id: "cls-3",
      name: "B.Sc Honors — Applied Chemical Instrumentation",
      code: "CHM301-C",
      department: "Department of Chemistry",
      semester: "Semester 3",
      academicYear: "2026-27",
      teacherId: "usr-teacher-2",
    },
  ];

  for (const c of seedClasses) {
    await db.insert(classes).values(c).onConflictDoNothing({ target: classes.id });
  }

  // 3. Seed Class Enrollments (canonical class_enrollments table)
  const enrollments = [
    { id: "enr-seed-cls1-s1", classId: "cls-1", studentId: "usr-student-1", enrollmentStatus: "active" },
    { id: "enr-seed-cls1-s2", classId: "cls-1", studentId: "usr-student-2", enrollmentStatus: "active" },
    { id: "enr-seed-cls1-s3", classId: "cls-1", studentId: "usr-student-3", enrollmentStatus: "active" },
    { id: "enr-seed-cls2-s1", classId: "cls-2", studentId: "usr-student-1", enrollmentStatus: "active" },
    { id: "enr-seed-cls2-s2", classId: "cls-2", studentId: "usr-student-2", enrollmentStatus: "active" },
    { id: "enr-seed-cls3-s3", classId: "cls-3", studentId: "usr-student-3", enrollmentStatus: "active" },
  ];

  for (const e of enrollments) {
    await db.insert(classEnrollments).values(e).onConflictDoNothing();
  }

  // 4. Seed Active Assignments (multiple attempts allowed so students can practice & re-submit)
  const seedAssignments = [
    {
      id: "asg-1",
      classId: "cls-1",
      title: "Lab 1: Ohm's Law & Conductor Resistance Verification",
      experimentId: "exp-ohms-law",
      dueDate: new Date("2026-12-15T23:59:00Z"),
      totalMarks: "100.00",
      weightTowardsInternal: "15.00",
      attemptsAllowed: 5,
      allowFreeExploration: true,
      status: "active",
      createdBy: "usr-teacher-1",
    },
    {
      id: "asg-2",
      classId: "cls-2",
      title: "Lab 2: Potentiometric Acid-Base Titration Curve",
      experimentId: "exp-titration",
      dueDate: new Date("2026-12-20T23:59:00Z"),
      totalMarks: "100.00",
      weightTowardsInternal: "15.00",
      attemptsAllowed: 5,
      allowFreeExploration: true,
      status: "active",
      createdBy: "usr-teacher-2",
    },
    {
      id: "asg-3",
      classId: "cls-1",
      title: "Lab 3: Photoelectric Effect & Planck's Constant",
      experimentId: "exp-photoelectric",
      dueDate: new Date("2026-12-28T23:59:00Z"),
      totalMarks: "100.00",
      weightTowardsInternal: "20.00",
      attemptsAllowed: 5,
      allowFreeExploration: true,
      status: "active",
      createdBy: "usr-teacher-1",
    },
    {
      id: "asg-4",
      classId: "cls-1",
      title: "Lab 4: Convex Lens Focal Length (u-v Method)",
      experimentId: "exp-convex-lens",
      dueDate: new Date("2027-01-10T23:59:00Z"),
      totalMarks: "100.00",
      weightTowardsInternal: "20.00",
      attemptsAllowed: 5,
      allowFreeExploration: true,
      status: "active",
      createdBy: "usr-teacher-1",
    },
    {
      id: "asg-5",
      classId: "cls-2",
      title: "Lab 5: PCR Amplification & Agarose Gel Electrophoresis",
      experimentId: "exp-pcr-gel",
      dueDate: new Date("2027-01-18T23:59:00Z"),
      totalMarks: "100.00",
      weightTowardsInternal: "20.00",
      attemptsAllowed: 5,
      allowFreeExploration: true,
      status: "active",
      createdBy: "usr-teacher-2",
    },
  ];

  for (const a of seedAssignments) {
    await db
      .insert(assignments)
      .values(a)
      .onConflictDoNothing({ target: assignments.id });
  }

  // 5. Seed Initial Persisted AI Viva Sessions, Submissions, and Competencies (if empty)
  const existingSubs = await db.select({ id: submissions.id }).from(submissions).limit(1);
  if (existingSubs.length === 0) {
    const seedEntries = [
      {
        vivaId: "viva-seed-101",
        subId: "sub-seed-101",
        studentId: "usr-student-1",
        studentName: "Aarav Sharma",
        assignmentId: "asg-1",
        experimentId: "exp-ohms-law",
        classId: "cls-1",
        taskAnswers: {
          "task-ohm-1": "opt-2",
          "task-ohm-2": "a",
          "task-ohm-3": 14.85,
        },
        vivaAnswer:
          "Continuous current causes Joule heating (P = I^2 R), raising conductor temperature. Because metals have a positive temperature coefficient of resistance, lattice vibrations intensify and increase electron scattering, raising resistance.",
        vivaScore: 92,
        vivaFeedback:
          "Strong explanation connecting Joule heating, lattice vibration, and positive temperature coefficient of resistance.",
        vivaTaskId: "task-ohm-4",
        vivaDimension: "troubleshooting_safety" as const,
        vivaQuestion:
          "Explain why the V-I curve starts bending upwards (current increasing slower than voltage) when high currents are passed continuously through the wire for prolonged periods.",
        observations: { voltageRange: "0-8V", trials: 6, linearFitR2: 0.996 },
        calculatedResults: { measuredResistanceOhms: 14.85, uncertaintyOhms: 0.25 },
        dataReadingsCount: 6,
        evaluationStatus: "faculty_reviewed",
        instructorFeedback:
          "Excellent precision on the linear V-I sweep and thorough physical reasoning on thermal drift.",
        evaluatedBy: "usr-teacher-1",
      },
      {
        vivaId: "viva-seed-102",
        subId: "sub-seed-102",
        studentId: "usr-student-2",
        studentName: "Priya Patel",
        assignmentId: "asg-1",
        experimentId: "exp-ohms-law",
        classId: "cls-1",
        taskAnswers: {
          "task-ohm-1": "opt-2",
          "task-ohm-2": "a",
          "task-ohm-3": 15.9, // outside tolerance to reflect realistic partial mastery
        },
        vivaAnswer:
          "When current flows for a long time the wire heats up and resistance goes up because of temperature.",
        vivaScore: 76,
        vivaFeedback:
          "Correctly identifies heating and rising resistance; expand with Joule power dissipation (P = I^2 R) and lattice scattering.",
        vivaTaskId: "task-ohm-4",
        vivaDimension: "troubleshooting_safety" as const,
        vivaQuestion:
          "Explain why the V-I curve starts bending upwards (current increasing slower than voltage) when high currents are passed continuously through the wire for prolonged periods.",
        observations: { voltageRange: "0-6V", trials: 4 },
        calculatedResults: { measuredResistanceOhms: 15.9 },
        dataReadingsCount: 4,
        evaluationStatus: "ai_evaluated",
        instructorFeedback: null,
        evaluatedBy: null,
      },
      {
        vivaId: "viva-seed-103",
        subId: "sub-seed-103",
        studentId: "usr-student-3",
        studentName: "Rahul Verma",
        assignmentId: "asg-1",
        experimentId: "exp-ohms-law",
        classId: "cls-1",
        taskAnswers: {
          "task-ohm-1": "opt-3", // wrong range
          "task-ohm-2": "a",
          "task-ohm-3": 16.5, // outside tolerance
        },
        vivaAnswer:
          "The voltage gets too high so the wire slows down the electricity.",
        vivaScore: 54,
        vivaFeedback:
          "Needs stronger grounding in Joule heating (P = I^2 R) and the positive temperature coefficient of metallic conductors.",
        vivaTaskId: "task-ohm-4",
        vivaDimension: "troubleshooting_safety" as const,
        vivaQuestion:
          "Explain why the V-I curve starts bending upwards (current increasing slower than voltage) when high currents are passed continuously through the wire for prolonged periods.",
        observations: { voltageRange: "0-10V", trials: 2 },
        calculatedResults: { measuredResistanceOhms: 16.5 },
        dataReadingsCount: 2,
        evaluationStatus: "pending",
        instructorFeedback: null,
        evaluatedBy: null,
      },
      {
        vivaId: "viva-seed-104",
        subId: "sub-seed-104",
        studentId: "usr-student-1",
        studentName: "Aarav Sharma",
        assignmentId: "asg-2",
        experimentId: "exp-titration",
        classId: "cls-2",
        taskAnswers: {
          "task-titr-1": "opt-1",
          "task-titr-2": "a",
          "task-titr-3": 0.086,
        },
        vivaAnswer:
          "The equivalence inflection for strong acid and strong base jumps steeply from pH 3.5 to 10.5 within a single drop (0.02 mL), so phenolphthalein transitioning at 8.2-10.0 yields negligible titration error under 0.1%.",
        vivaScore: 88,
        vivaFeedback:
          "Accurate stoichiometry and inflection-slope analysis justifying phenolphthalein selection.",
        vivaTaskId: "task-titr-4",
        vivaDimension: "experimental_design" as const,
        vivaQuestion:
          "Why is phenolphthalein (color transition pH 8.2 - 10.0) an acceptable visual indicator for strong acid - strong base titration even though pure neutral equivalence is pH 7.00?",
        observations: { analyteVolumeMl: 25.0, equivalenceVolumeMl: 21.5, phReadings: 12 },
        calculatedResults: { hclMolarity: 0.086 },
        dataReadingsCount: 12,
        evaluationStatus: "faculty_reviewed",
        instructorFeedback:
          "Well-resolved derivative peak at 21.50 mL and clear justification of indicator choice.",
        evaluatedBy: "usr-teacher-2",
      },
    ];

    for (const item of seedEntries) {
      await db.insert(vivaSessions).values({
        id: item.vivaId,
        studentId: item.studentId,
        experimentId: item.experimentId,
        assignmentId: item.assignmentId,
        attemptNumber: 1,
        status: "completed",
        overallScore: item.vivaScore.toFixed(2),
        maxScore: "100.00",
        questionsCount: 1,
        answeredCount: 1,
        summaryFeedback: item.vivaFeedback,
        completedAt: new Date(),
      }).onConflictDoNothing();

      await db.insert(vivaResponses).values({
        id: `vresp-${item.vivaId}`,
        sessionId: item.vivaId,
        questionIndex: 0,
        taskId: item.vivaTaskId,
        questionText: item.vivaQuestion,
        competencyDimension: item.vivaDimension,
        studentAnswer: item.vivaAnswer,
        score: item.vivaScore.toFixed(2),
        maxPoints: "30.00",
        passed: item.vivaScore >= 70,
        aiFeedback: item.vivaFeedback,
        rubricCriteriaMet: item.vivaScore >= 70 ? ["Core scientific mechanism identified"] : [],
        missingConcepts: item.vivaScore < 70 ? ["Quantitative thermal/physical relationship"] : [],
        adaptiveFollowUp: "How would experimental tolerance affect this conclusion?",
        aiModel: "gemini-4-hydrogen",
      }).onConflictDoNothing();

      const grading = gradeExperimentTasks(item.experimentId, item.taskAnswers, [
        {
          taskId: item.vivaTaskId,
          questionText: item.vivaQuestion,
          competencyDimension: item.vivaDimension,
          studentAnswer: item.vivaAnswer,
          score: item.vivaScore,
          maxPoints: 30,
          passed: item.vivaScore >= 70,
          aiFeedback: item.vivaFeedback,
          rubricCriteriaMet: item.vivaScore >= 70 ? ["Core scientific mechanism identified"] : [],
          missingConcepts: item.vivaScore < 70 ? ["Quantitative thermal/physical relationship"] : [],
        },
      ]);

      const compCalc = calculateSubmissionCompetencies(
        item.experimentId,
        grading.taskList,
        {
          dataReadingsCount: item.dataReadingsCount,
          config: DEFAULT_COMPETENCY_CONFIG,
        }
      );

      await db.insert(submissions).values({
        id: item.subId,
        assignmentId: item.assignmentId,
        studentId: item.studentId,
        studentName: item.studentName,
        experimentId: item.experimentId,
        attemptNumber: 1,
        totalScore: grading.totalScore.toFixed(2),
        maxScore: grading.maxScore.toFixed(2),
        competencyScores: compCalc.competencyScores,
        taskResponses: {
          ...grading.gradedTasks,
          vivaResponses: [
            {
              taskId: item.vivaTaskId,
              question: item.vivaQuestion,
              studentAnswer: item.vivaAnswer,
              score: item.vivaScore,
              feedback: item.vivaFeedback,
            },
          ],
        },
        observations: item.observations,
        calculatedResults: item.calculatedResults,
        dataReadingsCount: item.dataReadingsCount,
        completionStatus: "completed",
        evaluationStatus: item.evaluationStatus,
        vivaSessionId: item.vivaId,
        instructorFeedback: item.instructorFeedback,
        evaluatedBy: item.evaluatedBy,
        evaluatedAt: item.evaluatedBy ? new Date() : null,
      }).onConflictDoNothing();
    }

    // Recompute and persist student_competencies, competency_history, and class averages
    for (const studentId of ["usr-student-1", "usr-student-2", "usr-student-3"]) {
      const stuSubs = await db
        .select()
        .from(submissions)
        .where(eq(submissions.studentId, studentId));
      const stuVivas = await db
        .select()
        .from(vivaSessions)
        .where(eq(vivaSessions.studentId, studentId));

      const report = aggregateStudentCompetencies(
        stuSubs.map((s) => ({
          id: s.id,
          experimentId: s.experimentId,
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          attemptNumber: s.attemptNumber,
          totalScore: Number(s.totalScore),
          maxScore: Number(s.maxScore),
          facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
          competencyScores: s.competencyScores,
          taskResponses: (s.taskResponses || {}) as Record<string, any>,
          vivaSessionId: s.vivaSessionId,
          submittedAt: s.submittedAt,
        })),
        stuVivas.map((v) => ({
          id: v.id,
          experimentId: v.experimentId,
          overallScore: Number(v.overallScore),
          status: v.status,
        })),
        DEFAULT_COMPETENCY_CONFIG
      );

      for (const dim of report.dimensions) {
        await db
          .insert(studentCompetencies)
          .values({
            id: `scomp-${studentId}-${dim.key}`.slice(0, 64),
            studentId,
            competencyKey: dim.key,
            score: dim.score.toFixed(2),
            experimentContribution: dim.experimentContribution.toFixed(2),
            vivaContribution: dim.vivaContribution.toFixed(2),
            experimentsEvaluated: dim.experimentsEvaluated,
            status: dim.status,
          })
          .onConflictDoNothing();
      }

      if (stuSubs.length > 0) {
        await db
          .insert(competencyHistory)
          .values({
            id: `chist-seed-${studentId}`,
            studentId,
            submissionId: stuSubs[0].id,
            vivaSessionId: stuSubs[0].vivaSessionId,
            experimentId: stuSubs[0].experimentId,
            attemptNumber: stuSubs[0].attemptNumber,
            competencyScores: report.competencyScores,
            overallScore: report.overallScore.toFixed(2),
            deltaOverall: "0.00",
            calculationMetadata: { triggerType: "seed", methodology: report.methodology },
          })
          .onConflictDoNothing();
      }
    }

    // Update class averages from real seeded submissions
    for (const classId of ["cls-1", "cls-2"]) {
      const clsAsgs = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(eq(assignments.classId, classId));
      const allSubs = await db.select().from(submissions);
      const classSubs = allSubs.filter((s) =>
        clsAsgs.some((a) => a.id === s.assignmentId)
      );
      const analytics = computeClassAnalytics(
        classSubs.map((s) => ({
          id: s.id,
          experimentId: s.experimentId,
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          attemptNumber: s.attemptNumber,
          totalScore: Number(s.totalScore),
          maxScore: Number(s.maxScore),
          facultyScore: s.facultyScore != null ? Number(s.facultyScore) : null,
          competencyScores: s.competencyScores,
          taskResponses: (s.taskResponses || {}) as Record<string, any>,
          vivaSessionId: s.vivaSessionId,
          submittedAt: s.submittedAt,
        }))
      );

      await db
        .update(classes)
        .set({
          averageCompetencies: analytics.averageCompetencies,
          commonMisconceptions: analytics.commonMisconceptions,
          updatedAt: new Date(),
        })
        .where(eq(classes.id, classId));
    }
  }

  console.log("[Seed] Cloud SQL seeding completed cleanly.");
}

seed()
  .catch((err) => {
    console.error("[Seed] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
