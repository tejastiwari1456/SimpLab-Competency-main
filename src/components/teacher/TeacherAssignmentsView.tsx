import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Award,
  Search,
  Filter,
  X,
  Sparkles,
} from 'lucide-react';
import { Assignment, ClassCourse, Experiment } from '../../types';

interface TeacherAssignmentsViewProps {
  assignments: Assignment[];
  classes: ClassCourse[];
  experiments: Experiment[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  onCreateAssignment: (assignment: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>) => void;
}

export const TeacherAssignmentsView: React.FC<TeacherAssignmentsViewProps> = ({
  assignments,
  classes,
  experiments,
  selectedClassId,
  onSelectClassId,
  onCreateAssignment,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // New assignment form state
  const [newTitle, setNewTitle] = useState('');
  const [newExpId, setNewExpId] = useState(experiments[0]?.id || 'exp-ohms-law');
  const [newDueDate, setNewDueDate] = useState('2026-10-25');
  const [newWeight, setNewWeight] = useState(15);
  const [newAttempts, setNewAttempts] = useState(3);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  const filteredAssignments = assignments.filter((asg) => {
    const matchesSearch = asg.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || asg.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleFormSubmit = (e: React.FormEvent) => {
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
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Syllabus Lab Assignments
            </span>
            <span className="text-xs text-stone-500">Internal Continuous Assessment</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Assigned Experiments & Deadlines
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Publish standardized simulation tasks, configure syllabus weights, and track cohort completion rates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => onSelectClassId(e.target.value)}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code}: {cls.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Lab Assignment</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {tab === 'all' ? 'All Assignments' : tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Assignments Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAssignments.map((asg) => {
          const exp = experiments.find((e) => e.id === asg.experimentId);
          const percentDone = asg.totalStudents ? Math.round((asg.completedCount / asg.totalStudents) * 100) : 0;

          return (
            <div
              key={asg.id}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-bold text-stone-700 dark:text-stone-300 font-mono">
                    <FlaskConical className="h-3 w-3 text-indigo-500" />
                    {asg.experimentId}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                      asg.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {asg.status}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-stone-900 dark:text-stone-100 leading-snug">
                  {asg.title}
                </h3>
                {exp && (
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                    {exp.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar className="h-3.5 w-3.5 text-stone-400" />
                      Due Date:
                    </span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {new Date(asg.dueDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                    <span className="text-[11px]">Internal Weight:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {asg.weightTowardsInternal}% of Final Grade
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                    <span className="text-[11px]">Attempts Permitted:</span>
                    <span className="font-semibold">{asg.attemptsAllowed} Attempts</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-stone-500">
                    Cohort Submission Rate
                  </span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {asg.completedCount} / {asg.totalStudents} ({percentDone}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                    style={{ width: `${percentDone}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                  <Plus className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  Assign New Virtual Laboratory
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab 4: Ohm's Law & Verification of Internal Resistance"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Target Simulation Experiment
                </label>
                <select
                  value={newExpId}
                  onChange={(e) => setNewExpId(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3.5 py-2 text-stone-900 dark:text-stone-100 focus:outline-none"
                >
                  {experiments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Submission Due Date
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Internal Weight (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Simulation Attempts Permitted
                </label>
                <select
                  value={newAttempts}
                  onChange={(e) => setNewAttempts(Number(e.target.value))}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-900 dark:text-stone-100"
                >
                  <option value={1}>1 Attempt (Formal Exam Condition)</option>
                  <option value={3}>3 Attempts (Recommended)</option>
                  <option value={5}>5 Attempts (Practice Oriented)</option>
                  <option value={999}>Unlimited Exploratory Attempts</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold shadow-xs cursor-pointer"
                >
                  Publish Lab Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
