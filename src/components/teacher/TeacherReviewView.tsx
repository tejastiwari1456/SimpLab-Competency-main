import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  Download,
  Eye,
  X,
  CheckCircle2,
  Award,
  Loader2,
  AlertCircle,
  MessageSquare,
  History,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import {
  StudentSubmission,
  ClassCourse,
  Assignment,
  Experiment,
  SubmissionEvaluationStatus,
  EvaluationHistoryRecord,
} from '../../types';
import { downloadAuthenticatedCsv } from '../../utils/facultyPdfGenerator';

interface SubmissionDetail extends Omit<StudentSubmission, 'vivaSession'> {
  vivaSession?: {
    id: string;
    status: string;
    overallScore: number;
    summaryFeedback?: string | null;
    completedAt?: string | null;
    responses: Array<{
      id: string;
      taskId?: string | null;
      questionText: string;
      studentAnswer: string;
      score: number;
      passed: boolean;
      aiFeedback: string;
      rubricCriterionMet?: string[] | string | null;
      missingConcepts?: string[];
      adaptiveFollowUp?: string | null;
    }>;
  } | null;
  evaluationHistory?: EvaluationHistoryRecord[];
}

interface TeacherReviewViewProps {
  token: string | null;
  submissions: StudentSubmission[];
  classes: ClassCourse[];
  assignments?: Assignment[];
  experiments?: Experiment[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onEvaluateSubmission: (
    submissionId: string,
    evaluation: {
      evaluationStatus: SubmissionEvaluationStatus;
      instructorFeedback?: string;
      facultyScore?: number | null;
    }
  ) => Promise<StudentSubmission>;
}

function formatKeyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatScalarValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(3);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return `${val.length} items`;
  return JSON.stringify(val);
}

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({
  token,
  submissions,
  classes,
  assignments = [],
  experiments = [],
  selectedClassId,
  onSelectClassId,
  onEvaluateSubmission,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByCohort, setFilterByCohort] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'faculty_reviewed' | 'needs_revision' | 'rejected'
  >('all');
  const [selectedSub, setSelectedSub] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Faculty evaluation form state
  const [evalStatus, setEvalStatus] = useState<SubmissionEvaluationStatus>('faculty_reviewed');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [evalScoreInput, setEvalScoreInput] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [evalMessage, setEvalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const classAssignmentIds = React.useMemo(() => {
    if (!currentClass) return new Set<string>();
    return new Set(assignments.filter((a) => a.classId === currentClass.id).map((a) => a.id));
  }, [assignments, currentClass]);

  const pendingStatuses = new Set(['pending', 'auto_graded', 'ai_evaluated']);

  const filteredSubmissions = submissions.filter((s) => {
    const q = searchTerm.toLowerCase();
    const expTitle = (
      experiments.find((e) => e.id === s.experimentId)?.title || s.experimentId
    ).toLowerCase();
    const matchesSearch =
      s.studentName.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      s.experimentId.toLowerCase().includes(q) ||
      expTitle.includes(q);
    const matchesCohort =
      !filterByCohort || !currentClass || classAssignmentIds.has(s.assignmentId);
    const subStatus = s.evaluationStatus || 'auto_graded';
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? pendingStatuses.has(subStatus)
        : subStatus === statusFilter;
    return matchesSearch && matchesCohort && matchesStatus;
  });

  useEffect(() => {
    if (!selectedSub) return;
    if (
      selectedSub.evaluationStatus === 'needs_revision' ||
      selectedSub.evaluationStatus === 'rejected'
    ) {
      setEvalStatus(selectedSub.evaluationStatus);
    } else {
      setEvalStatus('faculty_reviewed');
    }
    setEvalFeedback(selectedSub.instructorFeedback || '');
    setEvalScoreInput(
      selectedSub.facultyScore != null ? String(selectedSub.facultyScore) : ''
    );
    setEvalMessage(null);
  }, [selectedSub?.id]);

  const fetchSubmissionDetail = async (submissionId: string) => {
    if (!token) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.submission) {
        setSelectedSub(data.submission);
      }
    } catch {
      // Keep existing summary view
    } finally {
      setDetailLoading(false);
    }
  };

  const handleInspect = async (sub: StudentSubmission) => {
    setSelectedSub(sub);
    setEvalMessage(null);
    await fetchSubmissionDetail(sub.id);
  };

  const submitEvaluation = async (overrideStatus?: SubmissionEvaluationStatus) => {
    if (!selectedSub) return;
    const targetStatus = overrideStatus || evalStatus;

    let parsedScore: number | null = null;
    if (evalScoreInput.trim() !== '') {
      const n = Number(evalScoreInput);
      if (!Number.isFinite(n) || n < 0 || n > (selectedSub.maxScore || 100)) {
        setEvalMessage({
          type: 'error',
          text: `Faculty score must be between 0 and ${selectedSub.maxScore || 100}.`,
        });
        return;
      }
      parsedScore = n;
    }

    setSavingEval(true);
    setEvalMessage(null);
    try {
      setEvalStatus(targetStatus);
      const updated = await onEvaluateSubmission(selectedSub.id, {
        evaluationStatus: targetStatus,
        instructorFeedback: evalFeedback.trim(),
        facultyScore: parsedScore,
      });
      setSelectedSub((prev) => (prev ? { ...prev, ...updated } : updated));
      // Reload detail to immediately display newly recorded immutable evaluation_history entry
      await fetchSubmissionDetail(selectedSub.id);
      setEvalMessage({
        type: 'success',
        text: `Evaluation saved (${targetStatus.replace(/_/g, ' ')}) and recorded in evaluation history.`,
      });
    } catch (err) {
      setEvalMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save faculty evaluation.',
      });
    } finally {
      setSavingEval(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitEvaluation();
  };

  const handleExportCSV = async () => {
    if (!token) return;
    setExportingCsv(true);
    try {
      const qs =
        filterByCohort && currentClass
          ? `&classId=${encodeURIComponent(currentClass.id)}`
          : '';
      await downloadAuthenticatedCsv(
        `/api/teacher/reports/export?type=historical${qs}`,
        token,
        `Internal_Practical_Marks_${currentClass?.code || 'ALL'}.csv`
      );
    } catch {
      // ignore
    } finally {
      setExportingCsv(false);
    }
  };

  const renderStatusBadge = (status?: string) => {
    const s = status || 'auto_graded';
    if (s === 'faculty_reviewed') {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold uppercase">
          Approved
        </span>
      );
    }
    if (s === 'needs_revision') {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-bold uppercase">
          Needs Revision
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 text-[10px] font-bold uppercase">
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 text-[10px] font-bold uppercase">
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <ClipboardList className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Continuous Internal Assessment
            </span>
            <span className="text-xs text-stone-500">Official Practical Gradebook</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Student Practical Submissions & Faculty Evaluation
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Review observations, calculated results, and AI evaluation transcripts; approve, reject, or request revisions with full evaluation history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={filteredSubmissions.length === 0 || exportingCsv}
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 text-xs font-bold text-stone-800 dark:text-stone-200 shadow-xs hover:bg-stone-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            ) : (
              <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            )}
            <span>Export Internal Marks (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter & Status Bar */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Submissions' },
              { id: 'pending', label: 'Pending Review' },
              { id: 'faculty_reviewed', label: 'Approved' },
              { id: 'needs_revision', label: 'Needs Revision' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search student, ID, or lab..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100 dark:border-stone-800">
          <span className="text-xs font-bold text-stone-600 dark:text-stone-400">Cohort:</span>
          {classes.length > 0 && (
            <select
              value={currentClass?.id || ''}
              onChange={(e) => onSelectClassId(e.target.value)}
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1 text-xs font-semibold text-stone-900 dark:text-stone-100"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.code}: {cls.name}
                </option>
              ))}
            </select>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 cursor-pointer">
            <input
              type="checkbox"
              checked={filterByCohort}
              onChange={(e) => setFilterByCohort(e.target.checked)}
              className="rounded border-stone-300"
            />
            <span>Selected cohort only</span>
          </label>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
            No student submissions found for the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
              <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase tracking-wider font-bold text-stone-500">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Lab Experiment</th>
                  <th className="px-5 py-3.5">Score</th>
                  <th className="px-5 py-3.5">Evaluation Status</th>
                  <th className="px-5 py-3.5">Attempt</th>
                  <th className="px-5 py-3.5">Submitted Date</th>
                  <th className="px-5 py-3.5 text-right">Review & Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {filteredSubmissions.map((sub) => {
                  const effectiveScore = sub.facultyScore ?? sub.totalScore;
                  const expTitle =
                    experiments.find((e) => e.id === sub.experimentId)?.title || sub.experimentId;
                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-stone-900 dark:text-stone-100 block">
                          {sub.studentName}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {sub.studentId}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-stone-800 dark:text-stone-200">
                        <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px]">
                          {expTitle}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`font-bold text-sm ${
                            effectiveScore >= 85
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : effectiveScore < 70
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-stone-900 dark:text-stone-100'
                          }`}
                        >
                          {effectiveScore}%
                        </span>
                        {sub.facultyScore != null && (
                          <span className="block text-[10px] text-indigo-500 font-semibold">
                            Faculty adjusted
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {renderStatusBadge(sub.evaluationStatus)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-stone-500">
                        #{sub.attemptNumber || 1}
                      </td>
                      <td className="px-5 py-3.5 text-stone-500">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleInspect(sub)}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Inspect & Grade</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspection & Faculty Evaluation Modal */}
      {selectedSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Inspect and Evaluate Submission"
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Laboratory Submission & Faculty Evaluation Record
                </span>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  {selectedSub.studentName}{' '}
                  <span className="text-xs font-normal text-stone-400">
                    (Attempt #{selectedSub.attemptNumber || 1})
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Experiment</span>
                <p className="font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                  {experiments.find((e) => e.id === selectedSub.experimentId)?.title ||
                    selectedSub.experimentId}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">
                  Auto / Final Score
                </span>
                <p className="font-bold text-indigo-600 dark:text-indigo-400 text-base mt-0.5">
                  {selectedSub.facultyScore ?? selectedSub.totalScore} /{' '}
                  {selectedSub.maxScore || 100}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Status</span>
                <div className="mt-1">{renderStatusBadge(selectedSub.evaluationStatus)}</div>
              </div>
            </div>

            {detailLoading && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                <span>Loading detailed observations, AI Viva transcript, and evaluation history...</span>
              </div>
            )}

            {/* Rubric Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                Demonstrated Practical Competencies
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedSub.competencyScores || {}).map(([k, score]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40"
                  >
                    <span className="capitalize font-medium text-stone-700 dark:text-stone-300">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {Number(score) >= 90 && (
                        <Award className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {Math.round(Number(score))}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Structured Observations & Calculated Results */}
            {((selectedSub.observations && Object.keys(selectedSub.observations).length > 0) ||
              (selectedSub.calculatedResults &&
                Object.keys(selectedSub.calculatedResults).length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {selectedSub.observations &&
                  Object.keys(selectedSub.observations).length > 0 && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-3.5 space-y-2">
                      <h5 className="text-[10px] font-bold uppercase text-stone-400">
                        Recorded Experimental Observations
                      </h5>
                      <div className="space-y-1.5">
                        {Object.entries(selectedSub.observations).map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between gap-2 text-[11px]">
                            <span className="text-stone-500">{formatKeyLabel(k)}:</span>
                            <span className="font-mono font-semibold text-stone-800 dark:text-stone-200 text-right break-all">
                              {formatScalarValue(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {selectedSub.calculatedResults &&
                  Object.keys(selectedSub.calculatedResults).length > 0 && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-3.5 space-y-2">
                      <h5 className="text-[10px] font-bold uppercase text-stone-400">
                        Calculated Experimental Results
                      </h5>
                      <div className="space-y-1.5">
                        {Object.entries(selectedSub.calculatedResults).map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between gap-2 text-[11px]">
                            <span className="text-stone-500">{formatKeyLabel(k)}:</span>
                            <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300 text-right break-all">
                              {formatScalarValue(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Persisted AI Viva Evaluation Report */}
            {selectedSub.vivaSession && selectedSub.vivaSession.responses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                    <span>AI-Generated Viva Evaluation Report ({selectedSub.vivaSession.overallScore}%)</span>
                  </h4>
                  <span className="text-[10px] font-mono text-stone-400">
                    {selectedSub.vivaSession.id}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedSub.vivaSession.responses.map((vr) => (
                    <div
                      key={vr.id}
                      className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          Q: {vr.questionText}
                        </span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                          {vr.score}/100
                        </span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300">
                        <strong>Student Answer:</strong> {vr.studentAnswer}
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        <strong>AI Assessment:</strong> {vr.aiFeedback}
                      </p>
                      {Array.isArray(vr.missingConcepts) && vr.missingConcepts.length > 0 && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">
                          <strong>Missing Concepts:</strong> {vr.missingConcepts.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Faculty Evaluation Form */}
            <form
              onSubmit={handleSaveEvaluation}
              className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                  Faculty Evaluation Decision & Feedback
                </h4>
                <span className="text-[10px] text-stone-500">
                  Faculty decision is authoritative & logged immutably
                </span>
              </div>

              {evalMessage && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    evalMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {evalMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{evalMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Evaluation Decision
                  </label>
                  <select
                    value={evalStatus}
                    onChange={(e) =>
                      setEvalStatus(e.target.value as SubmissionEvaluationStatus)
                    }
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                  >
                    <option value="faculty_reviewed">Approve (Faculty Reviewed)</option>
                    <option value="needs_revision">Request Improvements (Needs Revision)</option>
                    <option value="rejected">Reject Submission</option>
                    <option value="ai_evaluated">Keep AI Evaluated</option>
                    <option value="auto_graded">Keep Auto Graded</option>
                    <option value="pending">Return to Pending Review</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Faculty Score Override (optional, 0–{selectedSub.maxScore || 100})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={selectedSub.maxScore || 100}
                    step="0.5"
                    placeholder={`Keep auto score (${selectedSub.totalScore})`}
                    value={evalScoreInput}
                    onChange={(e) => setEvalScoreInput(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Instructor Feedback
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide specific apparatus calibration, error analysis, or viva feedback for the student..."
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>

              {/* Quick Action Buttons: Approve / Request Improvements / Reject */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingEval}
                    onClick={() => submitEvaluation('faculty_reviewed')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingEval}
                    onClick={() => submitEvaluation('needs_revision')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Request Improvements</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingEval}
                    onClick={() => submitEvaluation('rejected')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSub(null)}
                    className="rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingEval}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    {savingEval ? 'Saving...' : 'Save Evaluation'}
                  </button>
                </div>
              </div>
            </form>

            {/* Immutable Evaluation History Timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-indigo-500" />
                <span>
                  Evaluation History ({selectedSub.evaluationHistory?.length || 0})
                </span>
              </h4>
              {!selectedSub.evaluationHistory || selectedSub.evaluationHistory.length === 0 ? (
                <p className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/30 p-3 text-[11px] text-stone-500">
                  No prior faculty evaluations logged for this submission yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedSub.evaluationHistory.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 p-3 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {ev.evaluatorName}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                        {(ev.previousStatus || 'auto_graded').replace(/_/g, ' ')} →{' '}
                        {ev.newStatus.replace(/_/g, ' ')}
                        {ev.newScore != null && ` • Score: ${ev.newScore}`}
                      </p>
                      {ev.feedback && (
                        <p className="text-[11px] text-stone-600 dark:text-stone-300">
                          {ev.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
