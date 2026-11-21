import React from 'react';
import { GraduationCap, Users, Shield } from 'lucide-react';
import { UserRole } from '../../types';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  switch (role) {
    case 'student':
      return (
        <span
          id="read-only-role-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-300 select-none shadow-xs ${className}`}
          title="Role: Student (Read-Only)"
        >
          <GraduationCap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>🎓 Student</span>
        </span>
      );
    case 'teacher':
      return (
        <span
          id="read-only-role-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 text-xs font-semibold text-indigo-900 dark:text-indigo-300 select-none shadow-xs ${className}`}
          title="Role: Faculty (Read-Only)"
        >
          <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>👩‍🏫 Faculty</span>
        </span>
      );
    case 'admin':
      return (
        <span
          id="read-only-role-badge"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-xs font-semibold text-rose-900 dark:text-rose-300 select-none shadow-xs ${className}`}
          title="Role: Administrator (Read-Only)"
        >
          <Shield className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          <span>🛡️ Admin</span>
        </span>
      );
    default:
      return null;
  }
};
