import type { NotificationMetadataJson } from "../db/schema.ts";

export interface EnrollmentNotificationInput {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentEnrollmentCode?: string | null;
  classId: string;
  classCode: string;
  className: string;
  enrolledAt: Date;
}

export interface PersistentNotificationDraft {
  type: "student_enrolled" | "missing_faculty_assignment";
  title: string;
  message: string;
  metadata: NotificationMetadataJson;
}

/**
 * Normalizes a class ID or class code input from API/UI requests.
 */
export function normalizeClassSelector(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

/**
 * Validates that student registrations always specify a target class cohort.
 */
export function validateRegistrationClassSelection(
  role: string,
  classIdOrCode: unknown
): { valid: boolean; normalizedClassSelector: string; error?: string } {
  const normalized = normalizeClassSelector(classIdOrCode);
  if (role === "student" && normalized.length === 0) {
    return {
      valid: false,
      normalizedClassSelector: "",
      error: "Please select a class cohort (e.g., PHY101-A or SCI204-B) to enroll in.",
    };
  }
  return {
    valid: true,
    normalizedClassSelector: normalized,
  };
}

/**
 * Builds the standardized faculty notification payload when a student enrolls in a class.
 */
export function buildFacultyEnrollmentNotification(
  input: EnrollmentNotificationInput
): PersistentNotificationDraft {
  const cleanName = input.studentName.trim() || "New Student";
  const cleanCode = input.classCode.trim();
  const enrolledIso = input.enrolledAt.toISOString();

  return {
    type: "student_enrolled",
    title: "New Student Enrolled",
    message: `A new student, ${cleanName}, has joined your class ${cleanCode}.`,
    metadata: {
      enrollmentId: input.enrollmentId,
      studentId: input.studentId,
      studentName: cleanName,
      studentEmail: input.studentEmail.trim().toLowerCase(),
      studentEnrollmentCode: input.studentEnrollmentCode || null,
      classId: input.classId,
      classCode: cleanCode,
      className: input.className.trim(),
      enrolledAt: enrolledIso,
      actionPath: "/teacher/classes",
      severity: "info",
    },
  };
}

/**
 * Builds an explicit administrator alert payload when a student attempts to enroll
 * into a class that does not currently have an active assigned faculty member.
 */
export function buildMissingFacultyAdminNotification(input: {
  studentName: string;
  studentEmail: string;
  classId: string;
  classCode: string;
  className: string;
}): PersistentNotificationDraft {
  const cleanName = input.studentName.trim() || "A prospective student";
  const cleanCode = input.classCode.trim();

  return {
    type: "missing_faculty_assignment",
    title: `Faculty Assignment Required (${cleanCode})`,
    message: `Enrollment attempt by ${cleanName} (${input.studentEmail}) for class ${cleanCode} was blocked because no active faculty member is assigned to this class.`,
    metadata: {
      studentName: cleanName,
      studentEmail: input.studentEmail.trim().toLowerCase(),
      classId: input.classId,
      classCode: cleanCode,
      className: input.className.trim(),
      actionPath: "/admin/institutions",
      severity: "urgent",
    },
  };
}

/**
 * Formats an enrollment timestamp into a concise relative label for dashboards.
 */
export function formatRelativeEnrollmentTime(
  enrolledIso: string,
  referenceDate: Date = new Date()
): string {
  const parsed = new Date(enrolledIso);
  if (Number.isNaN(parsed.getTime())) return "Recently enrolled";

  const diffMs = Math.max(0, referenceDate.getTime() - parsed.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just enrolled";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
