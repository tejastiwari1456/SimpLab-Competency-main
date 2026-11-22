import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  FileText,
  MessageSquare,
  Loader2,
  Award,
  Layers,
} from 'lucide-react';
import {
  COMPETENCY_DIMENSIONS,
  CompetencyKey,
  StudentSubmission,
  VivaSessionRecord,
} from '../../types';
import { EXPERIMENTS } from '../../data/mockData';

interface VivaReportModalProps {
  session: VivaSessionRecord;
  token?: string | null;
  onClose: () => void;
}

const difficultyBadgeClasses = (difficulty?: string) => {
  if (difficulty === 'advanced') {
    return 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800';
  }
  if (difficulty === 'foundation') {
    return 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800';
  }
  return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
};

export const VivaReportModal: React.FC<VivaReportModalProps> = ({
  session,
  token,
  onClose,
}) => {
  const [detailedSession, setDetailedSession] = useState<VivaSessionRecord>(session);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/viva/sessions/${encodeURIComponent(session.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.success && data.session) {
          setDetailedSession(data.session);
        } else if (!cancelled && !res.ok) {
          setError(data.error || 'Could not refresh full viva session record.');
        }
      } catch {
        if (!cancelled) {
          setError('Network error while loading live viva report details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [session.id, token]);

  const exp = EXPERIMENTS.find((e) => e.id === detailedSession.experimentId);
  const responses = detailedSession.responses || [];

  return (
    <div
      id="viva-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viva-report-modal-title"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-6 py-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Sparkles className="h-3 w-3" />
                AI Viva Voce Assessment Report
              </span>
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                Attempt #{detailedSession.attemptNumber} •{' '}
                <span className="capitalize">
                  {detailedSession.status.replace(/_/g, ' ')}
                </span>
              </span>
            </div>
            <h3
              id="viva-report-modal-title"
              className="text-lg font-bold text-stone-900 dark:text-stone-100"
            >
              {exp?.title || detailedSession.experimentId}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Started {new Date(detailedSession.startedAt).toLocaleString()}
              {detailedSession.completedAt
                ? ` • Completed ${new Date(detailedSession.completedAt).toLocaleString()}`
                : ''}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3.5 py-2 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Viva Score
              </span>
              <span className="text-xl font-black font-mono text-stone-900 dark:text-amber-400">
                {Math.round(Number(detailedSession.overallScore))}%
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Viva report"
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-2 text-xs text-stone-600 dark:text-stone-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span>Loading persisted viva assessment transcript...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {detailedSession.summaryFeedback && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-xs space-y-1">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider text-[10px]">
                Examiner Overall Summary
              </span>
              <p className="text-stone-800 dark:text-stone-200 leading-relaxed">
                {detailedSession.summaryFeedback}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                Persisted Question & Defense Exchanges ({responses.length})
              </h4>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                {detailedSession.answeredCount} / {detailedSession.questionsCount} questions answered
              </span>
            </div>

            {responses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                No individual Q&A responses recorded for this viva session yet.
              </div>
            ) : (
              responses.map((resp, idx) => {
                const dimLabel =
                  COMPETENCY_DIMENSIONS[resp.competencyDimension as CompetencyKey]?.label ||
                  resp.competencyDimension;
                return (
                  <div
                    key={resp.id || idx}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/60 p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-stone-900 dark:bg-stone-100 px-2 py-0.5 font-mono text-[10px] font-bold text-white dark:text-stone-900">
                          Q{idx + 1}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${difficultyBadgeClasses(
                            resp.difficulty
                          )}`}
                        >
                          {resp.difficulty || 'intermediate'} difficulty
                        </span>
                        <span className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                          {dimLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${
                            resp.passed
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {resp.passed ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {Math.round(Number(resp.score))}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Examiner Prompt
                      </span>
                      <p className="font-semibold text-stone-900 dark:text-stone-100 leading-relaxed">
                        {resp.questionText}
                      </p>
                    </div>

                    <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Your Recorded Answer
                      </span>
                      <p className="text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                        {resp.studentAnswer}
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        AI Examiner Evaluation & Feedback
                      </span>
                      <p className="text-stone-800 dark:text-stone-200 leading-relaxed">
                        {resp.aiFeedback}
                      </p>
                    </div>

                    {((resp.rubricCriterionMet && resp.rubricCriterionMet.length > 0) ||
                      (resp.missingConcepts && resp.missingConcepts.length > 0)) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {resp.rubricCriterionMet && resp.rubricCriterionMet.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              Rubric Criteria Met
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {resp.rubricCriterionMet.map((crit, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[11px] text-emerald-800 dark:text-emerald-300"
                                >
                                  {crit}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {resp.missingConcepts && resp.missingConcepts.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              Concepts to Strengthen
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {resp.missingConcepts.map((miss, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-300"
                                >
                                  {miss}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {resp.adaptiveFollowUp && (
                      <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-2.5 text-[11px] text-stone-700 dark:text-stone-300 flex items-start gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-stone-900 dark:text-stone-100">
                            Adaptive Follow-Up Generated:
                          </strong>{' '}
                          {resp.adaptiveFollowUp}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-1.5 text-xs font-bold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};

interface SubmissionDetailModalProps {
  submission: StudentSubmission;
  token?: string | null;
  onClose: () => void;
}

const formatMetricLabel = (key: string): string =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const formatMetricValue = (val: unknown): string => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? String(val) : val.toFixed(3).replace(/\.?0+$/, '');
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return `${val.length} recorded entries`;
  return JSON.stringify(val);
};

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submission,
  token,
  onClose,
}) => {
  const [detail, setDetail] = useState<StudentSubmission>(submission);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchSubmission = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/submissions/${encodeURIComponent(submission.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.success && data.submission) {
          setDetail(data.submission);
        } else if (!cancelled && !res.ok) {
          setError(data.error || 'Could not refresh submission details.');
        }
      } catch {
        if (!cancelled) {
          setError('Network error while loading submission details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchSubmission();
    return () => {
      cancelled = true;
    };
  }, [submission.id, token]);

  const exp = EXPERIMENTS.find((e) => e.id === detail.experimentId);
  const effectiveScore = detail.facultyScore ?? detail.totalScore;
  const scorePct = Math.round((Number(effectiveScore) / Number(detail.maxScore || 100)) * 100);

  const calcEntries = Object.entries(detail.calculatedResults || {}).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== 'object'
  );
  const obsEntries = Object.entries(detail.observations || {}).filter(
    ([, v]) => v !== null && v !== undefined && !Array.isArray(v) && typeof v !== 'object'
  );
  const obsArrays = Object.entries(detail.observations || {}).filter(([, v]) => Array.isArray(v));

  const taskResponseEntries = Object.entries(detail.taskResponses || {});

  return (
    <div
      id="submission-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-detail-modal-title"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-6 py-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <FlaskConical className="h-3 w-3" />
                Verified Lab Submission Record
              </span>
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                Attempt #{detail.attemptNumber} •{' '}
                <span className="capitalize">
                  {(detail.evaluationStatus || 'auto_graded').replace(/_/g, ' ')}
                </span>
              </span>
            </div>
            <h3
              id="submission-detail-modal-title"
              className="text-lg font-bold text-stone-900 dark:text-stone-100"
            >
              {exp?.title || detail.experimentId}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Submitted {new Date(detail.submittedAt).toLocaleString()} • {detail.dataReadingsCount} recorded observations
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Official Score
              </span>
              <span className="text-xl font-black font-mono text-stone-900 dark:text-emerald-400">
                {scorePct}%
              </span>
              <span className="block text-[10px] font-mono text-stone-500 dark:text-stone-400">
                {effectiveScore}/{detail.maxScore} pts
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close submission detail"
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-3 py-2 text-stone-600 dark:text-stone-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span>Fetching verified submission details...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Faculty Feedback */}
          {detail.instructorFeedback && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Faculty Evaluation & Remark
              </span>
              <p className="text-stone-800 dark:text-stone-200 leading-relaxed">
                {detail.instructorFeedback}
              </p>
              {detail.evaluatedAt && (
                <p className="text-[10px] text-stone-500 dark:text-stone-400">
                  Reviewed on {new Date(detail.evaluatedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Apparatus Calculated Results & Observations */}
          {(calcEntries.length > 0 || obsEntries.length > 0 || obsArrays.length > 0) && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/60 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>Apparatus Observations & Calculated Results</span>
              </h4>

              {(calcEntries.length > 0 || obsEntries.length > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[...calcEntries, ...obsEntries].map(([key, val]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2"
                    >
                      <span className="block text-[10px] text-stone-500 dark:text-stone-400 truncate">
                        {formatMetricLabel(key)}
                      </span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {formatMetricValue(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {obsArrays.map(([arrKey, arrVal]) => {
                const items = (arrVal as unknown[]).slice(0, 6);
                if (items.length === 0) return null;
                const firstObj =
                  typeof items[0] === 'object' && items[0] !== null
                    ? (items[0] as Record<string, unknown>)
                    : null;
                if (!firstObj) return null;
                const cols = Object.keys(firstObj).slice(0, 5);
                return (
                  <div key={arrKey} className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      {formatMetricLabel(arrKey)} ({(arrVal as unknown[]).length} rows)
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
                      <table className="w-full text-left text-[11px]">
                        <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400">
                          <tr>
                            {cols.map((c) => (
                              <th key={c} className="px-2.5 py-1.5 font-semibold">
                                {formatMetricLabel(c)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
                          {items.map((row, rIdx) => {
                            const rec = row as Record<string, unknown>;
                            return (
                              <tr key={rIdx} className="text-stone-800 dark:text-stone-200">
                                {cols.map((c) => (
                                  <td key={c} className="px-2.5 py-1.5">
                                    {formatMetricValue(rec[c])}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-Graded Task Breakdown */}
          {taskResponseEntries.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                <span>Task-by-Task Graded Breakdown</span>
              </h4>
              <div className="space-y-2">
                {taskResponseEntries.map(([taskId, rawResp]) => {
                  const taskMeta = exp?.tasks.find((t) => t.id === taskId);
                  const respObj =
                    rawResp && typeof rawResp === 'object' ? (rawResp as Record<string, any>) : null;
                  const earned = respObj?.earnedPoints ?? respObj?.pointsEarned;
                  const maxPts = respObj?.maxPoints ?? taskMeta?.points;
                  const passed =
                    typeof respObj?.isCorrect === 'boolean'
                      ? respObj.isCorrect
                      : typeof earned === 'number' && typeof maxPts === 'number'
                      ? earned >= maxPts * 0.6
                      : true;

                  return (
                    <div
                      key={taskId}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/60 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {taskMeta?.title || taskId}
                        </span>
                        {earned !== undefined && maxPts !== undefined && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                              passed
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {earned} / {maxPts} pts
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        <strong>Recorded Answer:</strong>{' '}
                        {respObj?.answer !== undefined
                          ? String(respObj.answer)
                          : typeof rawResp === 'string' || typeof rawResp === 'number'
                          ? String(rawResp)
                          : 'Submitted'}
                      </p>
                      {respObj?.feedback && (
                        <p className="text-[11px] text-stone-700 dark:text-stone-300">
                          {String(respObj.feedback)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submission Competency Contribution */}
          {detail.competencyScores && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span>Competency Scores Recorded on Attempt</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).map((key) => (
                  <div
                    key={key}
                    className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-2.5 text-center"
                  >
                    <span className="block text-[10px] text-stone-500 dark:text-stone-400 line-clamp-1">
                      {COMPETENCY_DIMENSIONS[key].shortLabel}
                    </span>
                    <span className="font-mono text-sm font-bold text-stone-900 dark:text-stone-100">
                      {Math.round(Number(detail.competencyScores[key] ?? 0))}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked AI Viva Session */}
          {detail.vivaSession && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Linked AI Viva Assessment
                </span>
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 font-mono font-bold text-amber-900 dark:text-amber-300">
                  {Math.round(Number(detail.vivaSession.overallScore))}%
                </span>
              </div>
              {detail.vivaSession.summaryFeedback && (
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
                  {detail.vivaSession.summaryFeedback}
                </p>
              )}
              {detail.vivaSession.responses && detail.vivaSession.responses.length > 0 && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {detail.vivaSession.responses.length} persisted oral defense exchange(s) archived with this submission.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-1.5 text-xs font-bold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Close Submission Record
          </button>
        </div>
      </div>
    </div>
  );
};
