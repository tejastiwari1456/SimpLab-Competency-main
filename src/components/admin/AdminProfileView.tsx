import React from 'react';
import { Shield, Mail, Building, Key, ShieldCheck, Lock } from 'lucide-react';
import { CurrentUser } from '../../types';
import { RoleBadge } from '../common/RoleBadge';

interface AdminProfileViewProps {
  currentUser: CurrentUser;
}

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({ currentUser }) => {
  return (
    <div id="admin-profile-view" className="space-y-6 max-w-3xl mx-auto">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950 dark:bg-rose-900 text-2xl font-bold text-rose-300 shadow-sm border border-rose-800">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                {currentUser.name}
              </h2>
              <RoleBadge role="admin" />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">{currentUser.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-4 border-t border-stone-100 dark:border-stone-800 text-xs">
          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Administrative Realm
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              {currentUser.institution || 'SimLab Global Systems Operations'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" /> Root Access Level
            </span>
            <p className="font-mono font-semibold text-rose-700 dark:text-rose-400">
              ROLE_SUPER_ADMIN
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Audit Compliance
            </span>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              PostgreSQL Session & Event Logging Active
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Security Scope
            </span>
            <p className="font-semibold text-stone-900 dark:text-stone-100">
              User Status Revocation, Tenant Governance, Audit Trail
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
