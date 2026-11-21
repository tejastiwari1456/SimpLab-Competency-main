import React from 'react';
import { BookOpen, Calendar, Clock, CheckCircle2, ArrowRight, Award } from 'lucide-react';
import { Assignment } from '../../types';

interface StudentAssignmentsViewProps {
  assignments: Assignment[];
  onSelectExperiment: (expId: string) => void;
  onNavigate: (path: string) => void;
}

export const StudentAssignmentsView: React.FC<StudentAssignmentsViewProps> = ({
  assignments,
  onSelectExperiment,
  onNavigate,
}) => {
  return (
    <div id="student-assignments-view" className="space-y-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <BookOpen className="h-3 w-3" />
            Lab Assignments
          </span>
          <span className="text-xs text-stone-500 dark:text-stone-400">Internal Continuous Assessment</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
          My Assignments & Laboratory Exercises
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-300">
          Complete mandatory virtual apparatus simulations, auto-graded data exercises, and AI viva defenses before respective deadlines.
        </p>
      </div>

      <div className="space-y-3">
        {assignments.map((asg) => (
          <div
            key={asg.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-all hover:border-amber-300 dark:hover:border-amber-700"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase">
                  {asg.status}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due {new Date(asg.dueDate).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {asg.title}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Max Marks: {asg.totalMarks} • Weight Towards Internal Assessment: {asg.weightTowardsInternal}% • Attempts Allowed: {asg.attemptsAllowed}
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
              <span>Launch Lab Session</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
