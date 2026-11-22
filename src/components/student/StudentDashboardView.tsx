import React, { useState } from 'react';
import {
  FlaskConical,
  Award,
  Clock,
  ArrowRight,
  TrendingUp,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Target,
  Bell,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import {
  CurrentUser,
  CompetencyKey,
  COMPETENCY_DIMENSIONS,
  Assignment,
  ClassCourse,
  StudentSubmission,
  StudentMilestoneStatus,
  StudentCompetencyReport,
  VivaSessionRecord,
  StudentRecommendation,
  StudentNotification,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';
import { EXPERIMENTS } from '../../data/mockData';
import { COMPETENCY_MILESTONES, getMilestoneStatuses } from '../../data/milestonesData';
import { DigitalBadgeEmblem } from '../badges/DigitalBadgeEmblem';
import { DigitalBadgeModal } from '../badges/DigitalBadgeModal';

interface StudentDashboardViewProps {
  currentUser: CurrentUser;
  isLoading: boolean;
  classes: ClassCourse[];
  competencyScores: Record<CompetencyKey, number>;
  competencyReport: StudentCompetencyReport | null;
  classAverageScores: Record<CompetencyKey, number>;
  assignments: Assignment[];
  submissions: StudentSubmission[];
  vivaSessions: VivaSessionRecord[];
  recommendations: StudentRecommendation[];
  notifications: StudentNotification[];
  studentSubmissionsError: string;
  onMarkNotificationRead: (key: string) => void;
  onNotificationSelect: (notif: StudentNotification) => void;
  onNavigate: (path: string) => void;
  onSelectExperiment: (expId: string) => void;
  isDark: boolean;
}

const priorityBadgeStyle = (priority: StudentRecommendation['priority']) => {
  if (priority === 'high') {
    return 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  }
  if (priority === 'medium') {
    return 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  return 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700';
};

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  currentUser,
  isLoading,
  classes,
  competencyScores,
  competencyReport,
  classAverageScores,
  assignments,
  submissions,
  vivaSessions,
  recommendations,
  notifications,
  studentSubmissionsError,
  onMarkNotificationRead,
  onNotificationSelect,
  onNavigate,
  onSelectExperiment,
  isDark,
}) => {
  const [selectedMilestone, setSelectedMilestone] = useState<StudentMilestoneStatus | null>(null);

  const overallMastery =
    competencyReport?.overallScore ??
    Math.round(
      (Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).reduce(
        (sum, key) => sum + (competencyScores[key] ?? 0) * COMPETENCY_DIMENSIONS[key].weight,
        0
      )
    );

  const latestDelta = competencyReport?.latestDelta ?? 0;

  const milestoneStatuses = getMilestoneStatuses(
    COMPETENCY_MILESTONES,
    competencyScores,
    currentUser.name,
    currentUser.enrollmentCode
  );

  const unlockedBadges = milestoneStatuses.filter((s) => s.isUnlocked);
  const precisionScore = competencyScores.measurement_precision ?? 0;
  const targetPrecisionMilestone = milestoneStatuses.find(
    (m) => m.milestone.id === 'milestone-prec-90'
  );

  const activeAssignments = [...assignments]
    .filter((a) => a.status === 'active')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const classMap = new Map(classes.map((c) => [c.id, c]));

  // Count how many active assignments have at least one submission
  const submittedAssignmentIds = new Set(submissions.map((s) => s.assignmentId));
  const pendingAssignmentsCount = activeAssignments.filter(
    (a) => !submittedAssignmentIds.has(a.id)
  ).length;

  // Average AI Viva score from persisted viva_sessions
  const completedVivas = vivaSessions.filter((v) => v.answeredCount > 0);
  const avgVivaScore =
    completedVivas.length > 0
      ? Math.round(
          completedVivas.reduce((acc, v) => acc + Number(v.overallScore || 0), 0) /
            completedVivas.length
        )
      : null;

  // Map every active class assignment directly to its experiment metadata so newly assigned labs always appear
  const assignedLabItems = activeAssignments.map((asg) => {
    const exp = EXPERIMENTS.find((e) => e.id === asg.experimentId);
    const cls = classMap.get(asg.classId);
    const attemptsUsed = submissions.filter((s) => s.assignmentId === asg.id).length;
    return {
      assignment: asg,
      experiment: exp,
      classCode: asg.classCode || cls?.code || asg.classId,
      className: asg.className || cls?.name || 'Enrolled Cohort',
      attemptsUsed,
    };
  });

  const studentSubmissions = [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const topRecommendations = recommendations.slice(0, 3);
  const recentNotifications = notifications.slice(0, 4);
  const hasClassBenchmarks = Object.values(classAverageScores).some((v) => v > 0);

  if (isLoading && submissions.length === 0 && assignments.length === 0) {
    return (
      <div id="student-dashboard-loading" className="space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-200/70 dark:bg-stone-800/70" />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70" />
      </div>
    );
  }

  return (
    <div id="student-dashboard-root" className="space-y-6">
      {studentSubmissionsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          Unable to load submissions: {studentSubmissionsError}
        </div>
      )}

      {/* 1. Welcome & High-Impact Competency Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs sm:flex-row sm:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              Student Laboratory Workspace
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              ID: {currentUser.enrollmentCode || currentUser.id.slice(0, 10)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
            Welcome back, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
            Continuous empirical assessment hub for syllabus-aligned virtual laboratory experiments, auto-graded physics apparatus tasks, and adaptive AI viva defenses.
          </p>
        </div>

        {/* Overall Practical Mastery Score */}
        <div className="flex sm:flex-col items-center justify-between sm:justify-center rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-4 text-center min-w-[160px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Overall Competency
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-stone-900 dark:text-amber-400">
              {overallMastery}%
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">mastery</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" />
            {submissions.length === 0
              ? 'No attempts graded yet'
              : latestDelta > 0
              ? `+${latestDelta.toFixed(1)}% latest attempt`
              : latestDelta < 0
              ? `${latestDelta.toFixed(1)}% latest attempt`
              : `${competencyReport?.experimentsEvaluatedCount ?? submissions.length} labs evaluated`}
          </span>
        </div>
      </div>

      {/* 1b. Real-Time Database-Driven KPI Summary Row */}
      <div id="student-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onNavigate('/student/competencies')}
          className="text-left rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Mastery Index</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {overallMastery}%
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              {competencyReport?.strongAreas.length || 0} strong
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            {competencyReport?.experimentsEvaluatedCount ?? 0} syllabus labs evaluated
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/student/assignments')}
          className="text-left rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Assignments</span>
            <ClipboardList className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {activeAssignments.length}
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
              {pendingAssignmentsCount} pending
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            {activeAssignments.length - pendingAssignmentsCount} attempted in term
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/student/progress')}
          className="text-left rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Submissions</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {submissions.length}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              {unlockedBadges.length} badges
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Verified practical attempts
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/student/competencies')}
          className="text-left rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Viva Average</span>
            <MessageSquare className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {avgVivaScore !== null ? `${avgVivaScore}%` : '—'}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              {vivaSessions.length} session{vivaSessions.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            Adaptive oral defense history
          </p>
        </button>
      </div>

      {/* 1c. My Enrolled Class & Assigned Faculty */}
      <div
        id="student-enrolled-classes-card"
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                My Enrolled Class & Assigned Faculty
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Active cohort enrollment automatically syncs your assigned lab experiments and faculty mentor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/student/classes')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            <span>View All Classes</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {classes.map((cls) => {
              const classLabCount = activeAssignments.filter((a) => a.classId === cls.id).length;
              return (
                <div
                  key={cls.id}
                  data-class-code={cls.code}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-stone-900 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400 border border-stone-700">
                          {cls.code}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {cls.enrollmentStatus || 'active'}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold text-stone-900 dark:text-stone-100">
                        {cls.name}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        {cls.department} • {cls.semester} {cls.academicYear}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      {classLabCount} Active Lab{classLabCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-stone-200/80 dark:border-stone-800 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Faculty:{' '}
                        <strong className="text-stone-900 dark:text-stone-100">
                          {cls.facultyName || 'Faculty Assigned'}
                        </strong>
                      </span>
                    </span>
                    {cls.enrolledAt && (
                      <span className="text-[11px] text-stone-500 dark:text-stone-400">
                        Enrolled {new Date(cls.enrolledAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-4 text-xs text-stone-500 dark:text-stone-400">
            No active class enrollment found for your account yet. Contact your academic administrator if this looks unexpected.
          </div>
        )}
      </div>

      {/* Personalized Experiment Recommendations */}
      <div
        id="student-recommendations-section"
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Personalized Experiment Recommendations
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Ranked dynamically from your competency profile, mastery gaps, and active assignment deadlines.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/student/competencies')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            <span>Inspect Competency Gaps</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {topRecommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {topRecommendations.map((rec) => (
              <div
                key={rec.experimentId}
                className="flex flex-col justify-between rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 p-4 space-y-3 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityBadgeStyle(
                        rec.priority
                      )}`}
                    >
                      {rec.priority} priority
                    </span>
                    <span className="font-mono text-[10px] font-bold text-stone-500 dark:text-stone-400">
                      {rec.code} • {rec.subject}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-snug">
                    {rec.title}
                  </h3>
                  <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                    {rec.reason}
                  </p>

                  {rec.targetCompetencies.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {rec.targetCompetencies.slice(0, 2).map((tc) => (
                        <span
                          key={tc.key}
                          className="rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 px-1.5 py-0.5 text-[10px] text-stone-700 dark:text-stone-300"
                        >
                          {tc.label.split(' ')[0]} ({tc.currentScore}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 line-clamp-1">
                    {rec.dueDate
                      ? `Due ${new Date(rec.dueDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}`
                      : rec.estimatedImpact}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectExperiment(rec.experimentId);
                      onNavigate('/student/experiments');
                    }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    <span>Launch Lab</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-4 text-xs text-stone-500 dark:text-stone-400">
            Complete an assigned experiment to unlock tailored competency-driven experiment recommendations.
          </div>
        )}
      </div>

      {/* Competency Milestones & Digital Badges Showcase */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Competency Milestones & Earned Badges
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Verified digital badges unlocked across laboratory precision and calibration standards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {unlockedBadges.length} Badges Earned
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/student/progress')}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <span>View Milestone Hub</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {milestoneStatuses.slice(0, 6).map((status) => (
            <div
              key={status.milestone.id}
              onClick={() => setSelectedMilestone(status)}
              className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all cursor-pointer ${
                status.isUnlocked
                  ? 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 hover:border-amber-400 dark:hover:border-amber-500 hover:scale-102'
                  : 'border-dashed border-stone-200 dark:border-stone-800 opacity-60 hover:opacity-90'
              }`}
            >
              <DigitalBadgeEmblem
                iconName={status.milestone.iconName}
                tier={status.milestone.tier}
                threshold={status.milestone.threshold}
                isUnlocked={status.isUnlocked}
                size="sm"
              />
              <span className="mt-2 text-[11px] font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                {status.milestone.shortTitle}
              </span>
              <span className="text-[9px] text-stone-500 dark:text-stone-400">
                {status.isUnlocked ? 'Verified' : `${status.pointsNeeded}% to go`}
              </span>
            </div>
          ))}
        </div>

        {precisionScore < 90 && targetPrecisionMilestone && (
          <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Upcoming Milestone:</strong> Reach 90% in Measurement Precision (currently{' '}
                <strong className="font-mono">{precisionScore}%</strong>) to earn the{' '}
                <strong>Precision Metrology Master (Gold Tier)</strong> badge!
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/student/experiments')}
              className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 hover:underline shrink-0 cursor-pointer"
            >
              <span>Practice Assigned Lab</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Grid: Assigned Experiments & Notifications/Deadlines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div id="student-assigned-labs-section" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-500" />
              <span>Assigned Lab Experiments ({assignedLabItems.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/student/assignments')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <span>View All Assignments</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {assignedLabItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignedLabItems.map(({ assignment, experiment, classCode, attemptsUsed }) => (
                <div
                  key={assignment.id}
                  data-assignment-id={assignment.id}
                  data-class-code={classCode}
                  className="flex flex-col justify-between rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="rounded bg-stone-900 dark:bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-stone-700">
                        {classCode}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 truncate">
                        {experiment?.subject || 'Lab'} • {experiment?.code || assignment.experimentId}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xs font-bold text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {assignment.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2">
                      {experiment?.title || assignment.experimentId}
                    </p>
                    <p className="mt-1.5 text-[10px] text-stone-500 dark:text-stone-400">
                      Due {new Date(assignment.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {attemptsUsed}/{assignment.attemptsAllowed} attempts
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400">
                      <Clock className="h-3 w-3" />
                      {experiment?.durationMinutes ?? 30}m
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectExperiment(assignment.experimentId);
                        onNavigate('/student/experiments');
                      }}
                      className="flex items-center gap-1 rounded-md bg-stone-900 dark:bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
                    >
                      <span>{attemptsUsed > 0 ? 'Continue' : 'Launch'}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 text-xs text-stone-500 dark:text-stone-400">
              No active experiments are currently assigned to your enrolled classes. Check back once your instructor publishes a lab assignment.
            </div>
          )}

          {/* Recent Alerts & Notifications Card */}
          <div
            id="student-dashboard-notifications"
            className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2.5">
              <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-500" />
                <span>Recent Alerts, Deadlines & Evaluations</span>
              </h3>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                {notifications.filter((n) => !n.isRead).length} unread
              </span>
            </div>

            {recentNotifications.length > 0 ? (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {recentNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      if (!notif.isRead) onMarkNotificationRead(notif.id);
                      onNotificationSelect(notif);
                    }}
                    className="w-full text-left py-2.5 flex items-start justify-between gap-3 hover:bg-stone-50/70 dark:hover:bg-stone-850/70 rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {notif.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-1">
                        {notif.message}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Open →
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                You are all caught up — no pending alerts or unreviewed evaluations.
              </p>
            )}
          </div>
        </div>

        {/* Upcoming Assignments & Deadlines (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <span>Upcoming Deadlines</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/student/assignments')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {activeAssignments.length > 0 ? (
            <div className="space-y-2.5">
              {activeAssignments.slice(0, 6).map((asg) => {
                const studentAttempts = submissions.filter(
                  (s) => s.assignmentId === asg.id
                ).length;
                const classCode = asg.classCode || classMap.get(asg.classId)?.code;
                return (
                  <div
                    key={asg.id}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {classCode && (
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-stone-900 dark:bg-stone-800 px-1.5 py-0.5 rounded">
                            {classCode}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                          Due {new Date(asg.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400">
                        {asg.totalMarks} marks
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                      {asg.title}
                    </h3>
                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="text-stone-500 dark:text-stone-400">
                        Your Attempts: {studentAttempts} / {asg.attemptsAllowed}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectExperiment(asg.experimentId);
                          onNavigate('/student/experiments');
                        }}
                        className="font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Open Task →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 text-xs text-stone-500 dark:text-stone-400">
              No upcoming active deadlines.
            </div>
          )}
        </div>
      </div>

      {/* 3. Competency Progress Radar & Recent Results */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Competency Radar</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/student/competencies')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Details
            </button>
          </div>
          <div className="mt-3">
            <CompetencyRadar
              scores={competencyScores}
              benchmarkScores={hasClassBenchmarks ? classAverageScores : undefined}
              studentName="Your Score"
              height={260}
              isDark={isDark}
            />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-500" />
              <span>Competency Breakdown & Mastery Goals</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/student/progress')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Full Progress
            </button>
          </div>

          <div className="space-y-3">
            {(Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).map((dimKey) => {
              const dimension = COMPETENCY_DIMENSIONS[dimKey];
              const score = competencyScores[dimKey] ?? 0;
              return (
                <div key={dimKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {dimension.label}
                    </span>
                    <span className="font-bold font-mono text-stone-900 dark:text-amber-400">
                      {score}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400">
                    {dimension.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Recent Lab Results */}
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Recent Verified Lab Submissions
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('/student/competencies')}
                className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Full Report →
              </button>
            </div>
            {studentSubmissions.length > 0 ? (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {studentSubmissions.slice(0, 3).map((sub) => {
                  const effectiveScore = sub.facultyScore ?? sub.totalScore;
                  return (
                    <div key={sub.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-stone-800 dark:text-stone-200">
                          {EXPERIMENTS.find((e) => e.id === sub.experimentId)?.title || sub.experimentId}
                        </p>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400">
                          Attempt #{sub.attemptNumber} • Submitted {new Date(sub.submittedAt).toLocaleDateString()} •{' '}
                          <span className="capitalize">
                            {(sub.evaluationStatus || 'auto_graded').replace(/_/g, ' ')}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 text-xs font-bold rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {Math.round((Number(effectiveScore) / Number(sub.maxScore || 100)) * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                No submissions yet. Launch an assigned experiment to start earning verified competency credits!
              </p>
            )}
          </div>
        </div>
      </div>

      {selectedMilestone && (
        <DigitalBadgeModal
          status={selectedMilestone}
          studentName={currentUser.name}
          institution={currentUser.institution}
          enrollmentCode={currentUser.enrollmentCode}
          onClose={() => setSelectedMilestone(null)}
          onPractice={(expId) => {
            onSelectExperiment(expId);
            onNavigate('/student/experiments');
          }}
        />
      )}
    </div>
  );
};
