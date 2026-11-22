import crypto from "crypto";
import type { PoolClient } from "pg";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, pool } from "../db/index.ts";
import {
  authEvents,
  classEnrollments,
  classes,
  notifications,
  users,
} from "../db/schema.ts";
import {
  buildFacultyEnrollmentNotification,
  buildMissingFacultyAdminNotification,
  normalizeClassSelector,
} from "./enrollmentEngine.ts";

export interface AvailableClassDTO {
  id: string;
  code: string;
  name: string;
  department: string;
  semester: string;
  academicYear: string;
  studentCount: number;
  hasAssignedFaculty: boolean;
  facultyName: string | null;
}

export interface EnrollmentOutcome {
  enrollmentId: string;
  studentId: string;
  classId: string;
  classCode: string;
  className: string;
  facultyId: string;
  facultyName: string;
  enrollmentStatus: string;
  enrolledAt: string;
  notificationId: string;
}

/**
 * Dynamically retrieves enrollable classes from PostgreSQL along with their active
 * assigned faculty display name and live enrolled student count.
 * Never exposes private faculty emails or internal credentials on this public endpoint.
 */
export async function listAvailableClassesForRegistration(): Promise<AvailableClassDTO[]> {
  const rows = await db
    .select({
      id: classes.id,
      code: classes.code,
      name: classes.name,
      department: classes.department,
      semester: classes.semester,
      academicYear: classes.academicYear,
      teacherId: classes.teacherId,
      teacherName: users.name,
      teacherRole: users.role,
      teacherStatus: users.status,
      studentCount: sql<number>`(SELECT COUNT(*)::int FROM class_enrollments ce WHERE ce.class_id = "classes"."id" AND ce.enrollment_status = 'active')`,
    })
    .from(classes)
    .leftJoin(users, eq(users.id, classes.teacherId))
    .orderBy(classes.code, classes.name);

  return rows.map((r) => {
    const hasAssignedFaculty = Boolean(
      r.teacherId && r.teacherRole === "teacher" && r.teacherStatus === "ACTIVE"
    );
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      department: r.department,
      semester: r.semester,
      academicYear: r.academicYear,
      studentCount: Number(r.studentCount) || 0,
      hasAssignedFaculty,
      facultyName: hasAssignedFaculty ? r.teacherName || null : null,
    };
  });
}

/**
 * Emits persistent admin notifications outside of a rolled-back student enrollment
 * transaction so administrators are alerted whenever a class lacks an assigned faculty member.
 */
async function notifyAdminsOfMissingFaculty(params: {
  studentName: string;
  studentEmail: string;
  classId: string;
  classCode: string;
  className: string;
}): Promise<void> {
  try {
    const adminUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.status, "ACTIVE")));

    if (adminUsers.length === 0) return;

    const draft = buildMissingFacultyAdminNotification(params);
    await db.insert(notifications).values(
      adminUsers.map((admin) => ({
        id: `notif-${crypto.randomUUID().slice(0, 16)}`,
        recipientUserId: admin.id,
        recipientRole: "admin",
        type: draft.type,
        title: draft.title,
        message: draft.message,
        metadata: draft.metadata,
        isRead: false,
      }))
    );
  } catch (err) {
    console.error("[EnrollmentService] Failed to record admin missing-faculty alert:", err);
  }
}

/**
 * Transaction-participating enrollment helper used during atomic student registration.
 * Runs on the caller's active PostgreSQL PoolClient transaction (`BEGIN ... COMMIT`).
 *
 * Guarantees:
 * - Dynamic lookup by class ID or class code (zero hardcoded class/faculty IDs)
 * - Explicit rejection + admin alert if class has no active assigned faculty (never assigns arbitrary faculty)
 * - Duplicate enrollment prevention
 * - Atomic insertion into `class_enrollments` AND persistent faculty `notifications`
 */
export async function enrollStudentInClassWithinTransaction(
  client: PoolClient,
  params: {
    student: {
      id: string;
      name: string;
      email: string;
      enrollmentCode?: string | null;
    };
    classIdOrCode: string;
  }
): Promise<EnrollmentOutcome> {
  const selector = normalizeClassSelector(params.classIdOrCode);
  if (!selector) {
    throw new Error("INVALID_CLASS: Please select a valid class cohort to enroll in.");
  }

  // 1. Dynamically resolve the target class and its currently assigned faculty member
  const classRes = await client.query(
    `SELECT
       c.id AS class_id,
       c.code AS class_code,
       c.name AS class_name,
       c.teacher_id AS teacher_id,
       u.name AS teacher_name,
       u.role AS teacher_role,
       u.status AS teacher_status
     FROM classes c
     LEFT JOIN users u ON u.id = c.teacher_id
     WHERE c.id = $1 OR LOWER(c.code) = LOWER($1)
     LIMIT 1;`,
    [selector]
  );

  if (classRes.rows.length === 0) {
    throw new Error(
      `INVALID_CLASS: Selected class '${selector}' does not exist. Please choose an active class.`
    );
  }

  const cls = classRes.rows[0];

  // 2. Verify active assigned faculty member exists (never silently assign arbitrary faculty)
  const hasValidFaculty = Boolean(
    cls.teacher_id && cls.teacher_role === "teacher" && cls.teacher_status === "ACTIVE"
  );

  if (!hasValidFaculty) {
    // Alert administrators on a separate connection so the alert persists even after caller ROLLBACK
    await notifyAdminsOfMissingFaculty({
      studentName: params.student.name,
      studentEmail: params.student.email,
      classId: cls.class_id,
      classCode: cls.class_code,
      className: cls.class_name,
    });

    throw new Error(
      `UNASSIGNED_FACULTY: Class ${cls.class_code} does not currently have an assigned faculty member. An administrator has been notified to assign faculty before enrollment.`
    );
  }

  // 3. Enforce duplicate enrollment protection
  const dupRes = await client.query(
    `SELECT id, enrollment_status
     FROM class_enrollments
     WHERE student_id = $1 AND class_id = $2
     LIMIT 1;`,
    [params.student.id, cls.class_id]
  );

  if (dupRes.rows.length > 0) {
    throw new Error(
      `DUPLICATE_ENROLLMENT: Student is already enrolled in class ${cls.class_code}.`
    );
  }

  // 4. Insert canonical relational enrollment record
  const enrollmentId = `enr-${crypto.randomUUID().slice(0, 16)}`;
  const enrolledAt = new Date();

  await client.query(
    `INSERT INTO class_enrollments (id, student_id, class_id, enrollment_status, enrolled_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', $4, $4, $4);`,
    [enrollmentId, params.student.id, cls.class_id, enrolledAt]
  );

  // 5. Insert persistent in-app notification for ONLY the assigned faculty member
  const notificationId = `notif-${crypto.randomUUID().slice(0, 16)}`;
  const draft = buildFacultyEnrollmentNotification({
    enrollmentId,
    studentId: params.student.id,
    studentName: params.student.name,
    studentEmail: params.student.email,
    studentEnrollmentCode: params.student.enrollmentCode ?? null,
    classId: cls.class_id,
    classCode: cls.class_code,
    className: cls.class_name,
    enrolledAt,
  });

  await client.query(
    `INSERT INTO notifications (id, recipient_user_id, recipient_role, type, title, message, metadata, is_read, created_at)
     VALUES ($1, $2, 'teacher', $3, $4, $5, $6::jsonb, FALSE, $7);`,
    [
      notificationId,
      cls.teacher_id,
      draft.type,
      draft.title,
      draft.message,
      JSON.stringify(draft.metadata),
      enrolledAt,
    ]
  );

  return {
    enrollmentId,
    studentId: params.student.id,
    classId: cls.class_id,
    classCode: cls.class_code,
    className: cls.class_name,
    facultyId: cls.teacher_id,
    facultyName: cls.teacher_name,
    enrollmentStatus: "active",
    enrolledAt: enrolledAt.toISOString(),
    notificationId,
  };
}

/**
 * Enrolls an existing student into a class inside a single atomic PostgreSQL transaction.
 * Strictly restricted to administrators (students cannot self-enroll into arbitrary classes
 * or mutate enrollment records directly).
 */
export async function enrollExistingStudentByAdmin(
  adminUser: { id: string; role: string },
  params: { studentId: string; classIdOrCode: string }
): Promise<EnrollmentOutcome> {
  if (adminUser.role !== "admin") {
    throw new Error(
      "FORBIDDEN: Only administrators may directly enroll existing students or modify class enrollments."
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    const studentRes = await client.query(
      `SELECT id, name, email, role, status, enrollment_code
       FROM users
       WHERE id = $1
       LIMIT 1;`,
      [params.studentId]
    );

    if (studentRes.rows.length === 0) {
      throw new Error("NOT_FOUND: Student account not found.");
    }

    const stu = studentRes.rows[0];
    if (stu.role !== "student") {
      throw new Error("BAD_REQUEST: Only student accounts can be enrolled in classes.");
    }

    const outcome = await enrollStudentInClassWithinTransaction(client, {
      student: {
        id: stu.id,
        name: stu.name,
        email: stu.email,
        enrollmentCode: stu.enrollment_code,
      },
      classIdOrCode: params.classIdOrCode,
    });

    await client.query(
      `INSERT INTO auth_events (id, user_id, event_type, success, metadata, created_at)
       VALUES ($1, $2, 'ADMIN_STUDENT_ENROLLED', TRUE, $3::jsonb, NOW());`,
      [
        `evt-${crypto.randomUUID()}`,
        adminUser.id,
        JSON.stringify({
          studentId: outcome.studentId,
          classId: outcome.classId,
          classCode: outcome.classCode,
          enrollmentId: outcome.enrollmentId,
          facultyId: outcome.facultyId,
        }),
      ]
    );

    await client.query("COMMIT;");
    return outcome;
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin-only faculty-to-class assignment update with audit logging.
 */
export async function assignFacultyToClassByAdmin(
  adminUser: { id: string; role: string },
  classId: string,
  teacherId: string | null
) {
  if (adminUser.role !== "admin") {
    throw new Error("FORBIDDEN: Only administrators can modify faculty-class assignments.");
  }

  return await db.transaction(async (tx) => {
    const classRows = await tx
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (classRows.length === 0) {
      throw new Error("NOT_FOUND: Class not found.");
    }

    let resolvedTeacherName: string | null = null;
    if (teacherId !== null) {
      const teacherRows = await tx
        .select({ id: users.id, name: users.name, role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, teacherId))
        .limit(1);

      if (teacherRows.length === 0) {
        throw new Error("NOT_FOUND: Selected faculty member not found.");
      }
      if (teacherRows[0].role !== "teacher") {
        throw new Error("BAD_REQUEST: Assigned user must have the teacher/faculty role.");
      }
      if (teacherRows[0].status !== "ACTIVE") {
        throw new Error("BAD_REQUEST: Assigned faculty member account is not active.");
      }
      resolvedTeacherName = teacherRows[0].name;
    }

    const [updated] = await tx
      .update(classes)
      .set({ teacherId, updatedAt: new Date() })
      .where(eq(classes.id, classId))
      .returning();

    await tx.insert(authEvents).values({
      id: `evt-${crypto.randomUUID()}`,
      userId: adminUser.id,
      eventType: "CLASS_FACULTY_UPDATED",
      success: true,
      metadata: {
        classId: updated.id,
        classCode: updated.code,
        previousTeacherId: classRows[0].teacherId,
        newTeacherId: teacherId,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      teacherId: updated.teacherId,
      facultyName: resolvedTeacherName,
    };
  });
}

/**
 * Admin view of all classes with their assigned faculty and live active enrollment count.
 */
export async function listClassesForAdmin() {
  const rows = await db
    .select({
      id: classes.id,
      code: classes.code,
      name: classes.name,
      department: classes.department,
      semester: classes.semester,
      academicYear: classes.academicYear,
      teacherId: classes.teacherId,
      facultyName: users.name,
      facultyEmail: users.email,
      studentCount: sql<number>`(SELECT COUNT(*)::int FROM class_enrollments ce WHERE ce.class_id = "classes"."id" AND ce.enrollment_status = 'active')`,
    })
    .from(classes)
    .leftJoin(users, eq(users.id, classes.teacherId))
    .orderBy(classes.code, desc(classes.createdAt));

  return rows.map((r) => ({
    ...r,
    studentCount: Number(r.studentCount) || 0,
  }));
}
