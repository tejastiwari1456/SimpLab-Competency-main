import React, { useState } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Lock,
  ArrowRight,
  Sparkles,
  Calendar,
  Building,
  User,
  FlaskConical,
} from 'lucide-react';
import { StudentMilestoneStatus } from '../../types';
import { DigitalBadgeEmblem } from './DigitalBadgeEmblem';

interface DigitalBadgeModalProps {
  status: StudentMilestoneStatus;
  studentName?: string;
  institution?: string;
  enrollmentCode?: string;
  onClose: () => void;
  onPractice?: (experimentId: string) => void;
}

export const DigitalBadgeModal: React.FC<DigitalBadgeModalProps> = ({
  status,
  studentName = 'Aarav Sharma',
  institution = 'Delhi University • Faculty of Science',
  enrollmentCode = 'STU-2026-081',
  onClose,
  onPractice,
}) => {
  const [copied, setCopied] = useState(false);
  const { milestone, isUnlocked, currentScore, threshold, progressPercentage, pointsNeeded, credentialCode } =
    status;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(credentialCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xl transition-all">
        {/* Decorative Top Accent */}
        <div
          className={`h-2 w-full ${
            milestone.tier === 'gold'
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600'
              : milestone.tier === 'platinum'
              ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600'
              : milestone.tier === 'silver'
              ? 'bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600'
              : 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700'
          }`}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                isUnlocked
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              {isUnlocked ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  Verified Digital Credential
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  Locked Milestone
                </>
              )}
            </span>
            <span className="text-xs font-mono text-stone-400 capitalize">{milestone.tier} Tier</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Credential Certificate Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Badge Showcase Hero */}
          <div className="flex flex-col sm:flex-row items-center gap-5 rounded-xl border border-stone-100 dark:border-stone-800/80 bg-stone-50/70 dark:bg-stone-850/60 p-5 text-center sm:text-left">
            <div className="shrink-0">
              <DigitalBadgeEmblem
                iconName={milestone.iconName}
                tier={milestone.tier}
                threshold={threshold}
                isUnlocked={isUnlocked}
                size="lg"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {milestone.categoryLabel}
              </span>
              <h3 className="text-xl font-extrabold text-stone-900 dark:text-stone-100">
                {milestone.title}
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {milestone.description}
              </p>
            </div>
          </div>

          {/* Progress / Status Block */}
          {!isUnlocked ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  Current Score: <strong className="font-mono">{currentScore}%</strong>
                </span>
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  Threshold Required: <strong className="font-mono">{threshold}%</strong>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-amber-200/60 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <span>{pointsNeeded}% more points required to unlock this badge.</span>
                {milestone.recommendedExperimentId && onPractice && (
                  <button
                    type="button"
                    onClick={() => {
                      onPractice(milestone.recommendedExperimentId!);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    <span>Practice in Lab</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Empirical Standard Satisfied</span>
              </div>
              <p className="text-xs text-emerald-900 dark:text-emerald-200">
                Demonstrated practical score: <strong className="font-mono">{currentScore}%</strong>{' '}
                (exceeds standard threshold of {threshold}%).
              </p>
            </div>
          )}

          {/* Recipient & Accreditation Details */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 space-y-3 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 text-[10px]">
              Credential Recipient & Institutional Verification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-stone-400 text-[11px] flex items-center gap-1">
                  <User className="h-3 w-3" /> Candidate
                </span>
                <p className="font-bold text-stone-900 dark:text-stone-100">{studentName}</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-stone-400 text-[11px] flex items-center gap-1">
                  <Building className="h-3 w-3" /> Institution
                </span>
                <p className="font-medium text-stone-800 dark:text-stone-200">{institution}</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-stone-400 text-[11px]">Enrollment ID</span>
                <p className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                  {enrollmentCode}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-stone-400 text-[11px] flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Validated On
                </span>
                <p className="font-medium text-stone-800 dark:text-stone-200">
                  {status.unlockedAt ? new Date(status.unlockedAt).toLocaleDateString() : 'In Progress'}
                </p>
              </div>
            </div>
          </div>

          {/* Skill Criteria Rubric */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 space-y-2 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 text-[10px]">
              Demonstrated Competency Criteria
            </h4>
            <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
              {milestone.skillCriteria}
            </p>
          </div>

          {/* Credential Verification Hash */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-stone-400">
                Accredited Credential ID
              </span>
              <p className="font-mono font-bold text-stone-900 dark:text-stone-100 truncate text-[11px]">
                {credentialCode}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800 p-4 bg-stone-50/50 dark:bg-stone-900">
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            Syllabus Practical Accreditation Framework
          </span>
          <div className="flex items-center gap-2">
            {!isUnlocked && milestone.recommendedExperimentId && onPractice && (
              <button
                type="button"
                onClick={() => {
                  onPractice(milestone.recommendedExperimentId!);
                  onClose();
                }}
                className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span>Launch Practice Lab</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 dark:border-stone-700 px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
