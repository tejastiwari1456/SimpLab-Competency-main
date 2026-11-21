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

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  experimentId: string;
  dueDate: string;
  totalMarks: number;
  weightTowardsInternal: number; // e.g. 10%
  attemptsAllowed: number;
  allowFreeExploration: boolean;
  status: 'active' | 'archived';
  completedCount: number;
  totalStudents: number;
  avgScore?: number;
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
  competencyScores: Record<CompetencyKey, number>; // 0 to 100
  taskResponses: Record<string, {
    score: number;
    maxScore: number;
    studentAnswer: any;
    feedback: string;
    rubricCriterionMet?: string[];
    missingConcepts?: string[];
  }>;
  dataReadingsCount: number;
  instructorFeedback?: string;
}

export interface ClassCourse {
  id: string;
  name: string;
  code: string;
  department: string;
  semester: string;
  academicYear: string;
  studentCount: number;
  averageCompetencies: Record<CompetencyKey, number>;
  commonMisconceptions: Array<{
    title: string;
    affectedPercentage: number;
    relatedExperiment: string;
    recommendedRemediation: string;
  }>;
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
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  role: UserRole;
  name: string;
  institution: string;
  enrollmentCode?: string;
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

