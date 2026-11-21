import React, { useState } from 'react';
import {
  FlaskConical,
  GraduationCap,
  Users,
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole, CurrentUser } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface LoginPageProps {
  onLoginSuccess: (user: CurrentUser, token: string) => void;
  onNavigate: (path: string) => void;
  isDark: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigate,
  isDark,
}) => {
  const { login, setSession } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('student');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password, role);

      if (!result.success || !result.user || !result.token) {
        setErrorMessage(result.error || 'Failed to authenticate. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      // Synchronize session token and user state immediately
      setSession(result.user, result.token);
      setSuccessMessage(`Welcome back, ${result.user.name}!`);

      setTimeout(() => {
        onLoginSuccess(result.user!, result.token!);
        const roleRoute = (result.user!.role || 'student').toLowerCase();
        onNavigate(`/${roleRoute}/dashboard`);
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network connection failed. Please check your connection.');
      setIsLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoRole: UserRole) => {
    setEmail(demoEmail);
    setPassword('password123');
    setRole(demoRole);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Top Back Link */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Virtual Lab</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 sm:p-8 shadow-sm transition-colors">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 dark:bg-amber-500 text-amber-400 dark:text-stone-950 shadow-sm mb-3">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-2xl">
                Sign In to SimLab
              </h1>
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Access your syllabus laboratory trials, AI viva records, and telemetry
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              Select Your Role
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/80">
              <button
                type="button"
                id="login-role-student-btn"
                onClick={() => setRole('student')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  role === 'student'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <GraduationCap className="h-4 w-4 text-amber-500" />
                <span>Student</span>
              </button>
              <button
                type="button"
                id="login-role-teacher-btn"
                onClick={() => setRole('teacher')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  role === 'teacher'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Users className="h-4 w-4 text-indigo-500" />
                <span>Faculty</span>
              </button>
              <button
                type="button"
                id="login-role-admin-btn"
                onClick={() => setRole('admin')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  role === 'admin'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Shield className="h-4 w-4 text-rose-500" />
                <span>Admin</span>
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

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5"
              >
                Institutional Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-3 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                >
                  Password
                </label>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  Minimum 6 characters
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 pl-9 pr-10 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-stone-900 dark:bg-amber-500 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white dark:text-stone-950 shadow-sm hover:bg-stone-800 dark:hover:bg-amber-400 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <>
                  <span>Sign In as {role === 'student' ? 'Student' : role === 'teacher' ? 'Faculty' : 'Administrator'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins Helper */}
          <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Quick Demo Credentials
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                <Sparkles className="h-3 w-3" /> One-Click Fill
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="demo-student-login-btn"
                onClick={() => handleDemoFill('aarav.sharma@university.edu', 'student')}
                className="flex flex-col items-start p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:border-amber-400 dark:hover:border-amber-500/80 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-800 dark:text-stone-200">
                  <GraduationCap className="h-3.5 w-3.5 text-amber-500" />
                  <span>Student</span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate w-full mt-0.5">
                  aarav.sharma@...
                </span>
              </button>

              <button
                type="button"
                id="demo-teacher-login-btn"
                onClick={() => handleDemoFill('dr.ananya.sen@university.edu', 'teacher')}
                className="flex flex-col items-start p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:border-amber-400 dark:hover:border-amber-500/80 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-800 dark:text-stone-200">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Faculty</span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate w-full mt-0.5">
                  dr.ananya.sen@...
                </span>
              </button>

              <button
                type="button"
                id="demo-admin-login-btn"
                onClick={() => handleDemoFill('super.admin@simlab.internal', 'admin')}
                className="flex flex-col items-start p-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:border-amber-400 dark:hover:border-amber-500/80 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-800 dark:text-stone-200">
                  <Shield className="h-3.5 w-3.5 text-rose-500" />
                  <span>Admin</span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate w-full mt-0.5">
                  super.admin@...
                </span>
              </button>
            </div>
          </div>

          {/* Navigation to Register */}
          <div className="mt-5 text-center">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              New to SimLab?{' '}
              <button
                type="button"
                id="nav-to-register-btn"
                onClick={() => onNavigate('/register')}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline underline-offset-2 transition-colors"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
