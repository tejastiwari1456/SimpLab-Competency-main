import React, { useState, useEffect, useCallback } from 'react';
import {
  CurrentUser,
  ClassCourse,
  Assignment,
  StudentSubmission,
  Experiment,
  SubmissionEvaluationStatus,
  FacultyNotification,
} from '../../types';
import { AppShell } from '../navigation/AppShell';
import { TeacherOverviewView } from './TeacherOverviewView';
import { TeacherClassesView } from './TeacherClassesView';
import { TeacherAssignmentsView } from './TeacherAssignmentsView';
import { TeacherExperimentsView } from './TeacherExperimentsView';
import { TeacherAnalyticsView } from './TeacherAnalyticsView';
import { TeacherReviewView } from './TeacherReviewView';
import { TeacherReportsView } from './TeacherReportsView';
import { TeacherProfileView } from './TeacherProfileView';
import { AlertCircle } from 'lucide-react';

interface TeacherLayoutProps {
  currentUser: CurrentUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  token: string | null;
  classes: ClassCourse[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  experiments: Experiment[];
  dataError?: string;
  onCreateAssignment: (
    assignment: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>
  ) => Promise<void>;
  onToggleAssignmentStatus: (
    assignmentId: string,
    status: 'active' | 'archived'
  ) => Promise<void>;
  onEvaluateSubmission: (
    submissionId: string,
    evaluation: {
      evaluationStatus: SubmissionEvaluationStatus;
      instructorFeedback?: string;
      facultyScore?: number | null;
    }
  ) => Promise<StudentSubmission>;
}

export const TeacherLayout: React.FC<TeacherLayoutProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
  token,
  classes,
  assignments,
  submissions,
  experiments,
  dataError,
  onCreateAssignment,
  onToggleAssignmentStatus,
  onEvaluateSubmission,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [preselectedExpId, setPreselectedExpId] = useState<string | null>(null);
  const [openCreateNonce, setOpenCreateNonce] = useState<number>(0);
  const [facultyNotifications, setFacultyNotifications] = useState<FacultyNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  useEffect(() => {
    if (classes.length === 0) return;
    if (!selectedClassId || !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const loadFacultyNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/teacher/notifications?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.notifications)) {
        setFacultyNotifications(data.notifications);
        setUnreadNotificationsCount(Number(data.unreadCount) || 0);
      }
    } catch {
      // Retain last fetched notifications silently on transient network blip
    }
  }, [token]);

  useEffect(() => {
    void loadFacultyNotifications();
    const timer = window.setInterval(() => {
      void loadFacultyNotifications();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadFacultyNotifications, currentPath]);

  const handleMarkFacultyNotificationRead = useCallback(
    async (notificationId: string) => {
      if (!token) return;
      setFacultyNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        );
        setUnreadNotificationsCount(updated.filter((n) => !n.isRead).length);
        return updated;
      });
      try {
        await fetch(`/api/teacher/notifications/${encodeURIComponent(notificationId)}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Re-synced on next poll
      }
    },
    [token]
  );

  const handleMarkAllFacultyNotificationsRead = useCallback(async () => {
    if (!token) return;
    setFacultyNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotificationsCount(0);
    try {
      await fetch('/api/teacher/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Re-synced on next poll
    }
  }, [token]);

  const handleFacultyNotificationSelect = useCallback(
    (notif: FacultyNotification) => {
      if (notif.metadata?.classId && classes.some((c) => c.id === notif.metadata.classId)) {
        setSelectedClassId(notif.metadata.classId);
      }
      onNavigate(notif.metadata?.actionPath || '/teacher/classes');
    },
    [classes, onNavigate]
  );

  const handleQuickAssignModal = (expId?: string) => {
    if (expId) setPreselectedExpId(expId);
    setOpenCreateNonce((n) => n + 1);
    onNavigate('/teacher/assignments');
  };

  const renderTeacherView = () => {
    switch (currentPath) {
      case '/teacher/classes':
      case '/teacher/students':
        return (
          <TeacherClassesView
            token={token}
            currentUser={currentUser}
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            submissions={submissions}
            onNavigate={onNavigate}
            isDark={isDark}
          />
        );

      case '/teacher/assignments':
        return (
          <TeacherAssignmentsView
            assignments={assignments}
            classes={classes}
            experiments={experiments}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            preselectedExperimentId={preselectedExpId}
            openCreateNonce={openCreateNonce}
            onCreateAssignment={onCreateAssignment}
            onToggleAssignmentStatus={onToggleAssignmentStatus}
          />
        );

      case '/teacher/experiments':
        return (
          <TeacherExperimentsView
            experiments={experiments}
            onNavigate={onNavigate}
            onQuickAssignExp={(expId) => handleQuickAssignModal(expId)}
          />
        );

      case '/teacher/analytics':
        return (
          <TeacherAnalyticsView
            token={token}
            currentUser={currentUser}
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            submissions={submissions}
            experiments={experiments}
            isDark={isDark}
          />
        );

      case '/teacher/review':
        return (
          <TeacherReviewView
            token={token}
            submissions={submissions}
            classes={classes}
            assignments={assignments}
            experiments={experiments}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            onEvaluateSubmission={onEvaluateSubmission}
          />
        );

      case '/teacher/reports':
        return (
          <TeacherReportsView
            token={token}
            currentUser={currentUser}
            classes={classes}
            experiments={experiments}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            isDark={isDark}
          />
        );

      case '/teacher/profile':
        return <TeacherProfileView currentUser={currentUser} />;

      case '/teacher/dashboard':
      case '/teacher':
      default:
        return (
          <TeacherOverviewView
            currentUser={currentUser}
            token={token}
            classes={classes}
            assignments={assignments}
            submissions={submissions}
            experiments={experiments}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            onNavigate={onNavigate}
            onQuickAssignModal={() => handleQuickAssignModal()}
            facultyNotifications={facultyNotifications}
            unreadNotificationsCount={unreadNotificationsCount}
            onMarkNotificationRead={handleMarkFacultyNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllFacultyNotificationsRead}
            onSelectNotification={handleFacultyNotificationSelect}
            isDark={isDark}
          />
        );
    }
  };

  return (
    <AppShell
      id="teacher-application-shell"
      currentRole="teacher"
      currentUser={currentUser}
      currentPath={currentPath}
      onNavigate={onNavigate}
      onLogout={onLogout}
      isDark={isDark}
      onToggleDarkMode={onToggleDarkMode}
      facultyClasses={classes}
      selectedFacultyClassId={selectedClassId}
      onSelectFacultyClassId={setSelectedClassId}
      onFacultyQuickAssign={() => handleQuickAssignModal()}
      facultyNotifications={facultyNotifications}
      unreadFacultyNotificationsCount={unreadNotificationsCount}
      onMarkFacultyNotificationRead={handleMarkFacultyNotificationRead}
      onMarkAllFacultyNotificationsRead={handleMarkAllFacultyNotificationsRead}
      onFacultyNotificationSelect={handleFacultyNotificationSelect}
    >
      {dataError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{dataError}</span>
        </div>
      )}
      {renderTeacherView()}
    </AppShell>
  );
};
