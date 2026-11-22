import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Building2,
  History,
  Activity,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { CurrentUser } from '../../types';
import { EXPERIMENTS } from '../../data/mockData';

interface AdminDashboardViewProps {
  currentUser: CurrentUser;
  onNavigate: (path: string) => void;
  token: string | null;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  onNavigate,
  token,
}) => {
  const [usersCount, setUsersCount] = useState<number>(0);
  const [auditLogsCount, setAuditLogsCount] = useState<number>(0);
  const [institutionsCount, setInstitutionsCount] = useState<number>(0);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    Promise.all([
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Failed to load users.');
        return d;
      }),
      fetch('/api/admin/audit-logs?limit=5', { headers: { Authorization: `Bearer ${token}` } }).then(
        async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Failed to load audit logs.');
          return d;
        }
      ),
      fetch('/api/admin/institutions', { headers: { Authorization: `Bearer ${token}` } }).then(
        async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Failed to load institutions.');
          return d;
        }
      ),
    ])
      .then(([usersData, auditData, instData]) => {
        if (cancelled) return;
        if (Array.isArray(usersData?.users)) setUsersCount(usersData.users.length);
        const evts = Array.isArray(auditData?.events)
          ? auditData.events
          : Array.isArray(auditData?.logs)
          ? auditData.logs
          : [];
        setRecentEvents(evts.slice(0, 5));
        setAuditLogsCount(evts.length);
        if (Array.isArray(instData?.institutions)) {
          setInstitutionsCount(instData.institutions.length);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load admin overview.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div id="admin-dashboard-view" className="space-y-6">
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs sm:flex-row sm:items-center transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
              <Shield className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              Administrative Security Control Plane
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {currentUser.name}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
            System Overview & Governance
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
            Centralized platform security, institutional tenant controls, user status revocation, and live audit inspection.
          </p>
        </div>

        <div className="flex sm:flex-col items-center justify-between sm:justify-center rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-4 text-center min-w-[160px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
            Access Policy
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-stone-900 dark:text-rose-400">
              Enforced
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-0.5">
            <CheckCircle2 className="h-3 w-3" /> Role-Based Guard
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => onNavigate('/admin/users')}
          className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Total Users</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {loading ? '—' : usersCount}
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <span>Students, Teachers & Admins</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        <div
          onClick={() => onNavigate('/admin/audit')}
          className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Security Events</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400">
              <History className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {loading ? '—' : auditLogsCount}
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <span>Recent Audit Records</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        <div
          onClick={() => onNavigate('/admin/institutions')}
          className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Institutions</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {loading ? '—' : `${institutionsCount} ${institutionsCount === 1 ? 'Institution' : 'Institutions'}`}
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <span>Active Academic Tenants</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        <div
          onClick={() => onNavigate('/admin/settings')}
          className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Lab Modules</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
            {EXPERIMENTS.length} Active
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
            <span>Registered Apparatus Catalog</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>
      </div>

      {/* Real-Time Security Audit Stream */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <History className="h-4 w-4 text-rose-500" />
            <span>Recent Authentication & Authorization Events</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('/admin/audit')}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            Full Audit Trail →
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-2">
            Loading security audit events...
          </p>
        ) : recentEvents.length > 0 ? (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {recentEvents.map((evt, idx) => (
              <div key={evt.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                    {evt.event_type}
                  </span>
                  <div>
                    <p className="font-medium text-stone-800 dark:text-stone-200">
                      User ID: {evt.user_id ? evt.user_id.slice(0, 14) : 'Anonymous'}
                    </p>
                    <p className="text-[10px] text-stone-500 dark:text-stone-400">
                      IP: {evt.ip_address || '127.0.0.1'} • {evt.user_agent ? evt.user_agent.slice(0, 40) : 'Web'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  {new Date(evt.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-2">
            No security audit events recorded in this active window.
          </p>
        )}
      </div>
    </div>
  );
};
