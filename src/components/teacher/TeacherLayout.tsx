import React, { useState } from 'react';
import { CurrentUser, ClassCourse, Assignment, StudentSubmission, Experiment } from '../../types';
import { AppShell } from '../navigation/AppShell';
import { TeacherOverviewView } from './TeacherOverviewView';
import { TeacherClassesView } from './TeacherClassesView';
import { TeacherAssignmentsView } from './TeacherAssignmentsView';
import { TeacherExperimentsView } from './TeacherExperimentsView';
import { TeacherAnalyticsView } from './TeacherAnalyticsView';
import { TeacherReviewView } from './TeacherReviewView';
import { TeacherProfileView } from './TeacherProfileView';

interface TeacherLayoutProps {
  currentUser: CurrentUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  classes: ClassCourse[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  experiments: Experiment[];
  onCreateAssignment: (assignment: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>) => void;
}

export const TeacherLayout: React.FC<TeacherLayoutProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
  classes,
  assignments,
  submissions,
  experiments,
  onCreateAssignment,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || 'cls-1');

  const handleQuickAssignModal = () => {
    onNavigate('/teacher/assignments');
  };

  const renderTeacherView = () => {
    switch (currentPath) {
      case '/teacher/classes':
      case '/teacher/students':
        return (
          <TeacherClassesView
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            submissions={submissions}
            onNavigate={onNavigate}
          />
        );

      case '/teacher/assignments':
        return (
          <TeacherAssignmentsView
            assignments={assignments}
            classes={classes}
            experiments={experiments}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            onCreateAssignment={onCreateAssignment}
          />
        );

      case '/teacher/experiments':
        return (
          <TeacherExperimentsView
            experiments={experiments}
            onNavigate={onNavigate}
            onQuickAssignExp={(expId) => {
              onNavigate('/teacher/assignments');
            }}
          />
        );

      case '/teacher/analytics':
        return (
          <TeacherAnalyticsView
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            submissions={submissions}
            isDark={isDark}
          />
        );

      case '/teacher/review':
      case '/teacher/reports':
        return (
          <TeacherReviewView
            submissions={submissions}
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
          />
        );

      case '/teacher/profile':
        return <TeacherProfileView currentUser={currentUser} />;

      case '/teacher/dashboard':
      case '/teacher':
      default:
        return (
          <TeacherOverviewView
            classes={classes}
            assignments={assignments}
            submissions={submissions}
            experiments={experiments}
            selectedClassId={selectedClassId}
            onSelectClassId={setSelectedClassId}
            onNavigate={onNavigate}
            onQuickAssignModal={handleQuickAssignModal}
            isDark={isDark}
          />
        );
    }
  };

  return (
    <AppShell
      id="teacher-application-shell"
      currentRole="teacher"
      currentUser={currentUser}
      currentPath={currentPath}
      onNavigate={onNavigate}
      onLogout={onLogout}
      isDark={isDark}
      onToggleDarkMode={onToggleDarkMode}
      facultyClasses={classes}
      selectedFacultyClassId={selectedClassId}
      onSelectFacultyClassId={setSelectedClassId}
      onFacultyQuickAssign={handleQuickAssignModal}
    >
      {renderTeacherView()}
    </AppShell>
  );
};
