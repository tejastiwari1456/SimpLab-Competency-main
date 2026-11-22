import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  GraduationCap,
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Check,
  BookOpen,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole, CurrentUser, AvailableClassOption } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface RegisterPageProps {
  onRegisterSuccess: (user: CurrentUser, token: string) => void;
  onNavigate: (path: string) => void;
  isDark: boolean;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onRegisterSuccess,
  onNavigate,
  isDark,
}) => {
  const { register, setSession } = useAuth();
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [institution, setInstitution] = useState<string>('');
  const [enrollmentCode, setEnrollmentCode] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<AvailableClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState<boolean>(true);
  const [classesError, setClassesError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dynamically load active classes from PostgreSQL (e.g., PHY101-A, SCI204-B)
  useEffect(() => {
    let cancelled = false;
    setClassesLoading(true);
    setClassesError('');

    fetch('/api/classes/available')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.classes)) {
          throw new Error(data.error || 'Unable to load available class cohorts.');
        }
        if (!cancelled) {
          setAvailableClasses(data.classes);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setClassesError(
            err instanceof Error ? err.message : 'Unable to load available class cohorts.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClassObj = availableClasses.find((c) => c.id === selectedClassId) || null;

  // Password validation criteria
  const isLengthValid = password.length >= 6;
  const isMatchValid = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid institutional or personal email address.');
      return;
    }

    if (role === 'student' && !selectedClassId) {
      setErrorMessage('Please select the class cohort you are enrolling in (e.g., PHY101-A or SCI204-B).');
      return;
    }

    if (!isLengthValid) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        institution: institution.trim(),
        enrollmentCode: enrollmentCode.trim() || undefined,
        classId: role === 'student' ? selectedClassId : undefined,
      });

      if (!result.success || !result.user || !result.token) {
        setErrorMessage(result.error || 'Registration failed. Please review your details.');
        setIsLoading(false);
        return;
      }

      // Synchronize session token and user state immediately
      setSession(result.user, result.token);
      setSuccessMessage(
        role === 'student' && selectedClassObj
          ? `Account created & enrolled in ${selectedClassObj.code}! Welcome, ${result.user.name}.`
          : `Account created successfully! Welcome, ${result.user.name}.`
      );

      setTimeout(() => {
        onRegisterSuccess(result.user!, result.token!);
        const roleRoute = (result.user!.role || 'student').toLowerCase();
        onNavigate(`/${roleRoute}/dashboard`);
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred during registration. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        {/* Top Back Link */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to SimLab Overview</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 sm:p-8 shadow-sm transition-colors">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 dark:bg-amber-500 text-amber-400 dark:text-stone-950 shadow-sm mb-3">
              <FlaskConical className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-2xl">
              Create Your SimLab Account
            </h1>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Join students and faculty across universities in authentic syllabus virtual laboratories
            </p>
          </div>

          {/* Role Selection Interactive Cards */}
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Select Your Account Type & Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Student Role Card */}
              <button
                type="button"
                id="register-role-student-card"
                onClick={() => setRole('student')}
                className={`relative flex flex-col p-3.5 rounded-xl border text-left transition-all ${
                  role === 'student'
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      Student
                    </span>
                  </div>
                  {role === 'student' && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white dark:text-stone-950 text-[10px] font-bold">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                  Perform syllabus lab trials, submit AI viva defenses, and build competency profiles.
                </p>
              </button>

              {/* Teacher Role Card */}
              <button
                type="button"
                id="register-role-teacher-card"
                onClick={() => setRole('teacher')}
                className={`relative flex flex-col p-3.5 rounded-xl border text-left transition-all ${
                  role === 'teacher'
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                    : 'border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400">
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      Instructor
                    </span>
                  </div>
                  {role === 'teacher' && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white dark:text-stone-950 text-[10px] font-bold">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400">
                  Track cohorts, audit viva transcripts, assign custom syllabus tasks, and view telemetry.
                </p>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200"
            >
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </motion.div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-200"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="register-name"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
              >
                Full Name <span className="text-amber-600">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="register-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === 'student' ? 'e.g. Maya Chen' : 'e.g. Dr. Robert Lang'}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
              >
                Email Address <span className="text-amber-600">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            {/* Passwords row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="register-password"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Password <span className="text-amber-600">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 chars"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-9 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-confirm-password"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Confirm Password <span className="text-amber-600">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="register-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className={`w-full rounded-xl border bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 transition-all ${
                      confirmPassword && !isMatchValid
                        ? 'border-rose-400 focus:ring-rose-500/20'
                        : confirmPassword && isMatchValid
                        ? 'border-emerald-500 focus:ring-emerald-500/20'
                        : 'border-stone-300 dark:border-stone-700 focus:border-amber-500 focus:ring-amber-500/20'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Student Class Cohort Selection (Dynamically loaded from PostgreSQL) */}
            {role === 'student' && (
              <div>
                <label
                  htmlFor="register-class-select"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  Select Class / Cohort to Enroll <span className="text-amber-600">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <select
                    id="register-class-select"
                    required
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={classesLoading}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  >
                    <option value="">
                      {classesLoading
                        ? 'Loading available classes...'
                        : 'Choose your class cohort (e.g., PHY101-A or SCI204-B)'}
                    </option>
                    {availableClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.code} — {cls.name}
                        {cls.facultyName ? ` (${cls.facultyName})` : ' (Faculty Pending)'}
                      </option>
                    ))}
                  </select>
                </div>

                {classesError && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    {classesError}
                  </p>
                )}

                {selectedClassObj && (
                  <div className="mt-2 rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-stone-700 dark:text-stone-300 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-amber-800 dark:text-amber-300">
                        {selectedClassObj.code}
                      </span>{' '}
                      • {selectedClassObj.semester} ({selectedClassObj.academicYear})
                    </div>
                    <div className="font-medium">
                      Faculty:{' '}
                      <span
                        className={
                          selectedClassObj.hasAssignedFaculty
                            ? 'font-bold text-stone-900 dark:text-stone-100'
                            : 'font-bold text-rose-600 dark:text-rose-400'
                        }
                      >
                        {selectedClassObj.facultyName || 'Not yet assigned'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Institution & Student ID / Faculty Code Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="register-institution"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  University / College
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    id="register-institution"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. National Institute of Science"
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-enrollment-code"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  {role === 'student' ? 'Student ID / Reg. Number' : 'Faculty Passcode'}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    id="register-enrollment-code"
                    type="text"
                    value={enrollmentCode}
                    onChange={(e) => setEnrollmentCode(e.target.value)}
                    placeholder={role === 'student' ? 'e.g. PHYS-2026-109 (Optional)' : 'e.g. DEPT-FACULTY'}
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="register-submit-btn"
              disabled={isLoading}
              className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-stone-900 dark:bg-amber-500 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white dark:text-stone-950 shadow-sm hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Creating Account...</span>
                </div>
              ) : (
                <>
                  <span>Create {role === 'student' ? 'Student' : 'Instructor'} Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Navigation to Login */}
          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 text-center">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Already have an account?{' '}
              <button
                type="button"
                id="nav-to-login-btn"
                onClick={() => onNavigate('/login')}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline underline-offset-2 transition-colors"
              >
                Sign in to your account
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
