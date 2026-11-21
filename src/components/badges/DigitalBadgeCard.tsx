import React from 'react';
import { Award, CheckCircle2, ChevronRight, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { StudentMilestoneStatus } from '../../types';
import { DigitalBadgeEmblem } from './DigitalBadgeEmblem';

interface DigitalBadgeCardProps {
  status: StudentMilestoneStatus;
  onSelect: (status: StudentMilestoneStatus) => void;
  onPractice?: (experimentId: string) => void;
}

export const DigitalBadgeCard: React.FC<DigitalBadgeCardProps> = ({
  status,
  onSelect,
  onPractice,
}) => {
  const { milestone, isUnlocked, currentScore, threshold, progressPercentage, pointsNeeded } = status;

  return (
    <div
      onClick={() => onSelect(status)}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
        isUnlocked
          ? 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs hover:border-amber-400 dark:hover:border-amber-500/70 hover:shadow-md'
          : 'border-stone-200/80 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/40 opacity-80 hover:opacity-100 hover:border-stone-300 dark:hover:border-stone-700'
      }`}
    >
      <div>
        {/* Top Header: Category & Tier */}
        <div className="flex items-center justify-between gap-1 mb-3">
          <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            {milestone.categoryLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold capitalize ${
              milestone.tier === 'gold'
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800'
                : milestone.tier === 'platinum'
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300/60 dark:border-purple-800'
                : milestone.tier === 'silver'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
            }`}
          >
            {milestone.tier} Tier
          </span>
        </div>

        {/* Center Emblem & Title */}
        <div className="flex items-center gap-3.5 my-2">
          <div className="shrink-0">
            <DigitalBadgeEmblem
              iconName={milestone.iconName}
              tier={milestone.tier}
              threshold={threshold}
              isUnlocked={isUnlocked}
              size="md"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {milestone.title}
            </h4>
            <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
              {milestone.description}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Progress / Unlock Details */}
      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 space-y-2">
        {isUnlocked ? (
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Awarded ({currentScore}%)
            </span>
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 flex items-center gap-0.5">
              Inspect <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-500 dark:text-stone-400">
                Score: <strong className="font-mono text-stone-800 dark:text-stone-200">{currentScore}%</strong> / {threshold}%
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {pointsNeeded}% to unlock
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500/80 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
