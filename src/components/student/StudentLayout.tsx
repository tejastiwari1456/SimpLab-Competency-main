import React, { useState } from 'react';
import { CurrentUser, CompetencyKey, Assignment, StudentSubmission, ClassCourse } from '../../types';
import { AppShell } from '../navigation/AppShell';
import { StudentDashboardView } from './StudentDashboardView';
import { StudentClassesView } from './StudentClassesView';
import { StudentExperimentsView } from './StudentExperimentsView';
import { StudentAssignmentsView } from './StudentAssignmentsView';
import { StudentCompetenciesView } from './StudentCompetenciesView';
import { StudentScenariosView } from './StudentScenariosView';
import { StudentProgressView } from './StudentProgressView';
import { StudentProfileView } from './StudentProfileView';

interface StudentLayoutProps {
  currentUser: CurrentUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  classes: ClassCourse[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  studentSubmissionsError: string;
  competencyScores: Record<CompetencyKey, number>;
  competencyScoresError: string;
  onTaskCompleted: (taskId: string, score: number, competency: CompetencyKey) => void;
  onAllCompleted: (totalScore: number, maxScore: number,assignmentId: string, experimentId: string) => Promise<void>;
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
  classes,
  assignments,
  submissions,
  studentSubmissionsError,
  competencyScores,
  competencyScoresError,
  onTaskCompleted,
  onAllCompleted,
}) => {
  const [selectedExpId, setSelectedExpId] = useState<string>('exp-convex-lens');

  // Match student sub-route
  const renderStudentView = () => {
    switch (currentPath) {
      case '/student/classes':
        return <StudentClassesView classes={classes} onNavigate={onNavigate} />;
      case '/student/experiments':
        return (
          <StudentExperimentsView
            selectedExpId={selectedExpId}
            assignments={assignments}
            onSelectExperiment={setSelectedExpId}
            onTaskCompleted={onTaskCompleted}
            onAllCompleted={onAllCompleted}
            isDark={isDark}
          />
        );
      case '/student/assignments':
        return (
          <StudentAssignmentsView
            assignments={assignments}
            onSelectExperiment={setSelectedExpId}
            onNavigate={onNavigate}
          />
        );
      case '/student/competencies':
        return (
          <StudentCompetenciesView
            submissions={submissions}
            activeScores={competencyScores}
            competencyScoresError={competencyScoresError}
            classAverageScores={classes[0]?.averageCompetencies || {
              setup_adherence: 80,
              measurement_precision: 75,
              data_interpretation: 78,
              troubleshooting_safety: 82,
              experimental_design: 76,
            }}
            isDark={isDark}
          />
        );
      case '/student/scenarios':
        return <StudentScenariosView onTaskCompleted={onTaskCompleted} />;
      case '/student/progress':
        return (
          <StudentProgressView
            competencyScores={competencyScores}
            submissions={submissions}
            currentUser={currentUser}
            onPractice={(expId) => {
              setSelectedExpId(expId);
              onNavigate('/student/experiments');
            }}
            onTaskCompleted={onTaskCompleted}
          />
        );
      case '/student/profile':
        return (
          <StudentProfileView
            currentUser={currentUser}
            competencyScores={competencyScores}
          />
        );
      case '/student/dashboard':
      case '/student':
      default:
        return (
          <StudentDashboardView
            currentUser={currentUser}
            competencyScores={competencyScores}
            assignments={assignments}
            submissions={submissions}
            studentSubmissionsError={studentSubmissionsError}
            onNavigate={onNavigate}
            onSelectExperiment={setSelectedExpId}
            isDark={isDark}
          />
        );
    }
  };

  return (
    <AppShell
      id="student-application-shell"
      currentRole="student"
      currentUser={currentUser}
      currentPath={currentPath}
      onNavigate={onNavigate}
      onLogout={onLogout}
      isDark={isDark}
      onToggleDarkMode={onToggleDarkMode}
    >
      {renderStudentView()}
    </AppShell>
  );
};
