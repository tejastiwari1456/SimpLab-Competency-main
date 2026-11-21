import React from 'react';
import {
  Award,
  Target,
  Ruler,
  Shield,
  Zap,
  Sparkles,
  Compass,
  Cpu,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { MilestoneTier } from '../../types';

interface DigitalBadgeEmblemProps {
  iconName: 'target' | 'ruler' | 'shield' | 'award' | 'zap' | 'sparkles' | 'compass' | 'cpu';
  tier: MilestoneTier;
  threshold: number;
  isUnlocked: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
}

const TIER_STYLES: Record<
  MilestoneTier,
  {
    ringColor: string;
    bgColor: string;
    accentColor: string;
    textColor: string;
    ribbonColor: string;
    tierLabel: string;
  }
> = {
  bronze: {
    ringColor: 'border-amber-700/60 dark:border-amber-600/70',
    bgColor: 'from-amber-100 to-amber-200 dark:from-amber-950/80 dark:to-stone-900',
    accentColor: 'text-amber-800 dark:text-amber-300',
    textColor: 'text-amber-900 dark:text-amber-200',
    ribbonColor: 'bg-amber-800 text-amber-100',
    tierLabel: 'Bronze Tier',
  },
  silver: {
    ringColor: 'border-slate-400 dark:border-slate-500',
    bgColor: 'from-slate-100 to-slate-200 dark:from-slate-900 dark:to-stone-900',
    accentColor: 'text-slate-700 dark:text-slate-200',
    textColor: 'text-slate-800 dark:text-slate-100',
    ribbonColor: 'bg-slate-700 text-slate-100',
    tierLabel: 'Silver Tier',
  },
  gold: {
    ringColor: 'border-amber-500 dark:border-amber-400',
    bgColor: 'from-amber-300/40 via-amber-200/50 to-amber-400/40 dark:from-amber-950/90 dark:via-amber-900/60 dark:to-stone-900',
    accentColor: 'text-amber-600 dark:text-amber-300',
    textColor: 'text-amber-950 dark:text-amber-100',
    ribbonColor: 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 font-extrabold',
    tierLabel: 'Gold Mastery',
  },
  platinum: {
    ringColor: 'border-purple-400 dark:border-purple-400',
    bgColor: 'from-purple-100 via-indigo-100 to-purple-200 dark:from-purple-950/90 dark:via-indigo-950/70 dark:to-stone-900',
    accentColor: 'text-purple-600 dark:text-purple-300',
    textColor: 'text-purple-950 dark:text-purple-100',
    ribbonColor: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
    tierLabel: 'Platinum Elite',
  },
};

export const DigitalBadgeEmblem: React.FC<DigitalBadgeEmblemProps> = ({
  iconName,
  tier,
  threshold,
  isUnlocked,
  size = 'md',
  showLabel = false,
}) => {
  const tierConfig = TIER_STYLES[tier];

  const renderIcon = (iconSizeClass: string) => {
    switch (iconName) {
      case 'target':
        return <Target className={iconSizeClass} />;
      case 'ruler':
        return <Ruler className={iconSizeClass} />;
      case 'shield':
        return <Shield className={iconSizeClass} />;
      case 'zap':
        return <Zap className={iconSizeClass} />;
      case 'sparkles':
        return <Sparkles className={iconSizeClass} />;
      case 'compass':
        return <Compass className={iconSizeClass} />;
      case 'cpu':
        return <Cpu className={iconSizeClass} />;
      case 'award':
      default:
        return <Award className={iconSizeClass} />;
    }
  };

  const sizeClasses = {
    sm: {
      outer: 'h-11 w-11',
      icon: 'h-4 w-4',
      badgeText: 'text-[8px]',
      badgeBox: 'px-1 py-0.2',
    },
    md: {
      outer: 'h-16 w-16',
      icon: 'h-7 w-7',
      badgeText: 'text-[9px]',
      badgeBox: 'px-2 py-0.5',
    },
    lg: {
      outer: 'h-24 w-24',
      icon: 'h-10 w-10',
      badgeText: 'text-[10px]',
      badgeBox: 'px-2.5 py-0.5',
    },
    xl: {
      outer: 'h-32 w-32',
      icon: 'h-14 w-14',
      badgeText: 'text-xs',
      badgeBox: 'px-3 py-1',
    },
  }[size];

  if (!isUnlocked) {
    return (
      <div className="relative inline-flex flex-col items-center justify-center group">
        <div
          className={`${sizeClasses.outer} relative flex items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-100/80 dark:bg-stone-850/80 text-stone-400 dark:text-stone-500 shadow-inner`}
        >
          {renderIcon(sizeClasses.icon)}
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-stone-900/10 dark:bg-stone-950/40 backdrop-blur-[1px]">
            <Lock className="h-4 w-4 text-stone-500 dark:text-stone-400 drop-shadow-xs" />
          </div>
        </div>
        <div className="mt-1">
          <span className="rounded bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-stone-600 dark:text-stone-400">
            {threshold}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      {/* Medal Body */}
      <div
        className={`${sizeClasses.outer} relative flex items-center justify-center rounded-2xl border-2 ${tierConfig.ringColor} bg-gradient-to-b ${tierConfig.bgColor} shadow-sm transition-transform duration-200 hover:scale-105`}
      >
        {/* Subtle geometric sunburst/emboss ring */}
        <div className="absolute inset-1 rounded-xl border border-white/40 dark:border-white/10 pointer-events-none" />

        {/* Icon in center */}
        <div className={tierConfig.accentColor}>{renderIcon(sizeClasses.icon)}</div>

        {/* Checkmark verification pip */}
        <div className="absolute -top-1 -right-1 rounded-full bg-emerald-600 text-white p-0.5 shadow-xs">
          <CheckCircle2 className="h-3 w-3" />
        </div>
      </div>

      {/* Threshold Ribbon */}
      <div className="mt-1">
        <span
          className={`inline-block rounded-full ${tierConfig.ribbonColor} ${sizeClasses.badgeBox} ${sizeClasses.badgeText} uppercase tracking-wider font-bold shadow-xs whitespace-nowrap`}
        >
          {threshold}% Score
        </span>
      </div>

      {showLabel && (
        <span className="mt-1 text-[10px] font-semibold text-stone-600 dark:text-stone-400">
          {tierConfig.tierLabel}
        </span>
      )}
    </div>
  );
};
