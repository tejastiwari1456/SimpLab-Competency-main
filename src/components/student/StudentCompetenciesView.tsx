import React from 'react';
import { CompetencyKey, StudentSubmission } from '../../types';
import { StudentAnalytics } from '../analytics/StudentAnalytics';

interface StudentCompetenciesViewProps {
  submissions: StudentSubmission[];
  activeScores: Record<CompetencyKey, number>;
  competencyScoresError:string;
  classAverageScores: Record<CompetencyKey, number>;
  isDark: boolean;
}

export const StudentCompetenciesView: React.FC<StudentCompetenciesViewProps> = ({
  submissions,
  activeScores,
  competencyScoresError,
  classAverageScores,
  isDark,
}) => {
  return (
    <div id="student-competencies-view">

      {/* Show competency API errors */}
      {competencyScoresError && (
        <p className="text-red-500 mb-4">
          {competencyScoresError}
        </p>
      )}

      <StudentAnalytics
        submissions={submissions}
        
        activeScores={activeScores}
        classAverageScores={classAverageScores}
        isDark={isDark}
      />
    </div>
  );
};
