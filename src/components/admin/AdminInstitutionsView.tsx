import React from 'react';
import { Building2, Shield, Users, Server } from 'lucide-react';

export const AdminInstitutionsView: React.FC = () => {
  const institutions = [
    {
      id: 'inst-1',
      name: 'Delhi University',
      campus: 'North Campus',
      departments: ['Physics', 'Chemistry', 'Biotechnology'],
      activeStudents: 1420,
      activeFaculty: 48,
      status: 'VERIFIED',
    },
    {
      id: 'inst-2',
      name: 'Indian Institute of Technology (IIT) Delhi',
      campus: 'Hauz Khas',
      departments: ['Applied Optics', 'Electrical Engineering'],
      activeStudents: 850,
      activeFaculty: 32,
      status: 'VERIFIED',
    },
    {
      id: 'inst-3',
      name: 'Jawaharlal Nehru University (JNU)',
      campus: 'New Delhi',
      departments: ['School of Physical Sciences'],
      activeStudents: 620,
      activeFaculty: 22,
      status: 'VERIFIED',
    },
  ];

  return (
    <div id="admin-institutions-view" className="space-y-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            <Building2 className="h-3 w-3" />
            Tenant Multi-Tenancy
          </span>
          <span className="text-xs text-stone-500 dark:text-stone-400">Institutional Governance</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
          Partner Universities & Laboratory Campuses
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-300">
          Manage institutional tenant domains, department allocations, and enterprise single sign-on parameters.
        </p>
      </div>

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
              <span className="text-xs text-stone-500 dark:text-stone-400">{inst.campus}</span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {inst.name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {inst.departments.join(', ')}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-stone-500 block">Enrolled Students</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">{inst.activeStudents}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 block">Active Faculty</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">{inst.activeFaculty}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
