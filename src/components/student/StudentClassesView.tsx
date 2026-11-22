import React from 'react';
import { GraduationCap } from 'lucide-react';
import { ClassCourse } from '../../types';

interface StudentClassesViewProps {
  classes: ClassCourse[];
  error?: string;
  onNavigate: (path: string) => void;
}

export const StudentClassesView: React.FC<StudentClassesViewProps> = ({
  classes,
  error,
  onNavigate,
}) => {
  return (
    <div id="student-classes-view" className="space-y-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <GraduationCap className="h-3 w-3" />
            Enrolled Classes
          </span>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {classes[0] ? `${classes[0].semester} • ${classes[0].academicYear}` : 'Active Cohorts'}
          </span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
          My Laboratory Courses & Cohorts
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-300">
          Active syllabus lab sections with continuous assessment and internal credit weighting.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {classes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {classes.map((cls) => {
            const values = Object.values(cls.averageCompetencies || {}).map((v) => Number(v) || 0);
            const avgMastery =
              values.length > 0
                ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
                : 0;

            return (
              <div
                key={cls.id}
                className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-900 dark:text-amber-300">
                      {cls.code}
                    </span>
                    <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                      {cls.enrollmentStatus || 'active'}
                    </span>
                  </div>
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {cls.semester} • {cls.academicYear}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {cls.name}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {cls.department}
                  </p>
                </div>

                <div className="rounded-lg border border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 px-3 py-2 text-xs flex items-center justify-between gap-2">
                  <div>
                    <span className="text-stone-500 dark:text-stone-400 block text-[10px] uppercase font-bold">
                      Assigned Faculty
                    </span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {cls.facultyName || 'Faculty Coordinator'}
                    </span>
                  </div>
                  {cls.enrolledAt && (
                    <div className="text-right">
                      <span className="text-stone-500 dark:text-stone-400 block text-[10px] uppercase font-bold">
                        Enrolled On
                      </span>
                      <span className="font-medium text-stone-700 dark:text-stone-300">
                        {new Date(cls.enrolledAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
                  <div>
                    <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Cohort Size</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {cls.studentCount} Students
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Assigned Labs</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {cls.assignmentCount ?? 0} Active
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Class Average</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {avgMastery > 0 ? `${avgMastery}% Mastery` : 'In progress'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onNavigate('/student/assignments')}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    View Assigned Labs & Tasks →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-xs text-stone-500 dark:text-stone-400">
          You are not currently enrolled in any laboratory classes. Contact your faculty coordinator to be added to a course cohort.
        </div>
      )}
    </div>
  );
};
