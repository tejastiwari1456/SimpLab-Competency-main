import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  assignments,
  classEnrollments,
  notificationReads,
  notifications as notificationsTable,
  submissions,
  vivaSessions,
  type NotificationMetadataJson,
} from "../db/schema.ts";
import { getExperimentById } from "./experimentCatalog.ts";

export type StudentNotificationType =
  | "deadline"
  | "assignment"
  | "evaluation"
  | "viva_report";

export type StudentNotificationSeverity = "urgent" | "info" | "success" | "warning";

export interface StudentNotificationDTO {
  id: string; // deterministic notification_key
  type: StudentNotificationType;
  severity: StudentNotificationSeverity;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actionPath: string;
  experimentId?: string | null;
  assignmentId?: string | null;
  submissionId?: string | null;
  vivaSessionId?: string | null;
}

/**
 * Generates live, student-scoped notifications directly from PostgreSQL assignments,
 * deadlines, faculty evaluations, and AI Viva reports, joined with persistent read states.
 */
export async function getStudentNotifications(
  studentId: string
): Promise<{ notifications: StudentNotificationDTO[]; unreadCount: number }> {
  try {
    const now = new Date();

    const [assignedRows, studentSubmissions, completedVivas, readRows] = await Promise.all([
      db
        .select({
          id: assignments.id,
          title: assignments.title,
          experimentId: assignments.experimentId,
          dueDate: assignments.dueDate,
          attemptsAllowed: assignments.attemptsAllowed,
          createdAt: assignments.createdAt,
          attemptsUsed: sql<number>`count(${submissions.id})::int`,
        })
        .from(assignments)
        .innerJoin(classEnrollments, eq(classEnrollments.classId, assignments.classId))
        .leftJoin(
          submissions,
          and(
            eq(submissions.assignmentId, assignments.id),
            eq(submissions.studentId, classEnrollments.studentId)
          )
        )
        .where(
          and(
            eq(classEnrollments.studentId, studentId),
            eq(classEnrollments.enrollmentStatus, "active"),
            eq(assignments.status, "active")
          )
        )
        .groupBy(assignments.id)
        .orderBy(assignments.dueDate),
      db
        .select()
        .from(submissions)
        .where(eq(submissions.studentId, studentId))
        .orderBy(desc(submissions.evaluatedAt), desc(submissions.submittedAt))
        .limit(20),
      db
        .select()
        .from(vivaSessions)
        .where(
          and(
            eq(vivaSessions.studentId, studentId),
            eq(vivaSessions.status, "completed")
          )
        )
        .orderBy(desc(vivaSessions.completedAt), desc(vivaSessions.startedAt))
        .limit(10),
      db
        .select({ notificationKey: notificationReads.notificationKey })
        .from(notificationReads)
        .where(eq(notificationReads.userId, studentId)),
    ]);

    const readKeys = new Set(readRows.map((r) => r.notificationKey));
    const notifications: StudentNotificationDTO[] = [];

    // 1. Assignment & Deadline Alerts
    for (const asg of assignedRows) {
      const exp = getExperimentById(asg.experimentId);
      const expName = exp?.title || asg.experimentId;
      const daysUntilDue = Math.ceil(
        (asg.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (asg.attemptsUsed === 0) {
        if (daysUntilDue <= 0) {
          const key = `deadline-overdue:${asg.id}`;
          notifications.push({
            id: key,
            type: "deadline",
            severity: "urgent",
            title: `Overdue Lab: ${asg.title}`,
            message: `${expName} passed its deadline on ${asg.dueDate.toLocaleDateString()}. Submit your lab attempt promptly.`,
            createdAt: asg.dueDate.toISOString(),
            isRead: readKeys.has(key),
            actionPath: "/student/experiments",
            experimentId: asg.experimentId,
            assignmentId: asg.id,
          });
        } else if (daysUntilDue <= 7) {
          const key = `deadline-soon:${asg.id}`;
          notifications.push({
            id: key,
            type: "deadline",
            severity: "warning",
            title: `Upcoming Deadline (${daysUntilDue}d left): ${asg.title}`,
            message: `${expName} is due on ${asg.dueDate.toLocaleDateString()}. You have ${asg.attemptsAllowed} attempt(s) available.`,
            createdAt: asg.createdAt.toISOString(),
            isRead: readKeys.has(key),
            actionPath: "/student/experiments",
            experimentId: asg.experimentId,
            assignmentId: asg.id,
          });
        } else {
          const key = `assignment-active:${asg.id}`;
          notifications.push({
            id: key,
            type: "assignment",
            severity: "info",
            title: `Assigned Lab: ${asg.title}`,
            message: `${expName} is open for completion before ${asg.dueDate.toLocaleDateString()}.`,
            createdAt: asg.createdAt.toISOString(),
            isRead: readKeys.has(key),
            actionPath: "/student/assignments",
            experimentId: asg.experimentId,
            assignmentId: asg.id,
          });
        }
      }
    }

    // 2. Faculty Evaluation & Revision Notifications
    for (const sub of studentSubmissions) {
      const exp = getExperimentById(sub.experimentId);
      const expName = exp?.title || sub.experimentId;
      const effectiveScore =
        sub.facultyScore !== null ? Number(sub.facultyScore) : Number(sub.totalScore);
      const maxScore = Number(sub.maxScore) || 100;

      if (sub.evaluationStatus === "needs_revision") {
        const key = `eval-revision:${sub.id}`;
        notifications.push({
          id: key,
          type: "evaluation",
          severity: "warning",
          title: `Revision Requested: ${expName}`,
          message:
            sub.instructorFeedback?.trim() ||
            `Your instructor requested a revision on attempt #${sub.attemptNumber}. Review feedback and re-submit.`,
          createdAt: (sub.evaluatedAt || sub.submittedAt).toISOString(),
          isRead: readKeys.has(key),
          actionPath: "/student/progress",
          experimentId: sub.experimentId,
          assignmentId: sub.assignmentId,
          submissionId: sub.id,
        });
      } else if (
        sub.evaluationStatus === "faculty_reviewed" ||
        (sub.instructorFeedback && sub.instructorFeedback.trim().length > 0)
      ) {
        const key = `eval-reviewed:${sub.id}`;
        notifications.push({
          id: key,
          type: "evaluation",
          severity: "success",
          title: `Faculty Evaluation Posted: ${expName}`,
          message: `Verified score: ${effectiveScore}/${maxScore}.${
            sub.instructorFeedback ? ` "${sub.instructorFeedback.slice(0, 110)}"` : ""
          }`,
          createdAt: (sub.evaluatedAt || sub.submittedAt).toISOString(),
          isRead: readKeys.has(key),
          actionPath: "/student/progress",
          experimentId: sub.experimentId,
          assignmentId: sub.assignmentId,
          submissionId: sub.id,
        });
      }
    }

    // 3. Completed AI Viva Assessment Reports (most recent 3)
    for (const viva of completedVivas.slice(0, 3)) {
      const exp = getExperimentById(viva.experimentId);
      const expName = exp?.title || viva.experimentId;
      const key = `viva-report:${viva.id}`;
      notifications.push({
        id: key,
        type: "viva_report",
        severity: "info",
        title: `AI Viva Report Ready: ${expName}`,
        message: `Attempt #${viva.attemptNumber} evaluated at ${Math.round(
          Number(viva.overallScore)
        )}% across ${viva.answeredCount} response(s).`,
        createdAt: (viva.completedAt || viva.startedAt).toISOString(),
        isRead: readKeys.has(key),
        actionPath: "/student/competencies",
        experimentId: viva.experimentId,
        assignmentId: viva.assignmentId,
        vivaSessionId: viva.id,
      });
    }

    // Sort: unread urgent/warning first, then newest timestamp
    const severityOrder: Record<StudentNotificationSeverity, number> = {
      urgent: 0,
      warning: 1,
      success: 2,
      info: 3,
    };
    notifications.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return { notifications, unreadCount };
  } catch (error) {
    console.error("[NotificationService] Failed loading student notifications:", error);
    throw new Error("Failed to retrieve student notifications.", { cause: error });
  }
}

export async function markNotificationRead(
  studentId: string,
  notificationKey: string
): Promise<void> {
  const cleanKey = (notificationKey || "").trim();
  if (!cleanKey || cleanKey.length > 160) {
    throw new Error("BAD_REQUEST: Invalid notification key.");
  }

  try {
    await db
      .insert(notificationReads)
      .values({
        userId: studentId,
        notificationKey: cleanKey,
        readAt: new Date(),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[NotificationService] Failed marking notification read:", error);
    throw new Error("Failed to mark notification as read.", { cause: error });
  }
}

export async function markAllNotificationsRead(studentId: string): Promise<number> {
  try {
    const { notifications } = await getStudentNotifications(studentId);
    const unreadKeys = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadKeys.length === 0) return 0;

    await db.transaction(async (tx) => {
      for (const key of unreadKeys) {
        await tx
          .insert(notificationReads)
          .values({
            userId: studentId,
            notificationKey: key,
            readAt: new Date(),
          })
          .onConflictDoNothing();
      }
    });

    return unreadKeys.length;
  } catch (error) {
    console.error("[NotificationService] Failed marking all notifications read:", error);
    throw new Error("Failed to mark notifications as read.", { cause: error });
  }
}

export interface PersistentNotificationDTO {
  id: string;
  recipientUserId: string;
  recipientRole: string;
  type: string;
  title: string;
  message: string;
  metadata: NotificationMetadataJson;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Loads persistent PostgreSQL notifications strictly scoped to recipientUserId.
 */
export async function getPersistentNotificationsForUser(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<{ notifications: PersistentNotificationDTO[]; unreadCount: number }> {
  const limit = Math.max(1, Math.min(100, Number(options?.limit) || 50));

  const conditions = [eq(notificationsTable.recipientUserId, userId)];
  if (options?.unreadOnly) {
    conditions.push(eq(notificationsTable.isRead, false));
  }

  const [rows, unreadRes] = await Promise.all([
    db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.recipientUserId, userId),
          eq(notificationsTable.isRead, false)
        )
      ),
  ]);

  return {
    notifications: rows.map((r) => ({
      id: r.id,
      recipientUserId: r.recipientUserId,
      recipientRole: r.recipientRole,
      type: r.type,
      title: r.title,
      message: r.message,
      metadata: (r.metadata || {}) as NotificationMetadataJson,
      isRead: r.isRead,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    unreadCount: Number(unreadRes[0]?.count) || 0,
  };
}

/**
 * Marks a single persistent notification as read, enforcing strict recipient ownership.
 */
export async function markPersistentNotificationRead(
  userId: string,
  notificationId: string
): Promise<PersistentNotificationDTO> {
  const cleanId = (notificationId || "").trim();
  if (!cleanId) {
    throw new Error("BAD_REQUEST: Notification ID is required.");
  }

  const existing = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.id, cleanId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("NOT_FOUND: Notification not found.");
  }

  if (existing[0].recipientUserId !== userId) {
    throw new Error(
      "FORBIDDEN: You are not authorized to access or update this notification."
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true, readAt: existing[0].readAt || now })
    .where(
      and(
        eq(notificationsTable.id, cleanId),
        eq(notificationsTable.recipientUserId, userId)
      )
    )
    .returning();

  return {
    id: updated.id,
    recipientUserId: updated.recipientUserId,
    recipientRole: updated.recipientRole,
    type: updated.type,
    title: updated.title,
    message: updated.message,
    metadata: (updated.metadata || {}) as NotificationMetadataJson,
    isRead: updated.isRead,
    readAt: updated.readAt ? updated.readAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Marks all unread persistent notifications for the authenticated user as read.
 */
export async function markAllPersistentNotificationsRead(userId: string): Promise<number> {
  const now = new Date();
  const updated = await db
    .update(notificationsTable)
    .set({ isRead: true, readAt: now })
    .where(
      and(
        eq(notificationsTable.recipientUserId, userId),
        eq(notificationsTable.isRead, false)
      )
    )
    .returning({ id: notificationsTable.id });

  return updated.length;
}
