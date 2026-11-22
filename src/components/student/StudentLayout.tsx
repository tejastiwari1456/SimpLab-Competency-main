import React, { useState } from 'react';
import {
  CurrentUser,
  CompetencyKey,
  Assignment,
  StudentSubmission,
  ClassCourse,
  StudentCompetencyReport,
  VivaSessionRecord,
  StudentRecommendation,
  StudentNotification,
} from '../../types';
import type { ExperimentSubmitPayload } from '../../App';
import { AppShell } from '../navigation/AppShell';
import { StudentDashboardView } from './StudentDashboardView';
import { StudentClassesView } from './StudentClassesView';
import { StudentExperimentsView } from './StudentExperimentsView';
import { StudentAssignmentsView } from './StudentAssignmentsView';
import { StudentCompetenciesView } from './StudentCompetenciesView';
import { StudentScenariosView } from './StudentScenariosView';
import { StudentProgressView } from './StudentProgressView';
import { StudentProfileView } from './StudentProfileView';

const ZERO_SCORES: Record<CompetencyKey, number> = {
  setup_adherence: 0,
  measurement_precision: 0,
  data_interpretation: 0,
  troubleshooting_safety: 0,
  experimental_design: 0,
};

interface StudentLayoutProps {
  currentUser: CurrentUser;
  token: string | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  isLoadingData: boolean;
  classes: ClassCourse[];
  studentClassesError?: string;
  assignments: Assignment[];
  submissions: StudentSubmission[];
  studentSubmissionsError: string;
  competencyScores: Record<CompetencyKey, number>;
  competencyReport: StudentCompetencyReport | null;
  competencyScoresError: string;
  vivaSessions: VivaSessionRecord[];
  recommendations: StudentRecommendation[];
  notifications: StudentNotification[];
  unreadNotificationsCount: number;
  onMarkNotificationRead: (key: string) => void;
  onMarkAllNotificationsRead: () => void;
  onRefreshStudentData: () => Promise<void>;
  onTaskCompleted: (taskId: string, score: number, competency: CompetencyKey) => void;
  onAllCompleted: (payload: ExperimentSubmitPayload) => Promise<StudentSubmission>;
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({
  currentUser,
  token,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
  isLoadingData,
  classes,
  studentClassesError = '',
  assignments,
  submissions,
  studentSubmissionsError,
  competencyScores,
  competencyReport,
  competencyScoresError,
  vivaSessions,
  recommendations,
  notifications,
  unreadNotificationsCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onRefreshStudentData,
  onTaskCompleted,
  onAllCompleted,
}) => {
  const [selectedExpId, setSelectedExpId] = useState<string>('exp-convex-lens');

  const classAverageScores = classes[0]?.averageCompetencies || ZERO_SCORES;

  const handleLaunchExperiment = (expId: string) => {
    setSelectedExpId(expId);
    onNavigate('/student/experiments');
  };

  const handleNotificationSelect = (notif: StudentNotification) => {
    if (notif.experimentId && notif.actionPath === '/student/experiments') {
      setSelectedExpId(notif.experimentId);
    }
    onNavigate(notif.actionPath);
  };

  const renderStudentView = () => {
    switch (currentPath) {
      case '/student/classes':
        return (
          <StudentClassesView
            classes={classes}
            error={studentClassesError}
            onNavigate={onNavigate}
          />
        );
      case '/student/experiments':
        return (
          <StudentExperimentsView
            selectedExpId={selectedExpId}
            assignments={assignments}
            onSelectExperiment={setSelectedExpId}
            onNavigate={onNavigate}
            onVivaCompleted={() => {
              void onRefreshStudentData();
            }}
            onTaskCompleted={onTaskCompleted}
            onAllCompleted={onAllCompleted}
            isDark={isDark}
          />
        );
      case '/student/assignments':
        return (
          <StudentAssignmentsView
            assignments={assignments}
            submissions={submissions}
            isLoading={isLoadingData}
            onSelectExperiment={setSelectedExpId}
            onNavigate={onNavigate}
          />
        );
      case '/student/competencies':
        return (
          <StudentCompetenciesView
            currentUser={currentUser}
            token={token}
            isLoading={isLoadingData}
            submissions={submissions}
            activeScores={competencyScores}
            competencyReport={competencyReport}
            competencyScoresError={competencyScoresError}
            classAverageScores={classAverageScores}
            vivaSessions={vivaSessions}
            recommendations={recommendations}
            onLaunchExperiment={handleLaunchExperiment}
            isDark={isDark}
          />
        );
      case '/student/scenarios':
        return <StudentScenariosView onTaskCompleted={onTaskCompleted} />;
      case '/student/progress':
        return (
          <StudentProgressView
            token={token}
            competencyScores={competencyScores}
            competencyReport={competencyReport}
            submissions={submissions}
            vivaSessions={vivaSessions}
            currentUser={currentUser}
            onPractice={handleLaunchExperiment}
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
            isLoading={isLoadingData}
            classes={classes}
            competencyScores={competencyScores}
            competencyReport={competencyReport}
            classAverageScores={classAverageScores}
            assignments={assignments}
            submissions={submissions}
            vivaSessions={vivaSessions}
            recommendations={recommendations}
            notifications={notifications}
            studentSubmissionsError={studentSubmissionsError}
            onMarkNotificationRead={onMarkNotificationRead}
            onNotificationSelect={handleNotificationSelect}
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
      studentNotifications={notifications}
      unreadNotificationsCount={unreadNotificationsCount}
      onMarkNotificationRead={onMarkNotificationRead}
      onMarkAllNotificationsRead={onMarkAllNotificationsRead}
      onNotificationSelect={handleNotificationSelect}
    >
      {renderStudentView()}
    </AppShell>
  );
};
