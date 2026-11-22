import React, { useState, useEffect, useCallback } from 'react';
import type { TaskResponseState } from './components/tasks/AutoGradedTaskPanel';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/common/LoadingScreen';
import { UnauthorizedPage } from './components/common/UnauthorizedPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { LandingPage } from './components/landing/LandingPage';
import { StudentLayout } from './components/student/StudentLayout';
import { TeacherLayout } from './components/teacher/TeacherLayout';
import { AdminLayout } from './components/admin/AdminLayout';
import { EXPERIMENTS } from './data/mockData';
import {
  CurrentUser,
  UserRole,
  CompetencyKey,
  Assignment,
  StudentSubmission,
  CompetencyMilestone,
  StudentMilestoneStatus,
  ClassCourse,
  StudentCompetencyReport,
  VivaSessionRecord,
  SubmissionEvaluationStatus,
  StudentRecommendation,
  StudentNotification,
} from './types';
import {
  detectNewlyUnlockedMilestones,
  getMilestoneStatuses,
  COMPETENCY_MILESTONES,
} from './data/milestonesData';
import { MilestoneCelebrationModal } from './components/badges/MilestoneCelebrationModal';
import { DigitalBadgeModal } from './components/badges/DigitalBadgeModal';

const EMPTY_COMPETENCY_SCORES: Record<CompetencyKey, number> = {
  setup_adherence: 0,
  measurement_precision: 0,
  data_interpretation: 0,
  troubleshooting_safety: 0,
  experimental_design: 0,
};

export interface ExperimentSubmitPayload {
  assignmentId: string;
  experimentId: string;
  taskResponses: Record<string, TaskResponseState>;
  vivaSessionId?: string | null;
  observations?: Record<string, any>;
  calculatedResults?: Record<string, any>;
  dataReadingsCount?: number;
}

function AppContent() {
  const { user, role, token, isAuthenticated, isLoading, logout, setSession } = useAuth();

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('simlab_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const parseRoleFromSearch = (): UserRole => {
    if (typeof window === 'undefined') return 'student';
    const param = new URLSearchParams(window.location.search).get('role')?.toLowerCase();
    if (param === 'teacher' || param === 'admin' || param === 'student') {
      return param;
    }
    return 'student';
  };

  // Pre-selected role when handing off from LandingPage -> LoginPage
  const [selectedLoginRole, setSelectedLoginRole] = useState<UserRole>(parseRoleFromSearch);

  // Client-side URL pathname routing state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('simlab_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('simlab_theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => setIsDark((prev) => !prev);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setSelectedLoginRole(parseRoleFromSearch());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      const pathnameOnly = path.split('?')[0] || '/';
      setCurrentPath(pathnameOnly);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSignInWithRole = useCallback(
    (targetRole: UserRole) => {
      setSelectedLoginRole(targetRole);
      navigateTo(`/login?role=${targetRole}`);
    },
    [navigateTo]
  );

  // Live PostgreSQL-backed state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [classes, setClasses] = useState<ClassCourse[]>([]);
  const [vivaSessions, setVivaSessions] = useState<VivaSessionRecord[]>([]);
  const [studentCompetencyScores, setStudentCompetencyScores] = useState<Record<CompetencyKey, number>>(
    EMPTY_COMPETENCY_SCORES
  );
  const [competencyReport, setCompetencyReport] = useState<StudentCompetencyReport | null>(null);
  const [recommendations, setRecommendations] = useState<StudentRecommendation[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isLoadingStudentData, setIsLoadingStudentData] = useState<boolean>(false);

  // Explicit error & loading states
  const [studentSubmissionsError, setStudentSubmissionsError] = useState('');
  const [studentClassesError, setStudentClassesError] = useState('');
  const [competencyScoresError, setCompetencyScoresError] = useState('');
  const [teacherDataError, setTeacherDataError] = useState('');

  // Reset role-scoped state on logout or user switch
  useEffect(() => {
    if (!token || !role) {
      setAssignments([]);
      setSubmissions([]);
      setClasses([]);
      setVivaSessions([]);
      setRecommendations([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
      setIsLoadingStudentData(false);
      setStudentCompetencyScores(EMPTY_COMPETENCY_SCORES);
      setCompetencyReport(null);
      setStudentSubmissionsError('');
      setStudentClassesError('');
      setCompetencyScoresError('');
      setTeacherDataError('');
    }
  }, [token, role, user?.id]);

  // Helper to reload student data cleanly
  const loadStudentData = useCallback(async () => {
    if (!token || role !== 'student') return;
    const headers = { Authorization: `Bearer ${token}` };

    setIsLoadingStudentData(true);
    setStudentSubmissionsError('');
    setStudentClassesError('');
    setCompetencyScoresError('');

    try {
      const [asgRes, subRes, clsRes, compRes, vivaRes, recRes, notifRes] = await Promise.allSettled([
        fetch('/api/student/assignments', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch('/api/student/submissions', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch('/api/student/classes', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch('/api/student/competencies', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch('/api/viva/sessions', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch('/api/student/recommendations', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch('/api/student/notifications', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      ]);

      if (asgRes.status === 'fulfilled' && asgRes.value.ok && Array.isArray(asgRes.value.d?.assignments)) {
        setAssignments(asgRes.value.d.assignments);
      } else {
        setAssignments([]);
      }

      if (subRes.status === 'fulfilled' && subRes.value.ok && Array.isArray(subRes.value.d?.submissions)) {
        setSubmissions(subRes.value.d.submissions);
      } else {
        setSubmissions([]);
        setStudentSubmissionsError(
          subRes.status === 'fulfilled'
            ? subRes.value.d?.error || 'Failed to load student submissions.'
            : 'Network error while loading submissions.'
        );
      }

      if (clsRes.status === 'fulfilled' && clsRes.value.ok && Array.isArray(clsRes.value.d?.classes)) {
        setClasses(clsRes.value.d.classes);
      } else {
        setClasses([]);
        setStudentClassesError(
          clsRes.status === 'fulfilled'
            ? clsRes.value.d?.error || 'Failed to load enrolled classes.'
            : 'Network error while loading classes.'
        );
      }

      if (compRes.status === 'fulfilled' && compRes.value.ok && compRes.value.d?.success) {
        if (compRes.value.d.competencyScores && typeof compRes.value.d.competencyScores === 'object') {
          setStudentCompetencyScores(compRes.value.d.competencyScores);
        } else {
          setStudentCompetencyScores(EMPTY_COMPETENCY_SCORES);
        }
        setCompetencyReport(compRes.value.d.report ?? null);
      } else {
        setStudentCompetencyScores(EMPTY_COMPETENCY_SCORES);
        setCompetencyReport(null);
        setCompetencyScoresError(
          compRes.status === 'fulfilled'
            ? compRes.value.d?.error || 'Failed to load competency profile.'
            : 'Network error while loading competency profile.'
        );
      }

      if (vivaRes.status === 'fulfilled' && vivaRes.value.ok && Array.isArray(vivaRes.value.d?.sessions)) {
        setVivaSessions(vivaRes.value.d.sessions);
      } else {
        setVivaSessions([]);
      }

      if (recRes.status === 'fulfilled' && recRes.value.ok && Array.isArray(recRes.value.d?.recommendations)) {
        setRecommendations(recRes.value.d.recommendations);
      } else {
        setRecommendations([]);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.ok && Array.isArray(notifRes.value.d?.notifications)) {
        setNotifications(notifRes.value.d.notifications);
        setUnreadNotificationsCount(Number(notifRes.value.d.unreadCount) || 0);
      } else {
        setNotifications([]);
        setUnreadNotificationsCount(0);
      }
    } finally {
      setIsLoadingStudentData(false);
    }
  }, [token, role]);

  const handleMarkNotificationRead = useCallback(
    async (notificationKey: string) => {
      if (!token || role !== 'student') return;
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === notificationKey ? { ...n, isRead: true } : n));
        setUnreadNotificationsCount(updated.filter((n) => !n.isRead).length);
        return updated;
      });
      try {
        await fetch(`/api/student/notifications/${encodeURIComponent(notificationKey)}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Silent retry on next load
      }
    },
    [token, role]
  );

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!token || role !== 'student') return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotificationsCount(0);
    try {
      await fetch('/api/student/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Silent retry on next load
    }
  }, [token, role]);

  useEffect(() => {
    if (token && role === 'student') {
      void loadStudentData();
    }
  }, [token, role, user?.id, loadStudentData]);

  useEffect(() => {
    if (
      token &&
      role === 'student' &&
      (currentPath === '/student/dashboard' ||
        currentPath === '/student/assignments' ||
        currentPath === '/student/classes')
    ) {
      void loadStudentData();
    }
  }, [currentPath, token, role, loadStudentData]);

  // Helper to reload teacher data cleanly (classes + assignments + submissions)
  const loadTeacherData = useCallback(async () => {
    if (!token || role !== 'teacher') return;
    const headers = { Authorization: `Bearer ${token}` };
    setTeacherDataError('');

    const [clsRes, asgRes, subRes] = await Promise.allSettled([
      fetch('/api/teacher/classes', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch('/api/teacher/assignments', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch('/api/teacher/submissions', { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
    ]);

    const errors: string[] = [];

    if (clsRes.status === 'fulfilled' && clsRes.value.ok && Array.isArray(clsRes.value.d?.classes)) {
      setClasses(clsRes.value.d.classes);
    } else {
      setClasses([]);
      errors.push('classes');
    }

    if (asgRes.status === 'fulfilled' && asgRes.value.ok && Array.isArray(asgRes.value.d?.assignments)) {
      setAssignments(asgRes.value.d.assignments);
    } else {
      setAssignments([]);
      errors.push('assignments');
    }

    if (subRes.status === 'fulfilled' && subRes.value.ok && Array.isArray(subRes.value.d?.submissions)) {
      setSubmissions(subRes.value.d.submissions);
    } else {
      setSubmissions([]);
      errors.push('submissions');
    }

    if (errors.length > 0) {
      setTeacherDataError(`Unable to load faculty ${errors.join(', ')} from server.`);
    }
  }, [token, role]);

  useEffect(() => {
    if (token && role === 'teacher') {
      void loadTeacherData();
    }
  }, [token, role, loadTeacherData]);

  // Milestone celebration popup state
  const [celebratedMilestone, setCelebratedMilestone] = useState<{
    milestone: CompetencyMilestone;
    score: number;
  } | null>(null);
  const [inspectedMilestone, setInspectedMilestone] = useState<StudentMilestoneStatus | null>(null);

  // Do NOT fabricate competency scores on the client. Server calculates official scores on submission.
  const handleTaskCompleted = (_taskId: string, _score: number, _competency: CompetencyKey) => {
    // Official competency updates are persisted and computed server-side upon submission.
  };

  // Submit a completed experiment to PostgreSQL (server computes grades & competency report)
  const handleAllTasksCompleted = async (payload: ExperimentSubmitPayload): Promise<StudentSubmission> => {
    if (!user || !token) {
      throw new Error('Authentication session is missing. Please log in again.');
    }

    const {
      assignmentId,
      experimentId,
      taskResponses,
      vivaSessionId,
      observations,
      calculatedResults,
      dataReadingsCount,
    } = payload;

    if (!assignmentId || !experimentId) {
      throw new Error('Assignment or experiment is missing. Please select an active assignment.');
    }

    const selectedAssignment = assignments.find(
      (assignment) =>
        assignment.id === assignmentId &&
        assignment.experimentId === experimentId &&
        assignment.status === 'active'
    );

    if (!selectedAssignment) {
      throw new Error(
        'This assignment is not active or not assigned to your class. Refresh and try again.'
      );
    }

    const taskAnswers: Record<string, any> = {};
    for (const [taskId, resp] of Object.entries(taskResponses || {})) {
      taskAnswers[taskId] = resp?.studentAnswer;
    }

    const previousScores = { ...studentCompetencyScores };

    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assignmentId,
        experimentId,
        taskAnswers,
        taskResponses,
        observations: observations ?? {},
        calculatedResults: calculatedResults ?? {},
        dataReadingsCount: dataReadingsCount ?? Object.keys(taskAnswers).length,
        vivaSessionId: vivaSessionId ?? null,
        completionStatus: 'completed',
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.submission) {
      const message = result?.error || `Submission failed (HTTP ${response.status}).`;
      throw new Error(message);
    }

    // Update submissions & authoritative server competency report
    setSubmissions((previous) => [
      result.submission,
      ...previous.filter((sub) => sub.id !== result.submission.id),
    ]);

    if (result.competencyReport?.competencyScores) {
      const nextScores: Record<CompetencyKey, number> = result.competencyReport.competencyScores;
      setStudentCompetencyScores(nextScores);
      setCompetencyReport(result.competencyReport);

      const newlyUnlocked = detectNewlyUnlockedMilestones(previousScores, nextScores);
      if (newlyUnlocked.length > 0) {
        const first = newlyUnlocked[0];
        const targetScore =
          first.competencyKey === 'overall'
            ? result.competencyReport.overallScore
            : nextScores[first.competencyKey];
        setCelebratedMilestone({
          milestone: first,
          score: targetScore,
        });
      }
    }

    // Refresh assignments & viva history in background so attempt counters stay in sync
    void loadStudentData();

    return result.submission;
  };

  // Teacher creates an assignment in PostgreSQL
  const handleCreateAssignment = async (
    newAsg: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>
  ): Promise<void> => {
    if (!token) {
      throw new Error('Authentication token is missing. Please log in again.');
    }

    const response = await fetch('/api/teacher/assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newAsg),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success || !data?.assignment) {
      throw new Error(data?.error || 'Failed to create assignment.');
    }

    const saved = data.assignment;
    const created: Assignment = {
      id: saved.id,
      classId: saved.classId,
      title: saved.title,
      experimentId: saved.experimentId,
      dueDate: saved.dueDate,
      totalMarks: Number(saved.totalMarks),
      weightTowardsInternal: Number(saved.weightTowardsInternal),
      attemptsAllowed: saved.attemptsAllowed,
      allowFreeExploration: saved.allowFreeExploration,
      evaluationCriteria: saved.evaluationCriteria,
      status: saved.status,
      completedCount: saved.completedCount ?? 0,
      totalStudents: saved.totalStudents ?? 0,
      avgScore: saved.avgScore ?? 0,
    };

    setAssignments((prev) => [created, ...prev]);
  };

  // Teacher toggles assignment status (active <-> archived)
  const handleToggleAssignmentStatus = async (
    assignmentId: string,
    status: 'active' | 'archived'
  ): Promise<void> => {
    if (!token) {
      throw new Error('Authentication token is missing.');
    }

    const response = await fetch(`/api/teacher/assignments/${assignmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to update assignment status.');
    }

    setAssignments((prev) =>
      prev.map((asg) => (asg.id === assignmentId ? { ...asg, status } : asg))
    );
  };

  // Teacher evaluates a student submission
  const handleEvaluateSubmission = async (
    submissionId: string,
    evaluation: {
      evaluationStatus: SubmissionEvaluationStatus;
      instructorFeedback?: string;
      facultyScore?: number | null;
    }
  ): Promise<StudentSubmission> => {
    if (!token) {
      throw new Error('Authentication token is missing.');
    }

    const response = await fetch(`/api/teacher/submissions/${submissionId}/evaluate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(evaluation),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.submission) {
      throw new Error(data?.error || 'Failed to save faculty evaluation.');
    }

    setSubmissions((prev) =>
      prev.map((sub) => (sub.id === submissionId ? data.submission : sub))
    );

    // Refresh classes so updated cohort averages reflect the faculty evaluation
    void loadTeacherData();

    return data.submission;
  };

  // Handle logout with route redirection
  const handleLogout = async () => {
    await logout();
    navigateTo('/login');
  };

  const handleAuthSuccess = (authUser: CurrentUser, authToken: string) => {
    setSession(authUser, authToken);
    const roleRoute = (authUser.role || 'student').toLowerCase();
    navigateTo(`/${roleRoute}/dashboard`);
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
        const safeDashboard = `/${role}/dashboard`;
        navigateTo(safeDashboard);
      }
    }
  }, [isLoading, isAuthenticated, role, currentPath, navigateTo]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user || !role) {
    if (currentPath === '/register') {
      return (
        <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
          <RegisterPage
            onRegisterSuccess={handleAuthSuccess}
            onNavigate={navigateTo}
            isDark={isDark}
          />
        </div>
      );
    }

    if (currentPath === '/login' || currentPath.startsWith('/student') || currentPath.startsWith('/teacher') || currentPath.startsWith('/admin')) {
      const inferredRole: UserRole =
        currentPath.startsWith('/teacher')
          ? 'teacher'
          : currentPath.startsWith('/admin')
          ? 'admin'
          : selectedLoginRole;

      return (
        <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
          <LoginPage
            onLoginSuccess={handleAuthSuccess}
            onNavigate={navigateTo}
            isDark={isDark}
            initialRole={inferredRole}
          />
        </div>
      );
    }

    return (
      <LandingPage
        onSignInWithRole={handleSignInWithRole}
        onNavigate={navigateTo}
        isDark={isDark}
        onToggleDarkMode={toggleDarkMode}
      />
    );
  }

  if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
    return <LoadingScreen />;
  }

  if (currentPath.startsWith('/student') && role !== 'student') {
    return (
      <UnauthorizedPage
        currentRole={role}
        attemptedPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  if (currentPath.startsWith('/teacher') && role !== 'teacher') {
    return (
      <UnauthorizedPage
        currentRole={role}
        attemptedPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  if (currentPath.startsWith('/admin') && role !== 'admin') {
    return (
      <UnauthorizedPage
        currentRole={role}
        attemptedPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  let layoutContent: React.ReactNode;

  switch (role) {
    case 'student':
      layoutContent = (
        <StudentLayout
          currentUser={user}
          token={token}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          isLoadingData={isLoadingStudentData}
          classes={classes}
          studentClassesError={studentClassesError}
          assignments={assignments}
          submissions={submissions}
          studentSubmissionsError={studentSubmissionsError}
          competencyScores={studentCompetencyScores}
          competencyReport={competencyReport}
          competencyScoresError={competencyScoresError}
          vivaSessions={vivaSessions}
          recommendations={recommendations}
          notifications={notifications}
          unreadNotificationsCount={unreadNotificationsCount}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onRefreshStudentData={loadStudentData}
          onTaskCompleted={handleTaskCompleted}
          onAllCompleted={handleAllTasksCompleted}
        />
      );
      break;

    case 'teacher':
      layoutContent = (
        <TeacherLayout
          currentUser={user}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          token={token}
          classes={classes}
          assignments={assignments}
          submissions={submissions}
          experiments={EXPERIMENTS}
          dataError={teacherDataError}
          onCreateAssignment={handleCreateAssignment}
          onToggleAssignmentStatus={handleToggleAssignmentStatus}
          onEvaluateSubmission={handleEvaluateSubmission}
        />
      );
      break;

    case 'admin':
      layoutContent = (
        <AdminLayout
          currentUser={user}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          token={token}
        />
      );
      break;

    default:
      layoutContent = (
        <UnauthorizedPage
          currentRole={role}
          attemptedPath={currentPath}
          onNavigate={navigateTo}
        />
      );
      break;
  }

  return (
    <>
      {layoutContent}

      {celebratedMilestone && (
        <MilestoneCelebrationModal
          milestone={celebratedMilestone.milestone}
          newScore={celebratedMilestone.score}
          onClose={() => setCelebratedMilestone(null)}
          onViewBadge={(m) => {
            const allStatuses = getMilestoneStatuses(
              COMPETENCY_MILESTONES,
              studentCompetencyScores,
              user?.name,
              user?.enrollmentCode
            );
            const targetStatus = allStatuses.find((s) => s.milestone.id === m.id);
            if (targetStatus) {
              setInspectedMilestone({ ...targetStatus, isUnlocked: true });
            }
          }}
        />
      )}

      {inspectedMilestone && (
        <DigitalBadgeModal
          status={inspectedMilestone}
          studentName={user?.name}
          institution={user?.institution}
          enrollmentCode={user?.enrollmentCode}
          onClose={() => setInspectedMilestone(null)}
          onPractice={() => {
            setInspectedMilestone(null);
            navigateTo('/student/experiments');
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
