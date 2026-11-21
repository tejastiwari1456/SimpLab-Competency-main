import React, { useState } from 'react';
import { User, Mail, Building, Key, ShieldCheck, Calendar, Lock, Award, CheckCircle2 } from 'lucide-react';
import { CurrentUser, CompetencyKey, StudentMilestoneStatus } from '../../types';
import { RoleBadge } from '../common/RoleBadge';
import { COMPETENCY_MILESTONES, getMilestoneStatuses } from '../../data/milestonesData';
import { DigitalBadgeEmblem } from '../badges/DigitalBadgeEmblem';
import { DigitalBadgeModal } from '../badges/DigitalBadgeModal';

interface StudentProfileViewProps {
  currentUser: CurrentUser;
  competencyScores?: Record<CompetencyKey, number>;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  currentUser,
  competencyScores = {
    setup_adherence: 95,
    measurement_precision: 88,
    data_interpretation: 94,
    troubleshooting_safety: 90,
    experimental_design: 92,
  },
}) => {
  const [selectedMilestone, setSelectedMilestone] = useState<StudentMilestoneStatus | null>(null);

  const milestoneStatuses = getMilestoneStatuses(
    COMPETENCY_MILESTONES,
    competencyScores,
    currentUser.name,
    currentUser.enrollmentCode
  );

  const unlockedBadges = milestoneStatuses.filter((s) => s.isUnlocked);

  return (
    <div id="student-profile-view" className="space-y-6 max-w-3xl mx-auto">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 dark:bg-amber-500 text-2xl font-bold text-amber-400 dark:text-stone-950 shadow-sm">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                {currentUser.name}
              </h2>
              <RoleBadge role="student" />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">{currentUser.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-4 border-t border-stone-100 dark:border-stone-800 text-xs">
          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Institution / University
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              {currentUser.institution || 'Delhi University • Faculty of Science'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" /> Enrollment ID / Student Code
            </span>
            <p className="font-mono font-semibold text-amber-700 dark:text-amber-400">
              {currentUser.enrollmentCode || 'STU-2026-081'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Security Status
            </span>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              Active • Verified Session
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Authorization Scope
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              Student Lab Space & Competency Radar
            </p>
          </div>
        </div>
      </div>

      {/* Accredited Digital Badges Showcase */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Earned Competency Milestones & Badges
            </h3>
          </div>
          <span className="rounded-full bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {unlockedBadges.length} Verified Badges
          </span>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-300">
          Digital badges awarded upon crossing verified syllabus competency thresholds across laboratory apparatuses.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {unlockedBadges.slice(0, 8).map((status) => (
            <div
              key={status.milestone.id}
              onClick={() => setSelectedMilestone(status)}
              className="flex flex-col items-center text-center p-3 rounded-xl border border-stone-200/80 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500 bg-stone-50/50 dark:bg-stone-850/50 cursor-pointer transition-all hover:scale-102"
            >
              <DigitalBadgeEmblem
                iconName={status.milestone.iconName}
                tier={status.milestone.tier}
                threshold={status.milestone.threshold}
                isUnlocked={true}
                size="sm"
              />
              <span className="mt-2 text-xs font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                {status.milestone.shortTitle}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 capitalize">
                {status.milestone.categoryLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedMilestone && (
        <DigitalBadgeModal
          status={selectedMilestone}
          studentName={currentUser.name}
          institution={currentUser.institution}
          enrollmentCode={currentUser.enrollmentCode}
          onClose={() => setSelectedMilestone(null)}
        />
      )}
    </div>
  );
};
