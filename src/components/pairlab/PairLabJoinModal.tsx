import React, { useState } from 'react';
import {
  Users,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FlaskConical,
  Flame,
  CheckCircle2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { PairLabRole } from '../../types/pairLab';

interface PairLabJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomId: string, name: string, role: PairLabRole) => void;
  isDark?: boolean;
}

export const PairLabJoinModal: React.FC<PairLabJoinModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
  isDark = false,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [customRoomId, setCustomRoomId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('Student');
  const [selectedRole, setSelectedRole] = useState<PairLabRole>('partner_a');

  if (!isOpen) return null;

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoomId =
      mode === 'create'
        ? `PCR-${Math.floor(100 + Math.random() * 900)}`
        : customRoomId.trim().toUpperCase() || 'PCR-101';

    const finalName = studentName.trim() || (selectedRole === 'partner_a' ? 'Partner A' : 'Partner B');
    onJoinRoom(finalRoomId, finalName, selectedRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Pair Lab: Real-Time Collaborative Mode
              </h2>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-black uppercase text-blue-800 dark:text-blue-300">
                Dual-Student
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Connect two students to the same molecular biology simulation instance with real-time shared state & dual-gate coordination.
            </p>
          </div>
        </div>

        {/* Tab Selector: Create Station vs Join Existing */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              mode === 'create'
                ? 'bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Create New Station
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              mode === 'join'
                ? 'bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Join Existing Station
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleStart} className="mt-5 space-y-4">
          {/* Join Code Input if in join mode */}
          {mode === 'join' && (
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Enter Station Code (e.g. PCR-482)
              </label>
              <input
                type="text"
                value={customRoomId}
                onChange={(e) => setCustomRoomId(e.target.value)}
                placeholder="PCR-482"
                required
                className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3.5 py-2.5 font-mono text-sm uppercase text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Student Name */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Your Name / Student ID
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
              required
              className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3.5 py-2 text-xs text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Select Your Lab Responsibilities
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Partner A */}
              <div
                onClick={() => setSelectedRole('partner_a')}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  selectedRole === 'partner_a'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/30 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Partner A: Bench Chemist
                    </span>
                  </div>
                  {selectedRole === 'partner_a' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
                <ul className="mt-2 text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
                  <li>• Assembles 25 µL Master Mix via micropipette</li>
                  <li>• Monitors contamination & tip changes</li>
                  <li>• Authorizes thermocycler launch</li>
                  <li>• Loads submarine gel wells</li>
                </ul>
              </div>

              {/* Partner B */}
              <div
                onClick={() => setSelectedRole('partner_b')}
                className={`cursor-pointer rounded-xl border p-3 transition ${
                  selectedRole === 'partner_b'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/30 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Partner B: Instrument Engineer
                    </span>
                  </div>
                  {selectedRole === 'partner_b' && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                </div>
                <ul className="mt-2 text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
                  <li>• Verifies & co-signs reaction chemistry</li>
                  <li>• Operates touch vortex & mini centrifuge</li>
                  <li>• Programs thermal cycler stringency ($T_a$)</li>
                  <li>• Controls 100V power supply & UV imaging</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Coordination Gates Info Card */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-3 text-[11px] text-stone-600 dark:text-stone-400">
            <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Dual-Student Coordination Enforcement:
            </div>
            <p>
              Critical milestones (Master Mix co-signature, thermocycler dual-key launch authorization, Run-to-Red electrode polarity check, and clinical report sign-off) require active confirmation from both students before advancing.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-stone-500">
              💡 Tip: Once created, click <strong>"Open Partner Tab"</strong> to test live collaboration on this device!
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
            >
              <span>{mode === 'create' ? 'Launch Station' : 'Join Station'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
