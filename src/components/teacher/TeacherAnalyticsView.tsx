import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  TrendingUp,
  FlaskConical,
  Loader2,
  Eye,
  ShieldCheck,
  Lightbulb,
  Target,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  ClassCourse,
  CurrentUser,
  StudentSubmission,
  COMPETENCY_DIMENSIONS,
  Experiment,
  FacultyAnalyticsPayload,
  FacultyAiInsightsPayload,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';
import { StudentProfileReportModal } from './StudentProfileReportModal';

interface TeacherAnalyticsViewProps {
  token: string | null;
  currentUser?: CurrentUser;
  classes: ClassCourse[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  submissions: StudentSubmission[];
  experiments?: Experiment[];
  isDark?: boolean;
}

export const TeacherAnalyticsView: React.FC<TeacherAnalyticsViewProps> = ({
  token,
  currentUser,
  classes,
  selectedClassId,
  onSelectClassId,
  submissions,
  isDark = false,
}) => {
  const [scopeClassId, setScopeClassId] = useState<string>(selectedClassId || 'all');
  const [analytics, setAnalytics] = useState<FacultyAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Individual student report picker
  const [pickedStudentId, setPickedStudentId] = useState<string>('');
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  // AI Faculty Insights state
  const [aiInsights, setAiInsights] = useState<FacultyAiInsightsPayload | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setAiInsights(null);
    setAiError('');

    const qs =
      scopeClassId && scopeClassId !== 'all'
        ? `?classId=${encodeURIComponent(scopeClassId)}`
        : '';

    fetch(`/api/teacher/analytics${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.analytics) {
          throw new Error(data.error || 'Failed to load competency analytics.');
        }
        if (!cancelled) {
          setAnalytics(data.analytics);
          if (data.analytics.studentsSummary.length > 0) {
            setPickedStudentId((prev) =>
              prev && data.analytics.studentsSummary.some((s: any) => s.studentId === prev)
                ? prev
                : data.analytics.studentsSummary[0].studentId
            );
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load analytics.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, scopeClassId, submissions.length]);

  const handleGenerateAiInsights = async () => {
    if (!token) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/teacher/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classId: scopeClassId !== 'all' ? scopeClassId : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.insights) {
        throw new Error(data.error || 'Failed to generate AI faculty insights.');
      }
      setAiInsights(data.insights);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate AI insights right now.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-center">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          No Cohort Analytics Available
        </h2>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Analytics will appear once a class cohort is assigned to your account.
        </p>
      </div>
    );
  }

  const averageCompetencies = analytics?.averageCompetencies ?? {
    setup_adherence: 0,
    measurement_precision: 0,
    data_interpretation: 0,
    troubleshooting_safety: 0,
    experimental_design: 0,
  };

  const chartAxisColor = isDark ? '#a8a29e' : '#57534e';
  const chartGridColor = isDark ? '#292524' : '#e7e5e4';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Empirical Competency Diagnostics
            </span>
            <span className="text-xs text-stone-500">Cohort & Experiment Analytics</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Competency Analytics & AI Faculty Insights
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Compare cohorts, identify skill gaps, analyze experiment outcomes, track improvement trends, and generate advisory teaching insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={scopeClassId}
            onChange={(e) => {
              setScopeClassId(e.target.value);
              if (e.target.value !== 'all') onSelectClassId(e.target.value);
            }}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200"
          >
            <option value="all">All Assigned Cohorts</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code}: {cls.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={aiLoading || loading}
            onClick={handleGenerateAiInsights}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold shadow-xs cursor-pointer"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{aiLoading ? 'Analyzing Cohort...' : 'Generate AI Faculty Insights'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !analytics ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span>Computing real-time cohort competency analytics...</span>
        </div>
      ) : analytics ? (
        <>
          {/* AI FACULTY INSIGHTS SECTION (Advisory Support) */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 via-white to-white dark:from-indigo-950/30 dark:via-stone-900 dark:to-stone-900 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                    AI Faculty Insights — {analytics.scope.code}
                  </h3>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                  Synthesizes live cohort competency scores, submission outcomes, and AI Viva transcripts into actionable teaching guidance.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-stone-900 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 self-start sm:self-auto">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Advisory Only — Faculty Retains Authority</span>
              </span>
            </div>

            {aiError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {!aiInsights && !aiLoading && (
              <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/70 bg-white/80 dark:bg-stone-900/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <p className="text-stone-600 dark:text-stone-400">
                  Click <strong>Generate AI Faculty Insights</strong> to analyze real student performance data for{' '}
                  <strong>{analytics.scope.name}</strong> and surface common mistakes, competency gaps, teaching recommendations, and personalized student interventions.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateAiInsights}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 font-bold shrink-0 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate Insights</span>
                </button>
              </div>
            )}

            {aiLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-indigo-700 dark:text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating evidence-based faculty insights from student records...</span>
              </div>
            )}

            {aiInsights && (
              <div className="space-y-4">
                {/* Summary & Advisory Banner */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-white dark:bg-stone-900 p-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Class Performance Summary
                  </span>
                  <p className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed">
                    {aiInsights.classPerformanceSummary}
                  </p>
                  <p className="text-[11px] text-stone-500 italic pt-1 border-t border-stone-100 dark:border-stone-800">
                    {aiInsights.advisoryNotice}
                  </p>
                </div>

                {/* Common Mistakes + Frequently Observed Gaps */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-stone-900 p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Common Student Mistakes</span>
                    </h4>
                    {aiInsights.commonMistakes.map((m, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-2.5 text-xs space-y-0.5"
                      >
                        <p className="font-bold text-stone-900 dark:text-stone-100">{m.mistake}</p>
                        <p className="text-[11px] text-stone-600 dark:text-stone-400">
                          <strong>Lab:</strong> {m.affectedExperiment} • {m.frequencyNote}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-stone-900 p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      <span>Frequently Observed Competency Gaps</span>
                    </h4>
                    {aiInsights.frequentlyObservedGaps.map((g, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-2.5 text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-stone-900 dark:text-stone-100">
                            {g.competency}
                          </span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {Math.round(g.avgScore)}% avg
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 dark:text-stone-400">
                          {g.diagnosticReason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Teaching Recommendations + Personalized Student Interventions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-stone-900 p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5" />
                      <span>Teaching Improvement Recommendations</span>
                    </h4>
                    {aiInsights.teachingRecommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-2.5 text-xs space-y-1"
                      >
                        <p className="font-bold text-stone-900 dark:text-stone-100">{rec.title}</p>
                        <p className="text-[11px] text-stone-700 dark:text-stone-300">
                          {rec.actionPlan}
                        </p>
                        <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Expected Impact: {rec.expectedImpact}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-stone-900 p-4 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>Personalized Student Interventions</span>
                    </h4>
                    {aiInsights.studentInterventions.length === 0 ? (
                      <p className="text-xs text-stone-500">
                        No high-risk individual student interventions flagged in this cohort.
                      </p>
                    ) : (
                      aiInsights.studentInterventions.map((inv, idx) => (
                        <div
                          key={`${inv.studentId}-${idx}`}
                          className="rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectedStudentId(inv.studentId)}
                              className="font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                            >
                              {inv.studentName}
                            </button>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                inv.riskLevel === 'high'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  : inv.riskLevel === 'moderate'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                              }`}
                            >
                              {inv.riskLevel}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600 dark:text-stone-400">
                            <strong>Focus Gap:</strong> {inv.weakness}
                          </p>
                          <p className="text-[11px] text-stone-700 dark:text-stone-300">
                            <strong>Recommended Practice:</strong> {inv.recommendedPractice}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ROW 1: Cohort Radar + Skill-Gap Identification */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                    Cohort Competency Radar
                  </h3>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {analytics.scope.code}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  5-dimension practical + AI Viva empirical competency profile.
                </p>

                <div className="mt-4">
                  <CompetencyRadar
                    scores={averageCompetencies}
                    studentName={analytics.scope.code}
                    height={270}
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Individual Student Quick Report Launcher */}
              {analytics.studentsSummary.length > 0 && (
                <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Individual Student Competency Report
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={pickedStudentId}
                      onChange={(e) => setPickedStudentId(e.target.value)}
                      className="flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-1.5 text-xs text-stone-900 dark:text-stone-100"
                    >
                      {analytics.studentsSummary.map((st) => (
                        <option key={st.studentId} value={st.studentId}>
                          {st.studentName} ({Math.round(st.overallMastery)}%)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!pickedStudentId}
                      onClick={() => setInspectedStudentId(pickedStudentId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Open Report</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Skill-Gap Identification Panel */}
            <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" />
                  <span>Skill-Gap Identification (vs. 75% Benchmark)</span>
                </h3>
                <span className="text-[11px] font-semibold text-stone-500">
                  Sorted by largest deficit
                </span>
              </div>

              <div className="space-y-3">
                {analytics.skillGaps.map((gap) => (
                  <div
                    key={gap.competencyKey}
                    className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 p-3.5 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {gap.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {Math.round(gap.averageScore)}%
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            gap.severity === 'critical'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              : gap.severity === 'attention'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              : gap.severity === 'strong'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {gap.gapFromBenchmark > 0
                            ? `-${gap.gapFromBenchmark}% below target`
                            : `+${Math.abs(gap.gapFromBenchmark)}% above target`}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          gap.severity === 'critical'
                            ? 'bg-rose-500'
                            : gap.severity === 'attention'
                            ? 'bg-amber-500'
                            : gap.severity === 'strong'
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, gap.averageScore))}%` }}
                      />
                      {/* 75% benchmark marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-stone-700 dark:bg-stone-300"
                        style={{ left: '75%' }}
                        title="75% Target Benchmark"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 2: Class-wise Competency Comparison + Competency Improvement Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                  Class-Wise Competency Comparisons
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Side-by-side comparison of 5 syllabus competencies across your assigned cohorts.
                </p>
              </div>

              {analytics.classComparison.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-500">
                  No class cohorts available for comparison.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.classComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="code" tick={{ fontSize: 11, fill: chartAxisColor }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chartAxisColor }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1c1917' : '#ffffff',
                          borderColor: isDark ? '#44403c' : '#e7e5e4',
                          borderRadius: '10px',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="setup_adherence" name="Setup" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="measurement_precision" name="Measurement" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="data_interpretation" name="Data Analysis" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="troubleshooting_safety" name="Safety" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="experimental_design" name="Design" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>Competency Improvement Trends</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Chronological progression of mean student competency across assessment checkpoints.
                </p>
              </div>

              {analytics.improvementTrends.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  Improvement trend curve will populate as students submit lab attempts.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.improvementTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartAxisColor }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chartAxisColor }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1c1917' : '#ffffff',
                          borderColor: isDark ? '#44403c' : '#e7e5e4',
                          borderRadius: '10px',
                          fontSize: '11px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="averageOverall"
                        name="Mean Competency (%)"
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ROW 3: Experiment Performance Analysis */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-indigo-500" />
                  <span>Experiment Performance Analysis</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Submission volume, average score, pass rate (≥70%), and weakest competency per virtual experiment.
                </p>
              </div>
            </div>

            {analytics.experimentPerformance.length === 0 ? (
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-6 text-center text-xs text-stone-500">
                No experiment performance records available for the selected scope yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                  <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase font-bold text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Experiment</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Submissions</th>
                      <th className="px-4 py-3">Avg Score</th>
                      <th className="px-4 py-3">Pass Rate</th>
                      <th className="px-4 py-3">Weakest Competency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                    {analytics.experimentPerformance.map((exp) => (
                      <tr
                        key={exp.experimentId}
                        className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40"
                      >
                        <td className="px-4 py-3 font-bold text-stone-900 dark:text-stone-100">
                          {exp.title}
                          <span className="block text-[10px] font-mono font-normal text-stone-400">
                            {exp.code}
                          </span>
                        </td>
                        <td className="px-4 py-3">{exp.subject}</td>
                        <td className="px-4 py-3">
                          {exp.submissionsCount} ({exp.uniqueStudentsCount} students)
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                          {exp.averageScorePct}%
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-bold ${
                              exp.passRatePct >= 80
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : exp.passRatePct < 60
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {exp.passRatePct}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                            {COMPETENCY_DIMENSIONS[exp.weakestCompetency]?.shortLabel ||
                              exp.weakestCompetency}{' '}
                            ({exp.weakestCompetencyAvg}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ROW 4: Students Requiring Remedial Practice */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <span>Students Requiring Remedial Practice</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Deduplicated list of enrolled students below the 75% mastery threshold with recommended practice experiments.
                </p>
              </div>
              <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 text-xs font-bold">
                {analytics.remedialStudents.length} Students Flagged
              </span>
            </div>

            {analytics.remedialStudents.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 text-center text-xs text-emerald-700 dark:text-emerald-300">
                All evaluated students in this scope currently meet or exceed the 75% competency benchmark.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                  <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase font-bold text-stone-500">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Cohort</th>
                      <th className="px-4 py-3">Overall Mastery</th>
                      <th className="px-4 py-3">Weakest Dimension</th>
                      <th className="px-4 py-3">Recommended Remedial Lab</th>
                      <th className="px-4 py-3 text-right">Individual Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                    {analytics.remedialStudents.map((st) => (
                      <tr
                        key={st.studentId}
                        className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40"
                      >
                        <td className="px-4 py-3 font-bold text-stone-900 dark:text-stone-100">
                          {st.studentName}
                          <span className="block text-[10px] font-normal text-stone-400">
                            {st.submissionsCount} submissions • {st.riskLevel.toUpperCase()} risk
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {st.classCodes.join(', ')}
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">
                          {Math.round(st.overallMastery)}%
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[10px] font-semibold">
                            {st.weakestCompetencyLabel} ({Math.round(st.weakestCompetencyScore)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-700 dark:text-stone-300">
                          {st.recommendedExperimentTitle}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectedStudentId(st.studentId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {inspectedStudentId && (
        <StudentProfileReportModal
          studentId={inspectedStudentId}
          token={token}
          facultyName={currentUser?.name || 'Faculty'}
          isDark={isDark}
          onClose={() => setInspectedStudentId(null)}
        />
      )}
    </div>
  );
};
