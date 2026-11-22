import React, { useState } from 'react';
import {
  Award,
  Filter,
  ArrowRight,
  Target,
  Sparkles,
  Eye,
} from 'lucide-react';
import {
  CompetencyKey,
  StudentSubmission,
  CurrentUser,
  StudentMilestoneStatus,
  StudentCompetencyReport,
  VivaSessionRecord,
} from '../../types';
import { EXPERIMENTS } from '../../data/mockData';
import {
  COMPETENCY_MILESTONES,
  getMilestoneStatuses,
} from '../../data/milestonesData';
import { DigitalBadgeCard } from '../badges/DigitalBadgeCard';
import { DigitalBadgeModal } from '../badges/DigitalBadgeModal';
import { SubmissionDetailModal } from './AssessmentDetailModals';

interface StudentProgressViewProps {
  token?: string | null;
  competencyScores: Record<CompetencyKey, number>;
  competencyReport?: StudentCompetencyReport | null;
  submissions: StudentSubmission[];
  vivaSessions?: VivaSessionRecord[];
  currentUser: CurrentUser;
  onPractice?: (experimentId: string) => void;
}

export const StudentProgressView: React.FC<StudentProgressViewProps> = ({
  token = null,
  competencyScores,
  submissions,
  vivaSessions = [],
  currentUser,
  onPractice,
}) => {
  const studentName = currentUser.name;
  const enrollmentCode = currentUser.enrollmentCode || currentUser.id.slice(0, 12);
  const institution = currentUser.institution || 'Not specified';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeModalStatus, setActiveModalStatus] = useState<StudentMilestoneStatus | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);

  const milestoneStatuses = getMilestoneStatuses(
    COMPETENCY_MILESTONES,
    competencyScores,
    studentName,
    enrollmentCode
  );

  const unlockedCount = milestoneStatuses.filter((s) => s.isUnlocked).length;
  const totalCount = milestoneStatuses.length;
  const goldCount = milestoneStatuses.filter((s) => s.isUnlocked && s.milestone.tier === 'gold').length;

  const nearestMilestone = milestoneStatuses
    .filter((s) => !s.isUnlocked)
    .sort((a, b) => a.pointsNeeded - b.pointsNeeded)[0];

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
            Digital badges unlock automatically once your server-verified experiment submissions and AI Viva scores cross syllabus competency thresholds.
          </p>
        </div>

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

      {/* 2. Next Target Milestone Tracker */}
      {nearestMilestone && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-200 dark:bg-amber-900/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Next Milestone Target
                </span>
                <span className="text-xs font-mono font-bold text-stone-500 dark:text-stone-400">
                  Threshold: {nearestMilestone.threshold}%
                </span>
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                <span>{nearestMilestone.milestone.title}</span>
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Current verified score:{' '}
                <strong className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {nearestMilestone.currentScore}%
                </strong>{' '}
                ({nearestMilestone.pointsNeeded}% more required). Complete and submit an assigned laboratory experiment to update your official competency record.
              </p>
            </div>

            {onPractice && (
              <button
                type="button"
                onClick={() =>
                  onPractice(nearestMilestone.milestone.recommendedExperimentId || 'exp-convex-lens')
                }
                className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 dark:bg-amber-500 px-4 py-2.5 text-xs font-bold text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 transition-all cursor-pointer shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400 dark:text-stone-950" />
                <span>Launch Recommended Lab</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-stone-100 dark:border-stone-800 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Verified Practical Assessment Log
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              All experiment submissions directly feed continuous competency milestone evaluations. Click any row to inspect details.
            </p>
          </div>
          <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-700 dark:text-stone-300 shrink-0">
            {submissions.length} submissions • {vivaSessions.length} viva sessions
          </span>
        </div>

        {submissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-medium">
                <tr>
                  <th className="pb-2">Experiment</th>
                  <th className="pb-2">Attempt</th>
                  <th className="pb-2">Official Score</th>
                  <th className="pb-2">Evaluation Status</th>
                  <th className="pb-2">Submitted</th>
                  <th className="pb-2">Feedback</th>
                  <th className="pb-2 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {submissions.map((sub) => {
                  const exp = EXPERIMENTS.find((e) => e.id === sub.experimentId);
                  const effectiveScore = sub.facultyScore ?? sub.totalScore;
                  const pct = Math.round(
                    (Number(effectiveScore) / Number(sub.maxScore || 100)) * 100
                  );
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSubmission(sub)}
                      className="text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-850/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 font-semibold">{exp?.title || sub.experimentId}</td>
                      <td className="py-2.5 font-mono text-[11px]">#{sub.attemptNumber}</td>
                      <td className="py-2.5">
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {pct}%
                        </span>
                      </td>
                      <td className="py-2.5 capitalize text-[11px]">
                        {(sub.evaluationStatus || 'auto_graded').replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 text-stone-500">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-[11px] text-stone-600 dark:text-stone-400 max-w-[200px] truncate">
                        {sub.instructorFeedback || 'Auto-graded / pending comment'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubmission(sub);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-stone-700 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            No lab submission records available yet.
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

      {/* 7. Submission Detail Modal */}
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
