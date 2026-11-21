import React from 'react';
import { Settings, Shield, Lock, Database, Key } from 'lucide-react';

export const AdminSettingsView: React.FC = () => {
  return (
    <div id="admin-settings-view" className="space-y-6 max-w-4xl mx-auto">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/70 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <Settings className="h-3 w-3" />
            Security Configuration
          </span>
          <span className="text-xs text-stone-500 dark:text-stone-400">Environment & RBAC Rules</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
          Global Security & Session Parameters
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-300">
          Configure JWT session lifetimes, rate limit thresholds, and password complexity enforcement.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-500" />
          <span>Active Authentication Policies</span>
        </h3>

        <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-900 dark:text-stone-100">JWT Token Lifespan</p>
              <p className="text-[11px] text-stone-500">Access tokens automatically expire and rotate</p>
            </div>
            <span className="font-mono font-bold text-stone-800 dark:text-stone-200">24 Hours</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-900 dark:text-stone-100">Password Hashing Algorithm</p>
              <p className="text-[11px] text-stone-500">Salt rounds parameter for user credentials</p>
            </div>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">bcrypt (10 rounds)</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-900 dark:text-stone-100">Database Token Encryption</p>
              <p className="text-[11px] text-stone-500">Sessions stored as irreversible digests in PostgreSQL</p>
            </div>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">SHA-256 Hashes</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-900 dark:text-stone-100">Role Boundary Enforcement</p>
              <p className="text-[11px] text-stone-500">HTTP 403 Forbidden interceptor for cross-role attempts</p>
            </div>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">Strict Server RBAC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
