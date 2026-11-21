import { CompetencyKey, COMPETENCY_DIMENSIONS, CompetencyMilestone, StudentMilestoneStatus } from '../types';

export const COMPETENCY_MILESTONES: CompetencyMilestone[] = [
  // --- Measurement Precision & Noise Control ---
  {
    id: 'milestone-prec-75',
    title: 'Calibration Apprentice',
    shortTitle: 'Precision 75%',
    competencyKey: 'measurement_precision',
    threshold: 75,
    tier: 'bronze',
    categoryLabel: 'Measurement Precision',
    description: 'Mastered baseline instrument reading, scale estimation, and recorded data points within nominal lab tolerance.',
    skillCriteria: 'Achieve ≥75% in Measurement Precision. Demonstrates standard parallax minimization and consistent significant digits.',
    recommendedExperimentId: 'exp-ohms-law',
    badgeColor: 'amber',
    accreditationCode: 'NABL-MET-75-BRONZE',
    iconName: 'ruler',
  },
  {
    id: 'milestone-prec-85',
    title: 'Precision Metrologist',
    shortTitle: 'Precision 85%',
    competencyKey: 'measurement_precision',
    threshold: 85,
    tier: 'silver',
    categoryLabel: 'Measurement Precision',
    description: 'Consistently eliminates zero-error offsets and handles digital meter fluctuating jitter across multiple trials.',
    skillCriteria: 'Achieve ≥85% in Measurement Precision. Validated on optical bench pin alignment and potentiometer galvanometer balance.',
    recommendedExperimentId: 'exp-convex-lens',
    badgeColor: 'cyan',
    accreditationCode: 'NABL-MET-85-SILVER',
    iconName: 'target',
  },
  {
    id: 'milestone-prec-90',
    title: 'Precision Metrology Master',
    shortTitle: 'Precision 90% (Gold)',
    competencyKey: 'measurement_precision',
    threshold: 90,
    tier: 'gold',
    categoryLabel: 'Measurement Precision',
    description: 'Awarded for reaching 90 in Measurement Precision: demonstrated near-zero empirical variance, eliminating scale parallax and instrument noise across complex multi-stage apparatuses.',
    skillCriteria: 'Reach ≥90% in Measurement Precision & Noise Control. Requires precise regression fit, minimum 6 repeated trials, and zero-error correction.',
    recommendedExperimentId: 'exp-convex-lens',
    badgeColor: 'amber',
    accreditationCode: 'IEEE-PREC-90-GOLD',
    iconName: 'target',
  },
  {
    id: 'milestone-prec-95',
    title: 'Quantum Precision Fellow',
    shortTitle: 'Precision 95% (Elite)',
    competencyKey: 'measurement_precision',
    threshold: 95,
    tier: 'platinum',
    categoryLabel: 'Measurement Precision',
    description: 'Top-tier empirical metrology. Flawless instrumentation sensitivity, sub-millimeter optical focus, and zero residual noise.',
    skillCriteria: 'Reach ≥95% in Measurement Precision. Flawless score on Planck constant photo-current stopping potential determination.',
    recommendedExperimentId: 'exp-photoelectric',
    badgeColor: 'purple',
    accreditationCode: 'IUPAP-PREC-95-PLAT',
    iconName: 'sparkles',
  },

  // --- Apparatus Setup & Calibration ---
  {
    id: 'milestone-setup-75',
    title: 'Bench Setup Adept',
    shortTitle: 'Setup 75%',
    competencyKey: 'setup_adherence',
    threshold: 75,
    tier: 'bronze',
    categoryLabel: 'Apparatus Setup',
    description: 'Properly connects basic circuit loops, burette clamps, and optical bench carriages in proper sequence.',
    skillCriteria: 'Achieve ≥75% in Apparatus Setup & Calibration. Correct terminal polarities and zero index setting.',
    recommendedExperimentId: 'exp-ohms-law',
    badgeColor: 'emerald',
    accreditationCode: 'AICTE-SETUP-75-BRONZE',
    iconName: 'cpu',
  },
  {
    id: 'milestone-setup-85',
    title: 'Instrumentation Specialist',
    shortTitle: 'Setup 85%',
    competencyKey: 'setup_adherence',
    threshold: 85,
    tier: 'silver',
    categoryLabel: 'Apparatus Setup',
    description: 'Flawless apparatus orientation, ground isolation, and calibrated zero-error subtraction on mechanical calipers and dial meters.',
    skillCriteria: 'Achieve ≥85% in Apparatus Setup. Verifies potentiometer wire uniformity and buret bubble clearance.',
    recommendedExperimentId: 'exp-titration',
    badgeColor: 'cyan',
    accreditationCode: 'AICTE-SETUP-85-SILVER',
    iconName: 'compass',
  },
  {
    id: 'milestone-setup-90',
    title: 'Master of Instrumentation',
    shortTitle: 'Setup 90% (Gold)',
    competencyKey: 'setup_adherence',
    threshold: 90,
    tier: 'gold',
    categoryLabel: 'Apparatus Setup',
    description: 'Reaching 90 in Apparatus Setup: Flawless physical circuit wiring, coaxial shielding, and optical bench leveling on first attempt without faculty remediation.',
    skillCriteria: 'Reach ≥90% in Apparatus Setup & Calibration. Demonstrates rigorous zero-calibration and lead-resistance compensation.',
    recommendedExperimentId: 'exp-ohms-law',
    badgeColor: 'amber',
    accreditationCode: 'IEEE-INST-90-GOLD',
    iconName: 'award',
  },
  {
    id: 'milestone-setup-95',
    title: 'Chief Laboratory Engineer',
    shortTitle: 'Setup 95% (Elite)',
    competencyKey: 'setup_adherence',
    threshold: 95,
    tier: 'platinum',
    categoryLabel: 'Apparatus Setup',
    description: 'Flawless apparatus setup fidelity across multimeters, pH meters, PCR thermocyclers, and laser diode benches.',
    skillCriteria: 'Reach ≥95% in Apparatus Setup. Zero procedural mistakes across all completed virtual apparatus modules.',
    recommendedExperimentId: 'exp-pcr-gel',
    badgeColor: 'purple',
    accreditationCode: 'NABL-ENG-95-PLAT',
    iconName: 'shield',
  },

  // --- Data Interpretation & Graphing ---
  {
    id: 'milestone-data-75',
    title: 'Empirical Data Grapher',
    shortTitle: 'Graphing 75%',
    competencyKey: 'data_interpretation',
    threshold: 75,
    tier: 'bronze',
    categoryLabel: 'Data & Graphing',
    description: 'Correctly plots independent vs dependent variables, selects appropriate grid scales, and draws best-fit lines.',
    skillCriteria: 'Achieve ≥75% in Data Interpretation & Graphing. Basic slope derivation and tabular logging.',
    recommendedExperimentId: 'exp-ohms-law',
    badgeColor: 'indigo',
    accreditationCode: 'STEM-DATA-75-BRONZE',
    iconName: 'ruler',
  },
  {
    id: 'milestone-data-85',
    title: 'Linear Regression Analyst',
    shortTitle: 'Graphing 85%',
    competencyKey: 'data_interpretation',
    threshold: 85,
    tier: 'silver',
    categoryLabel: 'Data & Graphing',
    description: 'Calculates true physical resistance slope, focal lengths, and identifies anomalous scatter points with rigorous reasoning.',
    skillCriteria: 'Achieve ≥85% in Data Interpretation. Correctly handles 1/u vs 1/v intercepts and titration pH inflections.',
    recommendedExperimentId: 'exp-titration',
    badgeColor: 'cyan',
    accreditationCode: 'STEM-DATA-85-SILVER',
    iconName: 'target',
  },
  {
    id: 'milestone-data-90',
    title: 'Empirical Modeling Master',
    shortTitle: 'Graphing 90% (Gold)',
    competencyKey: 'data_interpretation',
    threshold: 90,
    tier: 'gold',
    categoryLabel: 'Data & Graphing',
    description: 'Reaching 90 in Data Interpretation: Precise derivative curve analysis, mathematical regression modeling, and statistical outlier isolation.',
    skillCriteria: 'Reach ≥90% in Data Interpretation & Graphing. Isolates non-linear heating deviations and calculates precise theoretical constants.',
    recommendedExperimentId: 'exp-convex-lens',
    badgeColor: 'amber',
    accreditationCode: 'IEEE-MODEL-90-GOLD',
    iconName: 'award',
  },
  {
    id: 'milestone-data-95',
    title: 'Principal Data Scientist',
    shortTitle: 'Graphing 95% (Elite)',
    competencyKey: 'data_interpretation',
    threshold: 95,
    tier: 'platinum',
    categoryLabel: 'Data & Graphing',
    description: 'Flawless theoretical-to-empirical convergence and error propagation analysis across multi-variable data sets.',
    skillCriteria: 'Reach ≥95% in Data Interpretation. Perfect viva defense on mathematical modeling and regression residuals.',
    recommendedExperimentId: 'exp-photoelectric',
    badgeColor: 'purple',
    accreditationCode: 'IUPAP-DATA-95-PLAT',
    iconName: 'sparkles',
  },

  // --- Fault Diagnosis & Lab Safety ---
  {
    id: 'milestone-safe-75',
    title: 'Safety Protocol Compliant',
    shortTitle: 'Safety 75%',
    competencyKey: 'troubleshooting_safety',
    threshold: 75,
    tier: 'bronze',
    categoryLabel: 'Faults & Safety',
    description: 'Follows electrical voltage caps, PPE guidelines, chemical handling safeguards, and thermocycler protocols.',
    skillCriteria: 'Achieve ≥75% in Fault Diagnosis & Lab Safety. Avoids dangerous short circuits and burette acid runaways.',
    recommendedExperimentId: 'exp-titration',
    badgeColor: 'emerald',
    accreditationCode: 'OSHA-SAFE-75-BRONZE',
    iconName: 'shield',
  },
  {
    id: 'milestone-safe-85',
    title: 'Fault Isolation Specialist',
    shortTitle: 'Safety 85%',
    competencyKey: 'troubleshooting_safety',
    threshold: 85,
    tier: 'silver',
    categoryLabel: 'Faults & Safety',
    description: 'Diagnoses high contact resistance, open key circuits, blurred lens positions, and ungrounded meter states.',
    skillCriteria: 'Achieve ≥85% in Fault Diagnosis & Safety. Solves simulated apparatus defect questions accurately in during-lab tasks.',
    recommendedExperimentId: 'exp-ohms-law',
    badgeColor: 'cyan',
    accreditationCode: 'OSHA-SAFE-85-SILVER',
    iconName: 'zap',
  },
  {
    id: 'milestone-safe-90',
    title: 'Fault Isolation Commander',
    shortTitle: 'Safety 90% (Gold)',
    competencyKey: 'troubleshooting_safety',
    threshold: 90,
    tier: 'gold',
    categoryLabel: 'Faults & Safety',
    description: 'Reaching 90 in Fault Diagnosis & Safety: Proactively catches anomalous readings, diagnoses instrument hardware faults, and defends viva safety stress tests.',
    skillCriteria: 'Reach ≥90% in Fault Diagnosis & Lab Safety. Accurately remediates wire heating breakdown and chemical contamination.',
    recommendedExperimentId: 'exp-pcr-gel',
    badgeColor: 'amber',
    accreditationCode: 'IEEE-SAFE-90-GOLD',
    iconName: 'shield',
  },
  {
    id: 'milestone-safe-95',
    title: 'Chief Safety Inspector',
    shortTitle: 'Safety 95% (Elite)',
    competencyKey: 'troubleshooting_safety',
    threshold: 95,
    tier: 'platinum',
    categoryLabel: 'Faults & Safety',
    description: 'Zero burned components, zero safety breaches, and 100% resolution of unannounced apparatus stress simulations.',
    skillCriteria: 'Reach ≥95% in Fault Diagnosis & Safety. Flawless troubleshooting viva defense.',
    recommendedExperimentId: 'exp-ohms-law',
    badgeColor: 'purple',
    accreditationCode: 'ISO-SAFE-95-PLAT',
    iconName: 'sparkles',
  },

  // --- Experimental Design & Application ---
  {
    id: 'milestone-des-85',
    title: 'Applied Methodologist',
    shortTitle: 'Design 85%',
    competencyKey: 'experimental_design',
    threshold: 85,
    tier: 'silver',
    categoryLabel: 'Experimental Design',
    description: 'Applies fundamental physical laws to solve real-world engineering constraints and variable isolation challenges.',
    skillCriteria: 'Achieve ≥85% in Experimental Design & Application. Solves scenario-based engineering tasks.',
    recommendedExperimentId: 'exp-photoelectric',
    badgeColor: 'cyan',
    accreditationCode: 'AICTE-DES-85-SILVER',
    iconName: 'compass',
  },
  {
    id: 'milestone-des-90',
    title: 'Applied Science Architect',
    shortTitle: 'Design 90% (Gold)',
    competencyKey: 'experimental_design',
    threshold: 90,
    tier: 'gold',
    categoryLabel: 'Experimental Design',
    description: 'Reaching 90 in Experimental Design: Formulates optimal experiment ranges, component values, and industrial application parameters.',
    skillCriteria: 'Reach ≥90% in Experimental Design & Application. High-level performance in engineering scenarios.',
    recommendedExperimentId: 'exp-pcr-gel',
    badgeColor: 'amber',
    accreditationCode: 'IEEE-DES-90-GOLD',
    iconName: 'award',
  },

  // --- Overall Practical Mastery ---
  {
    id: 'milestone-overall-85',
    title: 'Certified Laboratory Scholar',
    shortTitle: 'Overall 85%',
    competencyKey: 'overall',
    threshold: 85,
    tier: 'silver',
    categoryLabel: 'Comprehensive Mastery',
    description: 'Demonstrated well-rounded excellence across apparatus setup, measurement precision, graphing, safety, and design.',
    skillCriteria: 'Maintain ≥85% weighted average across all 5 syllabus competency dimensions.',
    badgeColor: 'cyan',
    accreditationCode: 'VLAB-SCHOLAR-85',
    iconName: 'award',
  },
  {
    id: 'milestone-overall-90',
    title: 'Distinguished STEM Practitioner',
    shortTitle: 'Overall 90% (Gold)',
    competencyKey: 'overall',
    threshold: 90,
    tier: 'gold',
    categoryLabel: 'Comprehensive Mastery',
    description: 'Reaching 90 in Overall Practical Mastery: Superior performance across syllabus experiments, continuous auto-graded tasks, and AI viva defenses.',
    skillCriteria: 'Reach ≥90% weighted aggregate practical mastery score across all dimensions.',
    badgeColor: 'amber',
    accreditationCode: 'VLAB-HONORS-90-GOLD',
    iconName: 'sparkles',
  },
  {
    id: 'milestone-overall-95',
    title: 'Grand Practical Laureate',
    shortTitle: 'Overall 95% (Elite)',
    competencyKey: 'overall',
    threshold: 95,
    tier: 'platinum',
    categoryLabel: 'Comprehensive Mastery',
    description: 'Top 1% laboratory rigor. Demonstrates flawless experimental precision, theoretical mastery, and diagnostic safety.',
    skillCriteria: 'Reach ≥95% weighted aggregate practical score across all virtual laboratory units.',
    badgeColor: 'purple',
    accreditationCode: 'VLAB-LAUREATE-95-PLAT',
    iconName: 'sparkles',
  },
];

export function calculateOverallMastery(scores: Record<CompetencyKey, number>): number {
  return Math.round(
    (Object.keys(COMPETENCY_DIMENSIONS) as CompetencyKey[]).reduce(
      (sum, key) => sum + (scores[key] || 75) * COMPETENCY_DIMENSIONS[key].weight,
      0
    )
  );
}

export function getMilestoneStatuses(
  milestones: CompetencyMilestone[] = COMPETENCY_MILESTONES,
  scores: Record<CompetencyKey, number>,
  studentName = 'Aarav Sharma',
  enrollmentCode = 'STU-2026-081'
): StudentMilestoneStatus[] {
  const overallMastery = calculateOverallMastery(scores);

  return milestones.map((milestone) => {
    const currentScore =
      milestone.competencyKey === 'overall'
        ? overallMastery
        : scores[milestone.competencyKey] || 0;

    const isUnlocked = currentScore >= milestone.threshold;
    const progressPercentage = Math.min(100, Math.round((currentScore / milestone.threshold) * 100));
    const pointsNeeded = Math.max(0, milestone.threshold - currentScore);

    // Deterministic credential hash based on student and milestone
    const sanitizedStudent = studentName.replace(/\s+/g, '').toUpperCase().slice(0, 5);
    const sanitizedCode = enrollmentCode.replace(/[^a-zA-Z0-9]/g, '');
    const credentialCode = `${milestone.accreditationCode}-${sanitizedStudent}-${sanitizedCode}`;

    return {
      milestone,
      isUnlocked,
      currentScore,
      threshold: milestone.threshold,
      progressPercentage,
      pointsNeeded,
      unlockedAt: isUnlocked ? '2026-09-18' : undefined,
      credentialCode,
    };
  });
}

export function detectNewlyUnlockedMilestones(
  prevScores: Record<CompetencyKey, number>,
  nextScores: Record<CompetencyKey, number>,
  milestones: CompetencyMilestone[] = COMPETENCY_MILESTONES
): CompetencyMilestone[] {
  const prevOverall = calculateOverallMastery(prevScores);
  const nextOverall = calculateOverallMastery(nextScores);

  return milestones.filter((milestone) => {
    const prevVal =
      milestone.competencyKey === 'overall'
        ? prevOverall
        : prevScores[milestone.competencyKey] || 0;

    const nextVal =
      milestone.competencyKey === 'overall'
        ? nextOverall
        : nextScores[milestone.competencyKey] || 0;

    return prevVal < milestone.threshold && nextVal >= milestone.threshold;
  });
}
