
import React from 'react';
import { Clock } from 'lucide-react';
import { EXPERIMENTS } from '../../data/mockData';
import { Assignment, CompetencyKey } from '../../types';
import { OhmsLawSim } from '../simulations/OhmsLawSim';
import { TitrationSim } from '../simulations/TitrationSim';
import { PhotoelectricSim } from '../simulations/PhotoelectricSim';
import { ConvexLensSim } from '../simulations/ConvexLensSim';
import { PcrGelSim } from '../simulations/PcrGelSim';
import { AutoGradedTaskPanel } from '../tasks/AutoGradedTaskPanel';
import { LabMentorChat } from '../mentor/LabMentorChat';

interface StudentExperimentsViewProps {
  selectedExpId: string;
  assignments: Assignment[];
  onSelectExperiment: (id: string) => void;
  onTaskCompleted: (
    taskId: string,
    score: number,
    competency: CompetencyKey
  ) => void;
  onAllCompleted: (
    totalScore: number,
    maxScore: number,
    assignmentId: string,
    experimentId: string
  ) => void;
  isDark: boolean;
}

export const StudentExperimentsView: React.FC<StudentExperimentsViewProps> = ({
  selectedExpId,
  assignments,
  onSelectExperiment,
  onTaskCompleted,
  onAllCompleted,
  isDark,
}) => {
  const activeExperiment =
    EXPERIMENTS.find((experiment) => experiment.id === selectedExpId) ??
    EXPERIMENTS[0];

  const activeAssignments = assignments.filter(
    (assignment) =>
      assignment.experimentId === activeExperiment.id &&
      assignment.status === 'active'
  );

  const isAssigned = activeAssignments.length > 0;

  return (
    <div id="student-experiments-view" className="space-y-6">
      {/* Syllabus Experiment Selector Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Syllabus Experiment:
          </span>

          <div className="flex flex-wrap gap-1.5">
            {EXPERIMENTS.map((exp) => {
              const hasAssignment = assignments.some(
                (assignment) =>
                  assignment.experimentId === exp.id &&
                  assignment.status === 'active'
              );

              return (
                <button
                  key={exp.id}
                  type="button"
                  id={`btn-select-exp-${exp.id}`}
                  onClick={() => onSelectExperiment(exp.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    selectedExpId === exp.id
                      ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  <span>{exp.title.split('&')[0].trim()}</span>

                  <span className="rounded bg-black/10 dark:bg-black/20 px-1 text-[10px]">
                    {exp.code}
                  </span>

                  <span
                    title={hasAssignment ? 'Assigned' : 'Not assigned'}
                    className={`h-2 w-2 rounded-full ${
                      hasAssignment ? 'bg-green-500' : 'bg-stone-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-stone-600 dark:text-stone-400">
          Syllabus Unit:{' '}
          <strong className="text-stone-900 dark:text-stone-200">
            {activeExperiment.syllabusTag}
          </strong>
        </div>
      </div>

      {/* Experiment Description & Theory Pills */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <h1 className="text-base font-bold text-stone-900 dark:text-stone-100 sm:text-lg">
            {activeExperiment.title}
          </h1>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-50 dark:bg-amber-950/70 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              {activeExperiment.subject}
            </span>

            <span className="flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
              <Clock className="h-3.5 w-3.5" />
              {activeExperiment.durationMinutes} mins
            </span>
          </div>
        </div>

        <p className="mt-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
          {activeExperiment.description}
        </p>

        {/* Governing Formulas */}
        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-400 self-center">
            Governing Laws:
          </span>

          {activeExperiment.keyFormulas.map((formula, index) => (
            <div
              key={index}
              className="rounded-md border border-stone-200 dark:border-stone-700/80 bg-stone-50 dark:bg-stone-800/70 px-2.5 py-1 text-xs text-stone-800 dark:text-stone-200"
            >
              <span className="text-stone-500 dark:text-stone-400 mr-1.5">
                {formula.label}:
              </span>

              <code className="font-mono font-bold text-stone-900 dark:text-amber-400">
                {formula.formula}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Virtual Simulation Apparatus */}
      {isAssigned ? (
        <>
          {activeExperiment.id === 'exp-ohms-law' && (
            <OhmsLawSim isDark={isDark} />
          )}

          {activeExperiment.id === 'exp-titration' && (
            <TitrationSim isDark={isDark} />
          )}

          {activeExperiment.id === 'exp-photoelectric' && (
            <PhotoelectricSim isDark={isDark} />
          )}

          {activeExperiment.id === 'exp-convex-lens' && (
            <ConvexLensSim isDark={isDark} />
          )}

          {activeExperiment.id === 'exp-pcr-gel' && (
            <PcrGelSim isDark={isDark} />
          )}

          {/* Auto-Graded Tasks & AI Viva Section */}
        <AutoGradedTaskPanel
          tasks={activeExperiment.tasks}
          experimentTitle={activeExperiment.title}
          onTaskCompleted={onTaskCompleted}
          onAllCompleted={(totalScore, maxScore,responses) => {
            if (activeAssignments.length !== 1) {
              throw new Error(
                'Unable to identify a unique active assignment. Please select the correct assignment before submitting.'
              );
            }

            const assignment = activeAssignments[0];

            return onAllCompleted(
              totalScore,
              maxScore,
              assignment.id,
              activeExperiment.id,
              responses
            );
          }}
        />
        </>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Experiment not assigned</strong>

          <p className="mt-1">
            Your teacher has not assigned this experiment to your class.
            The simulation and assessment are unavailable until an active
            assignment is created for you.
          </p>
        </div>
      )}

      {/* Floating Context-Aware Lab Mentor Chat */}
      <LabMentorChat experiment={activeExperiment} isDark={isDark} />
    </div>
  );
};
