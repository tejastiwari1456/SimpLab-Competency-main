import React from 'react';
import { Sparkles, Award, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { CompetencyMilestone } from '../../types';
import { DigitalBadgeEmblem } from './DigitalBadgeEmblem';

interface MilestoneCelebrationModalProps {
  milestone: CompetencyMilestone;
  newScore: number;
  onClose: () => void;
  onViewBadge: (milestone: CompetencyMilestone) => void;
}

export const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
  milestone,
  newScore,
  onClose,
  onViewBadge,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-400 dark:border-amber-500/70 bg-white dark:bg-stone-900 shadow-2xl text-center p-6 sm:p-8 space-y-5">
        {/* Background glow burst */}
        <div className="absolute -top-16 -left-16 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 h-36 w-36 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Celebration Header Pip */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 px-3 py-1 text-xs font-bold text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>Competency Milestone Achieved!</span>
        </div>

        {/* Big Badge Emblem */}
        <div className="my-3 flex justify-center scale-110">
          <DigitalBadgeEmblem
            iconName={milestone.iconName}
            tier={milestone.tier}
            threshold={milestone.threshold}
            isUnlocked={true}
            size="lg"
            showLabel={true}
          />
        </div>

        {/* Title and Threshold Details */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-stone-900 dark:text-stone-100">
            {milestone.title}
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto leading-relaxed">
            Congratulations! You have reached <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">{newScore}%</strong> in{' '}
            <strong className="text-stone-900 dark:text-stone-100">{milestone.categoryLabel}</strong>, surpassing the {milestone.threshold}% benchmark.
          </p>
        </div>

        {/* Accredited Verification Stamp */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850/80 p-3 text-left flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-stone-900 dark:text-stone-100 block text-[11px]">
                Accreditation Code: {milestone.accreditationCode}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400">
                Verified digital badge added to your laboratory transcript
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewBadge(milestone);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-stone-950 hover:bg-amber-400 transition-colors shadow-xs cursor-pointer"
          >
            <span>Inspect Digital Credential</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
