import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  BookOpen,
  Target,
  Wrench,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { EXPERIMENTS } from '../../data/mockData';
import { Assignment, CompetencyKey, StudentSubmission } from '../../types';
import type { ExperimentSubmitPayload } from '../../App';
import { OhmsLawSim } from '../simulations/OhmsLawSim';
import { TitrationSim } from '../simulations/TitrationSim';
import { PhotoelectricSim } from '../simulations/PhotoelectricSim';
import { ConvexLensSim } from '../simulations/ConvexLensSim';
import { PcrGelSim } from '../simulations/PcrGelSim';
import { AutoGradedTaskPanel, SimulationSnapshot } from '../tasks/AutoGradedTaskPanel';
import { LabMentorChat } from '../mentor/LabMentorChat';

interface StudentExperimentsViewProps {
  selectedExpId: string;
  assignments: Assignment[];
  onSelectExperiment: (id: string) => void;
  onNavigate?: (path: string) => void;
  onVivaCompleted?: () => void;
  onTaskCompleted: (
    taskId: string,
    score: number,
    competency: CompetencyKey
  ) => void;
  onAllCompleted: (payload: ExperimentSubmitPayload) => Promise<StudentSubmission>;
  isDark: boolean;
}

export const StudentExperimentsView: React.FC<StudentExperimentsViewProps> = ({
  selectedExpId,
  assignments,
  onSelectExperiment,
  onNavigate,
  onVivaCompleted,
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

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    activeAssignments[0]?.id || ''
  );
  const [guideOpen, setGuideOpen] = useState<boolean>(true);
  const [guideTab, setGuideTab] = useState<'procedure' | 'objectives' | 'apparatus'>('procedure');
  const [completedSteps, setCompletedSteps] = useState<Record<string, number[]>>({});
  const [simulationSnapshot, setSimulationSnapshot] = useState<SimulationSnapshot | null>(null);

  useEffect(() => {
    if (activeAssignments.length > 0) {
      if (!activeAssignments.some((a) => a.id === selectedAssignmentId)) {
        setSelectedAssignmentId(activeAssignments[0].id);
      }
    } else {
      setSelectedAssignmentId('');
    }
  }, [activeExperiment.id, assignments]);

  useEffect(() => {
    setSimulationSnapshot(null);
  }, [activeExperiment.id]);

  const handleSnapshotChange = useCallback((snapshot: SimulationSnapshot) => {
    setSimulationSnapshot(snapshot);
  }, []);

  const targetAssignment =
    activeAssignments.find((a) => a.id === selectedAssignmentId) ??
    activeAssignments[0];

  const isAssigned = Boolean(targetAssignment);

  const expProcedureSteps = activeExperiment.procedureSteps || [];
  const checkedForExp = completedSteps[activeExperiment.id] || [];

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => {
      const current = prev[activeExperiment.id] || [];
      const next = current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index];
      return { ...prev, [activeExperiment.id]: next };
    });
  };

  return (
    <div id="student-experiments-view" className="space-y-6">
      {/* Syllabus Experiment Selector Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between transition-colors">
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Active Assignment Picker if multiple active assignments exist for this lab */}
      {activeAssignments.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs">
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            Multiple active assignments found for this experiment. Choose the target assignment:
          </span>
          <select
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100"
          >
            {activeAssignments.map((asg) => (
              <option key={asg.id} value={asg.id}>
                {asg.title} (Due {new Date(asg.dueDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Experiment Description, Governing Laws & Assignment Status */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <h1 className="text-base font-bold text-stone-900 dark:text-stone-100 sm:text-lg">
              {activeExperiment.title}
            </h1>
            {targetAssignment && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <Calendar className="h-3 w-3" />
                  {targetAssignment.title} • Due {new Date(targetAssignment.dueDate).toLocaleDateString()}
                </span>
                <span>•</span>
                <span>
                  Attempts: {targetAssignment.completedCount || 0} / {targetAssignment.attemptsAllowed}
                </span>
                <span>•</span>
                <span>{targetAssignment.totalMarks} marks</span>
              </div>
            )}
          </div>

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

      {/* Collapsible Experiment Instructions, Learning Objectives & Apparatus Guide */}
      <div
        id="experiment-instructions-card"
        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs overflow-hidden transition-colors"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-stone-50/80 dark:bg-stone-850/60 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
              Lab Manual: Instructions, Learning Objectives & Apparatus
            </h2>
            {expProcedureSteps.length > 0 && (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                {checkedForExp.length}/{expProcedureSteps.length} steps checked
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setGuideOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 cursor-pointer"
          >
            <span>{guideOpen ? 'Hide Guide' : 'Show Guide'}</span>
            {guideOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {guideOpen && (
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'procedure' as const, label: 'Step-by-Step Procedure', icon: BookOpen },
                { id: 'objectives' as const, label: `Learning Objectives (${activeExperiment.objectives.length})`, icon: Target },
                { id: 'apparatus' as const, label: `Apparatus & Instruments (${activeExperiment.apparatusList.length})`, icon: Wrench },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = guideTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGuideTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {guideTab === 'procedure' && (
              <div className="space-y-2">
                {expProcedureSteps.map((step, idx) => {
                  const isDone = checkedForExp.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleStep(idx)}
                      className={`w-full flex items-start gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-colors cursor-pointer ${
                        isDone
                          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 text-stone-500 dark:text-stone-400 line-through'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/40 text-stone-800 dark:text-stone-200 hover:border-amber-300'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                      )}
                      <span>
                        <strong className="font-mono mr-1.5 text-amber-700 dark:text-amber-400">
                          Step {idx + 1}.
                        </strong>
                        {step}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {guideTab === 'objectives' && (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-stone-700 dark:text-stone-300">
                {activeExperiment.objectives.map((obj, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-850/40 p-2.5"
                  >
                    <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{obj}</span>
                  </li>
                ))}
              </ul>
            )}

            {guideTab === 'apparatus' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-stone-700 dark:text-stone-300">
                {activeExperiment.apparatusList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-850/40 p-2.5"
                  >
                    <Wrench className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Virtual Simulation Apparatus */}
      {isAssigned && targetAssignment ? (
        <>
          {activeExperiment.id === 'exp-ohms-law' && (
            <OhmsLawSim isDark={isDark} onSnapshotChange={handleSnapshotChange} />
          )}

          {activeExperiment.id === 'exp-titration' && (
            <TitrationSim isDark={isDark} />
          )}

          {activeExperiment.id === 'exp-photoelectric' && (
            <PhotoelectricSim isDark={isDark} />
          )}

          {activeExperiment.id === 'exp-convex-lens' && (
            <ConvexLensSim isDark={isDark} onSnapshotChange={handleSnapshotChange} />
          )}

          {activeExperiment.id === 'exp-pcr-gel' && (
            <PcrGelSim isDark={isDark} />
          )}

          {/* Auto-Graded Tasks & Adaptive AI Viva Section */}
          <AutoGradedTaskPanel
            tasks={activeExperiment.tasks}
            experimentId={activeExperiment.id}
            assignmentId={targetAssignment.id}
            experimentTitle={activeExperiment.title}
            attemptsUsed={targetAssignment.completedCount || 0}
            attemptsAllowed={targetAssignment.attemptsAllowed}
            simulationSnapshot={simulationSnapshot}
            onTaskCompleted={onTaskCompleted}
            onVivaCompleted={onVivaCompleted}
            onViewReport={onNavigate ? () => onNavigate('/student/competencies') : undefined}
            onAllCompleted={(payload) =>
              onAllCompleted({
                assignmentId: targetAssignment.id,
                experimentId: activeExperiment.id,
                taskResponses: payload.responses,
                vivaSessionId: payload.vivaSessionId,
                observations: payload.observations,
                calculatedResults: payload.calculatedResults,
                dataReadingsCount: payload.dataReadingsCount,
              })
            }
          />
        </>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Experiment not assigned</strong>

          <p className="mt-1 text-xs">
            Your instructor has not assigned this experiment to your class yet.
            Select any green-marked assigned experiment above to launch its interactive simulation and graded assessment.
          </p>
        </div>
      )}

      {/* Floating Context-Aware Lab Mentor Chat */}
      <LabMentorChat
        experiment={activeExperiment}
        currentStepLabel={
          expProcedureSteps[checkedForExp.length] || 'Experimental Execution & Result Validation'
        }
        apparatusState={simulationSnapshot?.calculatedResults}
        isDark={isDark}
      />
    </div>
  );
};
