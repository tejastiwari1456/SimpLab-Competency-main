import React, { useState, useEffect } from 'react';
import type { TaskResponseState } from "./components/tasks/AutoGradedTaskPanel";
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoadingScreen } from './components/common/LoadingScreen';
import { UnauthorizedPage } from './components/common/UnauthorizedPage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { StudentLayout } from './components/student/StudentLayout';
import { TeacherLayout } from './components/teacher/TeacherLayout';
import { AdminLayout } from './components/admin/AdminLayout';
import {
  EXPERIMENTS
} from './data/mockData';
import {
  CurrentUser,
  UserRole,
  CompetencyKey,
  Assignment,
  StudentSubmission,
  CompetencyMilestone,
  StudentMilestoneStatus,
  ClassCourse,
} from './types';
import {
  detectNewlyUnlockedMilestones,
  getMilestoneStatuses,
  COMPETENCY_MILESTONES,
} from './data/milestonesData';
import { MilestoneCelebrationModal } from './components/badges/MilestoneCelebrationModal';
import { DigitalBadgeModal } from './components/badges/DigitalBadgeModal';

function AppContent() {
  const { user, role, token, isAuthenticated, isLoading, logout, refreshUser, setSession } = useAuth();

  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('simlab_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Client-side URL pathname routing state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  // Sync dark class on root document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('simlab_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('simlab_theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => setIsDark((prev) => !prev);

  // Browser History & Popstate event handling for URL changes
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // State for simulated experiments & assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [studentSubmissionsError, setStudentSubmissionsError] = useState("");
  


  // Load assignments belonging to the authenticated student.
useEffect(() => {
  if (!token || role !== 'student') {
    return;
  }

  let cancelled = false;

  const fetchStudentAssignments = async () => {
    try {
      const response = await fetch('/api/student/assignments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'Failed to fetch student assignments.'
        );
      }

      if (!Array.isArray(data.assignments)) {
        throw new Error('Invalid assignments response from server.');
      }

      if (!cancelled) {
        setAssignments(data.assignments);
        console.log(
          'Student assignments loaded from PostgreSQL:',
          data.assignments
        );
      }
    } catch (error) {
      if (!cancelled) {
        setAssignments([]);
        console.error('Error loading student assignments:', error);
      }
    }
  };

  void fetchStudentAssignments();

  return () => {
    cancelled = true;
  };
}, [token, role]);


  
  // Load saved submissions from PostgreSQL for the logged-in student
useEffect(() => {
  if (!token || role !== "student") return;

  const fetchStudentSubmissions = async () => {
    try {
      setStudentSubmissionsError("");

      const response = await fetch("/api/student/submissions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to fetch student submissions"
        );
      }

      if (!Array.isArray(data.submissions)) {
        throw new Error("Invalid submissions response from server");
      }

      setSubmissions(data.submissions);

    } catch (error) {
      console.error("Error fetching student submissions:", error);

      setStudentSubmissionsError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading submissions"
      );
    }
  };

  fetchStudentSubmissions();
}, [token, role]);


  
useEffect(() => {
  if (!token || role !== "teacher") return;

  const fetchAssignments = async () => {
    try {
      const response = await fetch("/api/teacher/assignments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch assignments");
      }

      setAssignments(data.assignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  fetchAssignments();
}, [token, role]);


const [classes, setClasses] = useState<ClassCourse[]>([]);
const [studentClassesError, setStudentClassesError] = useState("");

useEffect(() => {
  if (!token || role !== "student") return;

  let cancelled = false;

  const fetchStudentClasses = async () => {
    try {
      setStudentClassesError("");

      const response = await fetch("/api/student/classes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.message || "Failed to fetch student classes"
        );
      }

      if (!Array.isArray(data.classes)) {
        throw new Error("Invalid classes response from server");
      }

      if (!cancelled) {
        setClasses(data.classes);
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Error fetching student classes:", error);

        setStudentClassesError(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading classes"
        );
      }
    }
  };

  void fetchStudentClasses();

  return () => {
    cancelled = true;
  };
}, [token, role]);


// {studentClassesError && (
//   <p className="text-red-500">
//     Unable to load classes: {studentClassesError}
//   </p>
// )}


  // Fetch classes from PostgreSQL for the logged-in teacher
  useEffect(() => {
    if (!token || role !== 'teacher') {
      return;
    }

    const fetchTeacherClasses = async () => {
      try {
        const response = await fetch('/api/teacher/classes', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch classes: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.classes)) {
          throw new Error('Invalid classes response from server.');
        }

        const databaseClasses: ClassCourse[] = data.classes.map(
          (item: any) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            department: item.department,
            semester: item.semester,
            academicYear: item.academicYear,
            studentCount: item.studentCount,
            averageCompetencies: item.averageCompetencies,
            commonMisconceptions: item.commonMisconceptions,
          })
        );

        setClasses(databaseClasses);
      } catch (error) {
        console.error('Error loading teacher classes:', error);
      }
    };

    fetchTeacherClasses();
  }, [token, role]);


  // Active student's demonstrated competencies
  const [studentCompetencyScores, setStudentCompetencyScores] = useState<Record<CompetencyKey, number>>({
    setup_adherence: 95,
    measurement_precision: 88,
    data_interpretation: 94,
    troubleshooting_safety: 90,
    experimental_design: 92,
  });

  const [competencyScoresError, setCompetencyScoresError] = useState('');

  useEffect(() => {
  if (!token|| role !== "student") return;

  const fetchCompetencyScores = async () => {
    try {
      setCompetencyScoresError("");

      //const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const response = await fetch("/api/student/competencies", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to fetch competency scores"
        );
      }

      if (data.competencyScores === null) {
        setCompetencyScoresError(
          "No official competency results are available yet."
        );
        return;
      }

      if (
        typeof data.competencyScores !== "object" ||
        Array.isArray(data.competencyScores)
      ) {
        throw new Error("Invalid competency scores received from server");
      }

      setStudentCompetencyScores(data.competencyScores);
    } catch (error) {
      console.error("Error fetching competency scores:", error);

      setCompetencyScoresError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading competency scores"
      );
    }
  };

  fetchCompetencyScores();
}, [token, role]);

  // Milestone celebration popup state
  const [celebratedMilestone, setCelebratedMilestone] = useState<{
    milestone: CompetencyMilestone;
    score: number;
  } | null>(null);
  const [inspectedMilestone, setInspectedMilestone] = useState<StudentMilestoneStatus | null>(null);

  // Handle student task completion in virtual lab
  const handleTaskCompleted = (taskId: string, score: number, competency: CompetencyKey) => {
    setStudentCompetencyScores((prev) => {
      const currentVal = prev[competency] || 75;
      const boost = Math.min(99, currentVal + Math.max(2, Math.round(score * 0.2)));
      const nextScores = {
        ...prev,
        [competency]: boost,
      };

      // Detect if crossing a milestone threshold (e.g. reaching 90 in measurement precision)
      const newlyUnlocked = detectNewlyUnlockedMilestones(prev, nextScores);
      if (newlyUnlocked.length > 0) {
        setCelebratedMilestone({
          milestone: newlyUnlocked[0],
          score: boost,
        });
      }

      return nextScores;
    });
  };

  // Handle full experiment submission
  
  // Handle full experiment submission and save it to PostgreSQL
// Submit a completed experiment using its actual assignment and experiment IDs.
const handleAllTasksCompleted = async (
  totalScore: number,
  maxScore: number,
  assignmentId: string,
  experimentId: string,
  taskResponses: Record<string, TaskResponseState>
): Promise<void> => {
  if (!user) {
    throw new Error('You must be logged in to submit the lab.');
  }

  if (!token) {
    throw new Error(
      'Authentication token is missing. Please log in again.'
    );
  }

  if (!assignmentId || !experimentId) {
    throw new Error(
      'Assignment or experiment is missing. Please select a valid assignment.'
    );
  }

  if (
    !Number.isFinite(totalScore) ||
    !Number.isFinite(maxScore) ||
    maxScore <= 0 ||
    totalScore < 0 ||
    totalScore > maxScore
  ) {
    throw new Error('Invalid lab score.');
  }

  // Confirm the assignment exists in the assignments loaded for this student.
  const selectedAssignment = assignments.find(
    (assignment) =>
      assignment.id === assignmentId &&
      assignment.experimentId === experimentId &&
      assignment.status === 'active'
  );

  if (!selectedAssignment) {
    throw new Error(
      'This assignment is not available to you or is no longer active. Refresh your assignments and try again.'
    );
  }

  const percentageScore = Math.round(
    (totalScore / maxScore) * 100
  );

  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      assignmentId,
      experimentId,
      totalScore: percentageScore,
      maxScore: 100,
      competencyScores: studentCompetencyScores,
      taskResponses,
      vivaResponses: [],
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    const message =
      result?.error ||
      `Submission failed (HTTP ${response.status}).`;

    console.error('Lab submission failed:', message, result);
    throw new Error(message);
  }

  // Update the UI only after PostgreSQL confirms the submission.
  if (result.submission) {
    setSubmissions((previous) => [
      result.submission,
      ...previous.filter(
        (submission) => submission.id !== result.submission.id
      ),
    ]);
  }

  console.log(
    'Lab submission saved successfully:',
    result.submission
  );
};





  // Teacher creates an assignment
 
  // Teacher creates an assignment and saves it to PostgreSQL
  const handleCreateAssignment = async (
    newAsg: Omit<Assignment, 'id' | 'completedCount' | 'totalStudents'>
  ) => {
    if (!token) {
      console.error('Cannot create assignment: authentication token is missing.');
      return;
    }

    try {
      const response = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAsg),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.assignment) {
        throw new Error(data.error || 'Failed to create assignment.');
      }

      const saved = data.assignment;

      const created: Assignment = {
        ...newAsg,
        id: saved.id,
        classId: saved.classId,
        title: saved.title,
        experimentId: saved.experimentId,
        dueDate: saved.dueDate,
        totalMarks: Number(saved.totalMarks),
        weightTowardsInternal: Number(saved.weightTowardsInternal),
        attemptsAllowed: saved.attemptsAllowed,
        allowFreeExploration: saved.allowFreeExploration,
        status: saved.status,
        completedCount: 0,
        totalStudents: 0,
      };

      setAssignments((prev) => [created, ...prev]);
    } catch (error) {
      console.error('Error creating assignment:', error);
      window.alert(
        error instanceof Error
          ? error.message
          : 'Could not create assignment. Please try again.'
      );
    }
  };


  // Handle logout with route redirection
  const handleLogout = async () => {
    await logout();
    navigateTo('/login');
  };

  // Dedicated callback to synchronize auth state and route immediately upon login/registration
  const handleAuthSuccess = (authUser: CurrentUser, authToken: string) => {
    setSession(authUser, authToken);
    const roleRoute = (authUser.role || 'student').toLowerCase();
    navigateTo(`/${roleRoute}/dashboard`);
  };

  // Auto-redirect authenticated users from root or auth pages to their role dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
        const safeDashboard = `/${role}/dashboard`;
        navigateTo(safeDashboard);
      }
    }
  }, [isLoading, isAuthenticated, role, currentPath, navigateTo]);

  // 1. Initial Authentication Resolution (Zero Role Flash)
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 2. Unauthenticated State
  if (!isAuthenticated || !user || !role) {
    if (currentPath === '/register') {
      return (
        <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
          <RegisterPage
            onRegisterSuccess={handleAuthSuccess}
            onNavigate={navigateTo}
            isDark={isDark}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <LoginPage
          onLoginSuccess={handleAuthSuccess}
          onNavigate={navigateTo}
          isDark={isDark}
        />
      </div>
    );
  }

  // 3. Authenticated State: Show clean loading state while transitioning from root/auth pages
  if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
    return <LoadingScreen />;
  }

  // 4. Role Route Guard: Block unauthorized direct URL access (HTTP 403)
  if (currentPath.startsWith('/student') && role !== 'student') {
    return (
      <UnauthorizedPage
        currentRole={role}
        attemptedPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  if (currentPath.startsWith('/teacher') && role !== 'teacher') {
    return (
      <UnauthorizedPage
        currentRole={role}
        attemptedPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  if (currentPath.startsWith('/admin') && role !== 'admin') {
    return (
      <UnauthorizedPage
        currentRole={role}
        attemptedPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  // 5. Strict Role Application Shell Rendering
  // Conditional route & layout selection - absolutely NO CSS-based hiding or co-rendering
  let layoutContent: React.ReactNode;

  switch (role) {
    case 'student':
      layoutContent = (
        <StudentLayout
          currentUser={user}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          classes={classes}
          assignments={assignments}
          submissions={submissions}
          studentSubmissionsError={studentSubmissionsError}
          competencyScores={studentCompetencyScores}
          competencyScoresError={competencyScoresError}
          onTaskCompleted={handleTaskCompleted}
          onAllCompleted={handleAllTasksCompleted}
        />
      );
      break;

    case 'teacher':
      layoutContent = (
        <TeacherLayout
          currentUser={user}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          classes={classes}
          assignments={assignments}
          submissions={submissions}
          experiments={EXPERIMENTS}
          onCreateAssignment={handleCreateAssignment}
        />
      );
      break;

    case 'admin':
      layoutContent = (
        <AdminLayout
          currentUser={user}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          token={token}
        />
      );
      break;

    default:
      layoutContent = (
        <UnauthorizedPage
          currentRole={role}
          attemptedPath={currentPath}
          onNavigate={navigateTo}
        />
      );
      break;
  }

  return (
    <>
      {layoutContent}

      {/* Global Milestone Celebration Modal */}
      {celebratedMilestone && (
        <MilestoneCelebrationModal
          milestone={celebratedMilestone.milestone}
          newScore={celebratedMilestone.score}
          onClose={() => setCelebratedMilestone(null)}
          onViewBadge={(m) => {
            const allStatuses = getMilestoneStatuses(
              COMPETENCY_MILESTONES,
              studentCompetencyScores,
              user?.name,
              user?.enrollmentCode
            );
            const targetStatus = allStatuses.find((s) => s.milestone.id === m.id);
            if (targetStatus) {
              setInspectedMilestone({ ...targetStatus, isUnlocked: true });
            }
          }}
        />
      )}

      {/* Inspected Milestone Credential Modal */}
      {inspectedMilestone && (
        <DigitalBadgeModal
          status={inspectedMilestone}
          studentName={user?.name}
          institution={user?.institution}
          enrollmentCode={user?.enrollmentCode}
          onClose={() => setInspectedMilestone(null)}
          onPractice={(expId) => {
            setInspectedMilestone(null);
            navigateTo('/student/experiments');
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
