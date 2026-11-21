import React, { useState } from 'react';
import {
  FlaskConical,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  GraduationCap,
  FlaskRound,
  FileCheck,
  CheckCircle2,
  Compass,
  TrendingUp,
  User,
  Users,
  BookOpen,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Shield,
  Building2,
  History,
  Activity,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, CurrentUser } from '../../types';
import { RoleBadge } from '../common/RoleBadge';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
}

const STUDENT_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'My Classes', path: '/student/classes', icon: GraduationCap },
  { id: 'experiments', label: 'My Experiments', path: '/student/experiments', icon: FlaskRound },
  { id: 'assignments', label: 'Assignments', path: '/student/assignments', icon: FileCheck },
  { id: 'competencies', label: 'Competencies', path: '/student/competencies', icon: CheckCircle2 },
  { id: 'scenarios', label: 'Scenario Modules', path: '/student/scenarios', icon: Compass },
  { id: 'progress', label: 'Progress', path: '/student/progress', icon: TrendingUp },
  { id: 'profile', label: 'Profile', path: '/student/profile', icon: User },
];

const TEACHER_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/teacher/dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'My Classes', path: '/teacher/classes', icon: Users },
  { id: 'experiments', label: 'Experiment Library', path: '/teacher/experiments', icon: FlaskConical },
  { id: 'assignments', label: 'Assignments', path: '/teacher/assignments', icon: BookOpen },
  { id: 'students', label: 'Student Progress', path: '/teacher/students', icon: TrendingUp },
  { id: 'analytics', label: 'Competency Analytics', path: '/teacher/analytics', icon: BarChart3 },
  { id: 'review', label: 'Session Review', path: '/teacher/review', icon: ClipboardList },
  { id: 'reports', label: 'Reports', path: '/teacher/reports', icon: FileSpreadsheet },
  { id: 'profile', label: 'Profile', path: '/teacher/profile', icon: User },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', path: '/admin/users', icon: Users },
  { id: 'institutions', label: 'Institutions', path: '/admin/institutions', icon: Building2 },
  { id: 'audit', label: 'Audit Logs', path: '/admin/audit', icon: History },
  { id: 'analytics', label: 'System Analytics', path: '/admin/analytics', icon: Activity },
  { id: 'experiments', label: 'Experiments', path: '/admin/experiments', icon: FlaskConical },
  { id: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings },
  { id: 'profile', label: 'Profile', path: '/admin/profile', icon: Shield },
];

interface RoleNavbarProps {
  currentRole: UserRole;
  currentUser: CurrentUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
}

export const RoleNavbar: React.FC<RoleNavbarProps> = ({
  currentRole,
  currentUser,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Strictly select navigation items based exclusively on authenticated role
  const navItems: NavItem[] = (() => {
    switch (currentRole) {
      case 'student':
        return STUDENT_NAV_ITEMS;
      case 'teacher':
        return TEACHER_NAV_ITEMS;
      case 'admin':
        return ADMIN_NAV_ITEMS;
      default:
        return [];
    }
  })();

  const brandPath = `/${currentRole}/dashboard`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left: Brand + Read-Only Role Indicator */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="role-navbar-brand-btn"
            onClick={() => onNavigate(brandPath)}
            className="flex items-center gap-2.5 text-left focus:outline-none group cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 dark:bg-amber-500 text-amber-400 dark:text-stone-950 shadow-xs group-hover:scale-105 transition-all">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                  SimLab
                </span>
                <span className="hidden sm:inline-block rounded bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  Competency Hub
                </span>
              </div>
            </div>
          </button>

          {/* Read-Only Role Indicator Badge (Interactive role switcher REMOVED) */}
          <RoleBadge role={currentRole} />
        </div>

        {/* Center: Desktop Navigation Bar (Strictly Role-Aware) */}
        <nav
          id="desktop-role-navigation"
          aria-label={`${currentRole} primary navigation`}
          className="hidden lg:flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-800/70 p-1 text-xs font-medium"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path || (item.id === 'dashboard' && currentPath === `/${currentRole}`);
            return (
              <button
                key={item.id}
                type="button"
                id={`nav-${currentRole}-${item.id}`}
                onClick={() => onNavigate(item.path)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-stone-800/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Controls & User Profile */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            type="button"
            id="theme-toggle-btn"
            onClick={onToggleDarkMode}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 p-2 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-stone-600" />}
          </button>

          {/* User Profile Info */}
          <div
            id="user-profile-badge"
            className="hidden md:flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/90 px-2.5 py-1 text-xs shadow-2xs"
            title={`${currentUser.name} • ${currentUser.email}`}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 dark:bg-amber-500 text-[11px] font-bold text-amber-400 dark:text-stone-950">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-semibold text-stone-900 dark:text-stone-100 max-w-[110px] truncate">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 capitalize">
                {currentRole}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            id="role-navbar-logout-btn"
            onClick={onLogout}
            title="Sign out of SimLab"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            id="mobile-nav-toggle-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle role navigation menu"
            className="lg:hidden flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 p-2 text-stone-700 dark:text-stone-300"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Role Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-4 py-3 shadow-lg"
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 dark:bg-amber-500 text-xs font-bold text-amber-400 dark:text-stone-950">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{currentUser.name}</p>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400">{currentUser.email}</p>
                </div>
              </div>
              <RoleBadge role={currentRole} />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path || (item.id === 'dashboard' && currentPath === `/${currentRole}`);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-700/50'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
