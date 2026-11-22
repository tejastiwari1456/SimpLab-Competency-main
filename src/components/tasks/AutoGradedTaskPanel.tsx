import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Lightbulb,
  Loader2,
  Award,
  ChevronRight,
  AlertCircle,
  BarChart3,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  AutoGradedTask,
  CompetencyKey,
  COMPETENCY_DIMENSIONS,
  StudentSubmission,
  VivaSessionRecord,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

export interface TaskResponseState {
  answered: boolean;
  studentAnswer: any;
  isCorrect: boolean;
  score: number;
  feedback: string;
  rubricCriterionMet?: string[];
  missingConcepts?: string[];
  adaptiveFollowUp?: string;
  difficulty?: 'foundation' | 'intermediate' | 'advanced';
  nextDifficulty?: 'foundation' | 'intermediate' | 'advanced';
  followUpAnswered?: boolean;
  followUpAnswer?: string;
  followUpScore?: number;
  followUpFeedback?: string;
  followUpDifficulty?: 'foundation' | 'intermediate' | 'advanced';
}

export interface SimulationSnapshot {
  observations: Record<string, unknown>;
  calculatedResults: Record<string, unknown>;
  readingsCount: number;
}

export interface TaskPanelSubmitPayload {
  responses: Record<string, TaskResponseState>;
  vivaSessionId: string | null;
  observations: Record<string, any>;
  calculatedResults: Record<string, any>;
  dataReadingsCount: number;
}

interface AutoGradedTaskPanelProps {
  tasks: AutoGradedTask[];
  experimentId: string;
  assignmentId?: string;
  experimentTitle: string;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  simulationSnapshot?: SimulationSnapshot | null;
  onTaskCompleted?: (taskId: string, score: number, competency: CompetencyKey) => void;
  onVivaCompleted?: () => void;
  onViewReport?: () => void;
  onAllCompleted?: (payload: TaskPanelSubmitPayload) => Promise<StudentSubmission | void>;
}

function difficultyBadgeStyle(level?: string) {
  if (level === 'advanced') {
    return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
  }
  if (level === 'foundation') {
    return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
  }
  return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
}

export const AutoGradedTaskPanel: React.FC<AutoGradedTaskPanelProps> = ({
  tasks,
  experimentId,
  assignmentId,
  experimentTitle,
  attemptsUsed = 0,
  attemptsAllowed,
  simulationSnapshot,
  onTaskCompleted,
  onVivaCompleted,
  onViewReport,
  onAllCompleted,
}) => {
  const { token } = useAuth();
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, TaskResponseState>>({});

  // Local inputs
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [numericInput, setNumericInput] = useState<string>('');
  const [vivaInput, setVivaInput] = useState<string>('');
  const [followUpInput, setFollowUpInput] = useState<string>('');
  const [observationNotes, setObservationNotes] = useState<string>('');
  const [vivaSessionId, setVivaSessionId] = useState<string | null>(null);
  const [vivaSession, setVivaSession] = useState<VivaSessionRecord | null>(null);
  const [isEvaluatingViva, setIsEvaluatingViva] = useState<boolean>(false);
  const [isEvaluatingFollowUp, setIsEvaluatingFollowUp] = useState<boolean>(false);
  const [isFinalizingViva, setIsFinalizingViva] = useState<boolean>(false);
  const [vivaError, setVivaError] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<StudentSubmission | null>(null);

  const resetAttemptState = () => {
    setActiveTaskIndex(0);
    setResponses({});
    setSelectedOptionId('');
    setNumericInput('');
    setVivaInput('');
    setFollowUpInput('');
    setObservationNotes('');
    setVivaSessionId(null);
    setVivaSession(null);
    setVivaError(null);
    setHintText(null);
    setIsSubmitting(false);
    setIsSubmitted(false);
    setSubmitError(null);
    setSubmittedRecord(null);
  };

  // Reset state whenever the active experiment or assignment changes
  useEffect(() => {
    resetAttemptState();
  }, [experimentId, assignmentId]);

  const currentTask = tasks[activeTaskIndex];
  const currentResponse = currentTask ? responses[currentTask.id] : undefined;

  const totalEarned =
    Math.round(
      Object.values(responses).reduce<number>(
        (acc, r) => acc + ((r as TaskResponseState)?.score || 0),
        0
      ) * 10
    ) / 10;
  const maxPossible = tasks.reduce((acc, t) => acc + t.points, 0);
  const allAnswered = tasks.length > 0 && tasks.every((t) => responses[t.id]?.answered);

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
        ? 'Correct selection verified against experimental protocol.'
        : 'Incorrect selection. Review the governing formula and instrument setup below.',
    };

    setResponses((prev) => ({ ...prev, [currentTask.id]: newResponse }));
    if (onTaskCompleted) onTaskCompleted(currentTask.id, score, currentTask.competencyDimension);
  };

  const handleNumericSubmit = () => {
    if (!currentTask || !numericInput.trim() || currentResponse?.answered) return;
    const val = parseFloat(numericInput);
    if (!Number.isFinite(val)) return;

    const target = Number(currentTask.correctAnswer);
    const tol = currentTask.numericTolerance ?? 0.5;
    const diff = Math.abs(val - target);
    const isCorrect = diff <= tol;
    // Aligned strictly with authoritative server tolerance grading
    const score = isCorrect ? currentTask.points : 0;

    const newResponse: TaskResponseState = {
      answered: true,
      studentAnswer: val,
      isCorrect,
      score,
      feedback: isCorrect
        ? `Accurate calculation (${val}). Verified within accepted experimental tolerance (±${tol}).`
        : `Entered ${val}, outside the accepted experimental tolerance around ${target} (±${tol}). Review the formula derivation below.`,
    };

    setResponses((prev) => ({ ...prev, [currentTask.id]: newResponse }));
    if (onTaskCompleted) onTaskCompleted(currentTask.id, score, currentTask.competencyDimension);
  };

  const handleVivaSubmit = async () => {
    if (!currentTask || !vivaInput.trim() || currentResponse?.answered) return;
    setIsEvaluatingViva(true);
    setVivaError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/gemini/viva-evaluate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: vivaSessionId ?? undefined,
          experimentId,
          assignmentId: assignmentId ?? undefined,
          taskId: currentTask.id,
          questionIndex: 0,
          question: currentTask.prompt,
          studentAnswer: vivaInput.trim(),
          rubric: currentTask.rubric,
          context: experimentTitle,
          competencyDimension: COMPETENCY_DIMENSIONS[currentTask.competencyDimension].label,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || `AI Viva evaluation failed (HTTP ${res.status}). Please retry.`
        );
      }

      if (data.vivaSessionId) {
        setVivaSessionId(data.vivaSessionId);
      }
      if (data.session) {
        setVivaSession(data.session);
      }

      const rawScore = Number(data.score ?? 0);
      const scoreNormalized =
        Math.round((Math.max(0, Math.min(100, rawScore)) / 100) * currentTask.points * 10) / 10;

      const newResponse: TaskResponseState = {
        answered: true,
        studentAnswer: vivaInput.trim(),
        isCorrect: Boolean(data.passed),
        score: scoreNormalized,
        feedback: data.feedback || 'Reasoning evaluated and persisted to your AI Viva record.',
        rubricCriterionMet: Array.isArray(data.rubricCriterionMet) ? data.rubricCriterionMet : [],
        missingConcepts: Array.isArray(data.missingConcepts) ? data.missingConcepts : [],
        adaptiveFollowUp: data.adaptiveFollowUp,
        difficulty: data.difficulty || 'intermediate',
        nextDifficulty: data.nextDifficulty || 'intermediate',
      };

      setResponses((prev) => ({ ...prev, [currentTask.id]: newResponse }));
      if (onTaskCompleted) onTaskCompleted(currentTask.id, scoreNormalized, currentTask.competencyDimension);
    } catch (e: any) {
      setVivaError(
        e?.message || 'Unable to reach the AI Viva evaluator right now. Please check your connection and try again.'
      );
    } finally {
      setIsEvaluatingViva(false);
    }
  };

  // Adaptive Follow-Up Defense (Q2 in the same persisted viva session)
  const handleAdaptiveFollowUpSubmit = async () => {
    if (!currentTask || !vivaSessionId || !followUpInput.trim() || !currentResponse) return;
    setIsEvaluatingFollowUp(true);
    setVivaError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`/api/viva/sessions/${vivaSessionId}/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          isAdaptiveFollowUp: true,
          questionIndex: 1,
          studentAnswer: followUpInput.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || `Adaptive follow-up evaluation failed (HTTP ${res.status}).`
        );
      }

      if (data.session) {
        setVivaSession(data.session);
      }

      const overallPct = Number(data.session?.overallScore ?? data.score ?? 0);
      const updatedTaskScore =
        Math.round((Math.max(0, Math.min(100, overallPct)) / 100) * currentTask.points * 10) / 10;

      setResponses((prev) => {
        const existing = prev[currentTask.id];
        if (!existing) return prev;
        return {
          ...prev,
          [currentTask.id]: {
            ...existing,
            score: updatedTaskScore,
            isCorrect: overallPct >= 70,
            followUpAnswered: true,
            followUpAnswer: followUpInput.trim(),
            followUpScore: Number(data.score ?? 0),
            followUpFeedback: data.feedback || 'Adaptive follow-up graded and saved.',
            followUpDifficulty: data.difficulty || existing.nextDifficulty || 'intermediate',
          },
        };
      });

      setFollowUpInput('');
      if (onVivaCompleted) onVivaCompleted();
    } catch (e: any) {
      setVivaError(e?.message || 'Failed to evaluate adaptive follow-up question.');
    } finally {
      setIsEvaluatingFollowUp(false);
    }
  };

  const handleFinalizeVivaNow = async () => {
    if (!vivaSessionId || isFinalizingViva) return;
    setIsFinalizingViva(true);
    setVivaError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`/api/viva/sessions/${vivaSessionId}/complete`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Could not finalize AI Viva session.');
      }
      if (data.session) {
        setVivaSession(data.session);
      }
      if (onVivaCompleted) onVivaCompleted();
    } catch (e: any) {
      setVivaError(e?.message || 'Failed to finalize AI Viva session.');
    } finally {
      setIsFinalizingViva(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!allAnswered || isSubmitting || isSubmitted) return;
    setSubmitError(null);

    if (!onAllCompleted) {
      setSubmitError('Submission handler is unavailable for this assignment.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure open viva session is finalized cleanly before attaching to submission
      if (vivaSessionId && vivaSession && vivaSession.status !== 'completed') {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;
          const compRes = await fetch(`/api/viva/sessions/${vivaSessionId}/complete`, {
            method: 'POST',
            headers,
          });
          const compData = await compRes.json().catch(() => null);
          if (compRes.ok && compData?.session) {
            setVivaSession(compData.session);
          }
        } catch {
          // Proceed with submission — server still reads persisted viva responses
        }
      }

      const observations: Record<string, any> = {
        ...(simulationSnapshot?.observations || {}),
      };
      const calculatedResults: Record<string, any> = {
        ...(simulationSnapshot?.calculatedResults || {}),
      };

      for (const task of tasks) {
        const resp = responses[task.id];
        if (!resp) continue;
        if (task.type === 'numeric') {
          calculatedResults[task.title] = resp.studentAnswer;
        } else {
          observations[task.title] = resp.studentAnswer;
        }
      }
      if (observationNotes.trim()) {
        observations.studentLabNotes = observationNotes.trim();
      }

      const readingsCount =
        (simulationSnapshot?.readingsCount || 0) +
        tasks.length +
        (observationNotes.trim() ? 1 : 0);

      const saved = await onAllCompleted({
        responses,
        vivaSessionId,
        observations,
        calculatedResults,
        dataReadingsCount: readingsCount,
      });

      if (saved) {
        setSubmittedRecord(saved);
      }
      setIsSubmitted(true);
    } catch (error: any) {
      setSubmitError(error?.message || 'Submission failed. Please review your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchHint = async () => {
    if (!currentTask) return;
    setIsLoadingHint(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/gemini/hint', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          experimentName: experimentTitle,
          currentStep: currentTask.title,
          studentIssue: currentTask.prompt,
          apparatusState: simulationSnapshot?.calculatedResults,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.hint) {
        setHintText(data.hint);
      } else {
        setHintText(currentTask.hint || 'Review the governing formula and boundary conditions.');
      }
    } catch {
      setHintText(currentTask.hint || 'Consider the physical relationship connecting the independent and dependent variables.');
    } finally {
      setIsLoadingHint(false);
    }
  };

  if (!currentTask) return null;

  const canRetake =
    isSubmitted &&
    typeof attemptsAllowed === 'number' &&
    attemptsUsed < attemptsAllowed;

  return (
    <div
      id="auto-graded-task-panel"
      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-5 transition-colors"
    >
      {/* Panel Header */}
      <div className="flex flex-col justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 sm:flex-row sm:items-center">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Stage Assessment:{' '}
            {currentTask.stage === 'pre_lab'
              ? 'Pre-Lab Preparation'
              : currentTask.stage === 'during_lab'
              ? 'In-Lab Diagnosis & Validation'
              : 'Adaptive AI Viva Voce'}
          </span>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">{currentTask.title}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {simulationSnapshot && simulationSnapshot.readingsCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              {simulationSnapshot.readingsCount} live readings synced
            </span>
          )}
          <div className="flex items-center gap-1 rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1 text-xs font-semibold text-stone-700 dark:text-stone-300">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span>
              Preliminary: {totalEarned} / {maxPossible} pts
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
              id={`task-step-btn-${idx + 1}`}
              onClick={() => {
                setActiveTaskIndex(idx);
                setHintText(null);
                setVivaError(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                  : resp?.answered
                  ? resp.isCorrect
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <span>{t.type === 'viva_text' ? 'AI Viva' : `Task ${idx + 1}`}</span>
              {resp?.answered &&
                (resp.isCorrect ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                ))}
            </button>
          );
        })}
      </div>

      {/* Competency & Difficulty Tag Row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:text-stone-300">
          Target Competency:{' '}
          <strong className="text-stone-900 dark:text-stone-100">
            {COMPETENCY_DIMENSIONS[currentTask.competencyDimension].label}
          </strong>
        </span>
        <span className="text-[11px] text-stone-500 dark:text-stone-400">
          Weight: {currentTask.points} marks
        </span>
        {currentTask.type === 'viva_text' && (
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${difficultyBadgeStyle(
              currentResponse?.difficulty || 'intermediate'
            )}`}
          >
            Adaptive Level: {currentResponse?.difficulty || 'Intermediate'}
          </span>
        )}
      </div>

      {/* Prompt Card */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850 p-4 text-xs text-stone-800 dark:text-stone-200 leading-relaxed">
        <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm mb-1 whitespace-pre-line">
          {currentTask.prompt}
        </p>
      </div>

      {/* Interactive Input Area based on Task Type */}
      <div className="space-y-3">
        {(currentTask.type === 'parameter_select' || currentTask.type === 'mcq') && currentTask.options && (
          <div className="grid grid-cols-1 gap-2">
            {currentTask.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id || currentResponse?.studentAnswer === opt.id;
              const isAnswered = !!currentResponse?.answered;
              const isCorrectOpt = opt.id === currentTask.correctAnswer;

              let btnClass =
                'border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-750';
              if (isAnswered) {
                if (isCorrectOpt)
                  btnClass =
                    'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 font-semibold';
                else if (isSelected)
                  btnClass =
                    'border-rose-400 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200';
              } else if (isSelected) {
                btnClass =
                  'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 font-semibold';
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
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left text-xs transition-all cursor-pointer disabled:cursor-default ${btnClass}`}
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
                className="flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <span>Verify</span>
              </button>
            </div>
            {currentTask.numericTolerance && (
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Accepted validation tolerance: ±{currentTask.numericTolerance} (verified server-side on submission)
              </p>
            )}
          </div>
        )}

        {currentTask.type === 'viva_text' && (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                id="viva-primary-answer-input"
                rows={3}
                disabled={!!currentResponse?.answered || isEvaluatingViva}
                placeholder="Type your physical explanation in your own words (persisted and graded against syllabus rubrics)..."
                value={vivaInput}
                onChange={(e) => setVivaInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-3 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
              />
            </div>

            {vivaError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{vivaError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                Evaluated by Adaptive AI Viva Examiner & persisted to your assessment record
              </span>
              <button
                type="button"
                id="submit-viva-primary-btn"
                disabled={!!currentResponse?.answered || !vivaInput.trim() || isEvaluatingViva}
                onClick={handleVivaSubmit}
                className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-colors cursor-pointer"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-stone-100 dark:border-stone-800 pt-2 text-xs">
          <button
            type="button"
            onClick={handleFetchHint}
            disabled={isLoadingHint}
            className="flex items-center gap-1 text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors font-medium cursor-pointer"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span>{isLoadingHint ? 'Generating Socratic Hint...' : 'Need a Socratic Hint?'}</span>
          </button>
          {hintText && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/70 p-2 text-[11px] text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              {hintText}
            </div>
          )}
        </div>
      )}

      {/* Result & Rubric Breakdown Card after Answering */}
      {currentResponse?.answered && (
        <div
          className={`rounded-xl border p-4 text-xs space-y-3 transition-all ${
            currentResponse.isCorrect
              ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200'
              : 'border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
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

          {currentResponse.rubricCriterionMet && currentResponse.rubricCriterionMet.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 dark:text-stone-100 text-[11px]">
                Rubric Criteria Demonstrated:
              </span>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-emerald-800 dark:text-emerald-300">
                {currentResponse.rubricCriterionMet.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {currentResponse.missingConcepts && currentResponse.missingConcepts.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-stone-900 dark:text-stone-100 text-[11px]">
                Concepts to Reinforce:
              </span>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-800 dark:text-amber-300">
                {currentResponse.missingConcepts.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Interactive Adaptive Follow-Up Defense (Q2) */}
          {currentTask.type === 'viva_text' && currentResponse.adaptiveFollowUp && (
            <div
              id="viva-adaptive-followup-box"
              className="rounded-xl bg-white/95 dark:bg-stone-900/95 p-3.5 border border-stone-200 dark:border-stone-700 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Adaptive Examiner Follow-Up Defense (Question 2)</span>
                </div>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${difficultyBadgeStyle(
                    currentResponse.followUpDifficulty || currentResponse.nextDifficulty
                  )}`}
                >
                  {currentResponse.followUpDifficulty || currentResponse.nextDifficulty || 'intermediate'} Difficulty
                </span>
              </div>

              <p className="text-stone-800 dark:text-stone-200 font-medium leading-relaxed">
                {currentResponse.adaptiveFollowUp}
              </p>

              {!currentResponse.followUpAnswered && vivaSession?.status !== 'completed' ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    id="viva-followup-answer-input"
                    rows={2}
                    disabled={isEvaluatingFollowUp || isFinalizingViva}
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder="Defend your reasoning on this adaptive follow-up question to strengthen your Viva mastery..."
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-amber-500 focus:outline-hidden"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isFinalizingViva || isEvaluatingFollowUp}
                      onClick={handleFinalizeVivaNow}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 underline cursor-pointer"
                    >
                      {isFinalizingViva ? 'Finalizing...' : 'Skip follow-up & finalize Viva now'}
                    </button>
                    <button
                      type="button"
                      id="submit-viva-followup-btn"
                      disabled={!followUpInput.trim() || isEvaluatingFollowUp || isFinalizingViva}
                      onClick={handleAdaptiveFollowUpSubmit}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isEvaluatingFollowUp ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Evaluating Follow-Up...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Submit Adaptive Defense</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 p-2.5 space-y-1">
                  {currentResponse.followUpAnswered ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        <span>Adaptive Follow-Up Evaluated</span>
                        <span className="font-mono">{currentResponse.followUpScore}%</span>
                      </div>
                      <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed">
                        {currentResponse.followUpFeedback}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                      AI Viva session finalized and persisted ({vivaSession?.overallScore ?? 0}% overall).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-stone-200/60 dark:border-stone-800 pt-2 text-[11px] text-stone-600 dark:text-stone-400">
            <strong className="text-stone-900 dark:text-stone-100">Key Concept Takeaway:</strong>{' '}
            {currentTask.explanation}
          </div>

          {activeTaskIndex < tasks.length - 1 && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveTaskIndex((prev) => prev + 1);
                  setHintText(null);
                  setVivaError(null);
                  setSelectedOptionId('');
                  setNumericInput('');
                  setVivaInput('');
                }}
                className="flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <span>Proceed to {tasks[activeTaskIndex + 1]?.type === 'viva_text' ? 'AI Viva' : `Task ${activeTaskIndex + 2}`}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Final submission section */}
      {allAnswered && (
        <div className="border-t border-stone-200 dark:border-stone-800 pt-4 space-y-3">
          <div className="text-sm text-stone-700 dark:text-stone-300">
            <strong>All experiment tasks completed.</strong>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Preliminary task tally: {totalEarned} / {maxPossible} points. Official score, live apparatus observations, and competency credits are verified and stored on submission.
            </p>
          </div>

          {!isSubmitted && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Experiment Observations & Error Analysis Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={observationNotes}
                onChange={(e) => setObservationNotes(e.target.value)}
                placeholder="Record key apparatus readings, slope observations, or sources of experimental error..."
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {isSubmitted && submittedRecord && (
            <div
              id="submission-verified-banner"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-900 dark:text-emerald-200"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Submission verified & persisted (Attempt #{submittedRecord.attemptNumber})
                  </p>
                  <p className="mt-0.5">
                    Official Score:{' '}
                    <strong>
                      {submittedRecord.totalScore} / {submittedRecord.maxScore} pts (
                      {Math.round(
                        (Number(submittedRecord.totalScore) / Number(submittedRecord.maxScore || 100)) *
                          100
                      )}
                      %)
                    </strong>{' '}
                    • Status:{' '}
                    <span className="capitalize">
                      {(submittedRecord.evaluationStatus || 'auto_graded').replace(/_/g, ' ')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onViewReport && (
                  <button
                    type="button"
                    id="btn-view-performance-report"
                    onClick={onViewReport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>View Performance Report</span>
                  </button>
                )}
                {canRetake && (
                  <button
                    type="button"
                    onClick={resetAttemptState}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>New Attempt</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {!isSubmitted && (
            <button
              type="button"
              id="submit-lab-experiment-btn"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Verifying & Saving Submission...' : 'Submit Lab Experiment'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
