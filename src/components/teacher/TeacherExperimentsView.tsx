import React, { useState } from 'react';
import {
  FlaskConical,
  BookOpen,
  CheckCircle2,
  Shield,
  Layers,
  Sparkles,
  Search,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { Experiment } from '../../types';

interface TeacherExperimentsViewProps {
  experiments: Experiment[];
  onNavigate: (path: string) => void;
  onQuickAssignExp?: (expId: string) => void;
}

export const TeacherExperimentsView: React.FC<TeacherExperimentsViewProps> = ({
  experiments,
  onNavigate,
  onQuickAssignExp,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedExpId, setSelectedExpId] = useState<string>(experiments[0]?.id || 'exp-convex-lens');

  const subjects = [
    'all',
    ...Array.from(
      new Set(
        experiments
          .map((e) => e.subject)
          .filter((sub): sub is string => Boolean(sub))
      )
    ),
  ];

  const filtered = experiments.filter(
    (e) => selectedSubject === 'all' || e.subject === selectedSubject
  );

  const activeExp = experiments.find((e) => e.id === selectedExpId) || experiments[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <FlaskConical className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Standardized Simulation Catalog
            </span>
            <span className="text-xs text-stone-500">Curriculum Aligned</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Experiment Library & Virtual Apparatuses
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Browse mathematical simulation models, inspect apparatus parameters, and assign experiments to cohorts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/teacher/assignments')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <BookOpen className="h-4 w-4" />
          <span>View Active Assignments</span>
        </button>
      </div>

      {/* Subject Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {subjects.map((sub) => (
          <button
            key={`subject-filter-${sub}`}
            type="button"
            onClick={() => setSelectedSubject(sub)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
              selectedSubject === sub
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
            }`}
          >
            {sub === 'all' ? 'All Disciplines' : sub}
          </button>
        ))}
      </div>

      {/* Main Grid: Experiment Cards + Inspector Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Experiments List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {filtered.map((exp) => {
            const isSelected = exp.id === activeExp?.id;
            return (
              <div
                key={`exp-card-${exp.id}`}
                onClick={() => setSelectedExpId(exp.id)}
                className={`rounded-2xl border p-4 transition-all cursor-pointer text-left ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-sm ring-2 ring-indigo-500/20'
                    : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                    {exp.subject}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">{exp.code || exp.id}</span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                  {exp.title}
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                  {exp.description}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-stone-100 dark:border-stone-800">
                  <span className="text-stone-500 font-medium">
                    {exp.apparatusList?.length || 0} Apparatus Modules
                  </span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    Inspect <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Experiment Deep-Dive (7 cols) */}
        {activeExp && (
          <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold px-2 py-0.5 text-xs">
                    {activeExp.subject}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">{activeExp.code || activeExp.id}</span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">
                  {activeExp.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onQuickAssignExp) {
                    onQuickAssignExp(activeExp.id);
                  }
                  onNavigate('/teacher/assignments');
                }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Assign to Cohort</span>
              </button>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Pedagogical Objective & Overview
              </h4>
              <p className="mt-1 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                {activeExp.description}
              </p>
            </div>

            {/* Apparatus Components */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                Simulated Apparatus Components
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeExp.apparatusList && activeExp.apparatusList.length > 0 ? (
                  activeExp.apparatusList.map((itemName, idx) => (
                    <div
                      key={`apparatus-item-${activeExp.id}-${idx}`}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {itemName}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1">Calibrated virtual laboratory instrument</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 p-3 text-xs">
                    <span className="font-bold text-stone-800 dark:text-stone-200">
                      Standard Laboratory Bench & Sensors
                    </span>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Calibrated virtual instruments with precision telemetry logging.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Key Governing Equations */}
            {activeExp.keyFormulas && activeExp.keyFormulas.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                  Governing Theoretical Principles & Formulas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeExp.keyFormulas.map((f, idx) => (
                    <div
                      key={`formula-${activeExp.id}-${idx}`}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-2.5 text-xs"
                    >
                      <span className="text-[10px] text-stone-500 block font-bold uppercase tracking-wider">
                        {f.label}
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs mt-0.5 block">
                        {f.formula}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Syllabus Competency Rubric Mapping */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                Syllabus Practical Competencies Evaluated
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 p-2.5">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      Setup & Calibration Adherence (20%)
                    </span>
                    <p className="text-[11px] text-stone-500">
                      Correct optical alignment, zero-error calibration, and circuit safety wiring.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 p-2.5">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      Measurement & Observation Precision (25%)
                    </span>
                    <p className="text-[11px] text-stone-500">
                      Parallax error elimination, multi-trial averaging, and focal length calculations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 p-2.5">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      Data Synthesis & Scientific Viva (30%)
                    </span>
                    <p className="text-[11px] text-stone-500">
                      Graphical verification of lens formula, gradient extrapolation, and conceptual viva.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
