import React from 'react';
import {
  CompetencyKey,
  CurrentUser,
  StudentCompetencyReport,
  StudentRecommendation,
  StudentSubmission,
  VivaSessionRecord,
} from '../../types';
import { StudentAnalytics } from '../analytics/StudentAnalytics';

interface StudentCompetenciesViewProps {
  currentUser: CurrentUser;
  token: string | null;
  isLoading: boolean;
  submissions: StudentSubmission[];
  activeScores: Record<CompetencyKey, number>;
  competencyReport: StudentCompetencyReport | null;
  competencyScoresError: string;
  classAverageScores: Record<CompetencyKey, number>;
  vivaSessions: VivaSessionRecord[];
  recommendations: StudentRecommendation[];
  onLaunchExperiment: (expId: string) => void;
  isDark: boolean;
}

export const StudentCompetenciesView: React.FC<StudentCompetenciesViewProps> = ({
  currentUser,
  token,
  isLoading,
  submissions,
  activeScores,
  competencyReport,
  competencyScoresError,
  classAverageScores,
  vivaSessions,
  recommendations,
  onLaunchExperiment,
  isDark,
}) => {
  return (
    <div id="student-competencies-view">
      {competencyScoresError && (
        <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
          {competencyScoresError}
        </div>
      )}

      <StudentAnalytics
        currentUser={currentUser}
        token={token}
        isLoading={isLoading}
        submissions={submissions}
        activeScores={activeScores}
        competencyReport={competencyReport}
        classAverageScores={classAverageScores}
        vivaSessions={vivaSessions}
        recommendations={recommendations}
        onLaunchExperiment={onLaunchExperiment}
        isDark={isDark}
      />
    </div>
  );
};
