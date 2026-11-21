import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  ShieldCheck,
  Clock,
  BookOpen,
  Sparkles,
  Filter,
  ArrowRight,
  Sliders,
  Target,
  FlaskConical,
  Zap,
} from 'lucide-react';
import {
  CompetencyKey,
  COMPETENCY_DIMENSIONS,
  StudentSubmission,
  CurrentUser,
  StudentMilestoneStatus,
  CompetencyMilestone,
} from '../../types';
import {
  COMPETENCY_MILESTONES,
  getMilestoneStatuses,
  calculateOverallMastery,
  detectNewlyUnlockedMilestones,
} from '../../data/milestonesData';
import { DigitalBadgeCard } from '../badges/DigitalBadgeCard';
import { DigitalBadgeModal } from '../badges/DigitalBadgeModal';
import { MilestoneCelebrationModal } from '../badges/MilestoneCelebrationModal';

interface StudentProgressViewProps {
  competencyScores: Record<CompetencyKey, number>;
  submissions: StudentSubmission[];
  currentUser?: CurrentUser;
  onPractice?: (experimentId: string) => void;
  onTaskCompleted?: (taskId: string, score: number, competency: CompetencyKey) => void;
}

export const StudentProgressView: React.FC<StudentProgressViewProps> = ({
  competencyScores,
  submissions,
  currentUser,
  onPractice,
  onTaskCompleted,
}) => {
  const studentName = currentUser?.name || 'Aarav Sharma';
  const enrollmentCode = currentUser?.enrollmentCode || 'STU-2026-081';
  const institution = currentUser?.institution || 'Delhi University • Faculty of Science';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeModalStatus, setActiveModalStatus] = useState<StudentMilestoneStatus | null>(null);
  const [celebratedMilestone, setCelebratedMilestone] = useState<{
    milestone: CompetencyMilestone;
    score: number;
  } | null>(null);

  // Quick Calibration simulation state for reaching 90 in measurement precision
  const [calibrationInput, setCalibrationInput] = useState<string>('15.40');
  const [calibrationFeedback, setCalibrationFeedback] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  // Compute live milestone statuses
  const milestoneStatuses = getMilestoneStatuses(
    COMPETENCY_MILESTONES,
    competencyScores,
    studentName,
    enrollmentCode
  );

  const unlockedCount = milestoneStatuses.filter((s) => s.isUnlocked).length;
  const totalCount = milestoneStatuses.length;
  const goldCount = milestoneStatuses.filter((s) => s.isUnlocked && s.milestone.tier === 'gold').length;
  const overallMastery = calculateOverallMastery(competencyScores);

  // Find the nearest locked milestone
  const lockedMilestones = milestoneStatuses
    .filter((s) => !s.isUnlocked)
    .sort((a, b) => a.pointsNeeded - b.pointsNeeded);
  const nearestMilestone = lockedMilestones[0];

  // Filtered milestones
  const filteredMilestones = milestoneStatuses.filter((s) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'unlocked') return s.isUnlocked;
    if (selectedCategory === 'locked') return !s.isUnlocked;
    if (selectedCategory === 'gold') return s.milestone.tier === 'gold';
    if (selectedCategory === 'precision') return s.milestone.competencyKey === 'measurement_precision';
    if (selectedCategory === 'setup') return s.milestone.competencyKey === 'setup_adherence';
    if (selectedCategory === 'data') return s.milestone.competencyKey === 'data_interpretation';
    if (selectedCategory === 'safety') return s.milestone.competencyKey === 'troubleshooting_safety';
    if (selectedCategory === 'design') return s.milestone.competencyKey === 'experimental_design';
    return true;
  });

  // Handle direct calibration task (e.g. hitting 90 in measurement precision)
  const handlePerformCalibrationTrial = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      setIsCalibrating(false);
      const prevScores = { ...competencyScores };
      const currentPrecision = competencyScores.measurement_precision || 88;
      const targetScore = Math.min(99, Math.max(90, currentPrecision + 2));

      // Trigger task completion callback
      if (onTaskCompleted) {
        onTaskCompleted('calib-precision-trial', 10, 'measurement_precision');
      }

      setCalibrationFeedback(
        `Zero-error offset eliminated! Measurement Precision boosted to ${targetScore}%.`
      );

      // Check if this unlocked the milestone (specifically milestone-prec-90)
      const nextScores = {
        ...prevScores,
        measurement_precision: targetScore,
      };
      const newlyUnlocked = detectNewlyUnlockedMilestones(prevScores, nextScores);
      if (newlyUnlocked.length > 0) {
        setCelebratedMilestone({
          milestone: newlyUnlocked[0],
          score: targetScore,
        });
      }
    }, 600);
  };

  return (
    <div id="student-progress-view" className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              Accredited Micro-Credentials
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Syllabus Practical Competency Milestones
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Competency Milestones & Digital Badges
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
            Digital badges are automatically awarded when your verified practical scores cross strict competency thresholds. Earn accredited micro-credentials for measurement precision, apparatus setup, and viva defense.
          </p>
        </div>

        {/* Milestone Achievement Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 px-4 py-3 text-center min-w-[110px]">
            <span className="block text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400">
              Badges Earned
            </span>
            <div className="mt-0.5 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {unlockedCount}
              </span>
              <span className="text-xs text-stone-400 font-medium">/ {totalCount}</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 px-4 py-3 text-center min-w-[110px]">
            <span className="block text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
              Gold Masteries
            </span>
            <span className="mt-0.5 block text-2xl font-black text-amber-700 dark:text-amber-400">
              {goldCount}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Focus Card: Measurement Precision Threshold Tracker (e.g. Reaching 90) */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-200 dark:bg-amber-900/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Target Milestone in Reach
              </span>
              <span className="text-xs font-mono font-bold text-stone-500 dark:text-stone-400">
                Threshold: 90% in Measurement Precision
              </span>
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              <span>Precision Metrology Master (Gold Tier)</span>
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Your current Measurement Precision is{' '}
              <strong className="font-mono font-bold text-stone-900 dark:text-stone-100">
                {competencyScores.measurement_precision || 88}%
              </strong>
              . Complete a zero-error calibration trial or optical bench run to hit the 90% threshold and unlock the Gold digital badge.
            </p>

            {calibrationFeedback && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{calibrationFeedback}</span>
              </div>
            )}
          </div>

          {/* Quick Simulation / Calibration Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 flex items-center gap-2.5">
              <Sliders className="h-4 w-4 text-amber-500" />
              <div className="text-left">
                <span className="block text-[10px] text-stone-400 uppercase font-bold">
                  Zero Offset Check
                </span>
                <span className="font-mono font-bold text-xs text-stone-800 dark:text-stone-200">
                  Δx = ±0.02 mm
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isCalibrating}
              onClick={handlePerformCalibrationTrial}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 dark:bg-amber-500 px-4 py-2.5 text-xs font-bold text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400 dark:text-stone-950" />
              <span>
                {competencyScores.measurement_precision >= 90
                  ? 'Re-Calibrate Precision (90%+ Earned)'
                  : 'Calibrate Bench & Reach 90%'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Category & Tier Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1 text-xs font-bold text-stone-400 pr-2 border-r border-stone-200 dark:border-stone-800 shrink-0">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>
        {[
          { id: 'all', label: `All Milestones (${totalCount})` },
          { id: 'unlocked', label: `Earned Badges (${unlockedCount})` },
          { id: 'locked', label: `In Progress (${totalCount - unlockedCount})` },
          { id: 'gold', label: 'Gold Mastery (90%)' },
          { id: 'precision', label: 'Measurement Precision' },
          { id: 'setup', label: 'Apparatus Setup' },
          { id: 'data', label: 'Data Interpretation' },
          { id: 'safety', label: 'Faults & Safety' },
          { id: 'design', label: 'Experimental Design' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategory(tab.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === tab.id
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-850'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Digital Badges Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMilestones.map((status) => (
          <DigitalBadgeCard
            key={status.milestone.id}
            status={status}
            onSelect={(selected) => setActiveModalStatus(selected)}
            onPractice={onPractice}
          />
        ))}
      </div>

      {/* 5. Verified Practical Assessment Log */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 dark:border-stone-800 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Verified Practical Assessment Log
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              All experiment scores directly feed continuous competency milestone evaluations.
            </p>
          </div>
          <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
            {submissions.length} verified submissions
          </span>
        </div>

        {submissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-medium">
                <tr>
                  <th className="pb-2">Session ID</th>
                  <th className="pb-2">Experiment</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Readings Taken</th>
                  <th className="pb-2">Submitted</th>
                  <th className="pb-2 text-right">Accredited Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="text-stone-800 dark:text-stone-200">
                    <td className="py-2.5 font-mono text-[11px] text-stone-500">
                      {sub.id.slice(0, 12)}
                    </td>
                    <td className="py-2.5 font-semibold">{sub.experimentId}</td>
                    <td className="py-2.5">
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {sub.totalScore}%
                      </span>
                    </td>
                    <td className="py-2.5">{sub.dataReadingsCount} data points</td>
                    <td className="py-2.5 text-stone-500">
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      VERIFIED • SYLLABUS UNIT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            No lab submission records available.
          </p>
        )}
      </div>

      {/* 6. Active Digital Badge Detail Modal */}
      {activeModalStatus && (
        <DigitalBadgeModal
          status={activeModalStatus}
          studentName={studentName}
          institution={institution}
          enrollmentCode={enrollmentCode}
          onClose={() => setActiveModalStatus(null)}
          onPractice={onPractice}
        />
      )}

      {/* 7. Milestone Celebration Modal (When crossing thresholds like 90 in measurement precision) */}
      {celebratedMilestone && (
        <MilestoneCelebrationModal
          milestone={celebratedMilestone.milestone}
          newScore={celebratedMilestone.score}
          onClose={() => setCelebratedMilestone(null)}
          onViewBadge={(m) => {
            const matched = milestoneStatuses.find((s) => s.milestone.id === m.id);
            if (matched) {
              setActiveModalStatus({ ...matched, isUnlocked: true });
            }
          }}
        />
      )}
    </div>
  );
};
