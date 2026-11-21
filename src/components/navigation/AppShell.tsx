import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
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
  Shield,
  Building2,
  History,
  Activity,
  Settings,
  Sparkles,
  School,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, CurrentUser, ClassCourse } from '../../types';
import { RoleBadge } from '../common/RoleBadge';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

export const STUDENT_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'My Classes', path: '/student/classes', icon: GraduationCap },
  { id: 'experiments', label: 'Experiments', path: '/student/experiments', icon: FlaskRound },
  { id: 'assignments', label: 'Assignments', path: '/student/assignments', icon: FileCheck },
  { id: 'competencies', label: 'Competencies', path: '/student/competencies', icon: CheckCircle2 },
  { id: 'scenarios', label: 'Scenario Modules', path: '/student/scenarios', icon: Compass },
  { id: 'progress', label: 'Progress', path: '/student/progress', icon: TrendingUp },
  { id: 'profile', label: 'Profile', path: '/student/profile', icon: User },
];

// Strictly relevant, distinct sections for Faculty Portal
export const TEACHER_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Faculty Hub', path: '/teacher/dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'Class Cohorts', path: '/teacher/classes', icon: Users, badge: 'Cohorts' },
  { id: 'assignments', label: 'Lab Assignments', path: '/teacher/assignments', icon: BookOpen, badge: 'Active' },
  { id: 'experiments', label: 'Experiment Catalog', path: '/teacher/experiments', icon: FlaskConical },
  { id: 'analytics', label: 'Competency Analytics', path: '/teacher/analytics', icon: BarChart3 },
  { id: 'review', label: 'Submissions & Review', path: '/teacher/review', icon: ClipboardList, badge: 'Audit' },
  { id: 'profile', label: 'Faculty Profile', path: '/teacher/profile', icon: User },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'User Directory', path: '/admin/users', icon: Users },
  { id: 'institutions', label: 'Institutions', path: '/admin/institutions', icon: Building2 },
  { id: 'audit', label: 'Audit Logs', path: '/admin/audit', icon: History },
  { id: 'analytics', label: 'System Analytics', path: '/admin/analytics', icon: Activity },
  { id: 'experiments', label: 'Experiment Config', path: '/admin/experiments', icon: FlaskConical },
  { id: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings },
  { id: 'profile', label: 'Security Profile', path: '/admin/profile', icon: Shield },
];

export interface AppShellProps {
  id?: string;
  currentRole: UserRole;
  currentUser: CurrentUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  // Faculty-specific interactive features
  facultyClasses?: ClassCourse[];
  selectedFacultyClassId?: string;
  onSelectFacultyClassId?: (id: string) => void;
  onFacultyQuickAssign?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  id,
  currentRole,
  currentUser,
  currentPath,
  onNavigate,
  onLogout,
  isDark,
  onToggleDarkMode,
  facultyClasses,
  selectedFacultyClassId,
  onSelectFacultyClassId,
  onFacultyQuickAssign,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('simlab_sidebar_collapsed');
      return saved === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('simlab_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Close mobile drawer upon path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  // Determine current navigation items
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

  // Find active item for page title & breadcrumbs
  const activeItem = navItems.find(
    (item) => item.path === currentPath || (item.id === 'dashboard' && currentPath === `/${currentRole}`)
  ) || navItems[0];

  const brandPath = `/${currentRole}/dashboard`;

  const roleTitle = currentRole === 'student'
    ? 'Student Workspace'
    : currentRole === 'teacher'
    ? 'Faculty Portal'
    : 'Admin Console';

  const isTeacher = currentRole === 'teacher';
  const isAdmin = currentRole === 'admin';

  // Active theme classes based on role
  const roleColorTheme = {
    brandBg: isTeacher
      ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
      : isAdmin
      ? 'bg-rose-600 dark:bg-rose-500 text-white'
      : 'bg-stone-900 dark:bg-amber-500 text-amber-400 dark:text-stone-950',
    hubBadge: isTeacher
      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
      : isAdmin
      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    activeNavItem: isTeacher
      ? 'bg-indigo-600 text-white font-bold shadow-xs'
      : isAdmin
      ? 'bg-rose-600 text-white font-bold shadow-xs'
      : 'bg-amber-500 text-stone-950 font-bold shadow-xs',
    pulseDot: isTeacher
      ? 'bg-indigo-600'
      : isAdmin
      ? 'bg-rose-600'
      : 'bg-amber-500',
  };

  const currentFacultyClass = facultyClasses?.find((c) => c.id === selectedFacultyClassId) || facultyClasses?.[0];

  return (
    <div
      id={id || `${currentRole}-application-shell`}
      className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-row font-sans transition-colors duration-200"
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (Role-Aware, Interactive, Collapsible)                 */}
      {/* ========================================================================= */}
      <aside
        className={`hidden lg:flex flex-col border-r border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 transition-all duration-300 z-30 sticky top-0 h-screen ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            id="role-navbar-brand-btn"
            onClick={() => onNavigate(brandPath)}
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer overflow-hidden"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs group-hover:scale-105 transition-all ${roleColorTheme.brandBg}`}
            >
              <FlaskConical className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col leading-none overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-tight text-stone-900 dark:text-stone-100">
                    SimLab
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${roleColorTheme.hubBadge}`}
                  >
                    {isTeacher ? 'Faculty' : isAdmin ? 'Admin' : 'Hub'}
                  </span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium mt-1 truncate">
                  {isTeacher ? 'Instruction & Grading' : 'Competency & Virtual Lab'}
                </span>
              </div>
            )}
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Role Identity Banner */}
        <div className={`px-3 py-3 border-b border-stone-100 dark:border-stone-800/80 ${sidebarCollapsed ? 'text-center' : ''}`}>
          {sidebarCollapsed ? (
            <div className="flex justify-center" title={`Role: ${roleTitle}`}>
              <span className={`h-3 w-3 rounded-full ${roleColorTheme.pulseDot} ring-4 ring-indigo-500/20 inline-block`} />
            </div>
          ) : (
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-800 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${roleColorTheme.pulseDot} animate-pulse`} />
                <div className="flex flex-col leading-tight overflow-hidden">
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                    {roleTitle}
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                    {currentUser.institution || (isTeacher ? 'Dept of Applied Sciences' : 'SimLab Academic Cloud')}
                  </span>
                </div>
              </div>
              <RoleBadge role={currentRole} className="scale-90 origin-right shrink-0" />
            </div>
          )}
        </div>

        {/* Interactive Faculty Cohort Switcher Widget (When in Teacher Role) */}
        {isTeacher && facultyClasses && facultyClasses.length > 0 && !sidebarCollapsed && (
          <div className="px-3 pt-3 pb-1 border-b border-stone-100 dark:border-stone-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              <span>Active Teaching Cohort</span>
              <span className="text-indigo-600 dark:text-indigo-400">{facultyClasses.length} Cohorts</span>
            </div>
            <div className="relative">
              <select
                id="faculty-sidebar-cohort-select"
                value={selectedFacultyClassId || facultyClasses[0]?.id}
                onChange={(e) => onSelectFacultyClassId?.(e.target.value)}
                className="w-full rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 px-2.5 py-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-7 truncate"
              >
                {facultyClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.code}: {cls.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-indigo-500 pointer-events-none" />
            </div>

            {currentFacultyClass && (
              <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 px-1 pt-0.5">
                <span>{currentFacultyClass.studentCount} Students Enrolled</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/teacher/classes')}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Manage Roster &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Action Button for Faculty */}
        {isTeacher && !sidebarCollapsed && onFacultyQuickAssign && (
          <div className="px-3 pt-2">
            <button
              type="button"
              onClick={onFacultyQuickAssign}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Assign Virtual Lab</span>
            </button>
          </div>
        )}

        {/* Vertical Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {!sidebarCollapsed && (
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              {isTeacher ? 'Instruction Modules' : 'Workspace Navigation'}
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path ||
              (item.id === 'dashboard' && currentPath === `/${currentRole}`);

            return (
              <button
                key={item.id}
                type="button"
                id={`nav-${currentRole}-${item.id}`}
                onClick={() => onNavigate(item.path)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? roleColorTheme.activeNavItem
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/70 hover:text-stone-900 dark:hover:text-stone-100'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? isTeacher
                        ? 'text-white'
                        : 'text-stone-950'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                />
                {!sidebarCollapsed && (
                  <span className="truncate text-left flex-1">{item.label}</span>
                )}
                {!sidebarCollapsed && item.badge && (
                  <span
                    className={`rounded-full text-[10px] font-bold px-1.5 py-0.2 ${
                      isActive
                        ? isTeacher
                          ? 'bg-indigo-500 text-white'
                          : 'bg-amber-200/80 text-amber-950'
                        : isTeacher
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: User Card & Collapse Expand */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand sidebar"
                className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${roleColorTheme.brandBg}`}
                title={`${currentUser.name} (${currentUser.email})`}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            </div>
          ) : (
            <>
              {/* User Identity Card */}
              <div
                id="user-profile-badge"
                className="rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-800 p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-2xs ${roleColorTheme.brandBg}`}
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col leading-tight overflow-hidden">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                      {isTeacher ? 'Faculty Member' : currentUser.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sign Out Button in Sidebar */}
              <button
                type="button"
                id="role-navbar-logout-btn"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 py-2 px-3 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE SLIDE-OVER DRAWER (< 1024px)                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs"
            />

            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${roleColorTheme.brandBg}`}>
                    <FlaskConical className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      SimLab
                    </span>
                    <span className="block text-[10px] text-stone-500 dark:text-stone-400">
                      {roleTitle}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Interactive Cohort Selector for Mobile */}
              {isTeacher && facultyClasses && facultyClasses.length > 0 && (
                <div className="p-3 border-b border-stone-100 dark:border-stone-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Teaching Cohort
                  </span>
                  <select
                    value={selectedFacultyClassId || facultyClasses[0]?.id}
                    onChange={(e) => onSelectFacultyClassId?.(e.target.value)}
                    className="w-full rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-200"
                  >
                    {facultyClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.code}: {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drawer Links */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    currentPath === item.path ||
                    (item.id === 'dashboard' && currentPath === `/${currentRole}`);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                        isActive
                          ? roleColorTheme.activeNavItem
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold ${roleColorTheme.brandBg}`}>
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-stone-900 dark:text-stone-100 truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-stone-500 truncate">{currentUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE & TOP HEADER (Clean, Professional, Spacious)           */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sleek Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 w-full border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md transition-colors px-4 sm:px-6 flex items-center justify-between">
          {/* Left: Mobile Menu Toggle + Breadcrumb Location */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="mobile-nav-toggle-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 p-2 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb Path Context */}
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden sm:flex items-center gap-1.5 font-medium text-stone-500 dark:text-stone-400">
                <School className="h-3.5 w-3.5 text-stone-400" />
                <span>SimLab</span>
                <ChevronRight className="h-3 w-3 text-stone-400" />
              </span>
              <span className="font-semibold text-stone-600 dark:text-stone-300 hidden md:inline">
                {roleTitle}
              </span>
              <ChevronRight className="h-3 w-3 text-stone-400 hidden md:inline" />
              <div
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                  isTeacher
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-800/60'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                }`}
              >
                {activeItem?.icon && (
                  <activeItem.icon
                    className={`h-3.5 w-3.5 ${isTeacher ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'}`}
                  />
                )}
                <span>{activeItem?.label || 'Overview'}</span>
              </div>
            </div>
          </div>

          {/* Right: Academic Status + Theme Toggle + User Actions */}
          <div className="flex items-center gap-2.5">
            {/* Term Badge */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/80 px-2.5 py-1 text-[11px] font-medium text-stone-600 dark:text-stone-300">
              <Sparkles className={`h-3 w-3 ${isTeacher ? 'text-indigo-500' : 'text-amber-500'}`} />
              <span>Spring 2026 Term</span>
            </div>

            {/* Role Badge in Header */}
            <div className="hidden md:block">
              <RoleBadge role={currentRole} />
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              id="theme-toggle-btn"
              onClick={onToggleDarkMode}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800 p-2 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-stone-600" />}
            </button>

            {/* User Quick Pill */}
            <div
              className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/90 pl-1.5 pr-2.5 py-1 text-xs"
              title={`${currentUser.name} (${currentUser.email})`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${roleColorTheme.brandBg}`}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-stone-800 dark:text-stone-200 max-w-[90px] sm:max-w-[120px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
            </div>

            {/* Direct Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              title="Sign out of SimLab"
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Scrollable Main Application Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};
