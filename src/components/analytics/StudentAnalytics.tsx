import React, { useState } from 'react';
import {
  Award,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { CompetencyKey, COMPETENCY_DIMENSIONS, StudentSubmission, StudentMilestoneStatus } from '../../types';
import { CompetencyRadar } from './CompetencyRadar';
import { COMPETENCY_MILESTONES, getMilestoneStatuses } from '../../data/milestonesData';
import { DigitalBadgeEmblem } from '../badges/DigitalBadgeEmblem';
import { DigitalBadgeModal } from '../badges/DigitalBadgeModal';

interface StudentAnalyticsProps {
  submissions: StudentSubmission[];
  activeScores: Record<CompetencyKey, number>;
  classAverageScores: Record<CompetencyKey, number>;
  isDark?: boolean;
}

export const StudentAnalytics: React.FC<StudentAnalyticsProps> = ({
  submissions,
  activeScores,
  classAverageScores,
  isDark = false,
}) => {
  const [selectedMilestone, setSelectedMilestone] = useState<StudentMilestoneStatus | null>(null);

  const milestoneStatuses = getMilestoneStatuses(
    COMPETENCY_MILESTONES,
    activeScores,
    'Aarav Sharma',
    'STU-2026-081'
  );

  // Aggregate overall weighted mastery
  const overallMastery = Math.round(
    (Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).reduce(
      (sum, key) => sum + (activeScores[key] || 0) * COMPETENCY_DIMENSIONS[key].weight,
      0
    )
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:flex-row md:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Verified Practical Competence
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">Aarav Sharma • ID: STU-2026-081</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            Student Practical Competency Profile
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Continuous evidence-based assessment replacing paper lab record books with verified empirical problem-solving.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-4 py-2 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Practical Mastery</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{overallMastery}%</span>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-4 py-2 text-center transition-colors">
            <span className="block text-[11px] text-stone-600 dark:text-stone-400">Labs Completed</span>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">{submissions.length}</span>
          </div>
        </div>
      </div>

      {/* Radar & Dimension Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Radar Chart (5 cols) */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-5 transition-colors">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">
            Competency Dimension Map
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-400 mb-4">
            Comparison between your demonstrated practical reasoning and the departmental class average.
          </p>
          <CompetencyRadar
            scores={activeScores}
            benchmarkScores={classAverageScores}
            studentName="Your Demonstrated Score"
            height={300}
            isDark={isDark}
          />
        </div>

        {/* Right: Dimension Breakdown Bars (7 cols) */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-7 space-y-4 transition-colors">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Syllabus Practical Competency Breakdown
          </h3>

          <div className="space-y-3.5">
            {(Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).map((key) => {
              const dim = COMPETENCY_DIMENSIONS[key];
              const score = activeScores?.[key] ?? 0;
              const avg = classAverageScores?.[key] ?? 70;
              const isAhead = score >= avg;

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
                <div key={key} className="space-y-1.5 p-2 rounded-lg border border-stone-100 dark:border-stone-800/80 bg-stone-50/40 dark:bg-stone-850/40">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-stone-900 dark:text-stone-100">{dim.label}</span>
                      {isAhead ? (
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          +{(score - avg).toFixed(0)}% vs Class
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 dark:bg-amber-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          -{(avg - score).toFixed(0)}% vs Class
                        </span>
                      )}

                      {/* Earned Milestone Badge Chip */}
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

                  {/* Progress track */}
                  <div className="h-2 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400">{dim.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lab History & Viva Feedback Log */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
          Evaluated Lab Submissions & Teacher Feedback
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-4 text-xs space-y-2 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                  {sub.experimentId === 'exp-ohms-law'
                    ? "Ohm's Law Verification"
                    : sub.experimentId === 'exp-titration'
                    ? 'Potentiometric Titration'
                    : 'Photoelectric Quantum Lab'}
                </span>
                <span className="rounded-full bg-stone-900 dark:bg-amber-500 px-2.5 py-0.5 font-mono text-xs font-bold text-white dark:text-stone-950">
                  {sub.totalScore} / {sub.maxScore} pts
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-stone-600 dark:text-stone-400">
                <span>Attempt #{sub.attemptNumber}</span>
                <span>•</span>
                <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>{sub.dataReadingsCount} observations recorded</span>
              </div>

              {sub.instructorFeedback && (
                <div className="rounded bg-white dark:bg-stone-800 p-2.5 border border-stone-200 dark:border-stone-700 text-[11px] text-stone-800 dark:text-stone-200">
                  <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">Instructor Remark:</strong>
                  {sub.instructorFeedback}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedMilestone && (
        <DigitalBadgeModal
          status={selectedMilestone}
          studentName="Aarav Sharma"
          institution="Delhi University • Faculty of Science"
          enrollmentCode="STU-2026-081"
          onClose={() => setSelectedMilestone(null)}
        />
      )}
    </div>
  );
};
