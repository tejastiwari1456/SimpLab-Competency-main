import React, { useEffect, useState } from 'react';
import {
  Users,
  ClipboardList,
  FlaskConical,
  TrendingUp,
  Plus,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageSquare,
  FileCheck2,
  Loader2,
  Eye,
  Bell,
  UserPlus,
  CheckCheck,
} from 'lucide-react';
import {
  CurrentUser,
  ClassCourse,
  Assignment,
  StudentSubmission,
  Experiment,
  FacultyDashboardSummary,
  FacultyNotification,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';
import { StudentProfileReportModal } from './StudentProfileReportModal';

interface TeacherOverviewViewProps {
  currentUser?: CurrentUser;
  token: string | null;
  classes: ClassCourse[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  experiments: Experiment[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onNavigate: (path: string) => void;
  onQuickAssignModal: () => void;
  facultyNotifications?: FacultyNotification[];
  unreadNotificationsCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onSelectNotification?: (notif: FacultyNotification) => void;
  isDark?: boolean;
}

export const TeacherOverviewView: React.FC<TeacherOverviewViewProps> = ({
  currentUser,
  token,
  classes,
  assignments,
  submissions,
  experiments,
  selectedClassId,
  onSelectClassId,
  onNavigate,
  onQuickAssignModal,
  facultyNotifications = [],
  unreadNotificationsCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onSelectNotification,
  isDark = false,
}) => {
  const [summary, setSummary] = useState<FacultyDashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [inspectStudentId, setInspectStudentId] = useState<string | null>(null);

  const currentClass =
    classes.find((c) => c.id === selectedClassId) || classes[0];

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadingSummary(true);

    fetch('/api/teacher/dashboard-summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.summary && !cancelled) {
          setSummary(data.summary);
        }
      })
      .catch(() => {
        // Fallback smoothly to props-derived metrics if offline
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, submissions.length, assignments.length, classes.length]);

  const fallbackTotalStudents = classes.reduce(
    (sum, c) => sum + (Number(c.studentCount) || 0),
    0
  );
  const pendingStatuses = new Set(['pending', 'auto_graded', 'ai_evaluated']);
  const fallbackPendingCount = submissions.filter((s) =>
    pendingStatuses.has(s.evaluationStatus || 'auto_graded')
  ).length;

  const averageCompetencies = currentClass?.averageCompetencies ?? {
    setup_adherence: 0,
    measurement_precision: 0,
    data_interpretation: 0,
    troubleshooting_safety: 0,
    experimental_design: 0,
  };

  const fallbackAvgClassScore = Math.round(
    Object.values(averageCompetencies).reduce(
      (sum, score) => sum + (Number(score) || 0),
      0
    ) / 5
  );

  const totalAssignedStudents =
    summary?.totalAssignedStudents ?? fallbackTotalStudents;
  const pendingSubmissionsCount =
    summary?.pendingSubmissionsCount ?? fallbackPendingCount;
  const completedExperimentsCount =
    summary?.completedExperimentsCount ?? submissions.length;
  const classAverageCompetency =
    summary?.classAverageCompetency ?? fallbackAvgClassScore;
  const recentActivities = summary?.recentActivities ?? [];
  const studentsRequiringAttention = summary?.studentsRequiringAttention ?? [];
  const recentlyEnrolledStudents = summary?.recentlyEnrolledStudents ?? [];
  const classDistribution =
    summary?.classDistribution ??
    classes.map((c) => ({
      classId: c.id,
      code: c.code,
      name: c.name,
      studentCount: Number(c.studentCount) || 0,
    }));
  const displayNotifications =
    facultyNotifications.length > 0
      ? facultyNotifications
      : summary?.latestEnrollmentNotifications ?? [];
  const displayUnreadCount =
    unreadNotificationsCount > 0
      ? unreadNotificationsCount
      : summary?.unreadNotificationsCount ?? 0;

  if (!currentClass) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          No classes available
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          No classes are currently assigned to your teacher account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Faculty Executive Hub
            </span>
            <span className="text-xs text-stone-500">
              {currentClass.department || currentUser?.institution || 'Applied Sciences'}
            </span>
          </div>

          <h2 className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
            Welcome back, {currentUser?.name || 'Faculty Member'}
          </h2>

          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Monitoring {classes.length} assigned cohorts, {assignments.filter((a) => a.status === 'active').length}{' '}
            active lab assignments, and {experiments.length} simulation apparatuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('/teacher/reports')}
            className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 px-4 py-2.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <FileCheck2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Generate Reports</span>
          </button>
          <button
            type="button"
            onClick={onQuickAssignModal}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Assign Virtual Lab</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Real-Time KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('/teacher/classes')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Assigned Students
            </span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {totalAssignedStudents}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Across {classes.length} Active Cohorts
          </p>
        </div>

        <div
          onClick={() => onNavigate('/teacher/review')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Pending Submissions
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingSubmissionsCount}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Awaiting Faculty Verification
          </p>
        </div>

        <div
          onClick={() => onNavigate('/teacher/review')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Completed Experiments
            </span>
            <FlaskConical className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {completedExperimentsCount}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {assignments.filter((a) => a.status === 'active').length} Active Assignments
          </p>
        </div>

        <div
          onClick={() => onNavigate('/teacher/analytics')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Class Avg Competency
            </span>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {Math.round(classAverageCompetency)}%
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Empirical 5-Dimension Mean
          </p>
        </div>
      </div>

      {/* Cohort Spotlight + Recent Student Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cohort Competency Radar */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Active Cohort Spotlight
                </span>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  {currentClass.name}
                </h3>
              </div>

              <select
                value={currentClass.id}
                onChange={(e) => onSelectClassId(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-1 text-xs font-bold"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <CompetencyRadar
                scores={averageCompetencies}
                studentName="Class Average"
                height={260}
                isDark={isDark}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              {currentClass.studentCount} Students in {currentClass.code}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/teacher/analytics')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full Analytics & AI Insights</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Recent Student Activities */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-500" />
                  <span>Recent Student Activities</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Live stream of practical submissions, AI Viva completions, and faculty evaluations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/teacher/review')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Review Queue</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {loadingSummary && recentActivities.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>Loading recent student activities...</span>
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-6 text-center text-xs text-stone-500">
                No recent student activity recorded yet across your assigned classes.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {recentActivities.slice(0, 7).map((act) => (
                  <div
                    key={act.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                          act.type === 'viva'
                            ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                            : act.type === 'evaluation'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {act.type === 'viva' ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : act.type === 'evaluation' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <FlaskConical className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 dark:text-stone-100 truncate">
                          {act.studentId ? (
                            <button
                              type="button"
                              onClick={() => setInspectStudentId(act.studentId!)}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left"
                            >
                              {act.title}
                            </button>
                          ) : (
                            act.title
                          )}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {act.subtitle} • {new Date(act.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {act.scorePct != null && (
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {Math.round(act.scorePct)}%
                        </span>
                      )}
                      {act.status && (
                        <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-600 dark:text-stone-300">
                          {act.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Enrolled Students & Enrollment Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recently Enrolled Students Table */}
        <div
          id="faculty-recently-enrolled-card"
          className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-500" />
                <span>Recently Enrolled Students</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Automatically synchronized from live class enrollments across your assigned cohorts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/teacher/classes')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full Class Roster</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {recentlyEnrolledStudents.length === 0 ? (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-5 text-center text-xs text-stone-500">
              No students enrolled in your assigned classes yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase font-bold text-stone-500">
                  <tr>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">Enrolled</th>
                    <th className="px-3 py-2.5 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                  {recentlyEnrolledStudents.slice(0, 8).map((st) => (
                    <tr
                      key={st.enrollmentId}
                      className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40"
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-stone-900 dark:text-stone-100">
                          {st.studentName}
                        </p>
                        <p className="text-[10px] text-stone-400 font-mono truncate max-w-[200px]">
                          {st.email}
                          {st.enrollmentCode ? ` • ${st.enrollmentCode}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/70 dark:border-indigo-800/60 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-800 dark:text-indigo-300">
                          {st.classCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-stone-500 whitespace-nowrap">
                        <div>{new Date(st.enrolledAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {new Date(st.enrolledAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectStudentId(st.studentId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-200 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Class-wise student distribution strip */}
          {classDistribution.length > 0 && (
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Cohort Distribution:
              </span>
              {classDistribution.map((item) => (
                <button
                  key={item.classId}
                  type="button"
                  onClick={() => {
                    onSelectClassId(item.classId);
                    onNavigate('/teacher/classes');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:border-indigo-300 cursor-pointer"
                >
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {item.code}
                  </span>
                  <span className="text-stone-500">•</span>
                  <span>{item.studentCount} students</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Latest Enrollment Notifications */}
        <div
          id="faculty-enrollment-notifications-card"
          className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-500" />
                <span>Enrollment Notifications</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {displayUnreadCount} unread alert{displayUnreadCount === 1 ? '' : 's'}
              </p>
            </div>
            {displayUnreadCount > 0 && onMarkAllNotificationsRead && (
              <button
                type="button"
                onClick={() => onMarkAllNotificationsRead()}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:text-indigo-600 cursor-pointer"
              >
                <CheckCheck className="h-3 w-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {displayNotifications.length === 0 ? (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-5 text-center text-xs text-stone-500">
              No enrollment notifications received yet. When a new student registers for your class, an alert will appear here automatically.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800/80 max-h-80 overflow-y-auto">
              {displayNotifications.slice(0, 6).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead && onMarkNotificationRead) {
                      onMarkNotificationRead(notif.id);
                    }
                    if (onSelectNotification) {
                      onSelectNotification(notif);
                    }
                  }}
                  className={`py-3 px-2 rounded-lg transition-colors cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 ${
                    notif.isRead ? 'opacity-75' : 'bg-indigo-50/30 dark:bg-indigo-950/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/70 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                      {notif.metadata?.classCode || 'Cohort'}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(notif.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-stone-900 dark:text-stone-100">
                    {notif.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
                    {notif.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Students Requiring Attention */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span>Students Requiring Attention</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Enrolled students scoring below the 75% mastery threshold or missing competency benchmarks.
            </p>
          </div>
          <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-3 py-1 text-xs font-bold">
            {studentsRequiringAttention.length} Flagged
          </span>
        </div>

        {studentsRequiringAttention.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 text-center text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            All evaluated students across your assigned cohorts are currently meeting or exceeding the 75% benchmark.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
              <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase font-bold text-stone-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Cohort</th>
                  <th className="px-4 py-3">Overall Mastery</th>
                  <th className="px-4 py-3">Weakest Competency</th>
                  <th className="px-4 py-3">Recommended Remedial Lab</th>
                  <th className="px-4 py-3 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {studentsRequiringAttention.map((st) => (
                  <tr
                    key={st.studentId}
                    className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-stone-900 dark:text-stone-100">
                        {st.studentName}
                      </p>
                      <span
                        className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          st.riskLevel === 'high'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {st.riskLevel} risk
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {st.classCodes.join(', ')}
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">
                      {Math.round(st.overallMastery)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[10px] font-semibold">
                        {st.weakestCompetencyLabel} ({Math.round(st.weakestCompetencyScore)}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-700 dark:text-stone-300">
                      {st.recommendedExperimentTitle}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectStudentId(st.studentId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {inspectStudentId && (
        <StudentProfileReportModal
          studentId={inspectStudentId}
          token={token}
          facultyName={currentUser?.name || 'Faculty'}
          isDark={isDark}
          onClose={() => setInspectStudentId(null)}
        />
      )}
    </div>
  );
};
