import React from 'react';
import { FlaskConical } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div
      id="auth-loading-screen"
      className="min-h-screen w-full flex flex-col items-center justify-center bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors duration-200"
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 dark:bg-amber-500 text-amber-400 dark:text-stone-950 shadow-md animate-pulse">
          <FlaskConical className="h-7 w-7 animate-bounce" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
            SimLab Competency Hub
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
            Loading your SimLab workspace...
          </p>
        </div>
        <div className="w-48 h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-amber-500 origin-left animate-pulse" />
        </div>
      </div>
    </div>
  );
};
