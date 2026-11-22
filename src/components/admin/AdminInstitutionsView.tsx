import React, { useState, useEffect } from 'react';
import { Building2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface InstitutionSummary {
  id: string;
  name: string;
  students: number;
  teachers: number;
  admins: number;
  activeUsers: number;
  totalUsers: number;
  classCount: number;
  departments: string[];
  status: string;
}

interface AdminInstitutionsViewProps {
  token: string | null;
}

export const AdminInstitutionsView: React.FC<AdminInstitutionsViewProps> = ({ token }) => {
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchInstitutions = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/institutions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load institutional metrics.');
      }
      setInstitutions(Array.isArray(data.institutions) ? data.institutions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load institutions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, [token]);

  return (
    <div id="admin-institutions-view" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
              <Building2 className="h-3 w-3" />
              Institutional Governance
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Live User & Class Aggregation
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            Registered Universities & Academic Campuses
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Live multi-tenant enrollment, faculty headcount, and active laboratory cohort metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchInstitutions}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-xs text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Loading institutional records...</span>
        </div>
      ) : institutions.length === 0 ? (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-center text-xs text-stone-500">
          No institutional records found in the user directory yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {institutions.map((inst) => (
            <div
              key={inst.id}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                  {inst.status}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {inst.classCount} {inst.classCount === 1 ? 'Cohort' : 'Cohorts'}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {inst.name}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {inst.departments.length > 0
                    ? inst.departments.join(', ')
                    : 'General Academic Directory'}
                </p>
              </div>

              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-stone-500 block">Students</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {inst.students}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block">Faculty</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {inst.teachers}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block">Active Users</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {inst.activeUsers} / {inst.totalUsers}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
