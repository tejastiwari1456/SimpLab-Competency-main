import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

interface JsonResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
}

async function api<T = any>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {}
): Promise<JsonResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => null)) as T;
  return { status: response.status, ok: response.ok, data };
}

async function login(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(res.status, 200, `Login failed for ${email}: ${JSON.stringify(res.data)}`);
  assert.ok(res.data?.token, `Missing token for ${email}`);
  return { token: res.data.token, user: res.data.user };
}

async function runCoreScenarios() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const phyStudentEmail = `rahul.phy.${suffix}@test.simlab.edu`;
  const sciStudentEmail = `meera.sci.${suffix}@test.simlab.edu`;
  const createdStudentIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  console.log(`\n=== Running Enrollment & Class-Scoped Assignment Integration Suite (${suffix}) ===`);

  // 1. Dynamic class availability check (no hardcoded class IDs in client)
  const availRes = await api('/api/classes/available');
  assert.equal(availRes.status, 200, 'GET /api/classes/available must succeed');
  const availableClasses: any[] = availRes.data.classes;
  assert.ok(Array.isArray(availableClasses) && availableClasses.length >= 2, 'Should list >= 2 active classes');

  const phyClass = availableClasses.find((c) => c.code === 'PHY101-A');
  const sciClass = availableClasses.find((c) => c.code === 'SCI204-B');
  assert.ok(phyClass, 'PHY101-A must be dynamically available');
  assert.ok(sciClass, 'SCI204-B must be dynamically available');
  assert.equal(phyClass.facultyName, 'Dr. Ananya Sen', 'PHY101-A must belong to Dr. Ananya Sen');
  assert.equal(sciClass.facultyName, 'Prof. Rajesh Iyer', 'SCI204-B must belong to Prof. Rajesh Iyer');
  console.log('✓ Dynamic class listing verified: PHY101-A (Dr. Ananya Sen) & SCI204-B (Prof. Rajesh Iyer)');

  // Login faculty & admin accounts
  const ananya = await login('dr.ananya.sen@university.edu', 'password123');
  const rajesh = await login('prof.rajesh.iyer@university.edu', 'password123');
  const admin = await login('admin.lead@university.edu', 'Admin@SimLab2026!');

  // Capture baseline student counts
  const ananyaBaselineDash = await api('/api/teacher/dashboard-summary', { token: ananya.token });
  assert.equal(ananyaBaselineDash.status, 200);
  const ananyaBaselineCount = ananyaBaselineDash.data.summary.totalAssignedStudents;

  const rajeshBaselineDash = await api('/api/teacher/dashboard-summary', { token: rajesh.token });
  assert.equal(rajeshBaselineDash.status, 200);
  const rajeshBaselineCount = rajeshBaselineDash.data.summary.totalAssignedStudents;

  // =========================================================================
  // SCENARIO A: Student registers for PHY101-A + faculty notification + lab propagation
  // =========================================================================
  const missingClassReg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'No Class Student',
      email: `noclass.${suffix}@test.simlab.edu`,
      password: 'Password123!',
      role: 'student',
    },
  });
  assert.equal(missingClassReg.status, 400, 'Student registration without classId must fail with 400');

  const invalidClassReg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Invalid Class Student',
      email: `badclass.${suffix}@test.simlab.edu`,
      password: 'Password123!',
      role: 'student',
      classId: 'NON_EXISTENT_CLASS_999',
    },
  });
  assert.equal(invalidClassReg.status, 400, 'Student registration with invalid classId must fail with 400');

  const phyReg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Rahul Sharma Test',
      email: phyStudentEmail,
      password: 'Password123!',
      role: 'student',
      institution: 'National Science University',
      classId: phyClass.id,
    },
  });
  assert.equal(phyReg.status, 201, `PHY101-A registration failed: ${JSON.stringify(phyReg.data)}`);
  assert.equal(phyReg.data.enrollment.classCode, 'PHY101-A');
  assert.equal(phyReg.data.enrollment.facultyName, 'Dr. Ananya Sen');
  const phyStudentToken: string = phyReg.data.token;
  const phyStudentId: string = phyReg.data.user.id;
  createdStudentIds.push(phyStudentId);

  // Verify student sees enrolled class + faculty on student endpoints
  const phyStudentClasses = await api('/api/student/classes', { token: phyStudentToken });
  assert.equal(phyStudentClasses.status, 200);
  assert.equal(phyStudentClasses.data.classes.length, 1);
  assert.equal(phyStudentClasses.data.classes[0].code, 'PHY101-A');
  assert.equal(phyStudentClasses.data.classes[0].facultyName, 'Dr. Ananya Sen');
  assert.equal(phyStudentClasses.data.classes[0].enrollmentStatus, 'active');

  // Verify student sees existing PHY101-A assignments and ZERO SCI204-B assignments
  const phyStudentAssignmentsBefore = await api('/api/student/assignments', { token: phyStudentToken });
  assert.equal(phyStudentAssignmentsBefore.status, 200);
  assert.ok(phyStudentAssignmentsBefore.data.assignments.length >= 1, 'New PHY101-A student must see existing PHY101-A assignments');
  assert.ok(
    phyStudentAssignmentsBefore.data.assignments.every((a: any) => a.classId === phyClass.id),
    'PHY101-A student must only see PHY101-A assignments'
  );

  // Verify Dr. Ananya Sen's roster, dashboard, and notifications updated automatically
  const ananyaRoster = await api(`/api/teacher/classes/${phyClass.id}/students`, { token: ananya.token });
  assert.equal(ananyaRoster.status, 200);
  assert.ok(
    ananyaRoster.data.students.some((s: any) => s.id === phyStudentId && s.enrollmentStatus === 'active'),
    'Dr. Ananya Sen PHY101-A roster must immediately contain Rahul Sharma Test'
  );

  const ananyaDashAfter = await api('/api/teacher/dashboard-summary', { token: ananya.token });
  assert.equal(ananyaDashAfter.status, 200);
  assert.equal(
    ananyaDashAfter.data.summary.totalAssignedStudents,
    ananyaBaselineCount + 1,
    'Dr. Ananya Sen totalAssignedStudents must increment by 1'
  );
  assert.ok(
    ananyaDashAfter.data.summary.recentlyEnrolledStudents.some((s: any) => s.studentId === phyStudentId && s.classCode === 'PHY101-A'),
    'Dr. Ananya Sen recentlyEnrolledStudents must include Rahul Sharma Test'
  );

  const ananyaNotifs = await api('/api/teacher/notifications', { token: ananya.token });
  assert.equal(ananyaNotifs.status, 200);
  const rahulNotif = ananyaNotifs.data.notifications.find(
    (n: any) => n.type === 'student_enrolled' && n.metadata?.studentId === phyStudentId
  );
  assert.ok(rahulNotif, 'Dr. Ananya Sen must receive persistent student_enrolled notification');
  assert.equal(rahulNotif.title, 'New Student Enrolled');
  assert.ok(rahulNotif.message.includes('Rahul Sharma Test') && rahulNotif.message.includes('PHY101-A'));
  assert.equal(rahulNotif.isRead, false);

  // Verify Prof. Rajesh Iyer did NOT get Rahul's notification
  const rajeshNotifsCheckA = await api('/api/teacher/notifications', { token: rajesh.token });
  assert.equal(
    rajeshNotifsCheckA.data.notifications.some((n: any) => n.metadata?.studentId === phyStudentId),
    false,
    'Prof. Rajesh Iyer must NOT receive PHY101-A enrollment notification'
  );
  console.log('✓ Scenario A passed: PHY101-A auto-enrollment, roster update, and Dr. Ananya Sen notification');

  // =========================================================================
  // SCENARIO B: Student registers for SCI204-B -> Prof. Rajesh Iyer notified ONLY
  // =========================================================================
  const sciReg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Meera Nair Test',
      email: sciStudentEmail,
      password: 'Password123!',
      role: 'student',
      institution: 'National Science University',
      classId: sciClass.id,
    },
  });
  assert.equal(sciReg.status, 201, `SCI204-B registration failed: ${JSON.stringify(sciReg.data)}`);
  assert.equal(sciReg.data.enrollment.classCode, 'SCI204-B');
  assert.equal(sciReg.data.enrollment.facultyName, 'Prof. Rajesh Iyer');
  const sciStudentToken: string = sciReg.data.token;
  const sciStudentId: string = sciReg.data.user.id;
  createdStudentIds.push(sciStudentId);

  const rajeshRoster = await api(`/api/teacher/classes/${sciClass.id}/students`, { token: rajesh.token });
  assert.equal(rajeshRoster.status, 200);
  assert.ok(
    rajeshRoster.data.students.some((s: any) => s.id === sciStudentId),
    'Prof. Rajesh Iyer SCI204-B roster must include Meera Nair Test'
  );

  const rajeshDashAfter = await api('/api/teacher/dashboard-summary', { token: rajesh.token });
  assert.equal(
    rajeshDashAfter.data.summary.totalAssignedStudents,
    rajeshBaselineCount + 1,
    'Prof. Rajesh Iyer totalAssignedStudents must increment by 1'
  );

  const rajeshNotifs = await api('/api/teacher/notifications', { token: rajesh.token });
  const meeraNotif = rajeshNotifs.data.notifications.find(
    (n: any) => n.type === 'student_enrolled' && n.metadata?.studentId === sciStudentId
  );
  assert.ok(meeraNotif, 'Prof. Rajesh Iyer must receive persistent notification for Meera Nair Test');
  assert.ok(meeraNotif.message.includes('Meera Nair Test') && meeraNotif.message.includes('SCI204-B'));

  // Confirm Dr. Ananya Sen did NOT receive Meera's notification
  const ananyaNotifsCheckB = await api('/api/teacher/notifications', { token: ananya.token });
  assert.equal(
    ananyaNotifsCheckB.data.notifications.some((n: any) => n.metadata?.studentId === sciStudentId),
    false,
    'Dr. Ananya Sen must NOT receive SCI204-B enrollment notification'
  );
  console.log('✓ Scenario B passed: SCI204-B auto-enrollment and Prof. Rajesh Iyer exclusive notification');

  // =========================================================================
  // CLASS-SCOPED LAB ASSIGNMENT PROPAGATION CHECK (User core requirement!)
  // =========================================================================
  const dueDateIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Dr. Ananya Sen assigns a new lab to PHY101-A
  const phyNewAsgTitle = `PHY101-A Optics Lab ${suffix}`;
  const phyNewAsgRes = await api('/api/teacher/assignments', {
    method: 'POST',
    token: ananya.token,
    body: {
      classId: phyClass.id,
      experimentId: 'exp-convex-lens',
      title: phyNewAsgTitle,
      dueDate: dueDateIso,
      totalMarks: 100,
      attemptsAllowed: 3,
      weightTowardsInternal: 20,
    },
  });
  assert.equal(phyNewAsgRes.status, 201, `Creating PHY101-A assignment failed: ${JSON.stringify(phyNewAsgRes.data)}`);
  const phyNewAsgId = phyNewAsgRes.data.assignment.id;
  createdAssignmentIds.push(phyNewAsgId);

  // Prof. Rajesh Iyer assigns a new lab to SCI204-B
  const sciNewAsgTitle = `SCI204-B Photoelectric Lab ${suffix}`;
  const sciNewAsgRes = await api('/api/teacher/assignments', {
    method: 'POST',
    token: rajesh.token,
    body: {
      classId: sciClass.id,
      experimentId: 'exp-photoelectric',
      title: sciNewAsgTitle,
      dueDate: dueDateIso,
      totalMarks: 100,
      attemptsAllowed: 3,
      weightTowardsInternal: 20,
    },
  });
  assert.equal(sciNewAsgRes.status, 201, `Creating SCI204-B assignment failed: ${JSON.stringify(sciNewAsgRes.data)}`);
  const sciNewAsgId = sciNewAsgRes.data.assignment.id;
  createdAssignmentIds.push(sciNewAsgId);

  // Verify NEW PHY101-A student IMMEDIATELY sees PHY101-A lab and NOT SCI204-B lab
  const phyStudentAsgsAfter = await api('/api/student/assignments', { token: phyStudentToken });
  assert.ok(
    phyStudentAsgsAfter.data.assignments.some((a: any) => a.id === phyNewAsgId && a.classCode === 'PHY101-A'),
    'Newly registered PHY101-A student MUST see newly assigned PHY101-A lab'
  );
  assert.equal(
    phyStudentAsgsAfter.data.assignments.some((a: any) => a.id === sciNewAsgId),
    false,
    'PHY101-A student must NOT see SCI204-B assigned lab'
  );

  // Verify NEW SCI204-B student IMMEDIATELY sees SCI204-B lab and NOT PHY101-A lab
  const sciStudentAsgsAfter = await api('/api/student/assignments', { token: sciStudentToken });
  assert.ok(
    sciStudentAsgsAfter.data.assignments.some((a: any) => a.id === sciNewAsgId && a.classCode === 'SCI204-B'),
    'Newly registered SCI204-B student MUST see newly assigned SCI204-B lab'
  );
  assert.equal(
    sciStudentAsgsAfter.data.assignments.some((a: any) => a.id === phyNewAsgId),
    false,
    'SCI204-B student must NOT see PHY101-A assigned lab'
  );
  console.log('✓ Lab assignment propagation verified: all newly enrolled students see ONLY their class assignments immediately');

  // =========================================================================
  // SCENARIO C: Duplicate Enrollment Prevention + RBAC on POST /api/enrollments
  // =========================================================================
  const studentEnrollAttempt = await api('/api/enrollments', {
    method: 'POST',
    token: phyStudentToken,
    body: { studentId: phyStudentId, classId: sciClass.id },
  });
  assert.equal(studentEnrollAttempt.status, 403, 'Students must not be allowed to call POST /api/enrollments');

  const duplicateAdminAttempt = await api('/api/enrollments', {
    method: 'POST',
    token: admin.token,
    body: { studentId: phyStudentId, classId: phyClass.id },
  });
  assert.equal(duplicateAdminAttempt.status, 409, 'Duplicate student-class enrollment must return HTTP 409');
  assert.equal(duplicateAdminAttempt.data.code, 'DUPLICATE_ENROLLMENT');
  console.log('✓ Scenario C passed: Duplicate enrollment blocked (409) & RBAC enforced (403)');

  // =========================================================================
  // SCENARIO D: Strict Faculty & Student Isolation + Notification Ownership
  // =========================================================================
  const ananyaAccessSciRoster = await api(`/api/teacher/classes/${sciClass.id}/students`, {
    token: ananya.token,
  });
  assert.equal(ananyaAccessSciRoster.status, 403, 'Dr. Ananya Sen must get 403 on SCI204-B roster');

  const ananyaAccessMeeraReport = await api(`/api/teacher/students/${sciStudentId}/report`, {
    token: ananya.token,
  });
  assert.equal(ananyaAccessMeeraReport.status, 403, 'Dr. Ananya Sen must get 403 on SCI204-B-only student report');

  const ananyaReadRajeshNotif = await api(`/api/teacher/notifications/${meeraNotif.id}/read`, {
    method: 'PATCH',
    token: ananya.token,
  });
  assert.equal(ananyaReadRajeshNotif.status, 403, 'Dr. Ananya Sen must get 403 trying to mark Prof. Rajesh notification read');

  // Dr. Ananya Sen CAN mark her own notification read
  const ananyaReadOwnNotif = await api(`/api/teacher/notifications/${rahulNotif.id}/read`, {
    method: 'PATCH',
    token: ananya.token,
  });
  assert.equal(ananyaReadOwnNotif.status, 200);
  assert.equal(ananyaReadOwnNotif.data.notification.isRead, true);

  // Student class isolation
  const phyStudentAccessSciClass = await api(`/api/student/classes/${sciClass.id}`, {
    token: phyStudentToken,
  });
  assert.equal(phyStudentAccessSciClass.status, 403, 'PHY101-A student must get 403 on SCI204-B class details');

  const phyStudentFilterSciAsgs = await api(`/api/student/assignments?classId=${sciClass.id}`, {
    token: phyStudentToken,
  });
  assert.equal(phyStudentFilterSciAsgs.status, 403, 'PHY101-A student must get 403 querying SCI204-B assignments');

  // Non-admin faculty assignment guard
  const teacherAssignFaculty = await api(`/api/admin/classes/${phyClass.id}/faculty`, {
    method: 'PATCH',
    token: ananya.token,
    body: { teacherId: rajesh.user.id },
  });
  assert.equal(teacherAssignFaculty.status, 403, 'Non-admin cannot reassign class faculty');
  console.log('✓ Scenario D passed: Faculty isolation, student class isolation, and notification ownership enforced');

  // =========================================================================
  // SCENARIO E: Missing Faculty Assignment -> 422 + Full Rollback + Admin Alert
  // =========================================================================
  // Use database connection only via server? Let's test via an unassigned class created if TEST_UNASSIGNED_CLASS_ID is passed
  if (process.env.TEST_UNASSIGNED_CLASS_ID) {
    const unassignedEmail = `orphan.check.${suffix}@test.simlab.edu`;
    const unassignedReg = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Orphan Rollback Check',
        email: unassignedEmail,
        password: 'Password123!',
        role: 'student',
        classId: process.env.TEST_UNASSIGNED_CLASS_ID,
      },
    });
    assert.equal(unassignedReg.status, 422, `Expected 422 for unassigned faculty class, got ${unassignedReg.status}`);
    assert.equal(unassignedReg.data.code, 'UNASSIGNED_FACULTY');

    // Verify login fails (meaning user creation was completely rolled back!)
    const orphanLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: unassignedEmail, password: 'Password123!' },
    });
    assert.equal(orphanLogin.status, 401, 'Rolled-back student account must NOT exist in DB');

    // Verify Admin received a persistent missing_faculty_assignment alert
    const adminNotifs = await api('/api/admin/notifications', { token: admin.token });
    assert.equal(adminNotifs.status, 200);
    const missingAlert = adminNotifs.data.notifications.find(
      (n: any) =>
        n.type === 'missing_faculty_assignment' &&
        n.metadata?.studentEmail === unassignedEmail
    );
    assert.ok(missingAlert, 'Admin must receive persistent missing_faculty_assignment alert');
    console.log('✓ Scenario E passed: Missing faculty returns 422, rolls back user atomically, and alerts Admin');
  }

  console.log('\nTEST_CLEANUP_IDS=' + JSON.stringify({ createdStudentIds, createdAssignmentIds }));
  console.log('=== ALL CORE INTEGRATION SCENARIOS PASSED ===\n');
}

async function runPersistenceSetup() {
  const email = process.env.PERSIST_EMAIL || 'persist.student@test.simlab.edu';
  const availRes = await api('/api/classes/available');
  const phyClass = availRes.data.classes.find((c: any) => c.code === 'PHY101-A');
  assert.ok(phyClass, 'PHY101-A must exist');

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Persistence Verification Student',
      email,
      password: 'Password123!',
      role: 'student',
      classId: phyClass.id,
    },
  });
  assert.equal(reg.status, 201, `Persistence setup registration failed: ${JSON.stringify(reg.data)}`);
  console.log('PERSIST_STUDENT_ID=' + reg.data.user.id);
  console.log('✓ Persistence setup created student + enrollment + notification for PHY101-A');
}

async function runPersistenceVerify() {
  const email = process.env.PERSIST_EMAIL || 'persist.student@test.simlab.edu';
  const student = await login(email, 'Password123!');
  const ananya = await login('dr.ananya.sen@university.edu', 'password123');

  const studentClasses = await api('/api/student/classes', { token: student.token });
  assert.equal(studentClasses.status, 200);
  assert.equal(studentClasses.data.classes[0]?.code, 'PHY101-A', 'Student enrollment must survive server restart');
  assert.equal(studentClasses.data.classes[0]?.facultyName, 'Dr. Ananya Sen');

  const studentAsgs = await api('/api/student/assignments', { token: student.token });
  assert.equal(studentAsgs.status, 200);
  assert.ok(studentAsgs.data.assignments.length >= 1, 'Assigned PHY101-A labs must survive server restart');

  const ananyaRoster = await api('/api/teacher/classes/cls-1/students', { token: ananya.token });
  assert.ok(
    ananyaRoster.data.students.some((s: any) => s.id === student.user.id),
    'Faculty roster entry must survive server restart'
  );

  const ananyaNotifs = await api('/api/teacher/notifications', { token: ananya.token });
  assert.ok(
    ananyaNotifs.data.notifications.some(
      (n: any) => n.type === 'student_enrolled' && n.metadata?.studentId === student.user.id
    ),
    'Faculty enrollment notification must survive server restart'
  );

  console.log('✓ Scenario F passed: Enrollment, faculty roster, notification, and assigned labs persisted across server restart!');
}

async function main() {
  const mode = process.argv[2] || 'core';
  if (mode === 'persist-setup') {
    await runPersistenceSetup();
  } else if (mode === 'persist-verify') {
    await runPersistenceVerify();
  } else {
    await runCoreScenarios();
  }
}

main().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
