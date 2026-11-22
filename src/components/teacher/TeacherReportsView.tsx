import React, { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  BarChart3,
  History,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  Filter,
} from 'lucide-react';
import {
  ClassCourse,
  CurrentUser,
  Experiment,
  FacultyAnalyticsPayload,
  FacultyHistoricalReport,
  FacultyStudentReport,
} from '../../types';
import {
  downloadAuthenticatedCsv,
  generateClassCompetencyPdf,
  generateHistoricalReportPdf,
  generateStudentReportPdf,
} from '../../utils/facultyPdfGenerator';
import { StudentProfileReportModal } from './StudentProfileReportModal';

interface TeacherReportsViewProps {
  token: string | null;
  currentUser: CurrentUser;
  classes: ClassCourse[];
  experiments: Experiment[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  isDark?: boolean;
}

export const TeacherReportsView: React.FC<TeacherReportsViewProps> = ({
  token,
  currentUser,
  classes,
  experiments,
  selectedClassId,
  isDark = false,
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'class' | 'historical'>('student');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Class & Student list source via analytics endpoint
  const [classScopeId, setClassScopeId] = useState<string>(selectedClassId || 'all');
  const [analytics, setAnalytics] = useState<FacultyAnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Student-wise report state
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentReport, setStudentReport] = useState<FacultyStudentReport | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [inspectModalStudentId, setInspectModalStudentId] = useState<string | null>(null);

  // Historical report filters & data
  const [histClassId, setHistClassId] = useState<string>('all');
  const [histExpId, setHistExpId] = useState<string>('all');
  const [histFrom, setHistFrom] = useState<string>('');
  const [histTo, setHistTo] = useState<string>('');
  const [historical, setHistorical] = useState<FacultyHistoricalReport | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const showSuccess = (text: string) => {
    setNotice({ type: 'success', text });
    setTimeout(() => setNotice(null), 4000);
  };
  const showError = (text: string) => setNotice({ type: 'error', text });

  // Load class analytics (and authorized student roster list)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setAnalyticsLoading(true);

    const qs = classScopeId && classScopeId !== 'all' ? `?classId=${encodeURIComponent(classScopeId)}` : '';
    fetch(`/api/teacher/analytics${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.analytics) {
          throw new Error(data.error || 'Failed to load class competency report data.');
        }
        if (!cancelled) {
          setAnalytics(data.analytics);
          if (
            data.analytics.studentsSummary.length > 0 &&
            (!selectedStudentId ||
              !data.analytics.studentsSummary.some((s: any) => s.studentId === selectedStudentId))
          ) {
            setSelectedStudentId(data.analytics.studentsSummary[0].studentId);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showError(err instanceof Error ? err.message : 'Unable to load analytics data.');
        }
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, classScopeId]);

  // Load selected student detailed report
  useEffect(() => {
    if (!token || !selectedStudentId) {
      setStudentReport(null);
      return;
    }
    let cancelled = false;
    setStudentLoading(true);

    fetch(`/api/teacher/students/${encodeURIComponent(selectedStudentId)}/report`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.report) {
          throw new Error(data.error || 'Failed to load student report.');
        }
        if (!cancelled) setStudentReport(data.report);
      })
      .catch((err) => {
        if (!cancelled) {
          showError(err instanceof Error ? err.message : 'Failed to load student report.');
        }
      })
      .finally(() => {
        if (!cancelled) setStudentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedStudentId]);

  // Load historical assessment report
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setHistLoading(true);

    const params = new URLSearchParams();
    if (histClassId && histClassId !== 'all') params.set('classId', histClassId);
    if (histExpId && histExpId !== 'all') params.set('experimentId', histExpId);
    if (histFrom) params.set('from', histFrom);
    if (histTo) params.set('to', histTo);

    fetch(`/api/teacher/reports/historical?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.report) {
          throw new Error(data.error || 'Failed to load historical assessment report.');
        }
        if (!cancelled) setHistorical(data.report);
      })
      .catch((err) => {
        if (!cancelled) {
          showError(err instanceof Error ? err.message : 'Unable to load historical report.');
        }
      })
      .finally(() => {
        if (!cancelled) setHistLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, histClassId, histExpId, histFrom, histTo]);

  const handleDownloadStudentPdf = () => {
    if (!studentReport) return;
    const filename = generateStudentReportPdf(studentReport, currentUser.name);
    showSuccess(`Student PDF generated: ${filename}`);
  };

  const handleDownloadClassPdf = () => {
    if (!analytics) return;
    const filename = generateClassCompetencyPdf(analytics, currentUser.name);
    showSuccess(`Class Competency PDF generated: ${filename}`);
  };

  const handleDownloadHistoricalPdf = () => {
    if (!historical) return;
    const scopeCls = classes.find((c) => c.id === histClassId);
    const scopeLabel = scopeCls ? `${scopeCls.code} (${scopeCls.name})` : 'All Assigned Cohorts';
    const filename = generateHistoricalReportPdf(historical, scopeLabel, currentUser.name);
    showSuccess(`Historical Assessment PDF generated: ${filename}`);
  };

  const handleExportCsv = async (
    key: string,
    type: 'student' | 'class_competency' | 'historical'
  ) => {
    if (!token) return;
    setExportingKey(key);
    try {
      const params = new URLSearchParams({ type });
      if (type === 'student' && selectedStudentId) {
        params.set('studentId', selectedStudentId);
      } else if (type === 'class_competency' && classScopeId !== 'all') {
        params.set('classId', classScopeId);
      } else if (type === 'historical') {
        if (histClassId !== 'all') params.set('classId', histClassId);
        if (histExpId !== 'all') params.set('experimentId', histExpId);
        if (histFrom) params.set('from', histFrom);
        if (histTo) params.set('to', histTo);
      }
      const filename = await downloadAuthenticatedCsv(
        `/api/teacher/reports/export?${params.toString()}`,
        token,
        `simlab_${type}_report.csv`
      );
      showSuccess(`Excel-compatible CSV exported: ${filename}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to export CSV.');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Official Academic Reporting Suite
            </span>
            <span className="text-xs text-stone-500">PDF & Excel-Compatible CSV Exports</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Faculty Competency & Historical Assessment Reports
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Generate accredited student-wise PDFs, class competency matrices, Excel-ready CSV spreadsheets, and historical evaluation transcripts.
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Report Type Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3">
        {[
          { id: 'student', label: 'Student-Wise PDF & CSV', icon: UserCheck },
          { id: 'class', label: 'Class-Wise Competency Report', icon: BarChart3 },
          { id: 'historical', label: 'Historical Assessment Report', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STUDENT-WISE REPORTS */}
      {activeTab === 'student' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                  Filter Cohort
                </label>
                <select
                  value={classScopeId}
                  onChange={(e) => setClassScopeId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-900 dark:text-stone-100"
                >
                  <option value="all">All Assigned Cohorts</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}: {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                  Select Authorized Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-900 dark:text-stone-100"
                >
                  {(analytics?.studentsSummary || []).map((st) => (
                    <option key={st.studentId} value={st.studentId}>
                      {st.studentName} ({st.classCodes.join(', ')}) — {Math.round(st.overallMastery)}%
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!studentReport}
                onClick={handleDownloadStudentPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>Download Student PDF</span>
              </button>
              <button
                type="button"
                disabled={!studentReport || exportingKey === 'student'}
                onClick={() => handleExportCsv('student', 'student')}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 text-stone-800 dark:text-stone-200 px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {exportingKey === 'student' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>Export CSV (Excel)</span>
              </button>
            </div>
          </div>

          {studentLoading || analyticsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span>Preparing student report preview...</span>
            </div>
          ) : studentReport ? (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {studentReport.student.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {studentReport.student.email} •{' '}
                    {studentReport.student.enrollmentCode || 'No Code'} •{' '}
                    {studentReport.student.enrolledClasses.map((c) => c.code).join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectModalStudentId(studentReport.student.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Open Full Interactive Report</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                {studentReport.competencyReport.dimensions.map((d) => (
                  <div
                    key={d.key}
                    className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3"
                  >
                    <span className="text-[10px] font-bold uppercase text-stone-400 block truncate">
                      {d.label}
                    </span>
                    <p className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
                      {Math.round(d.score)}%
                    </p>
                    <span className="text-[10px] capitalize text-indigo-600 dark:text-indigo-400 font-semibold">
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-stone-500">
                Report includes {studentReport.submissions.length} experiment submissions,{' '}
                {studentReport.vivaSessions.length} AI Viva Voce transcripts, and{' '}
                {studentReport.evaluationHistory.length} faculty evaluation audit records.
              </p>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-stone-500">
              No enrolled students found in the selected cohort scope.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLASS-WISE COMPETENCY REPORTS */}
      {activeTab === 'class' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="w-full sm:w-80">
              <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                Cohort Scope
              </label>
              <select
                value={classScopeId}
                onChange={(e) => setClassScopeId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-900 dark:text-stone-100"
              >
                <option value="all">All Assigned Cohorts (Comparison Matrix)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}: {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!analytics}
                onClick={handleDownloadClassPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>Download Class PDF</span>
              </button>
              <button
                type="button"
                disabled={!analytics || exportingKey === 'class'}
                onClick={() => handleExportCsv('class', 'class_competency')}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 text-stone-800 dark:text-stone-200 px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {exportingKey === 'class' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>Export Class CSV (Excel)</span>
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span>Aggregating class competency matrix...</span>
            </div>
          ) : analytics ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase font-bold text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Class Cohort</th>
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">Overall</th>
                    <th className="px-4 py-3">Setup</th>
                    <th className="px-4 py-3">Measurement</th>
                    <th className="px-4 py-3">Data Analysis</th>
                    <th className="px-4 py-3">Safety</th>
                    <th className="px-4 py-3">Design</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                  {analytics.classComparison.map((row) => (
                    <tr key={row.classId} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                      <td className="px-4 py-3 font-bold text-stone-900 dark:text-stone-100">
                        {row.code}
                        <span className="block text-[10px] font-normal text-stone-500">
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.studentCount}</td>
                      <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                        {Math.round(row.overallAverage)}%
                      </td>
                      <td className="px-4 py-3">{Math.round(row.setup_adherence)}%</td>
                      <td className="px-4 py-3">{Math.round(row.measurement_precision)}%</td>
                      <td className="px-4 py-3">{Math.round(row.data_interpretation)}%</td>
                      <td className="px-4 py-3">{Math.round(row.troubleshooting_safety)}%</td>
                      <td className="px-4 py-3">{Math.round(row.experimental_design)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: HISTORICAL ASSESSMENT REPORTS */}
      {activeTab === 'historical' && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-5">
          {/* Filter Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                  Cohort
                </label>
                <select
                  value={histClassId}
                  onChange={(e) => setHistClassId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                >
                  <option value="all">All Cohorts</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}: {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                  Experiment
                </label>
                <select
                  value={histExpId}
                  onChange={(e) => setHistExpId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                >
                  <option value="all">All Experiments</option>
                  {experiments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={histFrom}
                  onChange={(e) => setHistFrom(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={histTo}
                  onChange={(e) => setHistTo(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!historical}
                onClick={handleDownloadHistoricalPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                disabled={!historical || exportingKey === 'historical'}
                onClick={() => handleExportCsv('historical', 'historical')}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 text-stone-800 dark:text-stone-200 px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {exportingKey === 'historical' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                )}
                <span>Export CSV (Excel)</span>
              </button>
            </div>
          </div>

          {histLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span>Loading historical assessment records...</span>
            </div>
          ) : historical ? (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {[
                  { label: 'Total Submissions', value: historical.summary.totalSubmissions },
                  { label: 'Unique Students', value: historical.summary.uniqueStudents },
                  { label: 'Average Score', value: `${historical.summary.averageScorePct}%` },
                  { label: 'Approved', value: historical.summary.approvedCount },
                  { label: 'Needs Revision', value: historical.summary.needsRevisionCount },
                  { label: 'Pending Review', value: historical.summary.pendingReviewCount },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 p-3"
                  >
                    <span className="text-[10px] font-bold uppercase text-stone-400">
                      {kpi.label}
                    </span>
                    <p className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-100">
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {historical.records.length === 0 ? (
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-8 text-center text-xs text-stone-500 flex flex-col items-center gap-2">
                  <Filter className="h-5 w-5 text-stone-400" />
                  <span>No assessment records match the selected filters.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                    <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase font-bold text-stone-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Cohort</th>
                        <th className="px-4 py-3">Experiment</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                      {historical.records.map((rec) => (
                        <tr
                          key={rec.submissionId}
                          className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40"
                        >
                          <td className="px-4 py-3 font-bold text-stone-900 dark:text-stone-100">
                            <button
                              type="button"
                              onClick={() => setInspectModalStudentId(rec.studentId)}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left"
                            >
                              {rec.studentName}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">{rec.classCode}</td>
                          <td className="px-4 py-3">
                            {rec.experimentTitle}
                            <span className="block text-[10px] text-stone-400">
                              Attempt #{rec.attemptNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                            {rec.effectiveScorePct}%
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                rec.evaluationStatus === 'faculty_reviewed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : rec.evaluationStatus === 'rejected' ||
                                    rec.evaluationStatus === 'needs_revision'
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {rec.evaluationStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-500">
                            {new Date(rec.submittedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {inspectModalStudentId && (
        <StudentProfileReportModal
          studentId={inspectModalStudentId}
          token={token}
          facultyName={currentUser.name}
          isDark={isDark}
          onClose={() => setInspectModalStudentId(null)}
        />
      )}
    </div>
  );
};
