import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  Award,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { ClassCourse, StudentSubmission, CompetencyKey, COMPETENCY_DIMENSIONS } from '../../types';

interface TeacherClassesViewProps {
  classes: ClassCourse[];
  selectedClassId: string;
  onSelectClassId: (id: string) => void;
  submissions: StudentSubmission[];
  onNavigate: (path: string) => void;
}

export const TeacherClassesView: React.FC<TeacherClassesViewProps> = ({
  classes,
  selectedClassId,
  onSelectClassId,
  submissions,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'mastery' | 'competent' | 'needs_support'>('all');

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Deduplicate and aggregate students from submissions to ensure unique roster entries
  const classStudents = React.useMemo(() => {
    const studentMap = new Map<
      string,
      {
        id: string;
        name: string;
        lastActive: string;
        experimentsCount: number;
        totalScoreSum: number;
        status: 'mastery' | 'competent' | 'needs_support';
        radar: Record<string, number>;
      }
    >();

    submissions.forEach((sub) => {
      const existing = studentMap.get(sub.studentId);
      const subScore = sub.totalScore;
      if (!existing) {
        studentMap.set(sub.studentId, {
          id: sub.studentId,
          name: sub.studentName,
          lastActive: new Date(sub.submittedAt).toLocaleDateString(),
          experimentsCount: 1,
          totalScoreSum: subScore,
          status: subScore >= 85 ? 'mastery' : subScore < 70 ? 'needs_support' : 'competent',
          radar: { ...sub.competencyScores },
        });
      } else {
        existing.experimentsCount += 1;
        existing.totalScoreSum += subScore;
        const avg = Math.round(existing.totalScoreSum / existing.experimentsCount);
        existing.status = avg >= 85 ? 'mastery' : avg < 70 ? 'needs_support' : 'competent';
        if (new Date(sub.submittedAt).getTime() > new Date(existing.lastActive).getTime()) {
          existing.lastActive = new Date(sub.submittedAt).toLocaleDateString();
          existing.radar = { ...sub.competencyScores };
        }
      }
    });

    return Array.from(studentMap.values()).map((st) => ({
      ...st,
      avgScore: Math.round(st.totalScoreSum / st.experimentsCount),
    }));
  }, [submissions]);

  const filteredStudents = classStudents.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || st.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

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
            <span className="text-xs text-stone-500">Academic Year 2025–2026</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
            Class Cohorts & Student Rosters
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Manage laboratory cohorts, monitor real-time practical competency health, and inspect student progress.
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
          const isSelected = cls.id === selectedClassId;
          const avgCompetency = ((Object.values(cls.averageCompetencies) as number[]).reduce((a: number, b: number) => a + b, 0)) / 5;

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
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{cls.academicTerm}</p>

              <div className="mt-4 pt-4 border-t border-stone-200/80 dark:border-stone-800/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400">Roster</span>
                  <p className="font-bold text-stone-800 dark:text-stone-200">{cls.studentCount} Enrolled</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400">Class Average</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round(avgCompetency)}% Score</p>
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
              Live practical scores, experiment submissions, and competency flags.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search student or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 pl-8 pr-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 px-3 py-1.5 text-xs text-stone-800 dark:text-stone-200 focus:outline-none"
            >
              <option value="all">All Mastery Levels</option>
              <option value="mastery">Mastery (85%+)</option>
              <option value="competent">Competent (70-84%)</option>
              <option value="needs_support">Needs Support (&lt;70%)</option>
            </select>
          </div>
        </div>

        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
            <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-[11px] uppercase tracking-wider font-bold text-stone-500 dark:text-stone-400">
              <tr>
                <th className="px-4 py-3">Student Name & ID</th>
                <th className="px-4 py-3">Completed Labs</th>
                <th className="px-4 py-3">Recent Activity</th>
                <th className="px-4 py-3">Practical Score</th>
                <th className="px-4 py-3">Competency Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredStudents.map((st) => (
                <tr key={`roster-student-${st.id}`} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 dark:text-stone-100">{st.name}</p>
                        <p className="text-[10px] text-stone-400 font-mono">{st.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">{st.experimentsCount} Labs Verified</td>
                  <td className="px-4 py-3.5 text-stone-500">{st.lastActive}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      {st.avgScore}%
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
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate('/teacher/review')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <span>Inspect Log</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
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
