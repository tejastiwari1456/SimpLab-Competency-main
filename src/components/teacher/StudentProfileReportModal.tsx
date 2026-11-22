import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Award,
  MessageSquare,
  History,
  FlaskConical,
  Mail,
  GraduationCap,
} from 'lucide-react';
import {
  COMPETENCY_DIMENSIONS,
  FacultyStudentReport,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';
import {
  downloadAuthenticatedCsv,
  generateStudentReportPdf,
} from '../../utils/facultyPdfGenerator';

interface StudentProfileReportModalProps {
  studentId: string;
  token: string | null;
  facultyName: string;
  isDark?: boolean;
  onClose: () => void;
}

export const StudentProfileReportModal: React.FC<StudentProfileReportModalProps> = ({
  studentId,
  token,
  facultyName,
  isDark = false,
  onClose,
}) => {
  const [report, setReport] = useState<FacultyStudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'viva' | 'evaluations'>(
    'overview'
  );
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportNotice, setExportNotice] = useState('');

  useEffect(() => {
    if (!token || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(`/api/teacher/students/${encodeURIComponent(studentId)}/report`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.report) {
          throw new Error(data.error || 'Unable to load authorized student report.');
        }
        if (!cancelled) {
          setReport(data.report);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load student profile.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, token]);

  const handleDownloadPdf = () => {
    if (!report) return;
    const filename = generateStudentReportPdf(report, facultyName);
    setExportNotice(`Downloaded ${filename}`);
    setTimeout(() => setExportNotice(''), 3500);
  };

  const handleDownloadCsv = async () => {
    if (!token || !report) return;
    setExportingCsv(true);
    try {
      const filename = await downloadAuthenticatedCsv(
        `/api/teacher/reports/export?type=student&studentId=${encodeURIComponent(studentId)}`,
        token,
        `student_report_${studentId}.csv`
      );
      setExportNotice(`Downloaded ${filename}`);
      setTimeout(() => setExportNotice(''), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export student CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Student Profile and Competency Report"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl">
        {/* Sticky Top Header */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xs px-6 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Authorized Student Competency Profile
            </span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {report?.student.name || 'Loading Student Profile...'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  disabled={exportingCsv}
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 px-3 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {exportingCsv ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span>CSV</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close student report modal"
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {exportNotice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{exportNotice}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-xs text-stone-500">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span>Loading student competency report, submission history, and viva transcripts...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : report ? (
            <>
              {/* Student Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{report.student.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 font-medium">
                    <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                    <span>
                      {report.student.enrollmentCode || 'No Enrollment Code'} •{' '}
                      {report.student.institution}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {report.student.enrolledClasses.map((cls) => (
                      <span
                        key={cls.classId}
                        className="rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300"
                      >
                        {cls.code}: {cls.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-3.5">
                  <span className="text-[10px] font-bold uppercase text-stone-400">
                    Overall Competency
                  </span>
                  <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {Math.round(report.competencyReport.overallScore)}%
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {report.competencyReport.experimentsEvaluatedCount} labs assessed
                  </p>
                </div>

                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-3.5">
                  <span className="text-[10px] font-bold uppercase text-stone-400">
                    Activity Totals
                  </span>
                  <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {report.submissions.length}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Submissions • {report.vivaSessions.length} AI Vivas
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                {[
                  { id: 'overview', label: 'Competency Report', icon: Award },
                  {
                    id: 'submissions',
                    label: `Experiment History (${report.submissions.length})`,
                    icon: FlaskConical,
                  },
                  {
                    id: 'viva',
                    label: `AI Viva History (${report.vivaSessions.length})`,
                    icon: MessageSquare,
                  },
                  {
                    id: 'evaluations',
                    label: `Evaluation Log (${report.evaluationHistory.length})`,
                    icon: History,
                  },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id as any)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        activeTab === t.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: Competency Overview */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-800/30 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                      5-Dimension Competency Radar
                    </h4>
                    <CompetencyRadar
                      scores={report.competencyReport.competencyScores}
                      studentName={report.student.name}
                      height={250}
                      isDark={isDark}
                    />
                  </div>

                  <div className="lg:col-span-7 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Dimension-Wise Breakdown
                    </h4>
                    {report.competencyReport.dimensions.map((dim) => (
                      <div
                        key={dim.key}
                        className="rounded-xl border border-stone-200 dark:border-stone-800 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900 dark:text-stone-100">
                            {dim.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-stone-500">
                              Practical {Math.round(dim.experimentContribution)}% • Viva{' '}
                              {Math.round(dim.vivaContribution)}%
                            </span>
                            <span
                              className={`font-bold ${
                                dim.score >= 85
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : dim.score < 70
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-indigo-600 dark:text-indigo-400'
                              }`}
                            >
                              {Math.round(dim.score)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              dim.score >= 85
                                ? 'bg-emerald-500'
                                : dim.score < 70
                                ? 'bg-rose-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(2, dim.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                        <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Demonstrated Strengths
                        </span>
                        <p className="mt-1 font-medium text-stone-800 dark:text-stone-200">
                          {report.competencyReport.strongAreas.length > 0
                            ? report.competencyReport.strongAreas
                                .map((k) => COMPETENCY_DIMENSIONS[k]?.shortLabel || k)
                                .join(', ')
                            : 'No dimensions above 85% benchmark yet'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-3">
                        <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300">
                          Remedial Priority Areas
                        </span>
                        <p className="mt-1 font-medium text-stone-800 dark:text-stone-200">
                          {report.competencyReport.weakAreas.length > 0
                            ? report.competencyReport.weakAreas
                                .map((k) => COMPETENCY_DIMENSIONS[k]?.shortLabel || k)
                                .join(', ')
                            : 'All dimensions meeting proficiency threshold'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Experiment Submissions */}
              {activeTab === 'submissions' && (
                <div className="space-y-3">
                  {report.submissions.length === 0 ? (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-8 text-center text-xs text-stone-500">
                      No experiment submissions recorded for this student yet.
                    </div>
                  ) : (
                    report.submissions.map((sub) => {
                      const effective = sub.facultyScore ?? sub.totalScore;
                      return (
                        <div
                          key={sub.id}
                          className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 text-xs space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-stone-900 dark:text-stone-100">
                                {sub.experimentTitle}
                              </span>
                              <span className="ml-2 text-[11px] font-mono text-stone-400">
                                Attempt #{sub.attemptNumber} •{' '}
                                {new Date(sub.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {effective}/{sub.maxScore}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  sub.evaluationStatus === 'faculty_reviewed'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : sub.evaluationStatus === 'rejected' ||
                                      sub.evaluationStatus === 'needs_revision'
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {sub.evaluationStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>

                          {sub.instructorFeedback && (
                            <p className="rounded-lg bg-stone-50 dark:bg-stone-800/60 p-2.5 text-[11px] text-stone-700 dark:text-stone-300">
                              <strong>Faculty Feedback:</strong> {sub.instructorFeedback}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: AI Viva Sessions */}
              {activeTab === 'viva' && (
                <div className="space-y-3">
                  {report.vivaSessions.length === 0 ? (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-8 text-center text-xs text-stone-500">
                      No AI Viva Voce sessions recorded for this student yet.
                    </div>
                  ) : (
                    report.vivaSessions.map((vs) => (
                      <div
                        key={vs.id}
                        className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 text-xs space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-stone-900 dark:text-stone-100">
                              {vs.experimentTitle} (Attempt #{vs.attemptNumber})
                            </span>
                            <span className="ml-2 text-[11px] text-stone-500">
                              {vs.answeredCount}/{vs.questionsCount} questions •{' '}
                              {new Date(vs.startedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="font-bold text-indigo-700 dark:text-indigo-300">
                            {Math.round(vs.overallScore)}%
                          </span>
                        </div>
                        {vs.summaryFeedback && (
                          <p className="text-[11px] text-stone-700 dark:text-stone-300">
                            {vs.summaryFeedback}
                          </p>
                        )}
                        {vs.responses.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {vs.responses.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-lg bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 p-2.5 space-y-1"
                              >
                                <div className="flex justify-between gap-2 font-semibold text-stone-800 dark:text-stone-200">
                                  <span>Q: {r.questionText}</span>
                                  <span className="text-indigo-600 dark:text-indigo-400 shrink-0">
                                    {r.score}/100
                                  </span>
                                </div>
                                <p className="text-stone-600 dark:text-stone-400">
                                  <strong>Answer:</strong> {r.studentAnswer}
                                </p>
                                <p className="text-[11px] text-stone-500">
                                  <strong>AI Feedback:</strong> {r.aiFeedback}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: Evaluation History */}
              {activeTab === 'evaluations' && (
                <div className="space-y-2.5">
                  {report.evaluationHistory.length === 0 ? (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-8 text-center text-xs text-stone-500">
                      No faculty evaluation audit events recorded yet for this student.
                    </div>
                  ) : (
                    report.evaluationHistory.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-xl border border-stone-200 dark:border-stone-800 p-3.5 text-xs space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-stone-900 dark:text-stone-100">
                            {ev.evaluatorName}
                          </span>
                          <span className="text-[11px] text-stone-500">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
                          Status: {(ev.previousStatus || 'auto_graded').replace(/_/g, ' ')} →{' '}
                          {ev.newStatus.replace(/_/g, ' ')}
                          {ev.newScore != null && ` • Score: ${ev.newScore}`}
                        </p>
                        {ev.feedback && (
                          <p className="text-stone-600 dark:text-stone-300">{ev.feedback}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
