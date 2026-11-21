import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  Eye,
  X,
  CheckCircle2,
  Calendar,
  Award,
  FlaskConical,
  Check,
} from 'lucide-react';
import { StudentSubmission, ClassCourse } from '../../types';

interface TeacherReviewViewProps {
  submissions: StudentSubmission[];
  classes: ClassCourse[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
}

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({
  submissions,
  classes,
  selectedClassId,
  onSelectClassId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSub, setSelectedSub] = useState<StudentSubmission | null>(null);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const filteredSubmissions = submissions.filter(
    (s) =>
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.experimentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = [
      'Student ID',
      'Student Name',
      'Experiment ID',
      'Total Marks (100)',
      'Setup & Calibration (%)',
      'Measurement Precision (%)',
      'Data Interpretation (%)',
      'Troubleshooting & Safety (%)',
      'Experimental Design (%)',
      'Submitted At',
    ];

    const rows = filteredSubmissions.map((s) => [
      s.studentId,
      `"${s.studentName}"`,
      s.experimentId,
      s.totalScore,
      s.competencyScores?.setup_adherence ?? 0,
      s.competencyScores?.measurement_precision ?? 0,
      s.competencyScores?.data_interpretation ?? 0,
      s.competencyScores?.troubleshooting_safety ?? 0,
      s.competencyScores?.experimental_design ?? 0,
      new Date(s.submittedAt).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Internal_Practical_Marks_${currentClass.code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <ClipboardList className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Continuous Internal Assessment
            </span>
            <span className="text-xs text-stone-500">Official Practical Gradebook</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Student Practical Submissions & Session Logs
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Audit student apparatus telemetry, inspect task-level competency breakdowns, and export internal marks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 text-xs font-bold text-stone-800 dark:text-stone-200 shadow-xs hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Export Internal Marks (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-stone-600 dark:text-stone-400">Target Cohort:</span>
          <select
            value={selectedClassId}
            onChange={(e) => onSelectClassId(e.target.value)}
            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code}: {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search student, ID, or lab..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Submissions Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
            <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase tracking-wider font-bold text-stone-500">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Lab Experiment</th>
                <th className="px-5 py-3.5">Total Score</th>
                <th className="px-5 py-3.5">Setup Adherence</th>
                <th className="px-5 py-3.5">Precision</th>
                <th className="px-5 py-3.5">Data Synthesis</th>
                <th className="px-5 py-3.5">Submitted Date</th>
                <th className="px-5 py-3.5 text-right">Session Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-stone-900 dark:text-stone-100 block">
                      {sub.studentName}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">{sub.studentId}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-stone-800 dark:text-stone-200">
                    <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-mono">
                      {sub.experimentId}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`font-bold text-sm ${
                        sub.totalScore >= 85
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : sub.totalScore < 70
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-stone-900 dark:text-stone-100'
                      }`}
                    >
                      {sub.totalScore}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {sub.competencyScores?.setup_adherence ?? 0}%
                  </td>
                  <td className="px-5 py-3.5">
                    {sub.competencyScores?.measurement_precision ?? 0}%
                  </td>
                  <td className="px-5 py-3.5">
                    {sub.competencyScores?.data_interpretation ?? 0}%
                  </td>
                  <td className="px-5 py-3.5 text-stone-500">
                    {new Date(sub.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedSub(sub)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Laboratory Telemetry & Evaluation Record
                </span>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  {selectedSub.studentName} ({selectedSub.studentId})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Lab Experiment</span>
                <p className="font-bold text-stone-900 dark:text-stone-100 mt-0.5 font-mono">
                  {selectedSub.experimentId}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold text-stone-400">Total Awarded Score</span>
                <p className="font-bold text-indigo-600 dark:text-indigo-400 text-base mt-0.5">
                  {selectedSub.totalScore} / 100
                </p>
              </div>
            </div>

            {/* Rubric Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                Demonstrated Practical Competencies
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(selectedSub.competencyScores || {}).map(([k, score]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40"
                  >
                    <span className="capitalize font-medium text-stone-700 dark:text-stone-300">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      {Number(score) >= 90 && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                          <Award className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          <span>Gold Milestone (90%+)</span>
                        </span>
                      )}
                      <span className="font-bold text-stone-900 dark:text-stone-100">{score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
