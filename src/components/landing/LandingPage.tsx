import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Users,
  Shield,
  Sun,
  Moon,
  Check,
  Microscope,
  Cpu,
  MessageSquare,
} from 'lucide-react';
import {
  motion,
  MotionConfig,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'motion/react';
import { UserRole } from '../../types';
import HERO_IMAGE from '../../assets/images/simlab_hero_apparatus_1795370678943.jpg';
import ELECTRONICS_IMAGE from '../../assets/images/simlab_bento_electronics_1795370671389.jpg';
import VIVA_IMAGE from '../../assets/images/simlab_bento_viva_1795370662017.jpg';
import COMPETENCY_IMAGE from '../../assets/images/simlab_bento_competency_1795370700699.jpg';

interface LandingPageProps {
  onSignInWithRole: (role: UserRole) => void;
  onNavigate: (path: string) => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
}

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

const SCROLL_VIEWPORT = {
  once: true,
  amount: 0.15,
} as const;

const revealUpVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.68,
      delay,
      ease: APPLE_EASE,
    },
  }),
};

const cardRevealVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.985 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.72,
      delay,
      ease: APPLE_EASE,
    },
  }),
};

const listContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.12,
    },
  },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: APPLE_EASE,
    },
  },
};

interface RoleOptionConfig {
  role: UserRole;
  label: string;
  portalTitle: string;
  headline: string;
  summary: string;
  ctaLabel: string;
  accentText: string;
  accentBg: string;
  capabilities: string[];
}

const ROLE_OPTIONS: RoleOptionConfig[] = [
  {
    role: 'student',
    label: 'Student',
    portalTitle: 'Student Workspace',
    headline: 'Run apparatus trials, defend findings, and track real mastery.',
    summary:
      'Enroll directly into your assigned class cohort and access every published virtual experiment, contextual AI Lab Mentor, adaptive AI Viva, and five-dimension competency report.',
    ctaLabel: 'Sign In as Student',
    accentText: 'text-amber-700 dark:text-amber-400',
    accentBg:
      'bg-stone-900 hover:bg-stone-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950',
    capabilities: [
      'Cohort-synced lab assignments and deadline alerts',
      'Interactive Physics, Optics, Chemistry & PCR apparatus',
      'Adaptive AI Viva Voce with persistent assessment transcripts',
      'Competency radar, milestone badges & personalized next labs',
    ],
  },
  {
    role: 'teacher',
    label: 'Teacher',
    portalTitle: 'Faculty Portal',
    headline: 'Publish syllabus labs, audit submissions, and guide every cohort.',
    summary:
      'Rosters and enrollment notifications stay synchronized automatically as students join your classes. Review observations alongside AI evaluations, compare cohort gaps, and export reports.',
    ctaLabel: 'Sign In as Teacher',
    accentText: 'text-indigo-700 dark:text-indigo-400',
    accentBg:
      'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white',
    capabilities: [
      'Live class rosters with automatic student enrollment alerts',
      'One-click lab assignment publishing with custom rubrics',
      'Submission review workspace with faculty score overrides',
      'Class-wise competency analytics, AI insights & PDF/CSV exports',
    ],
  },
  {
    role: 'admin',
    label: 'Admin',
    portalTitle: 'Admin Console',
    headline: 'Govern institutions, faculty mappings, and security audit trails.',
    summary:
      'Maintain institutional integrity across departments. Manage user accounts and role permissions, assign responsible faculty to cohorts, and review immutable authentication logs.',
    ctaLabel: 'Sign In as Admin',
    accentText: 'text-rose-700 dark:text-rose-400',
    accentBg:
      'bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-500 dark:hover:bg-rose-400 dark:text-white',
    capabilities: [
      'Institutional directory and multi-department oversight',
      'Role-based access governance across Student, Teacher & Admin',
      'Class-to-faculty assignment management and alert resolution',
      'Immutable authentication and enrollment audit log inspection',
    ],
  },
];

const COMPETENCY_WEIGHTS = [
  { name: 'Measurement Precision', weight: '25%', detail: 'Tolerance accuracy across repeated apparatus trials' },
  { name: 'Data Interpretation', weight: '25%', detail: 'Slope fitting, anomaly detection, and error propagation' },
  { name: 'Setup & Calibration', weight: '20%', detail: 'Instrument alignment, zero-error checks, and parameter bounds' },
  { name: 'Experimental Design', weight: '15%', detail: 'Variable isolation, range selection, and methodology defense' },
  { name: 'Troubleshooting & Safety', weight: '15%', detail: 'Fault diagnosis, thermal/optical limits, and safe recovery' },
];

const PLATFORM_FACTS = [
  { value: '5', label: 'Syllabus Virtual Apparatuses', detail: 'Optics, Electronics, Quantum, Titration & PCR' },
  { value: '5', label: 'Empirical Competency Axes', detail: 'Weighted 70% practical observations · 30% AI viva' },
  { value: '3', label: 'Role-Isolated Workspaces', detail: 'Student, Teacher & Admin server-enforced RBAC' },
  { value: '100%', label: 'Persistent Academic Records', detail: 'Stored in relational PostgreSQL across every term' },
];

interface StudioMediaProps {
  src: string;
  alt: string;
  aspectClass: string;
  fallbackTitle: string;
  fallbackIcon: React.ReactNode;
  darkSurface?: boolean;
}

const StudioMedia: React.FC<StudioMediaProps> = ({
  src,
  alt,
  aspectClass,
  fallbackTitle,
  fallbackIcon,
  darkSurface = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${aspectClass} w-full flex flex-col items-center justify-center gap-3 ${
          darkSurface
            ? 'bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 text-stone-300'
            : 'bg-gradient-to-br from-stone-100 via-stone-50 to-amber-50/40 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800 text-stone-600 dark:text-stone-300'
        }`}
      >
        {fallbackIcon}
        <span className="text-xs font-medium">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} w-full overflow-hidden`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
      />
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignInWithRole,
  onNavigate,
  isDark,
  onToggleDarkMode,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const shouldReduceMotion = useReducedMotion();

  const heroMediaRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: pageScrollProgress } = useScroll();
  const { scrollYProgress: heroMediaProgress } = useScroll({
    target: heroMediaRef,
    offset: ['start end', 'center center'],
  });

  const heroMediaScale = useTransform(heroMediaProgress, [0, 1], [0.975, 1]);
  const heroMediaY = useTransform(heroMediaProgress, [0, 1], [16, 0]);

  const activeRoleConfig =
    ROLE_OPTIONS.find((item) => item.role === selectedRole) || ROLE_OPTIONS[0];

  return (
    <MotionConfig reducedMotion="user">
      <div
        id="simlab-landing-page"
        className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors duration-200 selection:bg-amber-200 selection:text-stone-950"
      >
        {/* =================================================================== */}
        {/* 1. APPLE-STYLE FROSTED 3-ZONE TOP BAR                               */}
        {/* =================================================================== */}
        <header className="sticky top-0 z-40 border-b border-stone-200/70 dark:border-stone-800/80 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-6">
            {/* Zone 1: Single clean wordmark */}
            <a
              href="#overview"
              className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0"
            >
              SimLab
            </a>

            {/* Zone 2: 4 concise single-line nav links */}
            <nav
              aria-label="Primary"
              className="hidden md:flex items-center gap-8 text-[13px] font-medium text-stone-600 dark:text-stone-400"
            >
              <a
                href="#overview"
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
              >
                Overview
              </a>
              <a
                href="#apparatus"
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
              >
                Apparatus
              </a>
              <a
                href="#portals"
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
              >
                Portals
              </a>
              <a
                href="#competencies"
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
              >
                Competencies
              </a>
            </nav>

            {/* Zone 3: 1 primary action */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                id="landing-nav-signin-btn"
                onClick={() => onSignInWithRole(selectedRole)}
                className="rounded-full bg-stone-900 dark:bg-amber-500 px-5 py-2 text-xs font-semibold text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Subtle Apple-style Reading Progress Hairline */}
          <motion.div
            aria-hidden="true"
            id="landing-scroll-progress"
            style={{ scaleX: pageScrollProgress, transformOrigin: '0% 50%' }}
            className="h-[1.5px] w-full bg-amber-600/80 dark:bg-amber-400/80"
          />
        </header>

        <main>
          {/* ================================================================= */}
          {/* 2. HERO SECTION — APPLE KEYNOTE PRODUCT REVEAL                    */}
          {/* ================================================================= */}
          <section
            id="overview"
            className="scroll-mt-16 mx-auto max-w-6xl px-6 pt-10 pb-16 sm:pt-14 sm:pb-24"
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: APPLE_EASE }}
              className="mx-auto max-w-4xl text-center"
            >
              <p className="text-xs sm:text-sm font-semibold tracking-tight text-amber-700 dark:text-amber-400">
                SimLab Competency Hub
              </p>

              <h1
                className="mt-2.5 font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.06]"
                style={{
                  fontSize: 'clamp(2.25rem, 4.4vw, 3.75rem)',
                  textWrap: 'balance',
                }}
              >
                Practical science. Measured with precision.
              </h1>

              <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-stone-600 dark:text-stone-300">
                A syllabus-aligned virtual laboratory platform where university students conduct interactive apparatus experiments, defend their methodology through adaptive AI viva assessments, and build verified practical competency profiles.
              </p>

              {/* Interactive Role Switcher & Primary Sign-In Handoff */}
              <div className="mt-6 flex flex-col items-center gap-3">
                <div
                  role="tablist"
                  aria-label="Choose your workspace role"
                  className="inline-flex items-center gap-1 rounded-full border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-1 shadow-xs"
                >
                  {ROLE_OPTIONS.map((opt) => {
                    const isActive = selectedRole === opt.role;
                    return (
                      <button
                        key={opt.role}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        id={`landing-hero-role-${opt.role}`}
                        onClick={() => setSelectedRole(opt.role)}
                        className={`relative rounded-full px-5 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                          isActive
                            ? 'text-white dark:text-stone-950'
                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="landing-hero-role-indicator"
                            transition={{ duration: 0.28, ease: APPLE_EASE }}
                            className="absolute inset-0 rounded-full bg-stone-900 dark:bg-stone-100 shadow-xs"
                          />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                  <motion.button
                    type="button"
                    id="landing-hero-signin-btn"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSignInWithRole(selectedRole)}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${activeRoleConfig.accentBg}`}
                  >
                    <span>{activeRoleConfig.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>

                  <button
                    type="button"
                    id="landing-hero-register-btn"
                    onClick={() => onNavigate('/register')}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Create a student account</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-[20px]">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={activeRoleConfig.role}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: APPLE_EASE }}
                      className="max-w-lg text-xs text-stone-500 dark:text-stone-400"
                    >
                      {activeRoleConfig.portalTitle} — {activeRoleConfig.headline}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Dominant 16:9 Studio Product Showcase with Subtle Scroll-Linked Settle */}
            <motion.div
              ref={heroMediaRef}
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.72, delay: 0.1, ease: APPLE_EASE }}
              style={
                shouldReduceMotion
                  ? undefined
                  : { scale: heroMediaScale, y: heroMediaY }
              }
              className="group mx-auto mt-9 max-w-5xl overflow-hidden rounded-[28px] border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm will-change-transform"
            >
              <StudioMedia
                src={HERO_IMAGE}
                alt="SimLab precision optical bench with convex glass lens focusing a warm light ray onto a millimeter calibration screen"
                aspectClass="aspect-[16/9]"
                fallbackTitle="Precision Optical Bench & Apparatus Simulation"
                fallbackIcon={<FlaskConical className="h-10 w-10 text-amber-500" />}
              />
            </motion.div>
          </section>

          {/* ================================================================= */}
          {/* 3. ASYMMETRIC BENTO CAPABILITIES — SCROLL-TRIGGERED REVEALS       */}
          {/* ================================================================= */}
          <section
            id="apparatus"
            className="scroll-mt-14 border-t border-stone-200/70 dark:border-stone-800/80 bg-white dark:bg-stone-900/40 py-24 sm:py-32"
          >
            <div className="mx-auto max-w-6xl px-6">
              <motion.div
                variants={revealUpVariants}
                initial="hidden"
                whileInView="visible"
                viewport={SCROLL_VIEWPORT}
                custom={0}
                className="max-w-2xl"
              >
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Inside the Laboratory
                </p>
                <h2
                  className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  Engineered for real empirical rigor.
                </h2>
                <p className="mt-4 text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                  Every apparatus models real physical equations, experimental error, and procedural order—turning browser lab sessions into verifiable academic credit.
                </p>
              </motion.div>

              {/* Asymmetric Bento Grid (7/5 + 5/7 rhythm) */}
              <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Row 1 Left: Wide Marquee Apparatus Card (7 cols) */}
                <motion.article
                  data-reveal-card="bento-apparatus"
                  variants={cardRevealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={SCROLL_VIEWPORT}
                  custom={0}
                  className="group lg:col-span-7 flex flex-col justify-between overflow-hidden rounded-[28px] border border-stone-200/80 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 will-change-transform"
                >
                  <div className="p-8 sm:p-10">
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      01. Interactive Apparatus Suite · Physics, Chemistry & Biology
                    </p>
                    <h3 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                      Five syllabus instruments. Calibrated to physical law.
                    </h3>
                    <p className="mt-3 text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed max-w-xl">
                      Manipulate voltage sources, move convex lenses along millimeter optical benches, tune ultraviolet wavelengths, run potentiometric acid-base titrations, and inspect PCR gel bands with real-time tolerance grading.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-stone-500 dark:text-stone-400">
                      <span>Ohm&apos;s Law Circuit</span>
                      <span aria-hidden="true">·</span>
                      <span>Convex Lens u-v Bench</span>
                      <span aria-hidden="true">·</span>
                      <span>Photoelectric Effect</span>
                      <span aria-hidden="true">·</span>
                      <span>Acid-Base Titration</span>
                      <span aria-hidden="true">·</span>
                      <span>PCR Gel Electrophoresis</span>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <StudioMedia
                      src={ELECTRONICS_IMAGE}
                      alt="Precision anodized laboratory voltage bench with amber digital display and test probes"
                      aspectClass="aspect-[16/10]"
                      fallbackTitle="Interactive Electronics & Optics Bench"
                      fallbackIcon={<Cpu className="h-9 w-9 text-amber-500" />}
                    />
                  </div>
                </motion.article>

                {/* Row 1 Right: Dark Pro Contrast Card — AI Viva Voce (5 cols) */}
                <motion.article
                  data-reveal-card="bento-viva"
                  variants={cardRevealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={SCROLL_VIEWPORT}
                  custom={0.1}
                  className="group lg:col-span-5 flex flex-col justify-between overflow-hidden rounded-[28px] border border-stone-800 bg-stone-950 text-stone-100 will-change-transform"
                >
                  <div className="p-8 sm:p-10">
                    <p className="text-xs font-medium text-amber-400">
                      02. Adaptive AI Viva Voce
                    </p>
                    <h3 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      Defend every measurement in your own words.
                    </h3>
                    <p className="mt-3 text-sm sm:text-base text-stone-300 leading-relaxed">
                      Following each apparatus trial, students answer experiment-grounded conceptual questions calibrated to their observations. Every viva transcript is evaluated, persisted, and reviewable by faculty.
                    </p>
                  </div>
                  <div className="mt-auto">
                    <StudioMedia
                      src={VIVA_IMAGE}
                      alt="Glass optical prism refracting warm golden spectrum beside an acoustic condenser microphone on dark stone"
                      aspectClass="aspect-[4/3]"
                      fallbackTitle="Adaptive AI Viva Assessment"
                      fallbackIcon={<MessageSquare className="h-9 w-9 text-amber-400" />}
                      darkSurface
                    />
                  </div>
                </motion.article>

                {/* Row 2 Left: Five-Dimension Competency Matrix (5 cols) */}
                <motion.article
                  data-reveal-card="bento-competency"
                  variants={cardRevealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={SCROLL_VIEWPORT}
                  custom={0}
                  className="lg:col-span-5 flex flex-col justify-between rounded-[28px] border border-stone-200/80 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 p-8 sm:p-10 will-change-transform"
                >
                  <div>
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      03. Competency Engine · 70% Practical / 30% Viva
                    </p>
                    <h3 className="mt-3 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                      Five dimensions of practical mastery.
                    </h3>
                    <p className="mt-3 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                      Instead of opaque letter grades, SimLab decomposes every submission across five weighted laboratory competencies so students and instructors pinpoint exact skill gaps.
                    </p>
                  </div>

                  <motion.dl
                    variants={listContainerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={SCROLL_VIEWPORT}
                    className="mt-8 divide-y divide-stone-200/80 dark:divide-stone-800"
                  >
                    {COMPETENCY_WEIGHTS.map((dim) => (
                      <motion.div
                        key={dim.name}
                        variants={listItemVariants}
                        className="py-3.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                            {dim.name}
                          </dt>
                          <dd className="font-mono text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                            {dim.weight}
                          </dd>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                          {dim.detail}
                        </p>
                      </motion.div>
                    ))}
                  </motion.dl>
                </motion.article>

                {/* Row 2 Right: Wide Cohort & Workflow Studio Card (7 cols) */}
                <motion.article
                  data-reveal-card="bento-cohort"
                  variants={cardRevealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={SCROLL_VIEWPORT}
                  custom={0.1}
                  className="group lg:col-span-7 flex flex-col justify-between overflow-hidden rounded-[28px] border border-stone-200/80 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 will-change-transform"
                >
                  <div className="p-8 sm:p-10">
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      04. Live Cohort Synchronization · PHY101-A, SCI204-B & Beyond
                    </p>
                    <h3 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                      Enrollment, rosters, and lab assignments—always in lockstep.
                    </h3>
                    <p className="mt-3 text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed max-w-xl">
                      When a student registers into a class cohort, their account links immediately to the assigned faculty member&apos;s roster, dispatches an enrollment alert, and syncs every active lab assignment for that cohort automatically.
                    </p>
                  </div>
                  <div className="mt-auto">
                    <StudioMedia
                      src={COMPETENCY_IMAGE}
                      alt="Overhead arrangement of borosilicate titration flask, convex lens, titanium vernier caliper, and lab grid notebook on pale stone"
                      aspectClass="aspect-[16/9]"
                      fallbackTitle="Cohort Synchronization & Assessment Records"
                      fallbackIcon={<Microscope className="h-9 w-9 text-amber-500" />}
                    />
                  </div>
                </motion.article>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* 4. ROLE PORTALS — STAGGERED STUDENT, TEACHER & ADMIN REVEAL       */}
          {/* ================================================================= */}
          <section
            id="portals"
            className="scroll-mt-14 border-t border-stone-200/70 dark:border-stone-800/80 bg-stone-50 dark:bg-stone-950 py-24 sm:py-32"
          >
            <div className="mx-auto max-w-6xl px-6">
              <motion.div
                variants={revealUpVariants}
                initial="hidden"
                whileInView="visible"
                viewport={SCROLL_VIEWPORT}
                custom={0}
                className="mx-auto max-w-2xl text-center"
              >
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Choose Your Workspace
                </p>
                <h2
                  className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  One platform. Three dedicated portals.
                </h2>
                <p className="mt-4 text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                  Select whether you are entering as a Student, Teacher, or Administrator to proceed directly to the sign-in screen with your workspace role pre-configured.
                </p>
              </motion.div>

              <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
                {ROLE_OPTIONS.map((portal, index) => {
                  const RoleIcon =
                    portal.role === 'student'
                      ? GraduationCap
                      : portal.role === 'teacher'
                      ? Users
                      : Shield;

                  return (
                    <motion.div
                      key={portal.role}
                      id={`landing-portal-card-${portal.role}`}
                      data-reveal-card={`portal-${portal.role}`}
                      variants={cardRevealVariants}
                      initial="hidden"
                      whileInView="visible"
                      viewport={SCROLL_VIEWPORT}
                      custom={index * 0.09}
                      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                      transition={{ duration: 0.22, ease: APPLE_EASE }}
                      className="flex flex-col justify-between rounded-[28px] border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 sm:p-9 transition-colors duration-200 hover:border-stone-300 dark:hover:border-stone-700 will-change-transform"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${portal.accentText}`}>
                            {portal.portalTitle}
                          </span>
                          <RoleIcon className={`h-5 w-5 ${portal.accentText}`} />
                        </div>

                        <h3 className="mt-4 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                          {portal.label}
                        </h3>

                        <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                          {portal.summary}
                        </p>

                        <ul className="mt-6 space-y-3 border-t border-stone-100 dark:border-stone-800 pt-6">
                          {portal.capabilities.map((cap) => (
                            <li
                              key={cap}
                              className="flex items-start gap-2.5 text-xs sm:text-[13px] text-stone-700 dark:text-stone-300 leading-snug"
                            >
                              <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${portal.accentText}`} />
                              <span>{cap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-8 pt-4">
                        <motion.button
                          type="button"
                          id={`landing-portal-signin-${portal.role}`}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onSignInWithRole(portal.role)}
                          className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-semibold transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${portal.accentBg}`}
                        >
                          <span>{portal.ctaLabel}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* 5. FULL-BLEED DARK PROOF & CONVERSION CHAPTER                     */}
          {/* ================================================================= */}
          <section
            id="competencies"
            className="scroll-mt-14 bg-stone-950 text-stone-100 py-24 sm:py-32 border-t border-stone-800"
          >
            <div className="mx-auto max-w-6xl px-6">
              <motion.div
                variants={revealUpVariants}
                initial="hidden"
                whileInView="visible"
                viewport={SCROLL_VIEWPORT}
                custom={0}
                className="max-w-2xl"
              >
                <p className="text-sm font-semibold text-amber-400">
                  Built for Academic Integrity
                </p>
                <h2
                  className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  Every observation verified. Every cohort isolated.
                </h2>
                <p className="mt-4 text-base text-stone-400 leading-relaxed">
                  From server-side auto-grading and persisted viva transcripts to strict cohort-scoped access control, SimLab Competency Hub delivers reliable assessment data across every academic term.
                </p>
              </motion.div>

              {/* 4-Column Quantitative Proof Row */}
              <div className="mt-14 grid grid-cols-1 gap-8 border-y border-stone-800 py-12 sm:grid-cols-2 lg:grid-cols-4">
                {PLATFORM_FACTS.map((fact, index) => (
                  <motion.div
                    key={fact.label}
                    data-reveal-card={`fact-${index}`}
                    variants={revealUpVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={SCROLL_VIEWPORT}
                    custom={index * 0.08}
                  >
                    <p className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-white">
                      {fact.value}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-stone-100">
                      {fact.label}
                    </p>
                    <p className="mt-1 text-xs text-stone-400 leading-relaxed">
                      {fact.detail}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Closing Keynote CTA */}
              <motion.div
                data-reveal-card="closing-cta"
                variants={cardRevealVariants}
                initial="hidden"
                whileInView="visible"
                viewport={SCROLL_VIEWPORT}
                custom={0.05}
                className="mt-16 flex flex-col items-start justify-between gap-8 rounded-[28px] border border-stone-800 bg-stone-900/70 p-8 sm:flex-row sm:items-center sm:p-12 will-change-transform"
              >
                <div className="max-w-xl">
                  <h3
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                    style={{ textWrap: 'balance' }}
                  >
                    Ready to step into the laboratory?
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-stone-300 leading-relaxed">
                    Sign in with your institutional credentials as a Student, Teacher, or Admin—or register a new student account directly into your class cohort.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <motion.button
                    type="button"
                    id="landing-footer-signin-btn"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSignInWithRole(selectedRole)}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 px-6 py-3 text-sm font-semibold text-stone-950 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Go to Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                  <button
                    type="button"
                    id="landing-footer-register-btn"
                    onClick={() => onNavigate('/register')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-700 hover:border-stone-500 px-5 py-3 text-sm font-medium text-stone-200 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Register Account</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        {/* =================================================================== */}
        {/* 6. QUIET APPLE-STYLE FOOTER                                         */}
        {/* =================================================================== */}
        <footer className="border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 py-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
              <span className="font-bold text-stone-900 dark:text-stone-100">
                SimLab Competency Hub
              </span>
              <span aria-hidden="true">·</span>
              <span>University Virtual Laboratory & Assessment Platform</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-stone-600 dark:text-stone-400">
              <button
                type="button"
                onClick={() => onSignInWithRole('student')}
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                Student Sign In
              </button>
              <button
                type="button"
                onClick={() => onSignInWithRole('teacher')}
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                Teacher Sign In
              </button>
              <button
                type="button"
                onClick={() => onSignInWithRole('admin')}
                className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                Admin Sign In
              </button>
              <button
                type="button"
                id="landing-theme-toggle-btn"
                onClick={onToggleDarkMode}
                aria-label={isDark ? 'Switch to light appearance' : 'Switch to dark appearance'}
                className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
};
