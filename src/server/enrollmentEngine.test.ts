import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFacultyEnrollmentNotification,
  buildMissingFacultyAdminNotification,
  formatRelativeEnrollmentTime,
  normalizeClassSelector,
  validateRegistrationClassSelection,
} from "./enrollmentEngine.ts";

describe("enrollmentEngine", () => {
  it("normalizes class selector strings safely", () => {
    assert.equal(normalizeClassSelector("  PHY101-A  "), "PHY101-A");
    assert.equal(normalizeClassSelector(null), "");
    assert.equal(normalizeClassSelector(undefined), "");
    assert.equal(normalizeClassSelector(123), "");
  });

  it("requires a class selection for students but allows teachers without one", () => {
    const missingStudent = validateRegistrationClassSelection("student", "   ");
    assert.equal(missingStudent.valid, false);
    assert.ok(missingStudent.error && missingStudent.error.includes("PHY101-A"));

    const validStudent = validateRegistrationClassSelection("student", "cls-1");
    assert.equal(validStudent.valid, true);
    assert.equal(validStudent.normalizedClassSelector, "cls-1");

    const validTeacher = validateRegistrationClassSelection("teacher", "");
    assert.equal(validTeacher.valid, true);
  });

  it("builds standardized faculty enrollment notification payload", () => {
    const enrolledAt = new Date("2026-11-22T10:00:00.000Z");
    const draft = buildFacultyEnrollmentNotification({
      enrollmentId: "enr-101",
      studentId: "usr-stu-99",
      studentName: "Rahul Sharma",
      studentEmail: "Rahul.Sharma@University.EDU",
      studentEnrollmentCode: "PHYS-2026-999",
      classId: "cls-1",
      classCode: "PHY101-A",
      className: "B.Tech Sem 1 — Engineering Physics & Optics Lab (Batch A)",
      enrolledAt,
    });

    assert.equal(draft.type, "student_enrolled");
    assert.equal(draft.title, "New Student Enrolled");
    assert.equal(
      draft.message,
      "A new student, Rahul Sharma, has joined your class PHY101-A."
    );
    assert.equal(draft.metadata.studentEmail, "rahul.sharma@university.edu");
    assert.equal(draft.metadata.classCode, "PHY101-A");
    assert.equal(draft.metadata.enrollmentId, "enr-101");
    assert.equal(draft.metadata.enrolledAt, "2026-11-22T10:00:00.000Z");
  });

  it("builds explicit administrator alert when a class has no assigned faculty", () => {
    const alert = buildMissingFacultyAdminNotification({
      studentName: "Meera Nair",
      studentEmail: "meera.nair@university.edu",
      classId: "cls-unassigned",
      classCode: "LAB999-X",
      className: "Experimental Photonics",
    });

    assert.equal(alert.type, "missing_faculty_assignment");
    assert.ok(alert.title.includes("LAB999-X"));
    assert.ok(alert.message.includes("no active faculty member is assigned"));
    assert.equal(alert.metadata.severity, "urgent");
    assert.equal(alert.metadata.classCode, "LAB999-X");
  });

  it("formats relative enrollment times accurately", () => {
    const ref = new Date("2026-11-22T12:00:00.000Z");
    assert.equal(
      formatRelativeEnrollmentTime("2026-11-22T11:59:40.000Z", ref),
      "Just enrolled"
    );
    assert.equal(
      formatRelativeEnrollmentTime("2026-11-22T11:45:00.000Z", ref),
      "15m ago"
    );
    assert.equal(
      formatRelativeEnrollmentTime("2026-11-22T09:00:00.000Z", ref),
      "3h ago"
    );
    assert.equal(
      formatRelativeEnrollmentTime("2026-11-21T10:00:00.000Z", ref),
      "Yesterday"
    );
  });
});
