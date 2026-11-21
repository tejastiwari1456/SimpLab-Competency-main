import React, { useState } from 'react';
import {
  Users,
  BookOpen,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Award,
  Search,
  Filter,
  Eye,
  X,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import {
  Assignment,
  ClassCourse,
  StudentSubmission,
  CompetencyKey,
  COMPETENCY_DIMENSIONS,
  Experiment,
} from '../../types';
import { CompetencyRadar } from '../analytics/CompetencyRadar';

interface TeacherDashboardProps {
  classes: ClassCourse[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  experiments: Experiment[];
  onCreateAssignment: (assignment: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>) => void;
  isDark?: boolean;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  classes,
  assignments,
  submissions,
  experiments,
  onCreateAssignment,
  isDark = false,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || 'cls-1');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedStudentSub, setSelectedStudentSub] = useState<StudentSubmission | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // New assignment form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newExpId, setNewExpId] = useState<string>(experiments[0]?.id || 'exp-ohms-law');
  const [newDueDate, setNewDueDate] = useState<string>('2026-10-15');
  const [newWeight, setNewWeight] = useState<number>(15);
  const [newAttempts, setNewAttempts] = useState<number>(3);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateAssignment({
      classId: selectedClassId,
      title: newTitle,
      experimentId: newExpId,
      dueDate: new Date(newDueDate).toISOString(),
      totalMarks: 100,
      weightTowardsInternal: newWeight,
      attemptsAllowed: newAttempts,
      allowFreeExploration: true,
      status: 'active',
      avgScore: 0,
    });

    setNewTitle('');
    setShowCreateModal(false);
  };

  // CSV Export
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

    const rows = submissions.map((s) => [
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

  // Filtered submissions
  const filteredSubmissions = submissions.filter((s) =>
    s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header with Class Selector & Actions */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs md:flex-row md:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-stone-900 dark:bg-amber-400/20 dark:border dark:border-amber-400/30 px-2 py-0.5 text-xs font-semibold text-amber-400 dark:text-amber-300">
              <Users className="h-3 w-3" />
              Instructor Portal
            </span>
            <span className="text-xs text-stone-600 dark:text-stone-400">Dr. Radhika Sen • Applied Sciences Dept</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            Competency Analytics & Internal Assessment Portal
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Monitor demonstrated practical competencies, track misconceptions, and export official practical marks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-900 dark:text-stone-100 shadow-2xs focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden transition-colors"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code}: {cls.name} ({cls.studentCount} students)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 shadow-2xs hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors"
            title="Download accredited CSV of student practical marks and competency scores"
          >
            <Download className="h-3.5 w-3.5 text-stone-600 dark:text-stone-400" />
            <span>Export Internal Marks (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 shadow-sm hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-amber-400 dark:text-stone-950" />
            <span>Assign Virtual Lab</span>
          </button>
        </div>
      </div>

      {/* Class Radar & Misconceptions Heatmap Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Class Competency Radar (5 cols) */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-5 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Class Practical Competencies
            </h3>
            <span className="text-xs text-stone-600 dark:text-stone-400">{currentClass.code}</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
            Aggregated empirical performance across all completed syllabus lab assignments.
          </p>
          <CompetencyRadar
            scores={currentClass.averageCompetencies}
            studentName="Class Average"
            height={280}
            isDark={isDark}
          />
        </div>

        {/* Right: Misconceptions Heatmap & Actionable Interventions (7 cols) */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs lg:col-span-7 space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Departmental Misconception Heatmap
              </h3>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">Auto-detected from Lab Submissions</span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Identified reasoning deficits and procedural errors flagged during simulation runs and AI viva defenses:
          </p>

          <div className="space-y-3">
            {currentClass.commonMisconceptions.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 text-xs space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 dark:text-stone-100">{item.title}</span>
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 font-bold text-amber-900 dark:text-amber-200 text-[10px]">
                    {item.affectedPercentage}% of cohort affected
                  </span>
                </div>
                <div className="text-[11px] text-stone-600 dark:text-stone-400">
                  <span>Related syllabus lab: <strong>{item.relatedExperiment}</strong></span>
                </div>
                <div className="rounded bg-white dark:bg-stone-800/90 p-2 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-950 dark:text-amber-200">
                  <strong className="text-amber-900 dark:text-amber-300">Recommended Pedagogical Remediation:</strong> {item.recommendedRemediation}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Syllabus Lab Assignments */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Assigned Syllabus Virtual Labs & Modules
          </h3>
          <span className="text-xs text-stone-600 dark:text-stone-400">{assignments.length} assignments active</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {assignments.map((asg) => (
            <div
              key={asg.id}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 p-4 text-xs space-y-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm leading-snug">{asg.title}</h4>
                <span className="rounded bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700 dark:text-stone-300 shrink-0">
                  {asg.weightTowardsInternal}% Internal
                </span>
              </div>

              <div className="space-y-1 text-stone-600 dark:text-stone-400">
                <div className="flex justify-between">
                  <span>Due Date:</span>
                  <strong className="text-stone-900 dark:text-stone-100">{new Date(asg.dueDate).toLocaleDateString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Submissions:</span>
                  <strong className="text-stone-900 dark:text-stone-100">
                    {asg.completedCount} / {asg.totalStudents} completed
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Average Score:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">{asg.avgScore || 82}%</strong>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                  <div
                    className="h-full bg-stone-900 dark:bg-amber-500 rounded-full"
                    style={{ width: `${(asg.completedCount / asg.totalStudents) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-stone-600 dark:text-stone-400">
                  <span>{Math.round((asg.completedCount / asg.totalStudents) * 100)}% Participation</span>
                  <span>{asg.attemptsAllowed} Attempts allowed</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Submissions Roster & Drilldown */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Student Practical Performance Roster
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Detailed breakdown of authentic practical decisions, task scores, and AI viva defenses.
            </p>
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search by student name or roll ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400">
                <th className="pb-2 font-semibold">Roll ID</th>
                <th className="pb-2 font-semibold">Student Name</th>
                <th className="pb-2 font-semibold">Experiment</th>
                <th className="pb-2 font-semibold">Total Marks</th>
                <th className="pb-2 font-semibold">Setup</th>
                <th className="pb-2 font-semibold">Precision</th>
                <th className="pb-2 font-semibold">Analysis</th>
                <th className="pb-2 font-semibold">Safety</th>
                <th className="pb-2 font-semibold">Design</th>
                <th className="pb-2 font-semibold text-right">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-stone-50 dark:hover:bg-stone-850/60 transition-colors">
                  <td className="py-2.5 font-mono text-[11px] text-stone-600 dark:text-stone-400">{sub.studentId}</td>
                  <td className="py-2.5 font-bold text-stone-900 dark:text-stone-100">{sub.studentName}</td>
                  <td className="py-2.5 text-stone-600 dark:text-stone-400">
                    {sub.experimentId === 'exp-ohms-law'
                      ? "Ohm's Law"
                      : sub.experimentId === 'exp-titration'
                      ? 'Titration'
                      : 'Photoelectric'}
                  </td>
                  <td className="py-2.5 font-bold text-stone-900 dark:text-stone-100">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-mono ${
                        sub.totalScore >= 85
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : sub.totalScore >= 70
                          ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {sub.totalScore} / 100
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-stone-600 dark:text-stone-400">{sub.competencyScores?.setup_adherence ?? 0}%</td>
                  <td className="py-2.5 font-mono text-stone-600 dark:text-stone-400">{sub.competencyScores?.measurement_precision ?? 0}%</td>
                  <td className="py-2.5 font-mono text-stone-600 dark:text-stone-400">{sub.competencyScores?.data_interpretation ?? 0}%</td>
                  <td className="py-2.5 font-mono text-stone-600 dark:text-stone-400">{sub.competencyScores?.troubleshooting_safety ?? 0}%</td>
                  <td className="py-2.5 font-mono text-stone-600 dark:text-stone-400">{sub.competencyScores?.experimental_design ?? 0}%</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentSub(sub)}
                      className="flex items-center gap-1 rounded bg-stone-100 dark:bg-stone-800 px-2 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-900 hover:text-white dark:hover:bg-amber-500 dark:hover:text-stone-950 transition-colors ml-auto"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Drill-Down Modal */}
      {selectedStudentSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <span className="text-xs text-stone-600 dark:text-stone-400">Lab Session Inspection</span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {selectedStudentSub.studentName} ({selectedStudentSub.studentId})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentSub(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Radar & Score Overview */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <CompetencyRadar
                  scores={selectedStudentSub.competencyScores}
                  benchmarkScores={currentClass.averageCompetencies}
                  studentName={selectedStudentSub.studentName}
                  height={220}
                  isDark={isDark}
                />
              </div>

              <div className="space-y-2 rounded-xl bg-stone-50 dark:bg-stone-850 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">Total Score Awarded:</span>
                  <strong className="text-stone-900 dark:text-stone-100 font-mono text-sm">{selectedStudentSub.totalScore} / 100 pts</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">Observations Logged:</span>
                  <strong className="text-stone-900 dark:text-stone-100 font-mono">{selectedStudentSub.dataReadingsCount} data rows</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600 dark:text-stone-400">Submitted At:</span>
                  <strong className="text-stone-900 dark:text-stone-100">{new Date(selectedStudentSub.submittedAt).toLocaleString()}</strong>
                </div>
                {selectedStudentSub.instructorFeedback && (
                  <div className="mt-2 rounded bg-white dark:bg-stone-800 p-2.5 border border-stone-200 dark:border-stone-700">
                    <strong className="text-stone-900 dark:text-stone-100 block mb-0.5">Instructor Remark:</strong>
                    <p className="text-stone-600 dark:text-stone-300">{selectedStudentSub.instructorFeedback}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Task Responses List */}
            <div className="space-y-2 border-t border-stone-200 dark:border-stone-800 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Task Responses & AI Viva Record
              </h4>
              <div className="space-y-2">
                {Object.entries(selectedStudentSub.taskResponses).map(([taskId, rawResp]) => {
                  const resp = rawResp as any;
                  return (
                    <div key={taskId} className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 p-3 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-stone-900 dark:text-stone-100">
                        <span>Task: {taskId}</span>
                        <span className="font-mono text-amber-700 dark:text-amber-400">{resp?.score ?? 0} / {resp?.maxScore ?? 0} pts</span>
                      </div>
                      <div className="text-[11px] text-stone-600 dark:text-stone-400">
                        <strong>Student Output:</strong> {typeof resp?.studentAnswer === 'object' ? JSON.stringify(resp?.studentAnswer) : String(resp?.studentAnswer ?? '')}
                      </div>
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                        <strong>Evaluation Feedback:</strong> {resp?.feedback ?? 'Evaluation recorded.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudentSub(null)}
                className="rounded-lg bg-stone-900 dark:bg-stone-800 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 dark:hover:bg-stone-700"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Create New Syllabus Lab Assignment</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">Assignment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Lab 3: Photoelectric Effect & Work Function Determination"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-2 text-xs text-stone-900 dark:text-stone-100 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">Select Experiment or Scenario</label>
                <select
                  value={newExpId}
                  onChange={(e) => setNewExpId(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-2 text-xs text-stone-900 dark:text-stone-100 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
                >
                  {experiments.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.code}: {exp.title} ({exp.syllabusTag})
                    </option>
                  ))}
                  <option value="scen-ecg-divider">
                    Scenario: Biomedical ECG Voltage Divider Sizing
                  </option>
                  <option value="scen-effluent-neutralization">
                    Scenario: Industrial Effluent Neutralization
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-2 text-xs text-stone-900 dark:text-stone-100 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">Weight Towards Internal (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={newWeight}
                    onChange={(e) => setNewWeight(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-2 text-xs text-stone-900 dark:text-stone-100 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">Allowed Re-attempts</label>
                <select
                  value={newAttempts}
                  onChange={(e) => setNewAttempts(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 p-2 text-xs text-stone-900 dark:text-stone-100 focus:border-stone-900 dark:focus:border-amber-400 focus:outline-hidden"
                >
                  <option value={1}>1 Attempt (Formal Examination)</option>
                  <option value={2}>2 Attempts (Best of 2)</option>
                  <option value={3}>3 Attempts (Mastery Learning)</option>
                  <option value={5}>Unlimited / Practice Mode</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-stone-300 dark:border-stone-700 px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors"
                >
                  Publish to Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
