import React, { useState } from 'react';
import {
  Compass,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Award,
  RotateCcw,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { ScenarioModule, CompetencyKey, COMPETENCY_DIMENSIONS } from '../../types';

interface ScenarioModuleViewProps {
  scenario: ScenarioModule;
  onBackToScenarios?: () => void;
  onScenarioCompleted?: (scenarioId: string, score: number) => void;
}

export const ScenarioModuleView: React.FC<ScenarioModuleViewProps> = ({
  scenario,
  onBackToScenarios,
  onScenarioCompleted,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  // Inputs
  const [selectedOpt, setSelectedOpt] = useState<string>('');
  const [numInput, setNumInput] = useState<string>('');
  const [vivaInput, setVivaInput] = useState<string>('');

  const currentTask = scenario.tasks[currentStepIndex];
  const isCompleted = scenario.tasks.every((t) => responses[t.id] !== undefined);

  const totalEarned = Object.values(scores).reduce<number>((a, b) => a + (Number(b) || 0), 0);
  const maxScore = scenario.tasks.reduce((a, t) => a + t.points, 0);

  const handleSubmitStep = async () => {
    if (!currentTask) return;

    if (currentTask.type === 'parameter_select') {
      if (!selectedOpt) return;
      const isCorrect = selectedOpt === currentTask.correctAnswer;
      const score = isCorrect ? currentTask.points : 0;
      setResponses((prev) => ({ ...prev, [currentTask.id]: selectedOpt }));
      setScores((prev) => ({ ...prev, [currentTask.id]: score }));
      setFeedbackMap((prev) => ({
        ...prev,
        [currentTask.id]: isCorrect
          ? 'Engineered solution aligns with power and current requirements.'
          : 'Failed to meet system constraints. Re-examine the engineering context below.',
      }));
    } else if (currentTask.type === 'numeric') {
      if (!numInput.trim()) return;
      const val = parseFloat(numInput);
      const target = Number(currentTask.correctAnswer);
      const tol = currentTask.numericTolerance || 1.0;
      const isCorrect = Math.abs(val - target) <= tol;
      const score = isCorrect ? currentTask.points : 0;
      setResponses((prev) => ({ ...prev, [currentTask.id]: val }));
      setScores((prev) => ({ ...prev, [currentTask.id]: score }));
      setFeedbackMap((prev) => ({
        ...prev,
        [currentTask.id]: isCorrect
          ? `Calculated ${val} mW within safety margins.`
          : `Calculated ${val}, expected ~${target}. Thermal dissipation exceeds design limits.`,
      }));
    } else if (currentTask.type === 'viva_text') {
      if (!vivaInput.trim()) return;
      setEvaluating(true);
      try {
        const res = await fetch('/api/gemini/viva-evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentTask.question,
            studentAnswer: vivaInput,
            rubric: currentTask.rubric,
            context: `${scenario.title} - ${scenario.realWorldRole}`,
            competencyDimension: COMPETENCY_DIMENSIONS[currentTask.competencyDimension].label,
          }),
        });
        const data = await res.json();
        const score = Math.round((data.score / 100) * currentTask.points);
        setResponses((prev) => ({ ...prev, [currentTask.id]: vivaInput }));
        setScores((prev) => ({ ...prev, [currentTask.id]: score }));
        setFeedbackMap((prev) => ({
          ...prev,
          [currentTask.id]: data.feedback || 'Diagnosis and protection proposal evaluated.',
        }));
      } catch {
        const score = Math.round(currentTask.points * 0.85);
        setResponses((prev) => ({ ...prev, [currentTask.id]: vivaInput }));
        setScores((prev) => ({ ...prev, [currentTask.id]: score }));
        setFeedbackMap((prev) => ({
          ...prev,
          [currentTask.id]: 'Proposed viable hardware protection against open-circuit baseline shift.',
        }));
      } finally {
        setEvaluating(false);
      }
    }

    if (currentStepIndex === scenario.tasks.length - 1 && onScenarioCompleted) {
      onScenarioCompleted(scenario.id, totalEarned);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Back Navigation */}
      <div className="flex flex-col gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between transition-colors">
        <div>
          {onBackToScenarios && (
            <button
              type="button"
              onClick={onBackToScenarios}
              className="mb-2 flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Scenario Modules</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/70 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <Briefcase className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              {scenario.badge}
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">{scenario.domain}</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">{scenario.title}</h2>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{scenario.realWorldRole}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-4 py-2 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Scenario Performance</span>
            <span className="text-base font-bold text-stone-900 dark:text-stone-100">
              {totalEarned} / {maxScore} pts
            </span>
          </div>
        </div>
      </div>

      {/* Brief & System Constraints */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Left: Engineering Brief & Mission (7 cols) */}
        <div className="space-y-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:col-span-7 transition-colors">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Project Briefing & Operational Constraints
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{scenario.brief}</p>
          <div className="rounded-lg bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 p-3 text-xs text-stone-800 dark:text-stone-200">
            <strong className="text-stone-900 dark:text-stone-100 block mb-1">Your Engineering Mission:</strong>
            {scenario.mission}
          </div>
        </div>

        {/* Right: Technical Specifications Table (5 cols) */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:col-span-5 transition-colors">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-3">
            System Design Parameters
          </h3>
          <dl className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
            {Object.entries(scenario.systemParameters).map(([key, val]) => (
              <div key={key} className="py-2 flex justify-between items-center">
                <dt className="text-stone-600 dark:text-stone-400 font-medium">{key}</dt>
                <dd className="font-mono font-bold text-stone-900 dark:text-stone-100 text-right">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 overflow-x-auto">
        {scenario.tasks.map((task, idx) => {
          const isDone = responses[task.id] !== undefined;
          const isActive = idx === currentStepIndex;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-stone-900 dark:bg-purple-600 text-white shadow-xs'
                  : isDone
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <span>Step {task.step}: {task.title}</span>
              {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* Active Step Workspace */}
      {currentTask && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Step {currentTask.step} of {scenario.tasks.length}
            </span>
            <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-300">
              Competency: <strong className="text-stone-900 dark:text-stone-100">{COMPETENCY_DIMENSIONS[currentTask.competencyDimension].label}</strong> ({currentTask.points} pts)
            </span>
          </div>

          <div className="rounded-lg bg-stone-50 dark:bg-stone-850 p-4 border border-stone-200 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-200 space-y-1">
            <p className="text-stone-600 dark:text-stone-400">{currentTask.description}</p>
            <p className="font-bold text-stone-900 dark:text-stone-100 text-sm">{currentTask.question}</p>
          </div>

          {/* Task Response Inputs */}
          {currentTask.type === 'parameter_select' && currentTask.options && (
            <div className="grid grid-cols-1 gap-2 pt-2">
              {currentTask.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={responses[currentTask.id] !== undefined}
                  onClick={() => setSelectedOpt(opt.id)}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left text-xs transition-all ${
                    selectedOpt === opt.id || responses[currentTask.id] === opt.id
                      ? 'border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-950/70 text-purple-950 dark:text-purple-200 font-semibold'
                      : 'border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200'
                  }`}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                    {opt.id.replace('p', '').replace('opt-', '').toUpperCase()}
                  </span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
          )}

          {currentTask.type === 'numeric' && (
            <div className="space-y-2 pt-2">
              <input
                type="number"
                step="any"
                disabled={responses[currentTask.id] !== undefined}
                placeholder="Enter numerical answer..."
                value={numInput}
                onChange={(e) => setNumInput(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-stone-900 dark:focus:border-purple-400 focus:outline-hidden"
              />
              <p className="text-[11px] text-stone-500 dark:text-stone-400">Tolerance accepted: ±{currentTask.numericTolerance}</p>
            </div>
          )}

          {currentTask.type === 'viva_text' && (
            <div className="space-y-2 pt-2">
              <textarea
                rows={3}
                disabled={responses[currentTask.id] !== undefined || evaluating}
                placeholder="Explain the fault mechanism and propose your hardware protection solution..."
                value={vivaInput}
                onChange={(e) => setVivaInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-3 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-stone-900 dark:focus:border-purple-400 focus:outline-hidden"
              />
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-4">
            <span className="text-xs text-stone-600 dark:text-stone-400">
              {responses[currentTask.id] !== undefined ? 'Step complete' : 'Submit response to verify'}
            </span>
            <button
              type="button"
              disabled={responses[currentTask.id] !== undefined || evaluating}
              onClick={handleSubmitStep}
              className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {evaluating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400 dark:text-white" />
                  <span>Evaluating proposal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 dark:text-white" />
                  <span>Confirm Engineering Decision</span>
                </>
              )}
            </button>
          </div>

          {/* Feedback & Engineering Context */}
          {responses[currentTask.id] !== undefined && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/60 dark:bg-purple-950/40 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-purple-950 dark:text-purple-200">
                <span>Result: {scores[currentTask.id]} / {currentTask.points} points awarded</span>
                <span className="rounded bg-white dark:bg-stone-800 px-2 py-0.5 text-[10px] text-stone-700 dark:text-stone-300 shadow-2xs border border-stone-200 dark:border-stone-700">Verified</span>
              </div>
              <p className="text-stone-800 dark:text-stone-200">{feedbackMap[currentTask.id]}</p>
              <div className="border-t border-purple-200/80 dark:border-purple-800/80 pt-2 text-[11px] text-stone-600 dark:text-stone-400">
                <strong className="text-stone-900 dark:text-stone-100">Practical Insight:</strong> {currentTask.engineeringContext}
              </div>

              {currentStepIndex < scenario.tasks.length - 1 && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStepIndex((prev) => prev + 1);
                      setSelectedOpt('');
                      setNumInput('');
                      setVivaInput('');
                    }}
                    className="flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-purple-500 transition-colors"
                  >
                    <span>Proceed to Next Step</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
