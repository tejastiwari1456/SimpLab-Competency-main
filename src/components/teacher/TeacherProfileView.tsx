import React from 'react';
import { Users, Mail, Building, ShieldCheck, BookOpen, Calendar, Award } from 'lucide-react';
import { CurrentUser } from '../../types';
import { RoleBadge } from '../common/RoleBadge';

interface TeacherProfileViewProps {
  currentUser: CurrentUser;
}

export const TeacherProfileView: React.FC<TeacherProfileViewProps> = ({ currentUser }) => {
  return (
    <div id="teacher-profile-view" className="space-y-6 max-w-3xl mx-auto">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-900 dark:bg-indigo-600 text-2xl font-bold text-white shadow-sm">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                {currentUser.name}
              </h2>
              <RoleBadge role="teacher" />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">{currentUser.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-4 border-t border-stone-100 dark:border-stone-800 text-xs">
          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Department & Institution
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              {currentUser.institution || 'Department of Physics & Biophysics • Delhi University'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" /> Academic Designation
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              Associate Professor & Lab In-Charge
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Teaching Cohorts
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              PHY-301 (Optics), BIO-204 (Molecular Biology)
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Authorization Scope
            </span>
            <p className="font-semibold text-indigo-600 dark:text-indigo-400">
              Instructor Portal • Assessment Grading • Internal Marks Export
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
