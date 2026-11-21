import React from 'react';
import { Users, GraduationCap, Calendar, Clock, BookOpen, CheckCircle2 } from 'lucide-react';
import { ClassCourse } from '../../types';

interface StudentClassesViewProps {
  classes: ClassCourse[];
  onNavigate: (path: string) => void;
}

export const StudentClassesView: React.FC<StudentClassesViewProps> = ({ classes, onNavigate }) => {
  return (
    <div id="student-classes-view" className="space-y-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <GraduationCap className="h-3 w-3" />
            Enrolled Classes
          </span>
          <span className="text-xs text-stone-500 dark:text-stone-400">Fall Semester 2026</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
          My Laboratory Courses & Cohorts
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-300">
          Active syllabus lab sections with continuous assessment and internal credit weighting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {classes.map((cls) => (
          <div
            key={cls.id}
            className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-900 dark:text-amber-300">
                {cls.code}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {cls.semester} • {cls.academicYear}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {cls.name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Department of {cls.department}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
              <div>
                <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Enrollment</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">{cls.studentCount} Students</span>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Class Average</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">82% Mastery</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('/student/assignments')}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                View Assignments & Tasks →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
