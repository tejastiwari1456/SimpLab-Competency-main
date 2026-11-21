import React, { useState } from 'react';
import { Compass, ArrowRight } from 'lucide-react';
import { SCENARIO_MODULES } from '../../data/mockData';
import { ScenarioModuleView } from '../scenarios/ScenarioModuleView';
import { CompetencyKey } from '../../types';

interface StudentScenariosViewProps {
  onTaskCompleted: (taskId: string, score: number, competency: CompetencyKey) => void;
}

export const StudentScenariosView: React.FC<StudentScenariosViewProps> = ({ onTaskCompleted }) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const activeScenario = SCENARIO_MODULES.find((s) => s.id === activeScenarioId);

  if (activeScenarioId && activeScenario) {
    return (
      <ScenarioModuleView
        scenario={activeScenario}
        onBackToScenarios={() => setActiveScenarioId(null)}
        onScenarioCompleted={(scenId, score) => {
          onTaskCompleted(scenId, score, 'experimental_design');
        }}
      />
    );
  }

  return (
    <div id="student-scenarios-view" className="space-y-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/70 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
            <Compass className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            Scenario-Based Modules
          </span>
          <span className="text-xs text-stone-500 dark:text-stone-400">Problem-Centric Engineering</span>
        </div>
        <h2 className="mt-1 text-xl font-bold text-stone-900 dark:text-stone-100">
          Real-World Scientific & Industrial Scenarios
        </h2>
        <p className="text-xs text-stone-600 dark:text-stone-300">
          Apply empirical laboratory measurements to solve authentic engineering constraints, circuit diagnosis, and analytical chemistry quality control problems.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {SCENARIO_MODULES.map((scen) => (
          <div
            key={scen.id}
            className="flex flex-col justify-between rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 shadow-xs space-y-4 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                  {scen.badge}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400">{scen.domain}</span>
              </div>
              <h3 className="mt-2 text-base font-bold text-stone-900 dark:text-stone-100">
                {scen.title}
              </h3>
              <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                Role: {scen.realWorldRole}
              </p>
              <p className="mt-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {scen.brief}
              </p>
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800 pt-4 flex items-center justify-between">
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {scen.tasks.length} Decision Steps
              </span>
              <button
                type="button"
                onClick={() => setActiveScenarioId(scen.id)}
                className="flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-amber-500 px-4 py-2 text-xs font-semibold text-white dark:text-stone-950 shadow-xs hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <span>Launch Scenario</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
