import React, { useState, useEffect } from 'react';
import { History, Shield, RefreshCw, Filter, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AdminAuditLogsViewProps {
  token: string | null;
}

export const AdminAuditLogsView: React.FC<AdminAuditLogsViewProps> = ({ token }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');

  const fetchAuditLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.events) {
        setEvents(data.events);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [token]);

  const filteredEvents = events.filter((e) => {
    if (eventTypeFilter === 'ALL') return true;
    return e.event_type === eventTypeFilter;
  });

  return (
    <div id="admin-audit-logs-view" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/70 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
              <History className="h-3 w-3" />
              Security Audit Trail
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">PostgreSQL auth_events Table</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            Authentication & Authorization Events
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Immutable system audit logs detailing registrations, logins, token rotations, password resets, and session revocations.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAuditLogs}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Event Filters */}
      <div className="flex flex-wrap gap-1.5">
        {['ALL', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'TOKEN_REFRESH', 'LOGOUT', 'REGISTER', 'PASSWORD_CHANGE'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setEventTypeFilter(f)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              eventTypeFilter === f
                ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-medium">
            <tr>
              <th className="pb-2.5">Event</th>
              <th className="pb-2.5">User ID</th>
              <th className="pb-2.5">IP Address</th>
              <th className="pb-2.5">User Agent</th>
              <th className="pb-2.5">Metadata</th>
              <th className="pb-2.5 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono text-[11px]">
            {filteredEvents.map((evt) => (
              <tr key={evt.id} className="text-stone-800 dark:text-stone-200">
                <td className="py-2.5">
                  <span
                    className={`inline-block rounded px-2 py-0.5 font-bold ${
                      evt.event_type.includes('SUCCESS')
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : evt.event_type.includes('FAILURE') || evt.event_type.includes('DETECTED')
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {evt.event_type}
                  </span>
                </td>
                <td className="py-2.5 text-stone-600 dark:text-stone-300">
                  {evt.user_id ? evt.user_id.slice(0, 10) + '...' : 'ANONYMOUS'}
                </td>
                <td className="py-2.5">{evt.ip_address || '127.0.0.1'}</td>
                <td className="py-2.5 text-stone-500 truncate max-w-[120px]">
                  {evt.user_agent || 'Unknown'}
                </td>
                <td className="py-2.5 text-stone-500">
                  {typeof evt.metadata === 'object' ? JSON.stringify(evt.metadata) : evt.metadata || '—'}
                </td>
                <td className="py-2.5 text-right text-stone-500">
                  {new Date(evt.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
