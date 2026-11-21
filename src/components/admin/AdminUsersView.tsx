import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Shield, AlertTriangle, CheckCircle2, UserX, RefreshCw } from 'lucide-react';
import { RoleBadge } from '../common/RoleBadge';

interface AdminUsersViewProps {
  token: string | null;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({ token }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleStatusChange = async (userId: string, newStatus: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') => {
    if (!token) return;
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
        );
      }
    } catch {
      // Ignore errors
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.institution || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || (u.role || '').toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  return (
    <div id="admin-users-view" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Users className="h-3 w-3" />
              Directory & Access Control
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">PostgreSQL Users Table</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
            User Accounts & Role Permissions
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Manage authenticated users, enforce account suspensions, and monitor institutional memberships.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or institution..."
            className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 pl-9 pr-4 py-2 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['all', 'student', 'teacher', 'admin'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                roleFilter === r
                  ? 'bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-medium">
            <tr>
              <th className="pb-2.5">User</th>
              <th className="pb-2.5">Role</th>
              <th className="pb-2.5">Institution</th>
              <th className="pb-2.5">Status</th>
              <th className="pb-2.5">Last Login</th>
              <th className="pb-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {filtered.map((u) => {
              const normalizedRole = (u.role || 'student').toLowerCase();
              return (
                <tr key={u.id} className="text-stone-800 dark:text-stone-200">
                  <td className="py-3">
                    <p className="font-semibold text-stone-900 dark:text-stone-100">{u.name}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">{u.email}</p>
                  </td>
                  <td className="py-3">
                    <RoleBadge role={normalizedRole as any} />
                  </td>
                  <td className="py-3 text-stone-600 dark:text-stone-300">
                    {u.institution || '—'}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : u.status === 'SUSPENDED'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {u.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 text-stone-500 dark:text-stone-400 text-[11px]">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.status !== 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={updatingId === u.id}
                          onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                          className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingId === u.id}
                          onClick={() => handleStatusChange(u.id, 'SUSPENDED')}
                          className="rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
