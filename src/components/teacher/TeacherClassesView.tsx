import React, { useState, useEffect } from 'react';
import {
  Users,
  Award,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  FileBarChart2,
} from 'lucide-react';
import { ClassCourse, CurrentUser, StudentSubmission } from '../../types';
import { StudentProfileReportModal } from './StudentProfileReportModal';

interface EnrolledStudentRecord {
  id: string;
  name: string;
  email: string;
  enrollmentCode?: string | null;
  institution?: string | null;
  enrollmentStatus?: string;
  enrolledAt: string;
  submissionsCount: number;
  overallMastery: number;
  latestSubmittedAt: string | null;
}

interface TeacherClassesViewProps {
  token: string | null;
  currentUser?: CurrentUser;
  classes: ClassCourse[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  submissions: StudentSubmission[];
  onNavigate: (path: string) => void;
  isDark?: boolean;
}

export const TeacherClassesView: React.FC<TeacherClassesViewProps> = ({
  token,
  currentUser,
  classes,
  selectedClassId,
  onSelectClassId,
  submissions,
  onNavigate,
  isDark = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'mastery' | 'competent' | 'needs_support' | 'not_started'
  >('all');
  const [roster, setRoster] = useState<EnrolledStudentRecord[]>([]);
  const [rosterLoading, setRosterLoading] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string>('');
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(null);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  useEffect(() => {
    if (!token || !currentClass?.id) {
      setRoster([]);
      return;
    }

    let cancelled = false;
    setRosterLoading(true);
    setRosterError('');

    fetch(`/api/teacher/classes/${encodeURIComponent(currentClass.id)}/students`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load enrolled student roster.');
        }
        if (!cancelled) {
          setRoster(Array.isArray(data.students) ? data.students : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRosterError(err instanceof Error ? err.message : 'Unable to load enrolled students.');
          setRoster([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, currentClass?.id, submissions.length]);

  const classStudents = React.useMemo(() => {
    return roster.map((st) => {
      const avgScore = Math.round(Number(st.overallMastery) || 0);
      const status: 'mastery' | 'competent' | 'needs_support' | 'not_started' =
        st.submissionsCount === 0
          ? 'not_started'
          : avgScore >= 85
          ? 'mastery'
          : avgScore < 70
          ? 'needs_support'
          : 'competent';
      return {
        id: st.id,
        name: st.name,
        email: st.email,
        enrollmentCode: st.enrollmentCode,
        enrollmentStatus: st.enrollmentStatus || 'active',
        enrolledDate: st.enrolledAt
          ? new Date(st.enrolledAt).toLocaleDateString()
          : '—',
        experimentsCount: st.submissionsCount,
        avgScore,
        lastActive: st.latestSubmittedAt
          ? new Date(st.latestSubmittedAt).toLocaleDateString()
          : 'No submissions yet',
        status,
      };
    });
  }, [roster]);

  const filteredStudents = classStudents.filter((st) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      st.name.toLowerCase().includes(q) ||
      st.id.toLowerCase().includes(q) ||
      (st.enrollmentCode || '').toLowerCase().includes(q) ||
      st.email.toLowerCase().includes(q);
    const matchesFilter = filterStatus === 'all' || st.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (!currentClass) {
    return (
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-center">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          No Assigned Class Cohorts
        </h2>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          No class cohorts are currently assigned to your faculty account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Academic Cohort Directory
            </span>
            <span className="text-xs text-stone-500">
              {currentClass.academicYear || 'Current Academic Year'}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Class Cohorts & Student Rosters
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Manage laboratory cohorts, filter students by performance, and inspect individual competency reports and experiment histories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/teacher/assignments')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>Create Cohort Assignment</span>
          </button>
        </div>
      </div>

      {/* Cohort Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {classes.map((cls) => {
          const isSelected = cls.id === currentClass.id;
          const compVals = Object.values(cls.averageCompetencies || {}) as number[];
          const avgCompetency =
            compVals.length > 0
              ? compVals.reduce((a, b) => a + (Number(b) || 0), 0) / compVals.length
              : 0;

          return (
            <div
              key={cls.id}
              onClick={() => onSelectClassId(cls.id)}
              className={`rounded-2xl border p-5 transition-all cursor-pointer text-left ${
                isSelected
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-stone-100 dark:bg-stone-800 px-2.5 py-1 text-xs font-bold text-stone-800 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700">
                  {cls.code}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {isSelected ? 'Active Cohort' : 'Select'}
                </span>
              </div>

              <h3 className="mt-3 text-sm font-bold text-stone-900 dark:text-stone-100">
                {cls.name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {cls.semester} • {cls.academicYear}
              </p>

              <div className="mt-4 pt-4 border-t border-stone-200/80 dark:border-stone-800/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400">Roster</span>
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    {cls.studentCount} Enrolled
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400">Class Average</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">
                    {Math.round(avgCompetency)}% Score
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Roster Table for Selected Class */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {currentClass.name} — Enrolled Student Roster
              </h3>
              <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-xs font-bold text-stone-600 dark:text-stone-300">
                {currentClass.code}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Click any student to open their full competency profile, experiment history, AI Viva transcripts, and PDF report.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search student or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 px-3 py-1.5 text-xs text-stone-800 dark:text-stone-200 focus:outline-none"
            >
              <option value="all">All Mastery Levels</option>
              <option value="mastery">Mastery (85%+)</option>
              <option value="competent">Competent (70-84%)</option>
              <option value="needs_support">Needs Support (&lt;70%)</option>
              <option value="not_started">No Submissions Yet</option>
            </select>
          </div>
        </div>

        {rosterError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            {rosterError}
          </div>
        )}

        {rosterLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>Loading enrolled student roster...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-500 dark:text-stone-400">
            No enrolled students match the selected filter in {currentClass.code}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
              <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-stone-400">
                <tr>
                  <th className="px-4 py-3">Student Name & Code</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Completed Labs</th>
                  <th className="px-4 py-3">Recent Activity</th>
                  <th className="px-4 py-3">Competency Score</th>
                  <th className="px-4 py-3">Performance Tier</th>
                  <th className="px-4 py-3 text-right">Profile & Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {filteredStudents.map((st) => (
                  <tr
                    key={`roster-student-${st.id}`}
                    className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                          {st.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900 dark:text-stone-100">{st.name}</p>
                          <p className="text-[10px] text-stone-400 font-mono">
                            {st.email}
                            {st.enrollmentCode ? ` • ${st.enrollmentCode}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-stone-500">
                      <div className="text-xs font-medium text-stone-700 dark:text-stone-300">
                        {st.enrolledDate}
                      </div>
                      <span className="inline-block mt-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                        {st.enrollmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium">
                      {st.experimentsCount} {st.experimentsCount === 1 ? 'Submission' : 'Submissions'}
                    </td>
                    <td className="px-4 py-3.5 text-stone-500">{st.lastActive}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        {st.experimentsCount > 0 ? `${st.avgScore}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {st.status === 'mastery' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold">
                          <CheckCircle2 className="h-3 w-3" /> Mastery
                        </span>
                      )}
                      {st.status === 'competent' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 px-2.5 py-0.5 text-[11px] font-bold">
                          <Award className="h-3 w-3" /> Competent
                        </span>
                      )}
                      {st.status === 'needs_support' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 text-[11px] font-bold">
                          <AlertCircle className="h-3 w-3" /> Needs Support
                        </span>
                      )}
                      {st.status === 'not_started' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-2.5 py-0.5 text-[11px] font-bold">
                          Not Started
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectedStudentId(st.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                      >
                        <FileBarChart2 className="h-3.5 w-3.5" />
                        <span>Inspect Profile</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {inspectedStudentId && (
        <StudentProfileReportModal
          studentId={inspectedStudentId}
          token={token}
          facultyName={currentUser?.name || 'Faculty'}
          isDark={isDark}
          onClose={() => setInspectedStudentId(null)}
        />
      )}
    </div>
  );
};
