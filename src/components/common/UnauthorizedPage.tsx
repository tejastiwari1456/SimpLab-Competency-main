import React from 'react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { UserRole } from '../../types';

interface UnauthorizedPageProps {
  currentRole: UserRole | null;
  attemptedPath?: string;
  onNavigate: (path: string) => void;
}

export const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({
  currentRole,
  attemptedPath = '',
  onNavigate,
}) => {
  const getSafeDashboard = (role: UserRole | null): string => {
    switch (role) {
      case 'student':
        return '/student/dashboard';
      case 'teacher':
        return '/teacher/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  };

  const safeDashboard = getSafeDashboard(currentRole);

  return (
    <div
      id="unauthorized-page-403"
      className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div className="max-w-md w-full rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-stone-900 p-8 shadow-sm transition-colors">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          HTTP 403 • FORBIDDEN
        </div>

        <h1 className="mt-3 text-xl font-bold text-stone-900 dark:text-stone-100">
          Access Denied
        </h1>

        <p className="mt-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
          Your authenticated role{' '}
          <strong className="font-semibold text-stone-900 dark:text-stone-100 uppercase">
            {currentRole || 'Unauthenticated'}
          </strong>{' '}
          does not have permission to access {attemptedPath ? <code className="font-mono text-rose-600 dark:text-rose-400 font-bold">{attemptedPath}</code> : 'this restricted portal'}.
        </p>

        <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
          SimLab enforces strict server-authoritative role boundary isolation.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            id="unauthorized-return-dashboard-btn"
            onClick={() => onNavigate(safeDashboard)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Return to My Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
