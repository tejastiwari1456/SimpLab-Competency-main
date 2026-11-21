import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  LogOut,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { PairLabState, PairLabUser } from '../../types/pairLab';

interface PairLabBarProps {
  roomId: string;
  roomState: PairLabState | null;
  myUser: PairLabUser | null;
  partnerUser: PairLabUser | null;
  isConnected: boolean;
  onOpenChat: () => void;
  onLeavePairLab: () => void;
  onResetSession: () => void;
  isDark?: boolean;
}

export const PairLabBar: React.FC<PairLabBarProps> = ({
  roomId,
  roomState,
  myUser,
  partnerUser,
  isConnected,
  onOpenChat,
  onLeavePairLab,
  onResetSession,
  isDark = false,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?pairLab=${encodeURIComponent(
      roomId
    )}&role=${myUser?.role === 'partner_a' ? 'partner_b' : 'partner_a'}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenSecondTab = () => {
    const nextRole = myUser?.role === 'partner_a' ? 'partner_b' : 'partner_a';
    const partnerName = nextRole === 'partner_b' ? 'Partner_B_Student' : 'Partner_A_Student';
    const inviteUrl = `${window.location.origin}${window.location.pathname}?pairLab=${encodeURIComponent(
      roomId
    )}&role=${nextRole}&name=${partnerName}`;
    window.open(inviteUrl, '_blank');
  };

  const coordination = roomState?.coordination;
  const activeStage = roomState?.activeStage || 1;

  // Determine active coordination banner
  let coordBanner: { text: string; status: 'pending' | 'success' | 'ready'; actionRequired?: string } | null = null;
  if (activeStage === 2) {
    if (!coordination?.masterMixSubmittedByA) {
      coordBanner = {
        text: 'Partner A is dispensing reagents for 25 µL master mix.',
        status: 'pending',
        actionRequired: myUser?.role === 'partner_a' ? 'Dispense reagents and click Submit for Review' : 'Monitoring partner volumes',
      };
    } else if (!coordination?.masterMixVerifiedByB) {
      coordBanner = {
        text: 'Master Mix submitted! Partner B must verify reaction chemistry & co-sign.',
        status: 'ready',
        actionRequired: myUser?.role === 'partner_b' ? 'Click Verify & Co-Sign Mix' : 'Waiting for Partner B co-signature',
      };
    } else {
      coordBanner = {
        text: 'Reaction chemistry co-signed by both partners! Ready for mixing & centrifugation.',
        status: 'success',
      };
    }
  } else if (activeStage === 4) {
    if (!coordination?.thermocyclerArmedByB) {
      coordBanner = {
        text: 'Partner B is configuring thermal cycler annealing temperature & cycle count.',
        status: 'pending',
        actionRequired: myUser?.role === 'partner_b' ? 'Select 55°C annealing temp and click Arm' : 'Reviewing protocol stringency',
      };
    } else if (!coordination?.thermocyclerAuthorizedByA) {
      coordBanner = {
        text: `Thermocycler armed at ${roomState?.thermocycler.annealingTemp}°C! Partner A must authorize launch.`,
        status: 'ready',
        actionRequired: myUser?.role === 'partner_a' ? 'Authorize Thermocycler Run' : 'Waiting for Partner A authorization',
      };
    } else {
      coordBanner = {
        text: 'Dual authorization complete! Thermocycler 30-cycle amplification in progress.',
        status: 'success',
      };
    }
  } else if (activeStage === 6) {
    const aChecked = coordination?.polarityCheckedByA;
    const bChecked = coordination?.polarityCheckedByB;
    if (!aChecked || !bChecked) {
      coordBanner = {
        text: `Run-to-Red Polarity Safety Check: ${aChecked ? '1' : '0'}/2 confirmed (A: ${aChecked ? '✓' : 'Pending'}, B: ${bChecked ? '✓' : 'Pending'}).`,
        status: 'ready',
        actionRequired: 'Inspect cathode (-) and anode (+) electrodes before energizing',
      };
    } else {
      coordBanner = {
        text: 'Electrodes verified! 100V DC submarine electrophoresis active.',
        status: 'success',
      };
    }
  } else if (activeStage === 7) {
    const aSigned = coordination?.diagnosisSignedByA;
    const bSigned = coordination?.diagnosisSignedByB;
    if (!aSigned || !bSigned) {
      coordBanner = {
        text: `Joint Clinical Diagnostic Sign-Off: ${aSigned && bSigned ? '2/2 Complete' : `${aSigned ? '1' : bSigned ? '1' : '0'}/2 Signed`}.`,
        status: 'ready',
        actionRequired: 'Both partners must agree on amplicon size & diagnostic call',
      };
    } else {
      coordBanner = {
        text: 'Clinical diagnostic report jointly endorsed by both investigators!',
        status: 'success',
      };
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50/90 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-stone-900/50 p-3 shadow-xs mb-4">
      {/* Top row: Status, Room Code, Partner Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Station identity */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase text-blue-900 dark:text-blue-200">
                Pair Lab Station
              </span>
              <span className="rounded bg-blue-100 dark:bg-blue-900/80 px-2 py-0.5 font-mono text-xs font-black text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                {roomId}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isConnected ? 'Real-Time Synchronized' : 'Reconnecting...'}
              </span>
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 flex items-center gap-1.5 mt-0.5">
              <span>Dual-Student Molecular Biology Terminal</span>
            </div>
          </div>
        </div>

        {/* Center: Partner Badges */}
        <div className="flex items-center gap-2">
          {/* My Badge */}
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/90 dark:bg-stone-900/80 px-2.5 py-1 text-xs shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <div className="text-left">
              <div className="font-bold text-stone-900 dark:text-stone-100 text-[11px] leading-tight">
                {myUser?.name || 'You'} (You)
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                {myUser?.role === 'partner_a' ? 'Partner A (Pipetting Lead)' : 'Partner B (Thermocycler Lead)'}
              </div>
            </div>
          </div>

          <span className="text-xs text-stone-400 dark:text-stone-500 font-bold">&</span>

          {/* Partner Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs shadow-xs ${
              partnerUser
                ? 'border-indigo-200 dark:border-indigo-800 bg-white/90 dark:bg-stone-900/80'
                : 'border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${partnerUser ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <div className="text-left">
              <div className="font-bold text-stone-900 dark:text-stone-100 text-[11px] leading-tight">
                {partnerUser ? partnerUser.name : 'Waiting for Partner...'}
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                {partnerUser
                  ? partnerUser.role === 'partner_a'
                    ? 'Partner A (Pipetting Lead)'
                    : 'Partner B (Thermocycler Lead)'
                  : 'Invite link below'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2">
          {/* Copy Invite Link */}
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition shadow-xs"
            title="Copy invite link to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Copy Partner Invite'}</span>
          </button>

          {/* Open Second Tab to test */}
          <button
            onClick={handleOpenSecondTab}
            className="flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition shadow-xs"
            title="Open second partner tab in new window to test real-time coordination"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Partner Tab</span>
          </button>

          {/* Chat Drawer Toggle */}
          <button
            onClick={onOpenChat}
            className="relative flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Partner Comms</span>
            {roomState && roomState.chatMessages.length > 1 && (
              <span className="ml-1 rounded-full bg-blue-400/50 px-1.5 py-0.2 text-[10px] font-bold">
                {roomState.chatMessages.length}
              </span>
            )}
          </button>

          {/* Leave Pair Lab */}
          <button
            onClick={onLeavePairLab}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition"
            title="Exit Pair Lab Mode"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Coordination Banner Row */}
      {coordBanner && (
        <div
          className={`mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs border ${
            coordBanner.status === 'ready'
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
              : coordBanner.status === 'success'
              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {coordBanner.status === 'ready' ? (
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 animate-bounce" />
            ) : coordBanner.status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-semibold">{coordBanner.text}</span>
          </div>

          {coordBanner.actionRequired && (
            <span className="rounded-md bg-white/80 dark:bg-stone-800/80 px-2 py-0.5 text-[11px] font-bold border border-current">
              Target: {coordBanner.actionRequired}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
