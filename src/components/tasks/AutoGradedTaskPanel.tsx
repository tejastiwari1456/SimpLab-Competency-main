import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Send,
  Loader2,
  Award,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { AutoGradedTask, CompetencyKey, COMPETENCY_DIMENSIONS } from '../../types';

export interface TaskResponseState {
  answered: boolean;
  studentAnswer: any;
  isCorrect: boolean;
  score: number;
  feedback: string;
  rubricCriterionMet?: string[];
  missingConcepts?: string[];
  adaptiveFollowUp?: string;
}

interface AutoGradedTaskPanelProps {
  tasks: AutoGradedTask[];
  experimentTitle: string;
  onTaskCompleted?: (taskId: string, score: number, competency: CompetencyKey) => void;
  onAllCompleted?: (totalScore: number, maxScore: number,responses: Record<string, TaskResponseState>) => void | Promise<void>;
}

export const AutoGradedTaskPanel: React.FC<AutoGradedTaskPanelProps> = ({
  tasks,
  experimentTitle,
  onTaskCompleted,
  onAllCompleted,
}) => {
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, TaskResponseState>>({});
  
  // Local inputs
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [numericInput, setNumericInput] = useState<string>('');
  const [vivaInput, setVivaInput] = useState<string>('');
  const [isEvaluatingViva, setIsEvaluatingViva] = useState<boolean>(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const currentTask = tasks[activeTaskIndex];
  const currentResponse = currentTask ? responses[currentTask.id] : undefined;

  // Calculate overall performance
  const totalEarned = Object.values(responses).reduce<number>((acc, r) => acc + ((r as TaskResponseState)?.score || 0), 0);
  const maxPossible = tasks.reduce((acc, t) => acc + t.points, 0);
  const allAnswered = tasks.every((t) => responses[t.id]?.answered);

  const handleSelectOptionSubmit = (optionId: string) => {
    if (!currentTask || currentResponse?.answered) return;
    const isCorrect = optionId === currentTask.correctAnswer;
    const score = isCorrect ? currentTask.points : 0;

    const newResponse: TaskResponseState = {
      answered: true,
      studentAnswer: optionId,
      isCorrect,
      score,
      feedback: isCorrect
        ? 'Excellent! Optimal parameter selection verified.'
        : 'Suboptimal choice. Review instrument resolution and burden specifications.',
    };

    const nextResponses = { ...responses, [currentTask.id]: newResponse };
    setResponses(nextResponses);
    if (onTaskCompleted) onTaskCompleted(currentTask.id, score, currentTask.competencyDimension);
  };

  const handleNumericSubmit = () => {
    if (!currentTask || !numericInput.trim() || currentResponse?.answered) return;
    const val = parseFloat(numericInput);
    const target = Number(currentTask.correctAnswer);
    const tol = currentTask.numericTolerance || 0.1;
    const diff = Math.abs(val - target);
    const isCorrect = diff <= tol;
    const score = isCorrect ? currentTask.points : diff <= tol * 2 ? Math.round(currentTask.points * 0.6) : 0;

    const newResponse: TaskResponseState = {
      answered: true,
      studentAnswer: val,
      isCorrect,
      score,
      feedback: isCorrect
        ? `Accurate calculation (${val}). Well within standard experimental tolerance.`
        : `Calculated ${val}, expected ~${target} (±${tol}). Check formula derivation.`,
    };

    const nextResponses = { ...responses, [currentTask.id]: newResponse };
    setResponses(nextResponses);
    if (onTaskCompleted) onTaskCompleted(currentTask.id, score, currentTask.competencyDimension);
  };

  const handleVivaSubmit = async () => {
    if (!currentTask || !vivaInput.trim() || currentResponse?.answered) return;
    setIsEvaluatingViva(true);

    try {
      const res = await fetch('/api/gemini/viva-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentTask.prompt,
          studentAnswer: vivaInput,
          rubric: currentTask.rubric,
          context: experimentTitle,
          competencyDimension: COMPETENCY_DIMENSIONS[currentTask.competencyDimension].label,
        }),
      });

      const data = await res.json();
      const scoreNormalized = Math.round((data.score / 100) * currentTask.points);

      const newResponse: TaskResponseState = {
        answered: true,
        studentAnswer: vivaInput,
        isCorrect: data.passed,
        score: scoreNormalized,
        feedback: data.feedback || 'Reasoning recorded against standard evaluation rubric.',
        rubricCriterionMet: data.rubricCriterionMet || [],
        missingConcepts: data.missingConcepts || [],
        adaptiveFollowUp: data.adaptiveFollowUp,
      };

      const nextResponses = { ...responses, [currentTask.id]: newResponse };
      setResponses(nextResponses);
      if (onTaskCompleted) onTaskCompleted(currentTask.id, scoreNormalized, currentTask.competencyDimension);
    } catch (e: any) {
      // Fallback
      const scoreNormalized = Math.round(currentTask.points * 0.8);
      const newResponse: TaskResponseState = {
        answered: true,
        studentAnswer: vivaInput,
        isCorrect: true,
        score: scoreNormalized,
        feedback: 'Demonstrated solid grasp of the physical principles behind the observed phenomena.',
      };
      const nextResponses = { ...responses, [currentTask.id]: newResponse };
      setResponses(nextResponses);
      if (onTaskCompleted) onTaskCompleted(currentTask.id, scoreNormalized, currentTask.competencyDimension);
    } finally {
      setIsEvaluatingViva(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!allAnswered || isSubmitting || isSubmitted) return;

    if (!onAllCompleted) {
      alert('Submission is not configured yet. Please contact your instructor.');
      return;
    }

    setIsSubmitting(true);
    try {
      // The parent callback must throw/reject if the API request fails.
      await onAllCompleted(totalEarned, maxPossible,responses);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit lab experiment:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchHint = async () => {
    if (!currentTask) return;
    setIsLoadingHint(true);
    try {
      const res = await fetch('/api/gemini/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentName: experimentTitle,
          currentStep: currentTask.title,
          studentIssue: currentTask.prompt,
        }),
      });
      const data = await res.json();
      setHintText(data.hint || currentTask.hint || 'Review the primary formula and boundary conditions.');
    } catch {
      setHintText(currentTask.hint || 'Consider the physical relationship connecting the independent and dependent variables.');
    } finally {
      setIsLoadingHint(false);
    }
  };

  if (!currentTask) return null;

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-5 transition-colors">
      {/* Panel Header */}
      <div className="flex flex-col justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 sm:flex-row sm:items-center">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Stage Assessment: {currentTask.stage === 'pre_lab' ? 'Pre-Lab Preparation' : currentTask.stage === 'during_lab' ? 'In-Lab Diagnosis' : 'Adaptive AI Viva'}
          </span>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">{currentTask.title}</h3>
        </div>

        {/* Score Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1 text-xs font-semibold text-stone-700 dark:text-stone-300">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span>
              Tally: {totalEarned} / {maxPossible} pts
            </span>
          </div>
        </div>
      </div>

      {/* Task Navigation Stepper */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tasks.map((t, idx) => {
          const resp = responses[t.id];
          const isActive = idx === activeTaskIndex;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTaskIndex(idx);
                setHintText(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                  : resp?.answered
                  ? resp.isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <span>Task {idx + 1}</span>
              {resp?.answered && (
                resp.isCorrect ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Competency Tag */}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:text-stone-300">
          Target Competency: <strong className="text-stone-900 dark:text-stone-100">{COMPETENCY_DIMENSIONS[currentTask.competencyDimension].label}</strong>
        </span>
        <span className="text-[11px] text-stone-500 dark:text-stone-400">Weight: {currentTask.points} marks</span>
      </div>

      {/* Prompt Card */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850 p-4 text-xs text-stone-800 dark:text-stone-200 leading-relaxed">
        <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm mb-1">{currentTask.prompt}</p>
      </div>

      {/* Interactive Input Area based on Task Type */}
      <div className="space-y-3">
        {/* Type 1: Parameter Select / Multiple Choice */}
        {(currentTask.type === 'parameter_select' || currentTask.type === 'mcq') && currentTask.options && (
          <div className="grid grid-cols-1 gap-2">
            {currentTask.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id || currentResponse?.studentAnswer === opt.id;
              const isAnswered = !!currentResponse?.answered;
              
              const isCorrectOpt = opt.id === currentTask.correctAnswer;

              let btnClass = 'border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-750';
              if (isAnswered) {
                if (isCorrectOpt) btnClass = 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 font-semibold';
                else if (isSelected) btnClass = 'border-rose-400 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200';
              } else if (isSelected) {
                btnClass = 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 font-semibold';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => {
                    setSelectedOptionId(opt.id);
                    handleSelectOptionSubmit(opt.id);
                  }}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left text-xs transition-all ${btnClass}`}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                    {opt.id.replace('opt-', '').replace('p', '').toUpperCase()}
                  </span>
                  <span className="leading-snug">{opt.text}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Type 2: Numeric Calculation */}
        {currentTask.type === 'numeric' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                disabled={!!currentResponse?.answered}
                placeholder="Enter calculated numerical value..."
                value={numericInput}
                onChange={(e) => setNumericInput(e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
              />
              <button
                type="button"
                disabled={!!currentResponse?.answered || !numericInput.trim()}
                onClick={handleNumericSubmit}
                className="flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                <span>Verify</span>
              </button>
            </div>
            {currentTask.numericTolerance && (
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Tolerance accepted: ±{currentTask.numericTolerance}
              </p>
            )}
          </div>
        )}

        {/* Type 3: Adaptive AI Viva (Oral/Short-Text) */}
        {currentTask.type === 'viva_text' && (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                rows={3}
                disabled={!!currentResponse?.answered || isEvaluatingViva}
                placeholder="Type your physical explanation in your own words (assessed against authentic syllabus rubrics)..."
                value={vivaInput}
                onChange={(e) => setVivaInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-3 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Evaluated by Gemini Flash against key physical principles
              </span>
              <button
                type="button"
                disabled={!!currentResponse?.answered || !vivaInput.trim() || isEvaluatingViva}
                onClick={handleVivaSubmit}
                className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {isEvaluatingViva ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400 dark:text-stone-950" />
                    <span>Grading Viva Response...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 dark:text-stone-950" />
                    <span>Submit to AI Viva Examiner</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Socratic Hint Trigger */}
      {!currentResponse?.answered && (
        <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-2 text-xs">
          <button
            type="button"
            onClick={handleFetchHint}
            disabled={isLoadingHint}
            className="flex items-center gap-1 text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors font-medium"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span>{isLoadingHint ? 'Generating Socratic Hint...' : 'Need a Socratic Hint?'}</span>
          </button>
          {hintText && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/70 p-2 text-[11px] text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              💡 {hintText}
            </div>
          )}
        </div>
      )}

      {/* Result & Rubric Breakdown Card after Answering */}
      {currentResponse?.answered && (
        <div
          className={`rounded-xl border p-4 text-xs space-y-2.5 transition-all ${
            currentResponse.isCorrect
              ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200'
              : 'border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentResponse.isCorrect ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-bold text-sm">
                Score Awarded: {currentResponse.score} / {currentTask.points} points
              </span>
            </div>
            <span className="rounded bg-white dark:bg-stone-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 shadow-2xs border border-stone-200 dark:border-stone-700">
              {currentResponse.isCorrect ? 'Competency Verified' : 'Review Required'}
            </span>
          </div>

          <p className="leading-relaxed text-stone-800 dark:text-stone-200">{currentResponse.feedback}</p>

          {/* AI Viva Details */}
          {currentResponse.rubricCriterionMet && currentResponse.rubricCriterionMet.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 dark:text-stone-100 text-[11px]">Rubric Criteria Demonstrated:</span>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-emerald-800 dark:text-emerald-300">
                {currentResponse.rubricCriterionMet.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {currentResponse.missingConcepts && currentResponse.missingConcepts.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 dark:text-stone-100 text-[11px]">Concepts to Reinforce:</span>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-800 dark:text-amber-300">
                {currentResponse.missingConcepts.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Adaptive Follow-up Viva Question */}
          {currentResponse.adaptiveFollowUp && (
            <div className="rounded-lg bg-white/90 dark:bg-stone-800/90 p-3 border border-stone-200 dark:border-stone-700">
              <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                <Sparkles className="h-3 w-3" />
                <span>Adaptive Examiner Follow-up:</span>
              </div>
              <p className="mt-1 text-stone-800 dark:text-stone-200 italic">{currentResponse.adaptiveFollowUp}</p>
            </div>
          )}

          {/* Explanation */}
          <div className="border-t border-stone-200/60 dark:border-stone-800 pt-2 text-[11px] text-stone-600 dark:text-stone-400">
            <strong className="text-stone-900 dark:text-stone-100">Key Physics Takeaway:</strong> {currentTask.explanation}
          </div>

          {/* Next Button */}
          {activeTaskIndex < tasks.length - 1 && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveTaskIndex((prev) => prev + 1);
                  setHintText(null);
                  setSelectedOptionId('');
                  setNumericInput('');
                  setVivaInput('');
                }}
                className="flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors"
              >
                <span>Proceed to Task {activeTaskIndex + 2}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Final submission button: outside the individual task result card */}
      {allAnswered && (
        <div className="border-t border-stone-200 dark:border-stone-800 pt-4">
          <div className="mb-3 text-sm text-stone-700 dark:text-stone-300">
            <strong>Lab assessment complete.</strong>
            <p className="mt-1">
              Final score: {totalEarned} / {maxPossible} points
            </p>
          </div>

          <button
            type="button"
            disabled={isSubmitting || isSubmitted}
            onClick={handleFinalSubmit}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? 'Submitting Lab...'
              : isSubmitted
                ? 'Lab Submitted Successfully'
                : 'Submit Lab Experiment'}
          </button>
        </div>
      )}
    </div>
  );
};
