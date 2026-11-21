
import React from 'react';
import {
  Users,
  BookOpen,
  ClipboardList,
  FlaskConical,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';
import {
  ClassCourse,
  Assignment,
  StudentSubmission,
  Experiment,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';

interface TeacherOverviewViewProps {
  classes: ClassCourse[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  experiments: Experiment[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onNavigate: (path: string) => void;
  onQuickAssignModal: () => void;
  isDark?: boolean;
}

export const TeacherOverviewView: React.FC<TeacherOverviewViewProps> = ({
  classes,
  assignments,
  submissions,
  experiments,
  selectedClassId,
  onSelectClassId,
  onNavigate,
  onQuickAssignModal,
  isDark = false,
}) => {
  const currentClass =
    classes.find((c) => c.id === selectedClassId) || classes[0];

  const totalStudents = classes.reduce(
    (sum, c) => sum + (Number(c.studentCount) || 0),
    0
  );

  const activeAssignmentsCount = assignments.filter(
    (a) => a.status === 'active'
  ).length;

  // Safe defaults for missing PostgreSQL competency data
  const averageCompetencies = currentClass?.averageCompetencies ?? {
    setup_adherence: 0,
    measurement_precision: 0,
    data_interpretation: 0,
    troubleshooting_safety: 0,
    experimental_design: 0,
  };

  const avgClassScore = Math.round(
    Object.values(averageCompetencies).reduce(
      (sum, score) => sum + (Number(score) || 0),
      0
    ) / 5
  );

  // Handle the case where the teacher has no classes
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
              Department of Applied Sciences
            </span>
          </div>

          <h2 className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
            Welcome back, {currentClass.name ? 'Faculty Member' : 'Teacher'}
          </h2>

          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Monitoring {classes.length} active cohorts across{' '}
            {experiments.length} simulation apparatuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('/teacher/classes')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Class Cohorts
            </span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {classes.length}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {totalStudents} Total Enrolled
          </p>
        </div>

        <div
          onClick={() => onNavigate('/teacher/assignments')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Lab Assignments
            </span>
            <BookOpen className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {activeAssignmentsCount}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {assignments.length} Total Published
          </p>
        </div>

        <div
          onClick={() => onNavigate('/teacher/review')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Submissions
            </span>
            <ClipboardList className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {submissions.length}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Continuous Evaluations Logged
          </p>
        </div>

        <div
          onClick={() => onNavigate('/teacher/analytics')}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">
              Cohort Mastery
            </span>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-3 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {avgClassScore}%
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {currentClass.code} Average
          </p>
        </div>
      </div>

      {/* Cohort Spotlight and Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
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
              {currentClass.studentCount} Students in this cohort
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/teacher/analytics')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full Analytics</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => onNavigate('/teacher/assignments')}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
            >
              <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                Manage Lab Assignments
              </h4>
              <p className="text-xs text-stone-500 mt-1">
                Configure experiment deadlines, weights, and permitted
                simulation attempts.
              </p>
            </div>

            <div
              onClick={() => onNavigate('/teacher/experiments')}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer"
            >
              <FlaskConical className="h-5 w-5 text-amber-500" />
              <h4 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                Simulation Catalog
              </h4>
              <p className="text-xs text-stone-500 mt-1">
                Explore available optics, circuits, and titration simulation
                apparatuses.
              </p>
            </div>
          </div>

          {/* Recent Submissions */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Recent Student Practical Submissions
              </h4>
              <button
                type="button"
                onClick={() => onNavigate('/teacher/review')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({submissions.length})</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
              {submissions.slice(0, 4).map((sub) => (
                <div
                  key={sub.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center font-bold text-stone-700 dark:text-stone-300">
                      {(sub.studentName || 'S').charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 dark:text-stone-100">
                        {sub.studentName || 'Student'}
                      </p>
                      <p className="text-[10px] text-stone-400 font-mono">
                        {sub.experimentId} •{' '}
                        {sub.submittedAt
                          ? new Date(sub.submittedAt).toLocaleDateString()
                          : 'Date unavailable'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {sub.totalScore}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('/teacher/review')}
                      className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-1 text-[11px] hover:bg-indigo-100 cursor-pointer"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
