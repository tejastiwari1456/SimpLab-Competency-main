import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Info,
  TrendingUp,
  ArrowRight,
  Eye,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  CompetencyKey,
  COMPETENCY_DIMENSIONS,
  CurrentUser,
  StudentCompetencyReport,
  StudentRecommendation,
  StudentSubmission,
  StudentMilestoneStatus,
  VivaSessionRecord,
} from '../../types';
import { EXPERIMENTS } from '../../data/mockData';
import { CompetencyRadar } from './CompetencyRadar';
import { COMPETENCY_MILESTONES, getMilestoneStatuses } from '../../data/milestonesData';
import { DigitalBadgeModal } from '../badges/DigitalBadgeModal';
import {
  SubmissionDetailModal,
  VivaReportModal,
} from '../student/AssessmentDetailModals';

interface StudentAnalyticsProps {
  currentUser: CurrentUser;
  token?: string | null;
  isLoading?: boolean;
  submissions: StudentSubmission[];
  activeScores: Record<CompetencyKey, number>;
  competencyReport: StudentCompetencyReport | null;
  classAverageScores: Record<CompetencyKey, number>;
  vivaSessions: VivaSessionRecord[];
  recommendations?: StudentRecommendation[];
  onLaunchExperiment?: (expId: string) => void;
  isDark?: boolean;
}

export const StudentAnalytics: React.FC<StudentAnalyticsProps> = ({
  currentUser,
  token = null,
  isLoading = false,
  submissions,
  activeScores,
  competencyReport,
  classAverageScores,
  vivaSessions,
  recommendations = [],
  onLaunchExperiment,
  isDark = false,
}) => {
  const [selectedMilestone, setSelectedMilestone] = useState<StudentMilestoneStatus | null>(null);
  const [selectedVivaSession, setSelectedVivaSession] = useState<VivaSessionRecord | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);

  const enrollmentLabel = currentUser.enrollmentCode || currentUser.id.slice(0, 12);
  const milestoneStatuses = getMilestoneStatuses(
    COMPETENCY_MILESTONES,
    activeScores,
    currentUser.name,
    enrollmentLabel
  );

  const overallMastery =
    competencyReport?.overallScore ??
    Math.round(
      (Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).reduce(
        (sum, key) => sum + (activeScores[key] || 0) * COMPETENCY_DIMENSIONS[key].weight,
        0
      )
    );

  const strongAreas = competencyReport?.strongAreas ?? [];
  const weakAreas = competencyReport?.weakAreas ?? [];
  const hasClassBenchmarks = Object.values(classAverageScores || {}).some((v) => v > 0);
  const hasEvaluations =
    (competencyReport?.experimentsEvaluatedCount ?? 0) > 0 ||
    submissions.length > 0 ||
    vivaSessions.length > 0;

  // Derive top strength and growth opportunity even when all dimensions sit in 70-84%
  const rankedDims = (Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[])
    .map((key) => ({ key, score: activeScores[key] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const topStrengthFallback = rankedDims[0];
  const lowestGrowthFallback = rankedDims[rankedDims.length - 1];

  // Build chronological competency trajectory for AreaChart
  const trajectoryData = [...(competencyReport?.history || [])]
    .reverse()
    .map((item, idx) => {
      const exp = EXPERIMENTS.find((e) => e.id === item.experimentId);
      return {
        index: idx + 1,
        label: `${exp?.code || 'Lab'} #${item.attemptNumber}`,
        overall: Math.round(Number(item.overallScore)),
        delta: Number(item.deltaOverall || 0),
        date: new Date(item.recordedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
      };
    });

  if (isLoading && !hasEvaluations) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-xl bg-stone-200/70 dark:bg-stone-800/70" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 rounded-xl bg-stone-200/70 dark:bg-stone-800/70" />
          <div className="h-32 rounded-xl bg-stone-200/70 dark:bg-stone-800/70" />
        </div>
        <div className="h-72 rounded-xl bg-stone-200/70 dark:bg-stone-800/70" />
      </div>
    );
  }

  return (
    <div id="student-performance-report" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:flex-row md:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Verified Practical Competence
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">
              {currentUser.name} • ID: {enrollmentLabel}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            Student Practical Competency & Performance Report
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Evidence-based practical and AI Viva competency tracking derived from verified laboratory submissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-4 py-2 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Practical Mastery</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{overallMastery}%</span>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-4 py-2 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Labs Evaluated</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">
              {competencyReport?.experimentsEvaluatedCount ?? submissions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses Identification (always visible once evaluated) */}
      <div id="strengths-weaknesses-panel" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>Demonstrated Strengths (≥ 85% Mastery)</span>
          </div>
          {strongAreas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {strongAreas.map((k) => (
                <span
                  key={k}
                  className="rounded-md bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 font-semibold text-emerald-900 dark:text-emerald-200"
                >
                  {COMPETENCY_DIMENSIONS[k].label} ({activeScores[k]}%)
                </span>
              ))}
            </div>
          ) : hasEvaluations && topStrengthFallback ? (
            <div className="space-y-1 text-stone-700 dark:text-stone-300">
              <p>
                Leading dimension:{' '}
                <strong className="text-emerald-800 dark:text-emerald-300">
                  {COMPETENCY_DIMENSIONS[topStrengthFallback.key].label} ({topStrengthFallback.score}%)
                </strong>
                . Reach 85%+ to unlock official Strong Mastery status.
              </p>
            </div>
          ) : (
            <p className="text-stone-600 dark:text-stone-400">
              Complete your first assigned experiment to establish verified competency strengths.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span>Weaknesses & Growth Focus (&lt; 70% Target)</span>
          </div>
          {weakAreas.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {weakAreas.map((k) => (
                  <span
                    key={k}
                    className="rounded-md bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 px-2.5 py-1 font-semibold text-amber-900 dark:text-amber-200"
                  >
                    {COMPETENCY_DIMENSIONS[k].label} ({activeScores[k]}%)
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                Focus on apparatus calibration checks, multi-trial observation tables, and AI Viva oral defense rubrics in these dimensions.
              </p>
            </div>
          ) : hasEvaluations && lowestGrowthFallback ? (
            <p className="text-stone-700 dark:text-stone-300">
              All dimensions meet the 70% proficiency floor. Next highest-leverage area to elevate:{' '}
              <strong className="text-amber-800 dark:text-amber-300">
                {COMPETENCY_DIMENSIONS[lowestGrowthFallback.key].label} ({lowestGrowthFallback.score}%)
              </strong>
              .
            </p>
          ) : (
            <p className="text-stone-600 dark:text-stone-400">
              No weak competency gaps detected yet. Submit a laboratory experiment to generate your diagnostic profile.
            </p>
          )}
        </div>
      </div>

      {/* Radar & Dimension Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-5 transition-colors">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">
            Competency Dimension Map
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 mb-4">
            Comparison between your demonstrated practical reasoning and your class average.
          </p>
          <CompetencyRadar
            scores={activeScores}
            benchmarkScores={hasClassBenchmarks ? classAverageScores : undefined}
            studentName="Your Demonstrated Score"
            height={300}
            isDark={isDark}
          />
        </div>

        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-7 space-y-4 transition-colors">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Syllabus Practical Competency Breakdown
          </h3>

          <div className="space-y-3.5">
            {(Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).map((key) => {
              const dim = COMPETENCY_DIMENSIONS[key];
              const score = activeScores?.[key] ?? 0;
              const avg = classAverageScores?.[key] ?? 0;
              const isAhead = score >= avg;
              const detail = competencyReport?.dimensions?.find((d) => d.key === key);

              const dimensionMilestones = milestoneStatuses.filter(
                (m) => m.milestone.competencyKey === key
              );
              const highestEarned = dimensionMilestones
                .filter((m) => m.isUnlocked)
                .sort((a, b) => b.threshold - a.threshold)[0];
              const nextMilestone = dimensionMilestones
                .filter((m) => !m.isUnlocked)
                .sort((a, b) => a.threshold - b.threshold)[0];

              let barColor = 'bg-amber-500';
              if (score >= 85) barColor = 'bg-emerald-500';
              else if (score < 70) barColor = 'bg-rose-500';

              return (
                <div
                  key={key}
                  className="space-y-1.5 p-2 rounded-lg border border-stone-100 dark:border-stone-800/80 bg-stone-50/40 dark:bg-stone-850/40"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-stone-900 dark:text-stone-100">{dim.label}</span>
                      {hasClassBenchmarks && (
                        isAhead ? (
                          <span className="rounded bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            +{(score - avg).toFixed(0)}% vs Class
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 dark:bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            -{(avg - score).toFixed(0)}% vs Class
                          </span>
                        )
                      )}

                      {highestEarned && (
                        <button
                          type="button"
                          onClick={() => setSelectedMilestone(highestEarned)}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 hover:scale-102 transition-transform cursor-pointer"
                        >
                          <Award className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          <span>{highestEarned.milestone.shortTitle}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {nextMilestone && (
                        <span
                          onClick={() => setSelectedMilestone(nextMilestone)}
                          className="text-[10px] text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer hidden sm:inline"
                        >
                          Next: {nextMilestone.milestone.shortTitle} ({nextMilestone.pointsNeeded}% to go)
                        </span>
                      )}
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{score}%</span>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-400 gap-2">
                    <span>{dim.description}</span>
                    {detail && (
                      <span className="font-mono text-[10px] shrink-0 text-stone-500">
                        Lab {detail.experimentContribution}% • Viva {detail.vivaContribution}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {competencyReport?.methodology && (
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/50 p-3 text-[11px] text-stone-600 dark:text-stone-400 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Scoring Methodology:</strong> Scores combine{' '}
                {Math.round(competencyReport.methodology.practicalWeight * 100)}% practical experiment performance and{' '}
                {Math.round(competencyReport.methodology.vivaWeight * 100)}% AI Viva evaluation, using your{' '}
                <strong>{competencyReport.methodology.attemptAggregationPolicy}</strong> attempt per experiment to avoid double-counting retries.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Competency Progression Over Time Chart & Targeted Recommendations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          id="competency-trajectory-card"
          className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-7 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Competency Progression Over Time</span>
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Historical overall mastery trajectory recorded after each submission or AI Viva completion.
              </p>
            </div>
            <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
              {trajectoryData.length} checkpoints
            </span>
          </div>

          {trajectoryData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="competencyTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#292524' : '#e7e5e4'}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#57534e' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: isDark ? '#a8a29e' : '#57534e' }}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1c1917' : '#ffffff',
                      borderColor: isDark ? '#44403c' : '#e7e5e4',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [`${value}%`, 'Overall Mastery']}
                  />
                  <Area
                    type="monotone"
                    dataKey="overall"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    fill="url(#competencyTrendFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-800 p-8 text-center text-xs text-stone-500 dark:text-stone-400">
              Your competency progression chart will populate automatically after your first graded lab submission or AI Viva session.
            </div>
          )}
        </div>

        {/* Personalized Next Labs */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Recommended Next Labs</span>
            </h3>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Targeted impact
            </span>
          </div>

          {recommendations.length > 0 ? (
            <div className="space-y-2.5">
              {recommendations.slice(0, 3).map((rec) => (
                <div
                  key={rec.experimentId}
                  className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/60 p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                      {rec.title}
                    </span>
                    <span className="rounded bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 shrink-0">
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-2">
                    {rec.reason}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      {rec.estimatedImpact}
                    </span>
                    {onLaunchExperiment && (
                      <button
                        type="button"
                        onClick={() => onLaunchExperiment(rec.experimentId)}
                        className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        <span>Launch Lab</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Recommendations will appear here based on your competency gaps and active assignments.
            </p>
          )}
        </div>
      </div>

      {/* Persisted AI Viva Assessment History (clickable to inspect full report) */}
      <div
        id="ai-viva-history-section"
        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>AI Viva Assessment Sessions</span>
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Select any recorded viva session to inspect full Q&A transcripts, adaptive difficulty progression, and rubric feedback.
            </p>
          </div>
          <span className="text-xs text-stone-500">{vivaSessions.length} recorded</span>
        </div>

        {vivaSessions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {vivaSessions.map((session) => {
              const exp = EXPERIMENTS.find((e) => e.id === session.experimentId);
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedVivaSession(session)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedVivaSession(session);
                    }
                  }}
                  className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-4 text-xs space-y-2 hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {exp?.title || session.experimentId}
                    </span>
                    <span className="rounded-full bg-amber-100 dark:bg-amber-950/70 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-900 dark:text-amber-300 shrink-0">
                      {Math.round(Number(session.overallScore))}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                    <span>Attempt #{session.attemptNumber}</span>
                    <span>•</span>
                    <span className="capitalize">{session.status.replace(/_/g, ' ')}</span>
                    <span>•</span>
                    <span>
                      {session.answeredCount} / {session.questionsCount} answered
                    </span>
                  </div>
                  {session.summaryFeedback && (
                    <p className="text-[11px] text-stone-700 dark:text-stone-300 leading-relaxed line-clamp-2">
                      {session.summaryFeedback}
                    </p>
                  )}
                  <div className="pt-1 flex items-center justify-end">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <Eye className="h-3 w-3" />
                      Inspect Full Viva Report
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            No AI Viva sessions recorded yet. Complete the Viva task inside any assigned experiment to view your oral defense evaluation here.
          </p>
        )}
      </div>

      {/* Lab History & Teacher Feedback Log (clickable to inspect submission observations & tasks) */}
      <div
        id="evaluated-submissions-section"
        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Evaluated Lab Submissions & Teacher Feedback
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Select any submission to review recorded apparatus observations, calculated results, and task-level grading.
            </p>
          </div>
          <span className="text-xs text-stone-500">{submissions.length} submissions</span>
        </div>

        {submissions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {submissions.map((sub) => {
              const exp = EXPERIMENTS.find((e) => e.id === sub.experimentId);
              const effectiveScore = sub.facultyScore ?? sub.totalScore;
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSubmission(sub);
                    }
                  }}
                  className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-4 text-xs space-y-2 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                      {exp?.title || sub.experimentId}
                    </span>
                    <span className="rounded-full bg-stone-900 dark:bg-amber-500 px-2.5 py-0.5 font-mono text-xs font-bold text-white dark:text-stone-950 shrink-0">
                      {effectiveScore} / {sub.maxScore} pts
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-600 dark:text-stone-400">
                    <span>Attempt #{sub.attemptNumber}</span>
                    <span>•</span>
                    <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{sub.dataReadingsCount} observations</span>
                    <span>•</span>
                    <span className="rounded bg-white dark:bg-stone-800 px-1.5 py-0.5 font-semibold capitalize border border-stone-200 dark:border-stone-700">
                      {(sub.evaluationStatus || 'auto_graded').replace(/_/g, ' ')}
                    </span>
                  </div>

                  {sub.instructorFeedback && (
                    <div className="rounded bg-white dark:bg-stone-800 p-2.5 border border-stone-200 dark:border-stone-700 text-[11px] text-stone-800 dark:text-stone-200">
                      <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">
                        Instructor Remark:
                      </strong>
                      {sub.instructorFeedback}
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-end">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      <Eye className="h-3 w-3" />
                      Inspect Observations & Breakdown
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            No lab submissions yet. Complete an assigned virtual experiment to see your evaluated results and instructor remarks.
          </p>
        )}
      </div>

      {selectedMilestone && (
        <DigitalBadgeModal
          status={selectedMilestone}
          studentName={currentUser.name}
          institution={currentUser.institution}
          enrollmentCode={enrollmentLabel}
          onClose={() => setSelectedMilestone(null)}
        />
      )}

      {selectedVivaSession && (
        <VivaReportModal
          session={selectedVivaSession}
          token={token}
          onClose={() => setSelectedVivaSession(null)}
        />
      )}

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          token={token}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
};
