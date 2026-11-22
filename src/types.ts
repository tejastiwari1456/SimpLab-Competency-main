export type UserRole = 'student' | 'teacher' | 'admin';

export type CompetencyKey =
  | 'setup_adherence'
  | 'measurement_precision'
  | 'data_interpretation'
  | 'troubleshooting_safety'
  | 'experimental_design';

export interface CompetencyDimension {
  key: CompetencyKey;
  label: string;
  shortLabel: string;
  description: string;
  weight: number;
}

export const COMPETENCY_DIMENSIONS: Record<CompetencyKey, CompetencyDimension> = {
  setup_adherence: {
    key: 'setup_adherence',
    label: 'Apparatus Setup & Calibration',
    shortLabel: 'Setup & Calibration',
    description: 'Proper arrangement of instruments, polarities, zero-error calibration, and connection integrity.',
    weight: 0.2,
  },
  measurement_precision: {
    key: 'measurement_precision',
    label: 'Measurement Precision & Noise Control',
    shortLabel: 'Measurement',
    description: 'Collecting sufficient data points across proper ranges, handling instrument resolution and jitter.',
    weight: 0.2,
  },
  data_interpretation: {
    key: 'data_interpretation',
    label: 'Data Interpretation & Graphing',
    shortLabel: 'Graphing & Analysis',
    description: 'Slope calculation, regression fit, identifying equivalence points, and detecting anomalous outliers.',
    weight: 0.2,
  },
  troubleshooting_safety: {
    key: 'troubleshooting_safety',
    label: 'Fault Diagnosis & Lab Safety',
    shortLabel: 'Safety & Faults',
    description: 'Preventing component burnout, managing chemical runaway, and diagnosing circuit open/short states.',
    weight: 0.2,
  },
  experimental_design: {
    key: 'experimental_design',
    label: 'Experimental Design & Application',
    shortLabel: 'Application & Design',
    description: 'Applying fundamental empirical data to solve real-world engineering constraints and design problems.',
    weight: 0.2,
  },
};

export type TaskType = 'mcq' | 'numeric' | 'parameter_select' | 'ordering' | 'viva_text';

export interface TaskOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface AutoGradedTask {
  id: string;
  experimentId: string;
  stage: 'pre_lab' | 'during_lab' | 'viva';
  title: string;
  type: TaskType;
  competencyDimension: CompetencyKey;
  points: number;
  prompt: string;
  options?: TaskOption[];
  correctAnswer?: string | number | string[];
  numericTolerance?: number; // e.g. 5% tolerance
  rubric?: string; // For AI viva assessment
  hint?: string;
  explanation: string;
}

export interface Experiment {
  id: string;
  title: string;
  code: string;
  subject: 'Physics' | 'Chemistry' | 'Electronics' | 'Biology';
  syllabusTag: string; // e.g., "CBSE 12 / AICTE Engg Phys Unit 2"
  semester: string;
  durationMinutes: number;
  description: string;
  objectives: string[];
  procedureSteps?: string[];
  apparatusList: string[];
  keyFormulas: Array<{ label: string; formula: string }>;
  tasks: AutoGradedTask[];
  scenarios: string[]; // IDs of linked scenarios
}

export interface ScenarioModule {
  id: string;
  experimentId: string;
  title: string;
  domain: string;
  badge: string;
  realWorldRole: string; // e.g., "Biomedical Instrumentation Engineer"
  brief: string;
  mission: string;
  systemParameters: Record<string, string | number>;
  tasks: Array<{
    id: string;
    step: number;
    title: string;
    description: string;
    question: string;
    type: 'parameter_select' | 'numeric' | 'viva_text';
    competencyDimension: CompetencyKey;
    points: number;
    options?: TaskOption[];
    correctAnswer?: string | number;
    numericTolerance?: number;
    rubric?: string;
    engineeringContext: string;
  }>;
}

export interface AssignmentEvaluationCriteria {
  practicalWeightPct: number;
  vivaWeightPct: number;
  passingThresholdPct: number;
  requireViva: boolean;
  rubricNotes?: string;
}

export interface Assignment {
  id: string;
  classId: string;
  classCode?: string;
  className?: string;
  title: string;
  experimentId: string;
  dueDate: string;
  totalMarks: number;
  weightTowardsInternal: number; // e.g. 10%
  attemptsAllowed: number;
  allowFreeExploration: boolean;
  evaluationCriteria?: AssignmentEvaluationCriteria;
  status: 'active' | 'archived';
  completedCount: number;
  totalStudents: number;
  avgScore?: number;
}

export type SubmissionCompletionStatus = 'draft' | 'submitted' | 'completed';
export type SubmissionEvaluationStatus =
  | 'pending'
  | 'auto_graded'
  | 'ai_evaluated'
  | 'faculty_reviewed'
  | 'needs_revision'
  | 'rejected';

export interface EvaluationHistoryRecord {
  id: string;
  submissionId: string;
  evaluatorId?: string;
  evaluatorName: string;
  previousStatus?: string | null;
  newStatus: string;
  previousScore?: number | null;
  newScore?: number | null;
  feedback?: string | null;
  createdAt: string;
}

export interface VivaResponseRecord {
  id: string;
  sessionId?: string;
  questionIndex?: number;
  taskId?: string | null;
  questionText: string;
  competencyDimension: string;
  studentAnswer: string;
  score: number;
  maxPoints?: number;
  passed: boolean;
  aiFeedback: string;
  rubricCriterionMet?: string[];
  missingConcepts?: string[];
  adaptiveFollowUp?: string | null;
  difficulty?: 'foundation' | 'intermediate' | 'advanced';
  aiModel?: string;
  createdAt?: string;
}

export interface VivaSessionRecord {
  id: string;
  studentId: string;
  experimentId: string;
  assignmentId: string | null;
  attemptNumber: number;
  status: 'in_progress' | 'completed';
  overallScore: number;
  maxScore: number;
  questionsCount: number;
  answeredCount: number;
  summaryFeedback: string | null;
  startedAt: string;
  completedAt: string | null;
  responses: VivaResponseRecord[];
}

export interface CompetencyHistoryItem {
  id: string;
  submissionId: string | null;
  vivaSessionId: string | null;
  experimentId: string;
  attemptNumber: number;
  competencyScores: Record<CompetencyKey, number>;
  overallScore: number;
  deltaOverall: number;
  recordedAt: string;
}

export interface StudentCompetencyReport {
  competencyScores: Record<CompetencyKey, number>;
  overallScore: number;
  latestDelta: number;
  strongAreas: CompetencyKey[];
  weakAreas: CompetencyKey[];
  experimentsEvaluatedCount: number;
  dimensions: Array<{
    key: CompetencyKey;
    label: string;
    score: number;
    experimentContribution: number;
    vivaContribution: number;
    experimentsEvaluated: number;
    status: 'strong' | 'proficient' | 'developing' | 'weak';
  }>;
  history: CompetencyHistoryItem[];
  methodology: {
    practicalWeight: number;
    vivaWeight: number;
    attemptAggregationPolicy: 'best' | 'latest';
    dimensionWeights: Record<CompetencyKey, number>;
    thresholds: {
      strong: number;
      proficient: number;
      developing: number;
    };
  };
}

export interface StudentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  experimentId: string;
  submittedAt: string;
  attemptNumber: number;
  totalScore: number;
  maxScore: number;
  facultyScore?: number | null;
  competencyScores: Record<CompetencyKey, number>; // 0 to 100
  taskResponses: Record<string, any>;
  observations?: Record<string, any>;
  calculatedResults?: Record<string, any>;
  dataReadingsCount: number;
  completionStatus?: SubmissionCompletionStatus;
  evaluationStatus?: SubmissionEvaluationStatus;
  vivaSessionId?: string | null;
  instructorFeedback?: string | null;
  evaluatedBy?: string | null;
  evaluatedAt?: string | null;
  vivaSession?: VivaSessionRecord | null;
  evaluationHistory?: EvaluationHistoryRecord[];
}

export interface ClassCourse {
  id: string;
  name: string;
  code: string;
  department: string;
  semester: string;
  academicYear: string;
  studentCount: number;
  assignmentCount?: number;
  enrollmentId?: string;
  enrollmentStatus?: string;
  enrolledAt?: string;
  facultyId?: string | null;
  facultyName?: string | null;
  facultyEmail?: string | null;
  averageCompetencies: Record<CompetencyKey, number>;
  commonMisconceptions: Array<{
    title: string;
    affectedPercentage: number;
    relatedExperiment: string;
    recommendedRemediation: string;
  }>;
}

export interface AvailableClassOption {
  id: string;
  code: string;
  name: string;
  department: string;
  semester: string;
  academicYear: string;
  studentCount: number;
  hasAssignedFaculty: boolean;
  facultyName: string | null;
}

export interface EnrollmentSummary {
  enrollmentId: string;
  studentId: string;
  classId: string;
  classCode: string;
  className: string;
  facultyId: string;
  facultyName: string;
  enrollmentStatus: string;
  enrolledAt: string;
  notificationId: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institution: string;
  enrollmentCode?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  token?: string;
  user?: CurrentUser;
  enrollment?: EnrollmentSummary;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  role: UserRole;
  name: string;
  institution: string;
  enrollmentCode?: string;
  classId?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  role?: UserRole;
}

export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CompetencyMilestone {
  id: string;
  title: string;
  shortTitle: string;
  competencyKey: CompetencyKey | 'overall';
  threshold: number; // e.g. 75, 80, 85, 90, 95
  tier: MilestoneTier;
  categoryLabel: string;
  description: string;
  skillCriteria: string;
  recommendedExperimentId?: string;
  badgeColor: 'amber' | 'emerald' | 'indigo' | 'purple' | 'rose' | 'cyan';
  accreditationCode: string;
  iconName: 'target' | 'ruler' | 'shield' | 'award' | 'zap' | 'sparkles' | 'compass' | 'cpu';
}

export interface StudentMilestoneStatus {
  milestone: CompetencyMilestone;
  isUnlocked: boolean;
  currentScore: number;
  threshold: number;
  progressPercentage: number;
  pointsNeeded: number;
  unlockedAt?: string;
  credentialCode: string;
}

export interface StudentRecommendation {
  experimentId: string;
  title: string;
  code: string;
  subject: string;
  priority: 'high' | 'medium' | 'low';
  priorityScore: number;
  reason: string;
  targetCompetencies: Array<{
    key: CompetencyKey;
    label: string;
    currentScore: number;
    experimentWeight: number;
  }>;
  assignmentId: string | null;
  assignmentTitle: string | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  attemptsUsed: number;
  attemptsAllowed: number | null;
  currentBestScore: number | null;
  estimatedImpact: string;
}

export interface StudentNotification {
  id: string;
  type: 'deadline' | 'assignment' | 'evaluation' | 'viva_report';
  severity: 'urgent' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actionPath: string;
  experimentId?: string | null;
  assignmentId?: string | null;
  submissionId?: string | null;
  vivaSessionId?: string | null;
}

export interface FacultyRemedialStudent {
  studentId: string;
  studentName: string;
  email: string;
  enrollmentCode: string | null;
  classIds: string[];
  classCodes: string[];
  overallMastery: number;
  submissionsCount: number;
  weakestCompetency: CompetencyKey;
  weakestCompetencyLabel: string;
  weakestCompetencyScore: number;
  recommendedExperimentId: string;
  recommendedExperimentTitle: string;
  riskLevel: 'high' | 'moderate';
}

export interface FacultyNotification {
  id: string;
  recipientUserId: string;
  recipientRole: string;
  type: string;
  title: string;
  message: string;
  metadata: {
    studentId?: string;
    studentName?: string;
    studentEmail?: string;
    studentEnrollmentCode?: string | null;
    classId?: string;
    classCode?: string;
    className?: string;
    enrollmentId?: string;
    enrolledAt?: string;
    actionPath?: string;
    severity?: 'info' | 'success' | 'warning' | 'urgent';
  };
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface RecentlyEnrolledStudent {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  email: string;
  enrollmentCode: string | null;
  classId: string;
  classCode: string;
  className: string;
  enrollmentStatus: string;
  enrolledAt: string;
}

export interface FacultyDashboardSummary {
  totalAssignedStudents: number;
  totalClasses: number;
  activeAssignmentsCount: number;
  pendingSubmissionsCount: number;
  completedExperimentsCount: number;
  totalSubmissionsCount: number;
  classAverageCompetency: number;
  recentActivities: Array<{
    id: string;
    type: 'submission' | 'viva' | 'evaluation';
    title: string;
    subtitle: string;
    studentId?: string;
    studentName: string;
    experimentId?: string;
    scorePct?: number;
    status?: string;
    timestamp: string;
  }>;
  studentsRequiringAttention: FacultyRemedialStudent[];
  recentlyEnrolledStudents?: RecentlyEnrolledStudent[];
  classDistribution?: Array<{
    classId: string;
    code: string;
    name: string;
    studentCount: number;
  }>;
  unreadNotificationsCount?: number;
  latestEnrollmentNotifications?: FacultyNotification[];
}

export interface FacultyStudentReport {
  student: {
    id: string;
    name: string;
    email: string;
    institution: string;
    enrollmentCode: string | null;
    lastLoginAt: string | null;
    enrolledClasses: Array<{
      classId: string;
      code: string;
      name: string;
      semester: string;
      academicYear: string;
    }>;
  };
  competencyReport: StudentCompetencyReport;
  submissions: Array<{
    id: string;
    assignmentId: string;
    experimentId: string;
    experimentTitle: string;
    attemptNumber: number;
    totalScore: number;
    maxScore: number;
    facultyScore: number | null;
    evaluationStatus: string;
    instructorFeedback: string | null;
    competencyScores: Record<CompetencyKey, number>;
    observations?: Record<string, any>;
    calculatedResults?: Record<string, any>;
    dataReadingsCount: number;
    submittedAt: string;
    evaluatedAt: string | null;
  }>;
  vivaSessions: Array<{
    id: string;
    experimentId: string;
    experimentTitle: string;
    attemptNumber: number;
    status: string;
    overallScore: number;
    answeredCount: number;
    questionsCount: number;
    summaryFeedback: string | null;
    startedAt: string;
    completedAt: string | null;
    responses: Array<{
      id: string;
      questionText: string;
      studentAnswer: string;
      score: number;
      passed: boolean;
      difficulty?: string;
      aiFeedback: string;
      rubricCriterionMet?: string[];
      missingConcepts?: string[];
    }>;
  }>;
  evaluationHistory: EvaluationHistoryRecord[];
}

export interface FacultyAnalyticsPayload {
  scope: { classId: string; code: string; name: string };
  averageCompetencies: Record<CompetencyKey, number>;
  classComparison: Array<{
    classId: string;
    code: string;
    name: string;
    studentCount: number;
    overallAverage: number;
    setup_adherence: number;
    measurement_precision: number;
    data_interpretation: number;
    troubleshooting_safety: number;
    experimental_design: number;
  }>;
  skillGaps: Array<{
    competencyKey: CompetencyKey;
    label: string;
    averageScore: number;
    benchmark: number;
    gapFromBenchmark: number;
    severity: 'critical' | 'attention' | 'on_track' | 'strong';
  }>;
  experimentPerformance: Array<{
    experimentId: string;
    code: string;
    title: string;
    subject: string;
    submissionsCount: number;
    uniqueStudentsCount: number;
    averageScorePct: number;
    passRatePct: number;
    weakestCompetency: CompetencyKey;
    weakestCompetencyAvg: number;
  }>;
  improvementTrends: Array<{
    isoDate: string;
    label: string;
    averageOverall: number;
    averageDelta: number;
    checkpointsCount: number;
  }>;
  remedialStudents: FacultyRemedialStudent[];
  studentsSummary: Array<{
    studentId: string;
    studentName: string;
    enrollmentCode: string | null;
    classCodes: string[];
    overallMastery: number;
    submissionsCount: number;
  }>;
}

export interface FacultyAiInsightsPayload {
  scope: { classId: string; code: string; name: string };
  generatedAt: string;
  advisoryNotice: string;
  classPerformanceSummary: string;
  commonMistakes: Array<{
    mistake: string;
    affectedExperiment: string;
    frequencyNote: string;
  }>;
  frequentlyObservedGaps: Array<{
    competency: string;
    avgScore: number;
    diagnosticReason: string;
  }>;
  teachingRecommendations: Array<{
    title: string;
    actionPlan: string;
    expectedImpact: string;
  }>;
  studentInterventions: Array<{
    studentId: string;
    studentName: string;
    riskLevel: 'high' | 'moderate' | 'monitor';
    weakness: string;
    recommendedPractice: string;
  }>;
  model: string;
}

export interface FacultyHistoricalReport {
  records: Array<{
    submissionId: string;
    studentId: string;
    studentName: string;
    classId: string;
    classCode: string;
    className: string;
    assignmentTitle: string;
    experimentId: string;
    experimentTitle: string;
    attemptNumber: number;
    autoScore: number;
    facultyScore: number | null;
    maxScore: number;
    effectiveScorePct: number;
    evaluationStatus: string;
    instructorFeedback: string;
    competencyScores: Record<CompetencyKey, number>;
    submittedAt: string;
    evaluatedAt: string | null;
  }>;
  evaluationLogs: EvaluationHistoryRecord[];
  summary: {
    totalSubmissions: number;
    uniqueStudents: number;
    averageScorePct: number;
    approvedCount: number;
    needsRevisionCount: number;
    rejectedCount: number;
    pendingReviewCount: number;
  };
}



