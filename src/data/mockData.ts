import { Experiment, ScenarioModule, Assignment, ClassCourse, StudentSubmission } from '../types';

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-ohms-law',
    title: "Ohm's Law & Conductor Resistance Verification",
    code: 'PHY-LAB-101',
    subject: 'Physics',
    syllabusTag: 'AICTE / CBSE Class 12 Lab Experiment 1',
    semester: 'Semester 1 / Grade 12',
    durationMinutes: 45,
    description:
      'Empirical investigation of the relationship between potential difference and electric current through an ohmic conductor. Calibrate ammeter shunt resistance, evaluate Joule heating deviation, and determine internal source resistance.',
    objectives: [
      'Assemble a regulated DC circuit with voltmeter, ammeter, rheostat, and unknown resistor.',
      'Plot potential difference (V) vs current (I) across multiple operating points.',
      'Calculate electrical resistance using linear regression slope (R = ΔV/ΔI) and calculate wire resistivity.',
      'Recognize non-ohmic departure caused by thermal heating under excessive current.',
    ],
    apparatusList: [
      'Regulated DC Power Supply (0–12V)',
      'Digital / Analog DC Voltmeter (0–10V, 0.05V resolution)',
      'DC Milliammeter (Dual range: 0–500mA / 0–2A)',
      'Wire-wound Rheostat (0–100Ω variable load)',
      'Unknown Nichrome Resistance Coil (Spec: ~15Ω ± 5%)',
      'One-way Key Switch & Banana plug connecting wires',
    ],
    keyFormulas: [
      { label: "Ohm's Law", formula: 'V = I · R' },
      { label: 'Regression Resistance', formula: 'R = (Σ(V - V̄)(I - Ī)) / Σ(I - Ī)²' },
      { label: 'Thermal Resistance Shift', formula: 'R(T) = R₀[1 + α(T - T₀)]' },
    ],
    scenarios: ['scen-ecg-divider'],
    tasks: [
      {
        id: 'task-ohm-1',
        experimentId: 'exp-ohms-law',
        stage: 'pre_lab',
        title: 'Instrument Range & Burden Voltage Selection',
        type: 'parameter_select',
        competencyDimension: 'setup_adherence',
        points: 20,
        prompt:
          'You are testing a 15Ω resistor powered by a variable 0-6V DC supply. What ammeter range should you select to prevent meter overload while retaining highest measurement resolution?',
        options: [
          { id: 'opt-1', text: '0–50 mA (High resolution, micro-burden)' },
          { id: 'opt-2', text: '0–500 mA range (Max expected I = 6V / 15Ω = 400mA)' },
          { id: 'opt-3', text: '0–10 A range (Prevents any risk of meter trip)' },
          { id: 'opt-4', text: 'Direct unmetered shunt connection' },
        ],
        correctAnswer: 'opt-2',
        explanation:
          'At 6V across 15Ω, maximum theoretical current is I = V/R = 6/15 = 0.4A (400mA). The 500mA range provides high accuracy without blowing the internal 50mA fuse or suffering from coarse scale quantization in the 10A range.',
      },
      {
        id: 'task-ohm-2',
        experimentId: 'exp-ohms-law',
        stage: 'during_lab',
        title: 'Anomalous Data Point & Outlier Diagnosis',
        type: 'mcq',
        competencyDimension: 'data_interpretation',
        points: 25,
        prompt:
          'During data recording, at V = 4.5V your ammeter displays 120mA, whereas at V = 3.0V it showed 200mA. What physical error most likely caused this reading?',
        options: [
          { id: 'a', text: 'Loose crocodile clip or poor high-resistance contact developed on the terminal' },
          { id: 'b', text: 'The resistor transitioned into a superconductive state' },
          { id: 'c', text: 'Ohm’s law fundamentally collapses above 4V' },
          { id: 'd', text: 'The ammeter shunt resistance spontaneously halved' },
        ],
        correctAnswer: 'a',
        explanation:
          'An unexpected drop in current at higher applied voltage indicates an unintended high contact resistance introduced into the series loop (e.g., loose terminal or oxidized binding post).',
      },
      {
        id: 'task-ohm-3',
        experimentId: 'exp-ohms-law',
        stage: 'during_lab',
        title: 'Resistance Calculation from Empirical Slope',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 25,
        prompt:
          'If your linear best-fit slope of the V vs I line is 14.85 V/A with an uncertainty of ±0.3Ω, calculate the measured resistance value in Ohms (Ω).',
        correctAnswer: 14.85,
        numericTolerance: 0.5,
        explanation:
          'By definition of Ohm’s law, R = dV/dI. Hence the slope directly represents the measured resistance of 14.85Ω.',
      },
      {
        id: 'task-ohm-4',
        experimentId: 'exp-ohms-law',
        stage: 'viva',
        title: 'Adaptive AI Viva: High-Current Non-Linearity',
        type: 'viva_text',
        competencyDimension: 'troubleshooting_safety',
        points: 30,
        prompt:
          'Explain why the V-I curve starts bending upwards (current increasing slower than voltage) when high currents are passed continuously through the wire for prolonged periods.',
        rubric:
          'Must mention: (1) Joule heating / electric power dissipation (P = I²R or V²/R), (2) Temperature rise of the metallic conductor, (3) Positive temperature coefficient of resistance (α > 0) causing increased lattice vibrations and electron scattering, leading to increased resistance.',
        explanation:
          'Continuous current produces Joule heating (P = I²R). As the conductor heats up, metal atoms vibrate with greater amplitude, increasing electron-lattice scattering and thus increasing resistance (R = R₀(1 + αΔT)).',
      },
    ],
  },
  {
    id: 'exp-titration',
    title: 'Potentiometric Acid-Base Titration & pH Inflection Curve',
    code: 'CHM-LAB-204',
    subject: 'Chemistry',
    syllabusTag: 'AICTE First Year Engg Chem / CBSE 12 Practical Unit 4',
    semester: 'Semester 1 or 2',
    durationMinutes: 50,
    description:
      'Perform quantitative neutralization titration of a strong acid (HCl) with standardized sodium hydroxide (0.10 M NaOH). Monitor real-time electrode potential, determine the equivalence volume from the first derivative peak, and calibrate indicator transitions.',
    objectives: [
      'Calibrate glass-combination pH electrode using standard buffer solutions (pH 4.01, 7.00, 10.01).',
      'Record pH progression upon precise dropwise additions of 0.1M titrant from a class-A 50mL burette.',
      'Plot pH vs Volume curve and determine exact equivalence volume via ΔpH/ΔV derivative inflection.',
      'Evaluate color indicator dissociation range vs electrochemical potentiometric inflection.',
    ],
    apparatusList: [
      'Precision 50 mL Class-A Glass Burette (0.05 mL graduated)',
      'Digital pH Meter with Combination Glass Electrode (0.01 pH sensitivity)',
      'Magnetic Stirrer with PTFE coated stir-bar & speed control',
      'Standardized Sodium Hydroxide (0.100 M NaOH)',
      'Analyte: Hydrochloric Acid aliquot (25.0 mL unknown ~0.08–0.12 M)',
      'Phenolphthalein & Methyl Orange visual indicators',
    ],
    keyFormulas: [
      { label: 'Neutralization Eq', formula: 'HCl + NaOH → NaCl + H₂O' },
      { label: 'Molarity Equivalence', formula: 'M_acid · V_acid = M_base · V_base' },
      { label: 'First Derivative Equiv', formula: '(dpH / dV)_max at V = V_eq' },
    ],
    scenarios: ['scen-effluent-neutralization'],
    tasks: [
      {
        id: 'task-titr-1',
        experimentId: 'exp-titration',
        stage: 'pre_lab',
        title: 'Burette Meniscus & Parallax Prevention',
        type: 'parameter_select',
        competencyDimension: 'setup_adherence',
        points: 20,
        prompt:
          'When reading clear colorless 0.1M NaOH solution in a glass burette, how must the student position their eye and read the level?',
        options: [
          { id: 'opt-1', text: 'Eye perpendicular to liquid column, read the bottom of the curved meniscus' },
          { id: 'opt-2', text: 'Eye slightly above the liquid level to see the reflective top ring' },
          { id: 'opt-3', text: 'Read the upper edge of the meniscus to compensate for surface tension' },
          { id: 'opt-4', text: 'Take an average between top and bottom meniscus' },
        ],
        correctAnswer: 'opt-1',
        explanation:
          'For colorless solutions in glass, reading the bottom of the concave meniscus at eye level prevents vertical parallax error.',
      },
      {
        id: 'task-titr-2',
        experimentId: 'exp-titration',
        stage: 'during_lab',
        title: 'Identifying the Equivalence Region',
        type: 'mcq',
        competencyDimension: 'data_interpretation',
        points: 25,
        prompt:
          'Why does the pH curve show a steep jump from ~pH 3.5 to ~pH 10.5 within just 0.2 mL of titrant addition near equivalence?',
        options: [
          { id: 'a', text: 'Because pH is a logarithmic scale of [H⁺], and residual [H⁺] drops by orders of magnitude' },
          { id: 'b', text: 'The magnetic stir bar causes cavitation bubbles that confuse the electrode' },
          { id: 'c', text: 'The glass electrode temporarily shorts out in neutral water' },
          { id: 'd', text: 'Sodium chloride precipitation consumes the remaining water molecules' },
        ],
        correctAnswer: 'a',
        explanation:
          'Because pH = -log₁₀[H⁺], removing the last micromoles of unneutralized H⁺ ions alters [H⁺] by factors of 10,000×, causing a massive logarithmic change with minimal titrant addition.',
      },
      {
        id: 'task-titr-3',
        experimentId: 'exp-titration',
        stage: 'during_lab',
        title: 'Unknown Acid Molarity Calculation',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 25,
        prompt:
          'If 25.0 mL of unknown HCl reached equivalence at 21.50 mL of 0.100 M NaOH, what is the exact molarity of the HCl sample (in mol/L)?',
        correctAnswer: 0.086,
        numericTolerance: 0.003,
        explanation:
          'M_acid = (M_base · V_base) / V_acid = (0.100 M · 21.50 mL) / 25.0 mL = 0.0860 M.',
      },
      {
        id: 'task-titr-4',
        experimentId: 'exp-titration',
        stage: 'viva',
        title: 'Adaptive AI Viva: Indicator Selection Rationale',
        type: 'viva_text',
        competencyDimension: 'experimental_design',
        points: 30,
        prompt:
          'Why is phenolphthalein (color transition pH 8.2 - 10.0) an acceptable visual indicator for strong acid - strong base titration even though pure neutral equivalence is pH 7.00?',
        rubric:
          'Must mention: (1) The steep vertical inflection of strong acid-strong base titration spans from pH 3.5 to 10.5, (2) The entire jump occurs within less than half a drop (0.02 mL) of titrant, (3) The titration error introduced by stopping at pH 8.3 vs 7.0 is negligible (< 0.1%).',
        explanation:
          'Because the inflection curve is virtually vertical through pH 4 to 10 within a fraction of a drop, phenolphthalein’s endpoint volume matches the stoichiometric equivalence volume within 0.05% margin.',
      },
    ],
  },
  {
    id: 'exp-photoelectric',
    title: "Photoelectric Effect & Planck's Constant Determination",
    code: 'PHY-LAB-305',
    subject: 'Physics',
    syllabusTag: 'AICTE Engg Physics Unit 4 / Quantum Mechanics Lab',
    semester: 'Semester 2 or 3',
    durationMinutes: 50,
    description:
      'Investigate quantum photon emission by illuminating vacuum phototubes with discrete monochromatic wavelengths (Mercury spectral lines). Measure stopping potentials across variable retarding voltages, determine the threshold frequency, and compute Planck’s constant (h).',
    objectives: [
      'Vary retarding voltage across a photocell to identify exact stopping potential (V₀) where photocurrent ceases.',
      'Demonstrate that stopping potential depends linearly on light frequency and is independent of light intensity.',
      'Verify that photocurrent magnitude scales proportionally with intensity, validating photon flux theory.',
      'Plot stopping potential (V₀) vs light frequency (f) to deduce Planck’s constant (h) and cathode work function (Φ).',
    ],
    apparatusList: [
      'Monochromatic Tunable Light Source (380nm UV to 650nm Red filter wheel)',
      'Vacuum Phototube with Cesium/Potassium photocathode',
      'Regulated Reverse Biasing DC Voltage Source (-5.00V to +2.00V, 0.01V vernier)',
      'Ultra-sensitive Electrometer / Picoammeter (0.01 nA resolution)',
      'Variable Aperture / Neutral Density Filters (20%, 40%, 60%, 80%, 100% optical intensity)',
    ],
    keyFormulas: [
      { label: "Einstein's Photoelectric Eq", formula: 'e · V₀ = h · f - Φ' },
      { label: 'Stopping Potential vs f', formula: 'V₀ = (h/e) · f - (Φ/e)' },
      { label: 'Planck Constant', formula: 'h = e · (Slope of V₀ vs f)' },
    ],
    scenarios: ['scen-solar-photocell'],
    tasks: [
      {
        id: 'task-photo-1',
        experimentId: 'exp-photoelectric',
        stage: 'pre_lab',
        title: 'Classical Wave Theory vs Photon Collision Prediction',
        type: 'mcq',
        competencyDimension: 'experimental_design',
        points: 20,
        prompt:
          'According to Einstein’s photon hypothesis, what happens to the stopping potential (V₀) when the light intensity is doubled while keeping wavelength strictly constant at 436nm?',
        options: [
          { id: 'a', text: 'Stopping potential remains exactly unchanged' },
          { id: 'b', text: 'Stopping potential doubles because the wave electric field doubles' },
          { id: 'c', text: 'Stopping potential drops to zero due to photo-saturation' },
          { id: 'd', text: 'Stopping potential halves due to electron cloud repulsion' },
        ],
        correctAnswer: 'a',
        explanation:
          'Stopping potential depends solely on the maximum kinetic energy of ejected photoelectrons (KE_max = hf - Φ), which is governed by individual photon energy, not the quantity of photons (intensity).',
      },
      {
        id: 'task-photo-2',
        experimentId: 'exp-photoelectric',
        stage: 'during_lab',
        title: 'Identifying Stopping Potential (V₀) from I-V Curve',
        type: 'parameter_select',
        competencyDimension: 'measurement_precision',
        points: 25,
        prompt:
          'When increasing the retarding negative potential on the anode, how is the stopping potential V₀ precisely located on the picoammeter?',
        options: [
          { id: 'opt-1', text: 'The exact reverse voltage at which the photocurrent just reaches zero (I = 0.00 nA)' },
          { id: 'opt-2', text: 'The voltage where current reaches 50% of saturation' },
          { id: 'opt-3', text: 'The maximum forward bias voltage that does not heat the tube' },
          { id: 'opt-4', text: 'The voltage at which anode glows blue' },
        ],
        correctAnswer: 'opt-1',
        explanation:
          'Stopping potential is the exact negative reverse voltage applied to the anode that arrests even the fastest emitted photoelectron with maximum kinetic energy, bringing net current to zero.',
      },
      {
        id: 'task-photo-3',
        experimentId: 'exp-photoelectric',
        stage: 'during_lab',
        title: 'Planck’s Constant Empirical Slope Extraction',
        type: 'numeric',
        competencyDimension: 'data_interpretation',
        points: 25,
        prompt:
          'From your linear regression of V₀ vs Frequency (f), the slope is 4.14 × 10⁻¹⁵ V·s. Given elementary charge e = 1.602 × 10⁻¹⁹ C, calculate Planck’s constant h in units of 10⁻³⁴ J·s (enter just the numerical coefficient, e.g. 6.63).',
        correctAnswer: 6.63,
        numericTolerance: 0.3,
        explanation:
          'h = e · slope = (1.602 × 10⁻¹⁹ C) × (4.14 × 10⁻¹⁵ V·s) = 6.63 × 10⁻³⁴ J·s.',
      },
      {
        id: 'task-photo-4',
        experimentId: 'exp-photoelectric',
        stage: 'viva',
        title: 'Adaptive AI Viva: Threshold Frequency Physical Meaning',
        type: 'viva_text',
        competencyDimension: 'troubleshooting_safety',
        points: 30,
        prompt:
          'If a red laser of wavelength 680nm is focused with very high power (100 Watts) on a Cesium cathode with work function 2.14 eV, will any photoelectrons be emitted? Explain why or why not.',
        rubric:
          'Must mention: (1) Energy of 680nm photon is E = hc/λ ≈ 1.82 eV, (2) 1.82 eV is strictly less than the work function Φ = 2.14 eV (frequency is below threshold f₀), (3) Photoelectric emission is a one-photon to one-electron quantum interaction; beam intensity/power cannot overcome the energy deficit of individual photons.',
        explanation:
          'No photoelectrons will be emitted. The energy of an individual 680nm photon is hc/λ ≈ 1.82 eV, which is less than the 2.14 eV work function. In single-photon absorption, high intensity merely increases the count of sub-threshold photons without increasing individual photon energy.',
      },
    ],
  },
  {
    id: 'exp-convex-lens',
    title: 'Determination of the Focal Length of a Convex Lens Using the u-v Method',
    code: 'OPT-LAB-201',
    subject: 'Physics',
    syllabusTag: 'CBSE / AICTE Class 12 / General Physics Optics Lab',
    semester: 'Semester 1 / Grade 12',
    durationMinutes: 45,
    description:
      'Empirical investigation of conjugate foci and focal length of a biconvex lens on an optical bench. Position the illuminated object, lens, and screen independently, calculate realistic image positions with measurement uncertainty, detect optical sharpness, log u, v, 1/u, 1/v, and analyze hyperbolic and linear relationships.',
    objectives: [
      'Independently align the illuminated object, convex lens holder, and screen on a dual-rail optical bench.',
      'Measure object distance u and corresponding sharp image distance v across multiple trials (u > 2f, u = 2f, f < u < 2f).',
      'Detect real vs virtual image thresholds and diagnose circles of confusion in out-of-focus states.',
      'Log u, v, 1/u, and 1/v data and calculate focal length using the thin lens formula f = (u · v) / (u + v).',
      'Analyze the u-v hyperbola curve and 1/v vs 1/u linear plot to compare empirical values with nominal lens specifications.',
      'Troubleshoot optical projector displacement issues where images form behind the screen plane.',
    ],
    apparatusList: [
      'Dual-rail Optical Bench (0–120 cm) with mm graduated scale and leveling screws',
      'Convex Lens Holder with upright brass rider and optical biconvex lens (f ≈ 15.0 cm)',
      'Illuminated Object Upright with LED crosswire/arrow illuminator and frosted diffuser',
      'White Frosted Projection Screen with mm alignment grid and index pointer',
      'Metre Scale & cursor index pointers with locking thumbscrews',
      'Spirit level & lens cleaning tissue',
    ],
    keyFormulas: [
      { label: 'Lens Formula (Cartesian)', formula: '1/f = 1/v - 1/u' },
      { label: 'Focal Length (Magnitudes)', formula: 'f = (u · v) / (u + v)' },
      { label: 'Transverse Magnification', formula: 'm = -v / u = h_img / h_obj' },
      { label: 'Lens Power', formula: 'P = 1 / f (in metres, Dioptres D)' },
    ],
    scenarios: ['scen-projector-optics'],
    tasks: [
      {
        id: 'task-lens-1',
        experimentId: 'exp-convex-lens',
        stage: 'pre_lab',
        title: 'Real vs Virtual Image Formation Prediction',
        type: 'mcq',
        competencyDimension: 'data_interpretation',
        points: 20,
        prompt:
          'A convex lens of focal length f = 15.0 cm is placed in the bench holder. An illuminated object is placed at distance u = 10.0 cm from the lens (u < f). Predict whether the resulting image is real or virtual, and its location.',
        options: [
          { id: 'opt-a', text: 'Real, inverted, formed on the projection screen at v = 30.0 cm' },
          { id: 'opt-b', text: 'Virtual, erect, and magnified, formed at v = -30.0 cm on the same side as the object (cannot be formed on screen)' },
          { id: 'opt-c', text: 'Real, erect, formed at the focal point F₂ (v = 15.0 cm)' },
          { id: 'opt-d', text: 'No rays emerge; total internal reflection traps light inside the glass' },
        ],
        correctAnswer: 'opt-b',
        explanation:
          'When an object is placed inside the principal focus (u < f), refracted rays diverge. Tracing them backwards reveals an erect, magnified, virtual image at 1/v = 1/f - 1/u = 1/15 - 1/10 = -1/30 => v = -30 cm. Because the light rays do not actually intersect, a virtual image cannot be captured on a physical projection screen.',
      },
      {
        id: 'task-lens-2',
        experimentId: 'exp-convex-lens',
        stage: 'pre_lab',
        title: 'Select the Correct Lens Position (Conjugate Foci)',
        type: 'parameter_select',
        competencyDimension: 'setup_adherence',
        points: 20,
        prompt:
          'On the optical bench, an illuminated object is fixed at the 10.0 cm mark (x_obj = 10.0 cm) and the screen is fixed at the 90.0 cm mark (x_screen = 90.0 cm), giving total separation D = 80.0 cm. For a lens with f = 15.0 cm, at which lens position mark on the bench can a sharp real image be formed on the screen?',
        options: [
          { id: 'pos-1', text: 'x_lens = 30.0 cm (u = 20.0 cm, v = 60.0 cm; magnified real image)' },
          { id: 'pos-2', text: 'x_lens = 45.0 cm (u = 35.0 cm, v = 45.0 cm)' },
          { id: 'pos-3', text: 'x_lens = 50.0 cm (u = 40.0 cm, v = 40.0 cm — only sharp if f = 20.0 cm)' },
          { id: 'pos-4', text: 'x_lens = 25.0 cm (u = 15.0 cm — object at focus, rays emerge parallel)' },
        ],
        correctAnswer: 'pos-1',
        explanation:
          'From the displacement method: u + v = D = 80 cm and 1/v + 1/u = 1/15 => u² - 80u + 1200 = 0 => u = 20 cm or u = 60 cm. Choosing u = 20 cm gives x_lens = x_obj + u = 10.0 + 20.0 = 30.0 cm, where v = 60.0 cm reaches the screen at 30.0 + 60.0 = 90.0 cm.',
      },
      {
        id: 'task-lens-3',
        experimentId: 'exp-convex-lens',
        stage: 'during_lab',
        title: 'Identify Why an Image is Blurred & Corrective Action',
        type: 'mcq',
        competencyDimension: 'troubleshooting_safety',
        points: 25,
        prompt:
          'During an experimental trial with u = 25.0 cm and lens f = 15.0 cm, the screen is stationed at distance v = 28.0 cm from the lens. The student observes a diffuse, blurred circle instead of a sharp arrow. Why is the image blurred, and what adjustment is required?',
        options: [
          { id: 'diag-a', text: 'The true conjugate focal plane is at v = (25 · 15)/(25 - 15) = 37.5 cm; the screen is 9.5 cm too close to the lens. The screen must be moved away to the 37.5 cm position.' },
          { id: 'diag-b', text: 'The light intensity is too high; the student must dim the lamp to eliminate chromatic aberration.' },
          { id: 'diag-c', text: 'The lens has reversed polarity and must be flipped by 180 degrees.' },
          { id: 'diag-d', text: 'The screen is too far; bringing it closer to 15.0 cm will restore focus.' },
        ],
        correctAnswer: 'diag-a',
        explanation:
          'By the thin lens equation, the true sharp image plane is v = (u · f)/(u - f) = (25 × 15)/10 = 37.5 cm. Stationing the screen at v = 28.0 cm intercepts the converging cone of rays prematurely, producing an out-of-focus blur circle (circle of confusion). Moving the screen outward to v = 37.5 cm achieves sharp focus.',
      },
      {
        id: 'task-lens-4',
        experimentId: 'exp-convex-lens',
        stage: 'during_lab',
        title: 'Calculate Focal Length Using the Lens Formula',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 25,
        prompt:
          'In an experimental trial on the optical bench, an object is placed at distance u = 30.0 cm from the lens. The screen is adjusted until the image is pin-sharp, yielding a screen distance of v = 30.2 cm. Using the lens formula f = (u · v) / (u + v), calculate the experimental focal length f in cm (rounded to two decimal places).',
        correctAnswer: 15.05,
        numericTolerance: 0.15,
        explanation:
          'Using the formula: f = (u · v) / (u + v) = (30.0 × 30.2) / (30.0 + 30.2) = 906.0 / 60.2 = 15.0498... ≈ 15.05 cm.',
      },
      {
        id: 'task-lens-5',
        experimentId: 'exp-convex-lens',
        stage: 'during_lab',
        title: 'Identify an Anomalous Trial & Parallax Error',
        type: 'mcq',
        competencyDimension: 'data_interpretation',
        points: 25,
        prompt:
          'Examine the following table of (u, v) trials recorded for a convex lens with nominal f = 15.0 cm:\nTrial 1: u = 50.0 cm, v = 21.4 cm -> f = 14.99 cm\nTrial 2: u = 40.0 cm, v = 24.1 cm -> f = 15.04 cm\nTrial 3: u = 24.0 cm, v = 28.5 cm -> f = 13.03 cm\nTrial 4: u = 20.0 cm, v = 60.1 cm -> f = 15.01 cm\nWhich trial is clearly anomalous, and what error accounts for it?',
        options: [
          { id: 'anom-1', text: 'Trial 1: Object is too distant, causing optical wavefront distortion.' },
          { id: 'anom-2', text: 'Trial 3: f = 13.03 cm deviates severely (~2.0 cm low); the student logged an out-of-focus blurred image (true sharp v is 40.0 cm) or made a scale reading index error.' },
          { id: 'anom-3', text: 'Trial 4: v = 60.1 cm is too large to be an optical solution.' },
          { id: 'anom-4', text: 'Trial 2: u and v values must be identical integers.' },
        ],
        correctAnswer: 'anom-2',
        explanation:
          'For Trial 3 with u = 24.0 cm and nominal f = 15.0 cm, the sharp image distance should be v = (24 × 15)/(24 - 15) = 360 / 9 = 40.0 cm. The recorded value of v = 28.5 cm is grossly premature, indicating the student logged a defocused circle or read an erroneous scale mark, corrupting f to 13.03 cm.',
      },
      {
        id: 'task-lens-6',
        experimentId: 'exp-convex-lens',
        stage: 'during_lab',
        title: 'Interpret the Relationship Between u and v',
        type: 'mcq',
        competencyDimension: 'data_interpretation',
        points: 25,
        prompt:
          'In the u-v method, as the illuminated object is moved continuously closer to the lens from u = 60.0 cm towards the focal point u = 15.0 cm, how do the image distance v, the image magnification m, and the u-v curve behave?',
        options: [
          { id: 'rel-a', text: 'Image distance v increases asymptotically towards infinity, magnification |m| increases rapidly (image becomes larger and inverted), and the points trace out a rectangular hyperbola.' },
          { id: 'rel-b', text: 'Image distance v decreases linearly towards zero, and the image shrinks into a single point.' },
          { id: 'rel-c', text: 'v remains constant at 15.0 cm because focal length does not change.' },
          { id: 'rel-d', text: 'Image distance v increases, but image height decreases inversely.' },
        ],
        correctAnswer: 'rel-a',
        explanation:
          'As u approaches f from the right (u -> f⁺), the denominator (u - f) approaches zero, driving v = (u · f)/(u - f) towards +∞. Transverse magnification |m| = v/u grows without limit, producing an increasingly magnified inverted real image that moves rapidly away along the hyperbolic branch.',
      },
      {
        id: 'task-lens-viva',
        experimentId: 'exp-convex-lens',
        stage: 'viva',
        title: 'Adaptive AI Viva: Lens Formula, Sign Convention & Optical Alignment',
        type: 'viva_text',
        competencyDimension: 'troubleshooting_safety',
        points: 30,
        prompt:
          'Explain how the Cartesian sign convention is applied to the lens formula 1/f = 1/v - 1/u to derive f = (u · v)/(u + v) for a real image. Additionally, why is the real image inverted, and how do you achieve proper collinear optical alignment of the bench uprights?',
        rubric:
          'Must mention: (1) Cartesian sign convention: light travels left-to-right; object distance u is negative (-u), real image distance v is positive (+v), and convex lens focal length is positive (+f), yielding 1/f = 1/v - 1/(-u) = 1/v + 1/u. (2) Real image inversion: rays from the top of the object pass through optical center O and intersect below the principal axis, yielding negative magnification m = -v/u < 0. (3) Optical alignment: adjusting rider heights and leveling screws so the optical centers of object, lens aperture, and screen are collinear along the central optical axis, eliminating tilt and parallax.',
        explanation:
          'Under Cartesian convention, distances measured against incident light are negative (object distance = -u), while distances along incident rays are positive (real image distance = +v, focal length = +f). Substituting gives 1/f = 1/v - 1/(-u) = 1/v + 1/u, which rearranges to f = (u · v)/(u + v). The real image is formed by rays intersecting below the axis, giving an inverted image. Collinear optical alignment requires leveling the bench and matching upright rider heights so the lens principal axis passes cleanly through object and screen centers.',
      },
    ],
  },
  {
    id: 'exp-pcr-gel',
    title: 'PCR: Amplification of a Target DNA Sequence and Analysis by Agarose Gel Electrophoresis',
    code: 'BIO-LAB-301',
    subject: 'Biology',
    syllabusTag: 'Undergraduate Molecular Biology & Biotechnology / Medical Biochemistry',
    semester: 'Semester 3 / Core Biology',
    durationMinutes: 50,
    description:
      'Empirical molecular-biology laboratory exercise: assemble a 25 µL PCR reaction mixture (template DNA, forward/reverse primers, Taq polymerase, dNTPs, reaction buffer, and MgCl₂ cofactor), operate a programmable 3-step thermal cycler, resolve amplicons on a submarine horizontal agarose gel tank, analyze bands against a 100 bp DNA ladder under UV transillumination, and troubleshoot control failures and contamination.',
    objectives: [
      'Assemble 25 µL PCR reactions for unknown patient sample, positive control, and negative control (NTC) using micropipettes and barrier tips.',
      'Configure and execute a 3-step thermal cycler program (95°C denaturation, 55°C annealing, 72°C extension) with heated lid.',
      'Evaluate the biochemical role of each reagent component (Taq polymerase, dNTPs, forward/reverse primers, Mg²⁺ cofactor, buffer).',
      'Perform micro-centrifugation and vortexing to ensure homogeneous reactant mixing at the tube apex.',
      'Cast, submerge, and load a 1.5% agarose gel in 1X TAE buffer with 6X loading dye and run towards the positive anode ("run to red").',
      'Analyze molecular weight bands against a 100 bp DNA ladder under UV transillumination to verify the 500 bp amplicon.',
      'Diagnose experimental failures including reagent omissions, false positives from NTC contamination, and non-specific mispriming.',
    ],
    apparatusList: [
      'Adjustable Micropipettes (P10: 0.5–10 µL, P20: 2–20 µL, P200: 20–200 µL) with sterile aerosol-barrier tips',
      '0.2 mL thin-wall PCR tubes in cold aluminum rack and 1.5 mL microcentrifuge tube rack',
      'Benchtop Mini Centrifuge (quick pulse spin-down) & Touch Vortex Mixer',
      'Insulated Ice Bucket with reagent vials (Template DNA, +Ctrl, NTC, Primers, Taq, dNTPs, Buffer, MgCl₂)',
      'Programmable 96-well Thermal Cycler with 105°C heated lid and real-time cycle monitor',
      'Horizontal Submarine Agarose Gel Box (1X TAE buffer, platinum wire electrodes, casting tray with 4-well comb)',
      'Regulated Electrophoresis DC Power Supply (Constant voltage 100V, timer)',
      'Dark-hood UV/Blue LED Gel Documentation Transilluminator with calibration reticle',
    ],
    keyFormulas: [
      { label: 'DNA Amplification Yield', formula: 'N = N₀ · 2ⁿ' },
      { label: 'Primer Tm (Wallace Rule)', formula: 'Tm = 2(wA + xT) + 4(yG + zC) °C' },
      { label: 'Optimal Annealing Temp', formula: 'Ta ≈ Tm_primer - 5 °C' },
      { label: 'Agarose Mobility Relationship', formula: 'Distance (Rf) ∝ -log₁₀(base pairs)' },
    ],
    scenarios: ['scen-pcr-investigation'],
    tasks: [
      {
        id: 'task-pcr-1',
        experimentId: 'exp-pcr-gel',
        stage: 'pre_lab',
        title: 'Essential PCR Reaction Components & Master Mix',
        type: 'parameter_select',
        competencyDimension: 'setup_adherence',
        points: 20,
        prompt:
          'To amplify a specific 500 bp genomic fragment, which set of reagents must be present in the reaction tube before placing it into the thermocycler?',
        options: [
          { id: 'mix-a', text: 'Template DNA, single forward primer, RNA polymerase, rNTPs, and sterile water' },
          { id: 'mix-b', text: 'Template DNA, paired forward & reverse primers, thermostable Taq DNA polymerase, dNTP mix (dATP, dCTP, dGTP, dTTP), reaction buffer with Mg²⁺, and nuclease-free water' },
          { id: 'mix-c', text: 'DNA template, ligase enzyme, ATP, ethidium bromide, and distilled tap water' },
          { id: 'mix-d', text: 'Genomic DNA, restriction endonucleases EcoRI/HindIII, buffer, and loading dye' },
        ],
        correctAnswer: 'mix-b',
        explanation:
          'A functional PCR reaction requires: (1) DNA template containing the target sequence, (2) two sequence-specific oligonucleotide primers (forward and reverse) flanking the target, (3) thermostable DNA polymerase (e.g. Taq) to synthesize daughter strands, (4) dNTPs as building blocks and energy, (5) buffer maintaining pH ~8.3 with Mg²⁺ as an essential divalent cofactor for polymerase catalytic activity, and (6) nuclease-free water to bring to final volume.',
      },
      {
        id: 'task-pcr-2',
        experimentId: 'exp-pcr-gel',
        stage: 'pre_lab',
        title: 'Scientific Purpose of the Negative Control (NTC)',
        type: 'mcq',
        competencyDimension: 'experimental_design',
        points: 20,
        prompt:
          'In diagnostic PCR, what is the critical purpose of including a No Template Control (NTC) / Negative Control containing all PCR reagents except template DNA?',
        options: [
          { id: 'ntc-1', text: 'To ensure the thermocycler reaches 95°C during denaturation' },
          { id: 'ntc-2', text: 'To detect reagent or aerosol contamination; if a band appears in the NTC lane, patient positive results cannot be trusted' },
          { id: 'ntc-3', text: 'To serve as a molecular size standard instead of a commercial DNA ladder' },
          { id: 'ntc-4', text: 'To calibrate the UV transilluminator camera exposure time' },
        ],
        correctAnswer: 'ntc-2',
        explanation:
          'The negative control (NTC) tests for carryover, reagent, or aerosol contamination. Because no template DNA is added, no amplification should occur. If a band is observed in the NTC lane, it indicates that one or more reagents or pipette barrels are contaminated with target DNA, rendering all test-sample positive results uninterpretable (potential false positives).',
      },
      {
        id: 'task-pcr-3',
        experimentId: 'exp-pcr-gel',
        stage: 'during_lab',
        title: 'Thermal Cycling Annealing Temperature & Specificity',
        type: 'mcq',
        competencyDimension: 'troubleshooting_safety',
        points: 25,
        prompt:
          'Your primer pair has an average melting temperature (Tm) of 60.0°C. If a student mistakenly sets the thermocycler annealing stage to 45.0°C instead of the recommended 55.0°C (Tm - 5°C), what is the most probable outcome on the agarose gel?',
        options: [
          { id: 'ann-1', text: 'Multiple non-specific bands and smeary background because primers anneal to partially complementary genomic sequences at excessively low stringency' },
          { id: 'ann-2', text: 'No bands at all because Taq polymerase denatures permanently at 45.0°C' },
          { id: 'ann-3', text: 'The DNA ladder will fail to migrate through the agarose gel matrix' },
          { id: 'ann-4', text: 'The target band will migrate twice as fast towards the cathode' },
        ],
        correctAnswer: 'ann-1',
        explanation:
          'At lower annealing temperatures (low stringency), the thermal kinetic barrier is reduced, allowing primers to stably hybridize to non-target genomic sites with partial base-pair mismatches. This mispriming produces multiple spurious, non-specific amplicons and smeary banding patterns on the gel. Raising Ta to ~55°C restores target specificity.',
      },
      {
        id: 'task-pcr-4',
        experimentId: 'exp-pcr-gel',
        stage: 'during_lab',
        title: 'Molecular Weight Sizing Against 100 bp DNA Ladder',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 25,
        prompt:
          'On the transilluminator gel image, the unknown sample displays a sharp fluorescent band that co-migrates directly parallel with the 5th band from the bottom of the 100 bp reference ladder (ladder rungs: 100, 200, 300, 400, 500, 600, 700, 800, 1000, 1500 bp). What is the estimated size of the amplified target DNA fragment in base pairs (bp)?',
        correctAnswer: 500,
        numericTolerance: 20,
        explanation:
          'Counting from the smallest fast-migrating band at the bottom (100 bp): 1st = 100 bp, 2nd = 200 bp, 3rd = 300 bp, 4th = 400 bp, 5th = 500 bp. The unknown amplicon aligns exactly with the 500 bp landmark, confirming successful amplification of the expected 500 bp target sequence.',
      },
      {
        id: 'task-pcr-5',
        experimentId: 'exp-pcr-gel',
        stage: 'during_lab',
        title: 'Agarose Gel Electrophoresis Migration & Polarity ("Run to Red")',
        type: 'mcq',
        competencyDimension: 'setup_adherence',
        points: 20,
        prompt:
          'Why does DNA migrate from the cathode (negative black electrode) towards the anode (positive red electrode) during horizontal agarose gel electrophoresis?',
        options: [
          { id: 'mig-1', text: 'DNA has a net negative charge due to its repeating phosphate backbone (PO₄³⁻), causing it to be repelled by the negative cathode and attracted toward the positive anode' },
          { id: 'mig-2', text: 'DNA is positively charged due to nitrogenous base amino groups, migrating towards the negative electrode' },
          { id: 'mig-3', text: 'Agarose gel possesses a permanent positive magnetic field that pulls neutral DNA molecules' },
          { id: 'mig-4', text: 'Taq polymerase enzymes carry the DNA strands physically across the gel matrix' },
        ],
        correctAnswer: 'mig-1',
        explanation:
          'At physiological and TAE buffer pH (~8.0–8.3), each phosphodiester link in the DNA sugar-phosphate backbone carries a deprotonated negative charge. Thus, DNA has a uniform charge-to-mass ratio and migrates steadily towards the positive anode ("Run to Red"). Small fragments navigate the agarose pore matrix faster than large fragments.',
      },
      {
        id: 'task-pcr-6',
        experimentId: 'exp-pcr-gel',
        stage: 'during_lab',
        title: 'Contaminated Negative Control Troubleshooting',
        type: 'mcq',
        competencyDimension: 'data_interpretation',
        points: 25,
        prompt:
          'Reviewing a completed gel run, an investigator observes: Lane 1 (Ladder): normal; Lane 2 (Positive Ctrl): 500 bp band; Lane 3 (Negative Ctrl / NTC): clear 500 bp band; Lane 4 (Unknown Sample): 500 bp band. What is the scientifically valid conclusion and corrective action?',
        options: [
          { id: 'diag-1', text: 'The patient is definitely positive; proceed to report clinical diagnosis' },
          { id: 'diag-2', text: 'The experiment is invalid due to reagent or template contamination in the NTC; discard shared water/reagents, wipe bench with 10% bleach/DNA decontamination spray, and repeat the assay with fresh aliquots' },
          { id: 'diag-3', text: 'The voltage was too high; rerun the exact same tubes at 50V' },
          { id: 'diag-4', text: 'The gel had too high an agarose percentage; cast a 0.5% gel instead' },
        ],
        correctAnswer: 'diag-2',
        explanation:
          'A band in the negative control (NTC) confirms contamination with target DNA or prior PCR amplicons. Because the unknown sample could have received the same contaminating template, the positive result is uninterpretable and cannot be reported. The run must be discarded, working spaces decontaminated, and the entire assay repeated with fresh sterile aliquots and barrier tips.',
      },
      {
        id: 'task-pcr-viva',
        experimentId: 'exp-pcr-gel',
        stage: 'viva',
        title: 'Adaptive AI Viva: PCR Cycle Kinetics, Hot-Start Enzymes & Control Integrity',
        type: 'viva_text',
        competencyDimension: 'troubleshooting_safety',
        points: 30,
        prompt:
          'Explain the three biochemical stages of a PCR thermal cycle (Denaturation, Annealing, Extension) including their temperatures and mechanisms. Additionally, explain what a "primer-dimer" is and why a failed positive control invalidates a negative test result.',
        rubric:
          'Must mention: (1) Three stages: Denaturation (~95°C breaks hydrogen bonds separating double-stranded DNA into single strands), Annealing (~50–65°C allows forward and reverse sequence-specific oligonucleotide primers to hybridize to flanking template regions), and Extension (~72°C optimal temperature for thermostable Taq polymerase to synthesize complementary strands from 3\'-OH of primers using dNTPs). (2) Primer-dimers: small artifacts (~30–80 bp) formed by primers annealing to each other due to partial 3\' complementarity and extended by Taq. (3) Positive control: confirms all reagents, polymerase activity, and thermocycling worked; if positive control fails, an absence of band in patient sample could be due to dead enzyme or forgotten dNTPs rather than true absence of pathogen DNA.',
        explanation:
          'A standard PCR cycle consists of: (1) Denaturation at ~95°C to melt double-stranded DNA by breaking hydrogen bonds; (2) Annealing at ~50–65°C (typically Tm - 5°C) where primers bind specifically to flanking single strands; (3) Extension at ~72°C where thermostable Taq polymerase incorporates dNTPs onto the 3\'-OH ends of primers at ~1000 bp/min. Primer-dimers are small non-specific artifacts (<100 bp) resulting from primers annealing to one another and being extended. If the positive control fails to amplify, it proves the reaction chemistry or thermocycler failed; consequently, a negative patient result cannot be verified as true negative, rendering the test inconclusive.',
      },
    ],
  },
];

export const SCENARIO_MODULES: ScenarioModule[] = [
  {
    id: 'scen-ecg-divider',
    experimentId: 'exp-ohms-law',
    title: 'Medical ECG Sensor Voltage Divider Sizing & Thermal Derating',
    domain: 'Biomedical & Embedded Systems',
    badge: 'Hardware Design Scenario',
    realWorldRole: 'Biomedical Instrumentation Engineer at MedTech Systems',
    brief:
      'A hospital ECG telemetry unit requires an analog front-end voltage divider to scale a patient baseline signal from a 9V backup lithium cell down to an ADC range strictly not exceeding 3.3V, while drawing less than 20mA to avoid draining the portable battery and preventing resistor thermal drift.',
    mission:
      'Using your empirical resistance, tolerance, and Joule-heating insights from Ohm’s Law, calculate and select optimal resistor values, verify that power dissipation stays within 1/4W resistor safety limits, and evaluate failure modes if an electrode develops high skin-contact resistance.',
    systemParameters: {
      'Input Rail Voltage (Vin)': '9.0 V DC',
      'Target ADC Max Voltage (Vout)': '3.0 V ± 0.15 V',
      'Current Drain Limit': '< 15 mA',
      'Max Resistor Power Rating': '0.25 W (250 mW)',
      'Operating Temperature Range': '20°C to 45°C',
    },
    tasks: [
      {
        id: 'scen-ecg-t1',
        step: 1,
        title: 'Voltage Divider Ratio Selection',
        description:
          'To scale 9.0V down to 3.0V across resistor R2, the ratio R2 / (R1 + R2) must equal 3.0 / 9.0 = 1/3.',
        question:
          'Which standard resistor pair provides a 3.0V output while keeping current drain safely between 1mA and 5mA?',
        type: 'parameter_select',
        competencyDimension: 'experimental_design',
        points: 30,
        options: [
          { id: 'p1', text: 'R1 = 20Ω, R2 = 10Ω (Current = 300mA - excessive battery drain & overheat)' },
          { id: 'p2', text: 'R1 = 2.0kΩ, R2 = 1.0kΩ (Current = 3.0mA, total R = 3.0kΩ)' },
          { id: 'p3', text: 'R1 = 20MΩ, R2 = 10MΩ (Current = 0.3µA - susceptible to ADC input leakage)' },
          { id: 'p4', text: 'R1 = 1.0kΩ, R2 = 2.0kΩ (Yields 6.0V output - exceeds 3.3V ADC limit!)' },
        ],
        correctAnswer: 'p2',
        engineeringContext:
          'Selecting R1 = 2.0kΩ and R2 = 1.0kΩ keeps loop current at I = 9V / 3kΩ = 3.0mA. Power on R1 is P = I²R1 = (0.003)² · 2000 = 0.018W (18mW), well below the 250mW thermal limit.',
      },
      {
        id: 'scen-ecg-t2',
        step: 2,
        title: 'Worst-Case Thermal Dissipation Check',
        description:
          'Evaluate power dissipation on resistor R1 (2.0 kΩ) under a 10% battery overcharge condition (Vin = 9.9V).',
        question:
          'Calculate the exact power dissipated by R1 in milliwatts (mW) under Vin = 9.9V with R1 = 2000Ω and R2 = 1000Ω.',
        type: 'numeric',
        competencyDimension: 'troubleshooting_safety',
        points: 35,
        correctAnswer: 21.78,
        numericTolerance: 1.5,
        engineeringContext:
          'Total current I = 9.9V / 3000Ω = 3.3mA. Power P1 = I² · R1 = (0.0033 A)² · 2000Ω = 0.02178 W = 21.78 mW. This represents an 8.7% stress factor against a 250mW rating, ensuring ultra-reliable hospital operation.',
      },
      {
        id: 'scen-ecg-t3',
        step: 3,
        title: 'AI Diagnostic Challenge: Contact Resistance Fault',
        description:
          'During clinical trials, nurse reports show the ECG baseline voltage occasionally jumps up to 8.2V, saturating the monitor.',
        question:
          'Explain what hardware fault in the divider ground return (R2 connection) would cause the output node to rise near 9V, and propose an on-board hardware protection safeguard.',
        type: 'viva_text',
        competencyDimension: 'troubleshooting_safety',
        points: 35,
        rubric:
          'Must mention: (1) Open-circuit fault on R2 or broken ground trace leaves the output node floating/pulled up to Vin through R1, (2) Hardware mitigation: Add a 3.3V Zener diode or clamp Schottky diode to the 3.3V rail to clamp over-voltages, protecting the sensitive ADC input.',
        engineeringContext:
          'If the ground leg R2 goes open-circuit, zero current flows, so no voltage drop occurs across R1 (V = I·R = 0), pulling the output directly to 9V. A clamping diode prevents ADC destruction.',
      },
    ],
  },
  {
    id: 'scen-effluent-neutralization',
    experimentId: 'exp-titration',
    title: 'Industrial Effluent Neutralization & Autonomous Dosing Control',
    domain: 'Environmental Chemical Engineering',
    badge: 'Process Control Scenario',
    realWorldRole: 'Environmental Compliance Officer at EcoTech Chemical Works',
    brief:
      'A chemical plant discharges 5,000 liters/hour of acidic wash liquor (predominantly hydrochloric acid, pH ~2.1) into an on-site continuous neutralization pit. EPA regulations strictly mandate that discharge to the municipal river must maintain pH strictly between 6.5 and 8.5.',
    mission:
      'Using your potentiometric titration curve data, configure the dosing rate of neutralizing agent (2.0 M NaOH), design a 2-stage dosing control loop to avoid catastrophic overshoot into the alkaline zone (pH > 11), and establish emergency reagent buffer volumes.',
    systemParameters: {
      'Effluent Inflow Rate': '5,000 L / hr',
      'Influent Stream pH': '2.10 (approx 7.94 × 10⁻³ M [H⁺])',
      'Target Discharge pH Window': '6.5 to 8.5',
      'Bulk Neutralizer Reagent': '2.0 M Industrial Grade NaOH',
      'Reaction Basin Retention Time': '20 minutes',
    },
    tasks: [
      {
        id: 'scen-chem-t1',
        step: 1,
        title: 'Primary Reagent Feedrate Sizing',
        description:
          'Compute the stoichiometric amount of 2.0 M NaOH required per hour to neutralize 5,000 L of pH 2.10 influent ([H⁺] = 0.00794 mol/L).',
        question:
          'What is the required 2.0M NaOH volumetric delivery rate in Liters per hour (L/hr)?',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 30,
        correctAnswer: 19.85,
        numericTolerance: 1.0,
        engineeringContext:
          'Total acid moles/hr = 5,000 L · 0.00794 mol/L = 39.7 moles H⁺/hr. Required 2.0 M NaOH volume = 39.7 mol / 2.0 mol/L = 19.85 L/hr.',
      },
      {
        id: 'scen-chem-t2',
        step: 2,
        title: 'Two-Stage Dosing Architecture',
        description:
          'Why do industrial chemical plants almost never attempt to reach pH 7.0 in a single continuous stirred tank reactor with one dosing valve?',
        question:
          'Which explanation correctly reflects the titration curve hazard learned in the lab simulation?',
        type: 'parameter_select',
        competencyDimension: 'experimental_design',
        points: 35,
        options: [
          { id: 'opt-a', text: 'Because near equivalence, the titration slope ΔpH/ΔV is near-vertical; a 1% valve hunting error instantly swings pH from 4.0 to 11.0' },
          { id: 'opt-b', text: 'Because sodium chloride reacts with steel tanks to generate dangerous chlorine gas' },
          { id: 'opt-c', text: 'Because pH electrodes cease working if water flow exceeds 100 L/hr' },
          { id: 'opt-d', text: 'Because pure water has no electrical conductivity' },
        ],
        correctAnswer: 'opt-a',
        engineeringContext:
          'The extreme logarithmic steepness of the strong acid-strong base curve makes single-stage control hyper-sensitive to valve deadband. Industrial plants use a 2-stage cascade (Roughing to pH 4.5, Trim to pH 7.2).',
      },
      {
        id: 'scen-chem-t3',
        step: 3,
        title: 'AI Environmental Audit: Buffer Chemistry Remediation',
        description:
          'The plant manager wants to know if dosing sodium bicarbonate (NaHCO₃) instead of strong NaOH for final trimming would prevent alkaline violations.',
        question:
          'Critique the chemical reasoning for using sodium bicarbonate as a finishing buffer around pH 7.5 to 8.2. How does the buffer system stabilize the discharge against sudden acidic surges?',
        type: 'viva_text',
        competencyDimension: 'data_interpretation',
        points: 35,
        rubric:
          'Must mention: (1) Bicarbonate is an amphoteric buffer (HCO₃⁻ ⇌ H⁺ + CO₃²⁻ and HCO₃⁻ + H⁺ ⇌ H₂CO₃), (2) Unlike strong NaOH which shoots pH to 12 upon slight excess, bicarbonate self-buffers in the pH 7.0–8.3 range, (3) Absorbs sudden acid spikes without hazardous caustic overshoot.',
        engineeringContext:
          'Sodium bicarbonate provides a built-in carbonic acid/bicarbonate buffer plateau, preventing the catastrophic pH spike characteristic of unbuffered strong base additions.',
      },
    ],
  },
  {
    id: 'scen-projector-optics',
    experimentId: 'exp-convex-lens',
    title: 'Classroom Digital Projector Lens Alignment & Focal Plane Calibration',
    domain: 'Optomechanical & Display Systems',
    badge: 'Optics Engineering Scenario',
    realWorldRole: 'Optical Systems Engineer at Lumina Projection Technologies',
    brief:
      'You are commissioning a high-brightness multimedia projector equipped with an f = 20.0 cm biconvex projection lens in a college auditorium. During installation, the projection screen is fixed at distance L = 4.00 m (400 cm) from the lens, but the sharp image plane is converging 50 cm behind the screen (v = 4.50 m = 450 cm), leaving an unresolved, blurred circle of confusion on the auditorium screen.',
    mission:
      'Using the conjugate u-v lens equations and geometric optics principles, diagnose why the image is appearing behind the screen, calculate the exact mechanical adjustment required for the lens-to-slide distance (u), and evaluate depth-of-field and keystone alignment.',
    systemParameters: {
      'Projection Lens Focal Length (f)': '20.0 cm (0.20 m)',
      'Auditorium Screen Distance (L)': '4.00 m (400 cm)',
      'Current Convergent Plane (v_current)': '4.50 m (450 cm — 50 cm behind screen)',
      'Current Slide Distance (u_current)': '20.93 cm',
      'Target Screen Conjugate (v_target)': '4.00 m (400 cm)',
      'Allowed Blur Circle on Screen': '< 1.5 mm (Pixel pitch limit)',
    },
    tasks: [
      {
        id: 'scen-proj-t1',
        step: 1,
        title: 'Focal Plane Diagnosis & Lens Barrel Adjustment',
        description:
          'The convergent rays currently focus 50 cm behind the screen (v = 450 cm instead of 400 cm). To bring the image closer to the lens so it focuses sharply on the screen, v must decrease.',
        question:
          'Based on the conjugate relation 1/v = 1/f - 1/u, what physical adjustment must be made to the lens position relative to the internal illuminated micro-display slide?',
        type: 'parameter_select',
        competencyDimension: 'troubleshooting_safety',
        points: 30,
        options: [
          { id: 'adj-1', text: 'Increase u: Move the projection lens slightly further away from the internal slide (advance lens forward / spiral barrel outward) to pull the focal plane onto the screen.' },
          { id: 'adj-2', text: 'Decrease u: Move the lens closer to the slide to push the image even further away.' },
          { id: 'adj-3', text: 'Decrease lamp voltage to shorten the wavelength of emitted light.' },
          { id: 'adj-4', text: 'Replace the convex lens with a plano-concave diverging lens.' },
        ],
        correctAnswer: 'adj-1',
        engineeringContext:
          'From 1/v = 1/f - 1/u: to decrease v (bringing image from 450 cm down to 400 cm), 1/v must increase, which requires subtracting a smaller 1/u term. Thus 1/u must decrease, meaning object distance u must INCREASE. Moving the lens slightly further from the slide pulls the image plane forward.',
      },
      {
        id: 'scen-proj-t2',
        step: 2,
        title: 'Precision Mechanical Throw Distance Calculation',
        description:
          'Calculate the exact target object distance u_target needed to project a sharp image onto the screen stationed at v = 400.0 cm, with lens focal length f = 20.0 cm.',
        question:
          'What is the required object distance u_target in cm (using u = (v · f) / (v - f), rounded to two decimal places)?',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 35,
        correctAnswer: 21.05,
        numericTolerance: 0.08,
        engineeringContext:
          'Target u = (v · f) / (v - f) = (400 × 20) / (400 - 20) = 8000 / 380 = 21.0526... ≈ 21.05 cm. Because current u is 20.93 cm, the mechanical focus helical ring must advance the lens outward by Δu = 21.05 - 20.93 = 0.12 cm (1.2 mm).',
      },
      {
        id: 'scen-proj-t3',
        step: 3,
        title: 'AI Optomechanical Audit: Longitudinal Magnification & Focus Sensitivity',
        description:
          'The auditorium facility manager is surprised that a tiny 1.2 mm shift in internal lens position shifts the auditorium image plane by a full 50 cm (500 mm).',
        question:
          'Explain the concept of longitudinal magnification (m_L = dv/du = -m²) in optical projection. Why does high transverse magnification cause extreme sensitivity in mechanical axial focus adjustment?',
        type: 'viva_text',
        competencyDimension: 'data_interpretation',
        points: 35,
        rubric:
          'Must mention: (1) Longitudinal magnification m_L = dv/du = -m² = -(v/u)², which is the square of transverse magnification m. (2) For a classroom projector with m ≈ 400cm / 20cm ≈ 20×, longitudinal magnification is m_L ≈ 20² = 400×. (3) Consequently, a 1.2 mm axial displacement of the lens produces a 400 × 1.2 mm ≈ 480–500 mm (50 cm) shift in the screen image plane, requiring fine-pitch helical threading.',
        engineeringContext:
          'Longitudinal magnification scales as the square of linear magnification (m_L = m²). In projection systems where m = 20 to 50, m_L reaches 400 to 2500, meaning micron-scale axial shifts of the lens barrel produce massive multi-decimeter focal plane movements at the auditorium wall.',
      },
    ],
  },
  {
    id: 'scen-pcr-investigation',
    experimentId: 'exp-pcr-gel',
    title: 'PCR Investigation: Why Did the Diagnostic Assay Fail?',
    domain: 'Molecular Diagnostics & Clinical Genomics',
    badge: 'Clinical QA Investigation',
    realWorldRole: 'Director of Molecular Diagnostics at GeneTrack BioLabs',
    brief:
      'You are auditing an urgent clinical PCR diagnostic run for an infectious viral pathogen (expected amplicon: 500 bp). The junior technician reported 100% positive patient samples, but the supervisor halted reporting because the No Template Control (NTC) displayed a vivid 500 bp band. Furthermore, a repeat test run at 46°C produced a smear of multiple non-specific bands across all lanes.',
    mission:
      'Using experimental logs, thermocycler ramp records, and gel transilluminator photos, dissect the dual points of failure (aerosol amplicon carryover contamination and low-stringency annealing), determine patient validity, and design an authoritative cleanroom remediation protocol.',
    systemParameters: {
      'Target Amplicon Size': '500 bp',
      'Forward Primer Tm': '59.5 °C',
      'Reverse Primer Tm': '60.5 °C',
      'Tested Run Annealing Temp': '46.0 °C (14 °C below optimal!)',
      'NTC Band Intensity': 'Strong 500 bp band (~20 ng/µL amplicon)',
      'Tip Type Used by Tech': 'Standard non-filter bevel tips (no aerosol barrier)',
      'Room Airflow Status': 'Template prep room positive pressure to post-PCR area',
    },
    tasks: [
      {
        id: 'scen-pcr-t1',
        step: 1,
        title: 'Diagnostic Validation & NTC Contamination Root Cause',
        description:
          'A band identical in size to the positive control appears in the negative control (NTC). Can the patient samples be reported as true positive, and what is the physical origin of the fault?',
        question:
          'Which conclusion is scientifically mandated regarding patient reporting, and what was the root mechanism of contamination?',
        type: 'parameter_select',
        competencyDimension: 'troubleshooting_safety',
        points: 35,
        options: [
          { id: 'ca-1', text: 'All patient positive calls are invalid. Non-filter tips allowed aerosolized amplicon droplets to enter the pipette barrel and contaminate the master mix water aliquot. The entire batch must be invalidated and re-extracted.' },
          { id: 'ca-2', text: 'Patient results are valid because patient bands are brighter than the NTC band.' },
          { id: 'ca-3', text: 'Taq polymerase synthesized 500 bp DNA spontaneously from buffer salts without template.' },
          { id: 'ca-4', text: 'The agarose gel was stained with too much loading dye, which fluoresces at 500 bp.' },
        ],
        correctAnswer: 'ca-1',
        engineeringContext:
          'In molecular clinical diagnostics, any detectable amplification in the No Template Control (NTC) completely invalidates the test run. Using non-filter tips produces aerosolization during liquid ejection, transferring high-copy amplicons into the pipette shaft and contaminating shared master mix reagents. All results must be voided.',
      },
      {
        id: 'scen-pcr-t2',
        step: 2,
        title: 'Optimal Annealing Temperature Stringency Calculation',
        description:
          'When repeating the run, the technician tried 46.0°C and obtained a ladder of non-specific ghost bands. The average melting temperature of the primer pair is Tm = (59.5 + 60.5) / 2 = 60.0°C.',
        question:
          'Calculate the optimal recommended annealing temperature (Ta) in °C using the standard empirical formula Ta = Tm - 5.0°C to eliminate non-specific mispriming.',
        type: 'numeric',
        competencyDimension: 'measurement_precision',
        points: 30,
        correctAnswer: 55.0,
        numericTolerance: 1.0,
        engineeringContext:
          'Optimal annealing temperature Ta = Tm - 5.0°C = 60.0°C - 5.0°C = 55.0°C. Running at 46.0°C was 9.0°C too cold, lowering hybridization stringency and allowing primers to bind with partial mismatches across the genome, yielding non-specific products.',
      },
      {
        id: 'scen-pcr-t3',
        step: 3,
        title: 'AI Cleanroom Quality Audit: Uracil-DNA Glycosylase (UDG) & Workflow Segregation',
        description:
          'To prevent future carryover disasters, the lab director mandates a biochemical safeguard and physical containment protocol.',
        question:
          'Explain how substituting dTTP with dUTP in the PCR mix and treating with Uracil-DNA Glycosylase (UDG/UNG) prior to cycling destroys prior amplicon contaminants without harming native genomic template DNA. Also describe unidirectional workflow segregation.',
        type: 'viva_text',
        competencyDimension: 'data_interpretation',
        points: 35,
        rubric:
          'Must mention: (1) dUTP incorporation: all synthesized PCR products contain uracil instead of thymine. (2) UNG treatment: prior to PCR, heating to 50°C activates Uracil-DNA Glycosylase which cleaves uracil bases in carryover DNA, creating apyrimidinic (AP) sites that fragment during initial denaturation (95°C), neutralizing contamination. (3) Native template safety: natural genomic/viral DNA contains thymine, not uracil, so it remains intact and accessible. (4) Unidirectional physical workflow: separate pre-PCR reagent prep (positive pressure), template addition (neutral), and post-PCR amplification/gel analysis (negative pressure) rooms with dedicated pipettes and PPE.',
        engineeringContext:
          'The dUTP/UNG enzymatic system selectively cleaves uracil-containing amplicons from previous runs while sparing genuine thymine-bearing native template. Coupled with physical unidirectional workflow (clean reagent room -> sample addition -> post-PCR gel room), aerosol carryover is completely prevented.',
      },
    ],
  },
];

export const INITIAL_CLASSES: ClassCourse[] = [
  {
    id: 'cls-1',
    name: 'B.Tech Applied Physics & Instrumentation (Sec A)',
    code: 'PHY-101A',
    department: 'Department of Electrical & Electronics Engineering',
    semester: 'Semester 1 (Autumn 2026)',
    academicYear: '2026–2027',
    studentCount: 42,
    averageCompetencies: {
      setup_adherence: 86,
      measurement_precision: 74,
      data_interpretation: 69,
      troubleshooting_safety: 82,
      experimental_design: 65,
    },
    commonMisconceptions: [
      {
        title: 'Confusing Instrument Range Resolution with Accuracy',
        affectedPercentage: 42,
        relatedExperiment: "Ohm's Law & Conductor Resistance",
        recommendedRemediation: 'Review digital quantization vs analog burden voltage module.',
      },
      {
        title: 'Failing to Account for Conductor Thermal Drift at Continuous High Currents',
        affectedPercentage: 38,
        relatedExperiment: "Ohm's Law & Conductor Resistance",
        recommendedRemediation: 'Re-run Joule heating simulation with continuous current stress toggle.',
      },
    ],
  },
  {
    id: 'cls-2',
    name: 'B.Tech Applied Chemistry & Material Science (Sec B)',
    code: 'CHM-102B',
    department: 'Department of Chemical & Materials Engineering',
    semester: 'Semester 1 (Autumn 2026)',
    academicYear: '2026–2027',
    studentCount: 38,
    averageCompetencies: {
      setup_adherence: 79,
      measurement_precision: 81,
      data_interpretation: 72,
      troubleshooting_safety: 88,
      experimental_design: 68,
    },
    commonMisconceptions: [
      {
        title: 'Misidentifying Equivalence Volume by Color Flash rather than Derivative Peak',
        affectedPercentage: 45,
        relatedExperiment: 'Potentiometric Acid-Base Titration',
        recommendedRemediation: 'Examine second-derivative inflection overlay on potentiometric curve.',
      },
      {
        title: 'Ignoring Logarithmic Dilution Effects near Stoichiometric Neutrality',
        affectedPercentage: 31,
        relatedExperiment: 'Potentiometric Acid-Base Titration',
        recommendedRemediation: 'Review Henderson-Hasselbalch and strong-electrolyte dissociation curves.',
      },
    ],
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-1',
    classId: 'cls-1',
    title: 'Lab 1: Verification of Ohm’s Law & Resistance Determination',
    experimentId: 'exp-ohms-law',
    dueDate: '2026-09-24T23:59:00.000Z',
    totalMarks: 100,
    weightTowardsInternal: 15,
    attemptsAllowed: 3,
    allowFreeExploration: true,
    status: 'active',
    completedCount: 34,
    totalStudents: 42,
    avgScore: 82.4,
  },
  {
    id: 'asg-2',
    classId: 'cls-2',
    title: 'Lab 2: Potentiometric Titration & Derivative Equivalence Analysis',
    experimentId: 'exp-titration',
    dueDate: '2026-09-28T23:59:00.000Z',
    totalMarks: 100,
    weightTowardsInternal: 15,
    attemptsAllowed: 2,
    allowFreeExploration: true,
    status: 'active',
    completedCount: 29,
    totalStudents: 38,
    avgScore: 76.8,
  },
  {
    id: 'asg-3',
    classId: 'cls-1',
    title: 'Capstone Scenario: Biomedical ECG Voltage Divider Sizing',
    experimentId: 'scen-ecg-divider',
    dueDate: '2026-10-05T23:59:00.000Z',
    totalMarks: 100,
    weightTowardsInternal: 20,
    attemptsAllowed: 2,
    allowFreeExploration: false,
    status: 'active',
    completedCount: 18,
    totalStudents: 42,
    avgScore: 84.1,
  },
  {
    id: 'asg-4',
    classId: 'cls-1',
    title: 'Lab 3: Determination of Focal Length of Convex Lens (u-v Method)',
    experimentId: 'exp-convex-lens',
    dueDate: '2026-10-12T23:59:00.000Z',
    totalMarks: 100,
    weightTowardsInternal: 15,
    attemptsAllowed: 3,
    allowFreeExploration: true,
    status: 'active',
    completedCount: 26,
    totalStudents: 42,
    avgScore: 88.5,
  },
  {
    id: 'asg-5',
    classId: 'cls-1',
    title: 'Lab 4: PCR Amplification & Agarose Gel Electrophoresis',
    experimentId: 'exp-pcr-gel',
    dueDate: '2026-10-20T23:59:00.000Z',
    totalMarks: 100,
    weightTowardsInternal: 20,
    attemptsAllowed: 3,
    allowFreeExploration: true,
    status: 'active',
    completedCount: 31,
    totalStudents: 42,
    avgScore: 89.2,
  },
];

export const INITIAL_SUBMISSIONS: StudentSubmission[] = [
  {
    id: 'sub-01',
    assignmentId: 'asg-1',
    studentId: 'stu-1',
    studentName: 'Aarav Sharma',
    experimentId: 'exp-ohms-law',
    submittedAt: '2026-09-14T14:20:00.000Z',
    attemptNumber: 1,
    totalScore: 92,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 95,
      measurement_precision: 88,
      data_interpretation: 94,
      troubleshooting_safety: 90,
      experimental_design: 92,
    },
    taskResponses: {
      'task-ohm-1': { score: 20, maxScore: 20, studentAnswer: 'opt-2', feedback: 'Correct range selection.' },
      'task-ohm-2': { score: 25, maxScore: 25, studentAnswer: 'a', feedback: 'Accurately recognized contact resistance anomaly.' },
      'task-ohm-3': { score: 25, maxScore: 25, studentAnswer: 14.85, feedback: 'Exact resistance slope derived.' },
      'task-ohm-4': { score: 22, maxScore: 30, studentAnswer: 'Joule heating causes resistance to increase as lattice atoms vibrate faster.', feedback: 'Good conceptual basis.' },
    },
    dataReadingsCount: 8,
    instructorFeedback: 'Excellent experimental rigor. Good control over meter burden.',
  },
  {
    id: 'sub-02',
    assignmentId: 'asg-1',
    studentId: 'stu-2',
    studentName: 'Priya Patel',
    experimentId: 'exp-ohms-law',
    submittedAt: '2026-09-15T09:12:00.000Z',
    attemptNumber: 1,
    totalScore: 78,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 85,
      measurement_precision: 70,
      data_interpretation: 82,
      troubleshooting_safety: 75,
      experimental_design: 76,
    },
    taskResponses: {
      'task-ohm-1': { score: 20, maxScore: 20, studentAnswer: 'opt-2', feedback: 'Correct.' },
      'task-ohm-2': { score: 15, maxScore: 25, studentAnswer: 'c', feedback: 'Mistook local terminal defect for fundamental breakdown.' },
      'task-ohm-3': { score: 25, maxScore: 25, studentAnswer: 14.9, feedback: 'Slope within acceptable bounds.' },
      'task-ohm-4': { score: 18, maxScore: 30, studentAnswer: 'Wire gets hot.', feedback: 'Needs temperature coefficient physics formulation.' },
    },
    dataReadingsCount: 6,
    instructorFeedback: 'Pay closer attention to abnormal reading diagnostics.',
  },
  {
    id: 'sub-03',
    assignmentId: 'asg-2',
    studentId: 'stu-3',
    studentName: 'Rahul Verma',
    experimentId: 'exp-titration',
    submittedAt: '2026-09-15T11:45:00.000Z',
    attemptNumber: 1,
    totalScore: 71,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 70,
      measurement_precision: 65,
      data_interpretation: 75,
      troubleshooting_safety: 78,
      experimental_design: 66,
    },
    taskResponses: {
      'task-titr-1': { score: 20, maxScore: 20, studentAnswer: 'opt-1', feedback: 'Correct bottom meniscus reading.' },
      'task-titr-2': { score: 25, maxScore: 25, studentAnswer: 'a', feedback: 'Recognized logarithmic nature of pH.' },
      'task-titr-3': { score: 10, maxScore: 25, studentAnswer: 0.12, feedback: 'Calculation error: failed to account for aliquot dilution factor.' },
      'task-titr-4': { score: 16, maxScore: 30, studentAnswer: 'It turns pink when base is added.', feedback: 'Viva response missed transition pKa overlap.' },
    },
    dataReadingsCount: 14,
    instructorFeedback: 'Review stoichiometric concentration formula M1V1 = M2V2.',
  },
  {
    id: 'sub-04',
    assignmentId: 'asg-1',
    studentId: 'stu-4',
    studentName: 'Ananya Deshmukh',
    experimentId: 'exp-ohms-law',
    submittedAt: '2026-09-15T16:05:00.000Z',
    attemptNumber: 1,
    totalScore: 96,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 98,
      measurement_precision: 96,
      data_interpretation: 95,
      troubleshooting_safety: 94,
      experimental_design: 96,
    },
    taskResponses: {
      'task-ohm-1': { score: 20, maxScore: 20, studentAnswer: 'opt-2', feedback: 'Ideal selection.' },
      'task-ohm-2': { score: 25, maxScore: 25, studentAnswer: 'a', feedback: 'Correct.' },
      'task-ohm-3': { score: 25, maxScore: 25, studentAnswer: 14.86, feedback: 'Precise linear regression.' },
      'task-ohm-4': { score: 26, maxScore: 30, studentAnswer: 'P=I^2*R causes wire heating which elevates resistance via positive temperature coefficient alpha.', feedback: 'Outstanding physical articulation.' },
    },
    dataReadingsCount: 10,
    instructorFeedback: 'Exemplary practical reasoning and thorough data logging.',
  },
  {
    id: 'sub-05',
    assignmentId: 'asg-4',
    studentId: 'stu-1',
    studentName: 'Aarav Sharma',
    experimentId: 'exp-convex-lens',
    submittedAt: '2026-09-16T14:10:00.000Z',
    attemptNumber: 1,
    totalScore: 94,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 95,
      measurement_precision: 92,
      data_interpretation: 96,
      troubleshooting_safety: 90,
      experimental_design: 95,
    },
    taskResponses: {
      'task-lens-1': { score: 20, maxScore: 20, studentAnswer: 'opt-b', feedback: 'Accurately predicted virtual image formation for u < f.' },
      'task-lens-2': { score: 20, maxScore: 20, studentAnswer: 'pos-1', feedback: 'Correctly solved conjugate foci displacement method.' },
      'task-lens-3': { score: 25, maxScore: 25, studentAnswer: 'diag-a', feedback: 'Diagnosed circle of confusion and screen displacement correctly.' },
      'task-lens-4': { score: 25, maxScore: 25, studentAnswer: 15.05, feedback: 'Accurate focal length calculation f = 15.05 cm.' },
      'task-lens-5': { score: 25, maxScore: 25, studentAnswer: 'anom-2', feedback: 'Identified Trial 3 outlier caused by premature logging of blurred image.' },
      'task-lens-6': { score: 25, maxScore: 25, studentAnswer: 'rel-a', feedback: 'Correctly described asymptotic hyperbolic behavior as u -> f.' },
    },
    dataReadingsCount: 6,
    instructorFeedback: 'Outstanding optical alignment and precise focal length calculation.',
  },
  {
    id: 'sub-06',
    assignmentId: 'asg-5',
    studentId: 'stu-1',
    studentName: 'Aarav Sharma',
    experimentId: 'exp-pcr-gel',
    submittedAt: '2026-09-16T15:30:00.000Z',
    attemptNumber: 1,
    totalScore: 96,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 98,
      measurement_precision: 95,
      data_interpretation: 96,
      troubleshooting_safety: 94,
      experimental_design: 98,
    },
    taskResponses: {
      'task-pcr-1': { score: 20, maxScore: 20, studentAnswer: 'mix-b', feedback: 'Correctly identified all essential PCR cocktail ingredients.' },
      'task-pcr-2': { score: 20, maxScore: 20, studentAnswer: 'ntc-2', feedback: 'Solid comprehension of NTC contamination detection.' },
      'task-pcr-3': { score: 25, maxScore: 25, studentAnswer: 'ann-1', feedback: 'Accurately recognized non-specific mispriming at low annealing stringency.' },
      'task-pcr-4': { score: 25, maxScore: 25, studentAnswer: 500, feedback: 'Precise 500 bp target amplicon sizing against ladder.' },
      'task-pcr-5': { score: 20, maxScore: 20, studentAnswer: 'mig-1', feedback: 'Correct physical basis for negative phosphate migration towards positive anode.' },
      'task-pcr-6': { score: 25, maxScore: 25, studentAnswer: 'diag-2', feedback: 'Correctly invalidated test upon NTC contamination.' },
    },
    dataReadingsCount: 8,
    instructorFeedback: 'Flawless sterile pipetting, excellent control interpretation, and authoritative troubleshooting.',
  },
];
