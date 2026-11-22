import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Assignment, StudentSubmission } from '../../types';

interface StudentAssignmentsViewProps {
  assignments: Assignment[];
  submissions: StudentSubmission[];
  isLoading: boolean;
  onSelectExperiment: (expId: string) => void;
  onNavigate: (path: string) => void;
}

type AssignmentFilter = 'all' | 'pending' | 'completed';

export const StudentAssignmentsView: React.FC<StudentAssignmentsViewProps> = ({
  assignments,
  submissions,
  isLoading,
  onSelectExperiment,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<AssignmentFilter>('all');

  const enriched = assignments.map((asg) => {
    const asgSubs = submissions.filter((s) => s.assignmentId === asg.id);
    const attemptsUsed = asgSubs.length;
    const bestPct =
      asgSubs.length > 0
        ? Math.max(
            ...asgSubs.map((s) =>
              Math.round(
                (Number(s.facultyScore ?? s.totalScore) / Number(s.maxScore || 100)) * 100
              )
            )
          )
        : null;
    const latestSub = [...asgSubs].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
    const needsRevision = latestSub?.evaluationStatus === 'needs_revision';
    const isCompleted = attemptsUsed > 0 && !needsRevision;
    const dueMs = new Date(asg.dueDate).getTime();
    const daysLeft = Math.ceil((dueMs - Date.now()) / (1000 * 60 * 60 * 24));
    const isOverdue = !isCompleted && daysLeft < 0;
    const isDueSoon = !isCompleted && daysLeft >= 0 && daysLeft <= 3;

    return {
      asg,
      attemptsUsed,
      bestPct,
      latestSub,
      needsRevision,
      isCompleted,
      daysLeft,
      isOverdue,
      isDueSoon,
    };
  });

  const filtered = enriched.filter((item) => {
    if (filter === 'pending') return !item.isCompleted;
    if (filter === 'completed') return item.isCompleted;
    return true;
  });

  const pendingCount = enriched.filter((i) => !i.isCompleted).length;
  const completedCount = enriched.filter((i) => i.isCompleted).length;

  return (
    <div id="student-assignments-view" className="space-y-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <BookOpen className="h-3 w-3" />
              Lab Assignments
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Internal Continuous Assessment
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            My Assignments & Laboratory Exercises
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Complete mandatory virtual apparatus simulations, auto-graded data exercises, and adaptive AI viva defenses before deadlines.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-1 shrink-0">
          {(
            [
              { id: 'all', label: `All (${enriched.length})` },
              { id: 'pending', label: `Pending (${pendingCount})` },
              { id: 'completed', label: `Completed (${completedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && assignments.length === 0 ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-200/70 dark:bg-stone-800/70" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
            {filter === 'pending'
              ? 'No pending assignments remaining'
              : filter === 'completed'
              ? 'No completed assignments yet'
              : 'No assignments published to your enrolled classes yet'}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {filter === 'pending'
              ? 'Great work! All active lab exercises have at least one verified submission.'
              : 'Once you launch and submit a lab experiment, your progress and verified scores will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(
            ({
              asg,
              attemptsUsed,
              bestPct,
              latestSub,
              needsRevision,
              isCompleted,
              daysLeft,
              isOverdue,
              isDueSoon,
            }) => {
              const attemptsExhausted = attemptsUsed >= asg.attemptsAllowed;
              return (
                <div
                  key={asg.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-all hover:border-amber-300 dark:hover:border-amber-700"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {asg.classCode && (
                        <span className="rounded bg-stone-900 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-stone-700">
                          {asg.classCode}
                        </span>
                      )}
                      {needsRevision ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase">
                          <AlertTriangle className="h-3 w-3" />
                          Needs Revision
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase">
                          <CheckCircle2 className="h-3 w-3" />
                          Completed • Best {bestPct}%
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase">
                          Not Started
                        </span>
                      )}

                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          <Clock className="h-3 w-3" />
                          Overdue
                        </span>
                      )}

                      {isDueSoon && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          <Clock className="h-3 w-3" />
                          Due in {daysLeft === 0 ? 'today' : `${daysLeft}d`}
                        </span>
                      )}

                      <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due{' '}
                        {new Date(asg.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {asg.title}
                    </h3>

                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Max Marks: {asg.totalMarks} • Internal Weight: {asg.weightTowardsInternal}% •
                      Attempts Used:{' '}
                      <strong className="font-mono text-stone-800 dark:text-stone-200">
                        {attemptsUsed} / {asg.attemptsAllowed}
                      </strong>
                      {latestSub?.evaluationStatus && (
                        <>
                          {' '}
                          • Status:{' '}
                          <span className="capitalize font-medium text-stone-700 dark:text-stone-300">
                            {latestSub.evaluationStatus.replace(/_/g, ' ')}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectExperiment(asg.experimentId);
                      onNavigate('/student/experiments');
                    }}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    <span>
                      {attemptsExhausted
                        ? 'Open Lab Workspace'
                        : attemptsUsed > 0
                        ? 'Retry / Review Lab'
                        : 'Launch Lab Session'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};
