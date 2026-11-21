import React, { useState } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Award,
  TrendingUp,
  Download,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ClassCourse,
  StudentSubmission,
  CompetencyKey,
  COMPETENCY_DIMENSIONS,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';

interface TeacherAnalyticsViewProps {
  classes: ClassCourse[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  submissions: StudentSubmission[];
  isDark?: boolean;
}

export const TeacherAnalyticsView: React.FC<TeacherAnalyticsViewProps> = ({
  classes,
  selectedClassId,
  onSelectClassId,
  submissions,
  isDark = false,
}) => {
  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const atRiskStudents = submissions.filter((s) => s.totalScore < 75);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Empirical Competency Assessment
            </span>
            <span className="text-xs text-stone-500">Cohort Diagnostics</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Competency Radar & Misconception Analytics
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Evaluate cohort mastery across all 5 syllabus competency dimensions and identify targeted remediations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => onSelectClassId(e.target.value)}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3.5 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code}: {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics Grid: Radar Chart + Misconceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Chart (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                Cohort Competency Radar
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {currentClass.code}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Multi-dimensional evaluation normalized against ABET syllabus targets.
            </p>

            <div className="mt-4">
              <CompetencyRadar
                scores={currentClass.averageCompetencies}
                studentName="Cohort Average"
                height={290}
                isDark={isDark}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Class Average Score:</span>
              </span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {Math.round(
                  (Object.values(currentClass.averageCompetencies) as number[]).reduce((a: number, b: number) => a + b, 0) / 5
                )}%
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <span>Institutional Benchmark:</span>
              </span>
              <span className="font-bold text-stone-900 dark:text-stone-100">75% Target</span>
            </div>
          </div>
        </div>

        {/* Misconceptions Heatmap (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                Common Misconceptions & Deficits
              </h3>
            </div>
            <span className="rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-bold px-2.5 py-0.5 text-[10px]">
              AI Telemetry Insights
            </span>
          </div>

          <p className="text-xs text-stone-500">
            Procedural mistakes and conceptual errors detected during virtual apparatus manipulations:
          </p>

          <div className="space-y-3">
            {currentClass.commonMisconceptions.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-4 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 dark:text-stone-100">{item.title}</h4>
                  <span className="rounded-full bg-amber-200/80 dark:bg-amber-900/80 px-2 py-0.5 font-bold text-amber-950 dark:text-amber-200 text-[10px]">
                    {item.affectedPercentage}% Cohort Affected
                  </span>
                </div>

                <p className="text-[11px] text-stone-600 dark:text-stone-400">
                  Simulation Module: <strong>{item.relatedExperiment}</strong>
                </p>

                <div className="rounded-lg bg-white dark:bg-stone-900 p-2.5 border border-amber-200 dark:border-amber-900/50 text-[11px]">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">
                    Recommended Faculty Intervention:
                  </span>
                  <span className="text-stone-700 dark:text-stone-300">
                    {item.recommendedRemediation}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* At-Risk Students Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              At-Risk Students Requiring Targeted Remediation
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Students scoring below 75% on experimental design or error analysis.
            </p>
          </div>
          <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 text-xs font-bold">
            {atRiskStudents.length} Students Flagged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
            <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase tracking-wider font-bold text-stone-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Failed Experiment</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Lowest Competency Dimension</th>
                <th className="px-4 py-3">Suggested Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {atRiskStudents.map((st) => (
                <tr key={st.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                  <td className="px-4 py-3 font-bold text-stone-900 dark:text-stone-100">
                    {st.studentName}
                    <span className="block text-[10px] text-stone-400 font-normal">{st.studentId}</span>
                  </td>
                  <td className="px-4 py-3">{st.experimentId}</td>
                  <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">
                    {st.totalScore}%
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[10px] font-semibold">
                      Troubleshooting & Safety (60%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                    Assign guided replay simulation with apparatus hints.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
