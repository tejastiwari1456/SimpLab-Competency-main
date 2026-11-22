import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Calendar,
  AlertCircle,
  FlaskConical,
  Search,
  X,
  Archive,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import { Assignment, ClassCourse, Experiment } from '../../types';

interface TeacherAssignmentsViewProps {
  assignments: Assignment[];
  classes: ClassCourse[];
  experiments: Experiment[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  preselectedExperimentId?: string | null;
  openCreateNonce?: number;
  onCreateAssignment: (
    assignment: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>
  ) => Promise<void>;
  onToggleAssignmentStatus?: (
    assignmentId: string,
    status: 'active' | 'archived'
  ) => Promise<void>;
}

export const TeacherAssignmentsView: React.FC<TeacherAssignmentsViewProps> = ({
  assignments,
  classes,
  experiments,
  selectedClassId,
  onSelectClassId,
  preselectedExperimentId,
  openCreateNonce = 0,
  onCreateAssignment,
  onToggleAssignmentStatus,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusToggleId, setStatusToggleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [createdSuccessMsg, setCreatedSuccessMsg] = useState('');

  // New assignment form state + Evaluation Criteria
  const [modalClassId, setModalClassId] = useState(selectedClassId || classes[0]?.id || '');
  const [newTitle, setNewTitle] = useState('');
  const [newExpId, setNewExpId] = useState(
    preselectedExperimentId || experiments[0]?.id || 'exp-ohms-law'
  );
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [newTotalMarks, setNewTotalMarks] = useState(100);
  const [newWeight, setNewWeight] = useState(15);
  const [newAttempts, setNewAttempts] = useState(3);
  const [practicalWeightPct, setPracticalWeightPct] = useState(70);
  const [passingThresholdPct, setPassingThresholdPct] = useState(70);
  const [requireViva, setRequireViva] = useState(true);
  const [rubricNotes, setRubricNotes] = useState('');

  useEffect(() => {
    if (selectedClassId) {
      setModalClassId(selectedClassId);
    } else if (classes[0]?.id) {
      setModalClassId(classes[0].id);
    }
  }, [selectedClassId, classes]);

  useEffect(() => {
    if (openCreateNonce > 0) {
      if (preselectedExperimentId) {
        setNewExpId(preselectedExperimentId);
      }
      setFormError('');
      setShowModal(true);
    }
  }, [openCreateNonce, preselectedExperimentId]);

  const vivaWeightPct = 100 - practicalWeightPct;
  const classById = React.useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const filteredAssignments = assignments.filter((asg) => {
    const matchesSearch = asg.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || asg.status === statusFilter;
    const matchesCohort = cohortFilter === 'all' || asg.classId === cohortFilter;
    return matchesSearch && matchesStatus && matchesCohort;
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClassId = modalClassId || selectedClassId || classes[0]?.id || '';
    if (!newTitle.trim() || !targetClassId) {
      setFormError('Please enter a title and select a target class cohort.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await onCreateAssignment({
        classId: targetClassId,
        title: newTitle.trim(),
        experimentId: newExpId,
        dueDate: new Date(newDueDate).toISOString(),
        totalMarks: newTotalMarks,
        weightTowardsInternal: newWeight,
        attemptsAllowed: newAttempts,
        allowFreeExploration: true,
        evaluationCriteria: {
          practicalWeightPct,
          vivaWeightPct,
          passingThresholdPct,
          requireViva,
          rubricNotes: rubricNotes.trim(),
        },
        status: 'active',
        avgScore: 0,
      });

      setNewTitle('');
      setRubricNotes('');
      setShowModal(false);
      setCreatedSuccessMsg('New experiment assignment published with evaluation criteria.');
      setTimeout(() => setCreatedSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (asg: Assignment) => {
    if (!onToggleAssignmentStatus) return;
    setStatusToggleId(asg.id);
    setActionError('');
    try {
      await onToggleAssignmentStatus(asg.id, asg.status === 'active' ? 'archived' : 'active');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update assignment status.');
    } finally {
      setStatusToggleId(null);
    }
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
            Assigned Experiments, Deadlines & Evaluation Criteria
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Assign experiments to classes or batches, configure practical/viva weights and passing thresholds, and monitor completion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={classes.length === 0}
            onClick={() => {
              setFormError('');
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Lab Assignment</span>
          </button>
        </div>
      </div>

      {createdSuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{createdSuccessMsg}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'active', 'archived'] as const).map((tab) => (
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

          {classes.length > 0 && (
            <select
              value={cohortFilter}
              onChange={(e) => {
                setCohortFilter(e.target.value);
                if (e.target.value !== 'all') onSelectClassId(e.target.value);
              }}
              className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-200"
            >
              <option value="all">All Assigned Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.code}: {cls.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Assignments Cards Grid */}
      {filteredAssignments.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-center text-xs text-stone-500 dark:text-stone-400">
          No assignments match the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssignments.map((asg) => {
            const exp = experiments.find((e) => e.id === asg.experimentId);
            const cls = classById.get(asg.classId);
            const percentDone = asg.totalStudents
              ? Math.min(100, Math.round((asg.completedCount / asg.totalStudents) * 100))
              : 0;
            const criteria = asg.evaluationCriteria || {
              practicalWeightPct: 70,
              vivaWeightPct: 30,
              passingThresholdPct: 70,
              requireViva: true,
              rubricNotes: '',
            };

            return (
              <div
                key={asg.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-bold text-stone-700 dark:text-stone-300 font-mono truncate">
                      <FlaskConical className="h-3 w-3 text-indigo-500 shrink-0" />
                      <span className="truncate">{exp?.title || asg.experimentId}</span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize shrink-0 ${
                        asg.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {asg.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    {cls && (
                      <span className="rounded bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        {cls.code}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-stone-400">
                      {asg.totalMarks} Marks
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100 leading-snug">
                    {asg.title}
                  </h3>

                  {/* Evaluation Criteria Pill Strip */}
                  <div className="mt-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 p-2.5 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Practical / Viva Split:</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {criteria.practicalWeightPct}% / {criteria.vivaWeightPct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Passing Threshold:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        ≥ {criteria.passingThresholdPct}%{' '}
                        {criteria.requireViva ? '• Viva Required' : '• Viva Optional'}
                      </span>
                    </div>
                    {criteria.rubricNotes && (
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 pt-1 border-t border-stone-200/60 dark:border-stone-700/60 line-clamp-2">
                        Rubric: {criteria.rubricNotes}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/80 space-y-1.5 text-xs">
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
                      <span className="text-[11px]">Internal Weight / Attempts:</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {asg.weightTowardsInternal}% • {asg.attemptsAllowed}x
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Status Toggle */}
                <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-medium text-stone-500">
                        Cohort Completion
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

                  {onToggleAssignmentStatus && (
                    <button
                      type="button"
                      disabled={statusToggleId === asg.id}
                      onClick={() => handleToggleStatus(asg)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                    >
                      {asg.status === 'active' ? (
                        <>
                          <Archive className="h-3.5 w-3.5" />
                          <span>Archive Assignment</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Re-activate Assignment</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Create Lab Assignment"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    Assign New Virtual Laboratory
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Configure target class, deadline, attempts, and evaluation rubric criteria.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Assign to Class / Batch
                  </label>
                  <select
                    value={modalClassId}
                    onChange={(e) => setModalClassId(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.code}: {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Target Simulation Experiment
                  </label>
                  <select
                    value={newExpId}
                    onChange={(e) => setNewExpId(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none"
                  >
                    {experiments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({e.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-2 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={newTotalMarks}
                    onChange={(e) => setNewTotalMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-2 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Internal Wt (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-2 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Attempts
                  </label>
                  <select
                    value={newAttempts}
                    onChange={(e) => setNewAttempts(Number(e.target.value))}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-2.5 py-2 text-stone-900 dark:text-stone-100"
                  >
                    <option value={1}>1 (Exam)</option>
                    <option value={3}>3 (Std)</option>
                    <option value={5}>5 (Practice)</option>
                    <option value={10}>10 (Open)</option>
                  </select>
                </div>
              </div>

              {/* Evaluation Criteria Section */}
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 text-[11px]">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Evaluation Criteria Configuration
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                    Practical {practicalWeightPct}% + Viva {vivaWeightPct}% = 100%
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Practical vs. AI Viva Weight Split ({practicalWeightPct}% Practical / {vivaWeightPct}% Viva)
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={practicalWeightPct}
                    onChange={(e) => setPracticalWeightPct(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Passing Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="95"
                      value={passingThresholdPct}
                      onChange={(e) => setPassingThresholdPct(Number(e.target.value))}
                      className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-stone-900 dark:text-stone-100"
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 font-semibold text-stone-700 dark:text-stone-300 pt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireViva}
                      onChange={(e) => setRequireViva(e.target.checked)}
                      className="rounded border-stone-300 text-indigo-600"
                    />
                    <span>Require AI Viva Voce Completion</span>
                  </label>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Faculty Rubric & Grading Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Minimum 5 distinct readings across 2V–10V; slope error must remain within ±5%."
                    value={rubricNotes}
                    onChange={(e) => setRubricNotes(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 text-xs font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Publishing...' : 'Publish Lab Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
