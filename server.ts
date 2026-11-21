import "dotenv/config";
import http from "http";
import crypto from "crypto";
import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { setupPairLabServer } from "./pairLabServer";
import { authRouter } from "./auth.controller";
import { requireAuth, requireRole, extractToken, AuthenticatedRequest } from "./auth.middleware";
import { authService } from "./auth.service";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Security Headers Middleware (Requirement 26)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// JSON Body Parser with safe payload size limit
app.use(express.json({ limit: "1mb" }));

// Lazy-initialized Gemini client with required User-Agent header
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Resilient multi-tier model calling with retry on transient capacity spikes (503 / 429)
interface GeminiCallResult {
  text: string;
  source: string;
}

async function callGeminiWithResilience(
  ai: GoogleGenAI,
  contents: string,
  config?: any
): Promise<GeminiCallResult | null> {
  // Primary model: gemini-3.8-flash; High-availability fallback: gemini-3.1-flash-lite
  const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];

  for (const model of candidateModels) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: Model call exceeded 3500ms")), 3500)
      );
      const generatePromise = ai.models.generateContent({
        model,
        contents,
        config,
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const text = response.text?.trim();
      if (text) {
        return { text, source: model };
      }
    } catch (err: any) {
      console.warn(`[Gemini Resilience] ${model} unavailable (${err?.message || err?.status || 'transient'}). Trying next option...`);
    }
  }

  return null;
}

// Heuristic fallback for viva assessment when AI models are experiencing high demand or offline
function getHeuristicVivaEvaluation(studentAnswer: string = "", question: string = "") {
  const answerLower = studentAnswer.toLowerCase();
  const length = studentAnswer.trim().split(/\s+/).length;
  let score = Math.min(85, Math.max(50, length * 5));

  // Check relevant STEM concepts
  if (
    answerLower.includes("temperature") ||
    answerLower.includes("resistance") ||
    answerLower.includes("heating") ||
    answerLower.includes("logarithm") ||
    answerLower.includes("photon") ||
    answerLower.includes("voltage") ||
    answerLower.includes("slope") ||
    answerLower.includes("anneal") ||
    answerLower.includes("primer") ||
    answerLower.includes("buffer") ||
    answerLower.includes("focal") ||
    answerLower.includes("convex")
  ) {
    score += 15;
  }
  score = Math.min(98, score);

  return {
    score,
    passed: score >= 70,
    rubricCriterionMet: ["Identified core physical/chemical phenomenon", "Used standard laboratory terminology"],
    missingConcepts: length < 10 ? ["Deeper mathematical derivation or quantitative relationship"] : [],
    feedback: `Demonstrates sound conceptual recognition (${score}%). Good articulation of the primary cause, consider expanding on quantitative boundary limits.`,
    adaptiveFollowUp: `How would your conclusion change if the temperature was held strictly constant or the component tolerances were doubled?`,
  };
}

// Domain-specific expert Socratic mentor rule engine covering all syllabus virtual lab experiments
function getHeuristicMentorReply(experimentId?: string, question: string = ""): string {
  const qLower = question.toLowerCase();

  if (
    experimentId === "exp-ohms-law" ||
    qLower.includes("ohm") ||
    qLower.includes("voltage") ||
    qLower.includes("current") ||
    qLower.includes("resistance")
  ) {
    if (qLower.includes("zero") || qLower.includes("not moving") || qLower.includes("0") || qLower.includes("ammeter") || qLower.includes("stuck")) {
      return `Here are the immediate checks to resolve a zero-current reading:
• **Circuit Continuity**: Ensure the DC power supply switch is turned **ON** and voltage is dialed above **0.0 V**.
• **Polarity Alignment**: Verify the digital ammeter is connected in **series** with the positive terminal connected to the positive supply.
• **Rheostat / Resistance setting**: Make sure the wire resistance is not open-circuited. Once voltage is set to even 1.0 V, you should observe current register immediately according to $I = V / R$.`;
    } else if (qLower.includes("slope") || qLower.includes("graph") || qLower.includes("calculate") || qLower.includes("resistance")) {
      return `To calculate the experimental resistance from your $V\\text{--}I$ graph:
1. **Identify Two Coordinates**: Pick two points $(I_1, V_1)$ and $(I_2, V_2)$ along the linear section of your plot.
2. **Calculate the Slope**: $\\text{Slope} = \\frac{\\Delta V}{\\Delta I} = \\frac{V_2 - V_1}{I_2 - I_1}$.
3. **Unit Watch**: Note if your ammeter is measuring in milliamperes ($\\text{mA}$). Convert to Amperes by dividing by 1,000 (e.g., $100\\text{ mA} = 0.1\\text{ A}$) before taking the ratio to get the correct Ohms ($\\Omega$).`;
    } else if (qLower.includes("hot") || qLower.includes("heat") || qLower.includes("burn") || qLower.includes("curve") || qLower.includes("deviate")) {
      return `At higher voltages (> 10V), you will notice the $V\\text{--}I$ plot curve slightly upwards:
• **Joule Heating**: Electrical power dissipated as heat is given by $P = I^2 R$.
• **Temperature Coefficient**: As wire temperature increases, thermal vibration of metal ions increases resistance: $R(T) = R_0 (1 + \\alpha \\Delta T)$.
• **Remedy**: Take readings promptly and avoid leaving the voltage pegged at maximum to prevent thermal drift and burnout!`;
    } else {
      return `In Ohm's Law verification ($V = I \\cdot R$):
• Start with voltage at **0V** and advance in **1V increments** up to ~8V.
• Record both Voltage ($V$) and Current ($I$) in your observation table for each increment.
• Notice how the ratio $V/I$ remains constant until Joule heating sets in. What specific step can I help you troubleshoot right now?`;
    }
  } else if (
    experimentId === "exp-titration" ||
    qLower.includes("titrat") ||
    qLower.includes("acid") ||
    qLower.includes("base") ||
    qLower.includes("ph") ||
    qLower.includes("burette")
  ) {
    if (qLower.includes("pink") || qLower.includes("color") || qLower.includes("endpoint") || qLower.includes("jump") || qLower.includes("magenta")) {
      return `Here is how to master the phenolphthalein end-point:
• **Sharp Equivalence Transition**: Phenolphthalein changes from colorless to faint pink in the pH range of **8.2 to 10.0**.
• **Near the Equivalence Point (~20-25 mL)**: Add NaOH in small fractions (0.2 mL to 0.5 mL) or single drops while gently swirling the flask.
• **Over-Titration Warning**: If the liquid turns hot dark magenta, you have over-titrated! The true stoichiometric endpoint is the **faintest persistent pale pink** that lingers for 30 seconds.`;
    } else if (qLower.includes("molarity") || qLower.includes("calculate") || qLower.includes("formula") || qLower.includes("concentration")) {
      return `To calculate the unknown molarity of HCl:
• Use the neutralization equivalence formula:
$$M_{\\text{acid}} \\times V_{\\text{acid}} = M_{\\text{base}} \\times V_{\\text{base}}$$
• Since $\\text{HCl} + \\text{NaOH} \\rightarrow \\text{NaCl} + \\text{H}_2\\text{O}$ has a $1:1$ stoichiometric ratio:
$$M_{\\text{HCl}} = \\frac{M_{\\text{NaOH}} \\times V_{\\text{NaOH, eq}}}{V_{\\text{HCl}}}$$
• Insert your known standard base molarity ($0.10\\text{ M}$) and pipetted acid aliquot ($25.0\\text{ mL}$) with your observed equivalence volume.`;
    } else {
      return `For standard Acid-Base Potentiometric Titration:
• Ensure the burette is filled to the 0.00 mL mark with standardized NaOH.
• Use the burette stopcock slider to dispense NaOH in ~1-2 mL increments initially, slowing down to **0.5 mL drops** when approaching pH 6.0.
• Plot the pH curve to locate the point of maximum inflection $(\\frac{d(\\text{pH})}{dV})$. Where are you currently stuck?`;
    }
  } else if (
    experimentId === "exp-photoelectric" ||
    qLower.includes("photo") ||
    qLower.includes("electron") ||
    qLower.includes("stopping") ||
    qLower.includes("planck")
  ) {
    if (qLower.includes("stopping") || qLower.includes("retarding") || qLower.includes("zero") || qLower.includes("negative")) {
      return `Understanding Stopping Potential ($V_0$):
• Emitted photoelectrons leave the cathode with kinetic energies up to $K_{\\max} = \\frac{1}{2} m v_{\\max}^2$.
• Applying a **negative (retarding) voltage** to the anode repels the arriving electrons.
• When the electric potential barrier equals the maximum kinetic energy:
$$e V_0 = K_{\\max}$$
• Dial the voltage negatively until the digital nano-ammeter reads **exactly 0.000 nA**. That voltage is your experimental $V_0$.`;
    } else if (qLower.includes("red") || qLower.includes("threshold") || qLower.includes("no current") || qLower.includes("frequency")) {
      return `Why doesn't Red Light produce any photocurrent?
• According to Einstein's photoelectric equation:
$$K_{\\max} = h\\nu - \\Phi$$
• Red light has a long wavelength ($\\approx 650\\text{--}700\\text{ nm}$) and low frequency ($\\nu < \\nu_0$). Each incoming photon possesses insufficient energy ($E = h\\nu$) to overcome the material's work function ($\\Phi \\approx 2.14\\text{ eV}$).
• **Solution**: Switch to Green ($532\\text{ nm}$) or Violet/UV ($405\\text{ nm}$) where photon energy exceeds $\\Phi$!`;
    } else {
      return `In the Photoelectric Effect experiment:
• Select an incident light wavelength (Violet $405\\text{ nm}$ or Blue $470\\text{ nm}$).
• Notice that increasing **Intensity** increases the quantity of electrons (higher saturation current), but **does NOT change the stopping voltage**.
• Stopping voltage ($V_0$) depends purely on **frequency/wavelength**! Which aspect can I guide you through?`;
    }
  } else if (
    experimentId === "exp-convex-lens" ||
    qLower.includes("lens") ||
    qLower.includes("focal") ||
    qLower.includes("optics") ||
    qLower.includes("u-v") ||
    qLower.includes("blur")
  ) {
    if (qLower.includes("blur") || qLower.includes("fuzzy") || qLower.includes("defocus") || qLower.includes("not clear") || qLower.includes("sharp")) {
      return `Here is how to eliminate image blur on the optical bench:
• **Conjugate Plane Mismatch**: A blurred circle occurs when the screen is stationed in front of or behind the true focal plane.
• **Theoretical Position**: Calculate the ideal image distance using $v = \\frac{u \\cdot f}{u - f}$.
• **Adjustment**: Adjust the screen slider until the green **Sharp Real Image Obtained (95–100%)** indicator appears, or click **Auto-Focus Screen** to align immediately!
• **Check Object Distance**: Ensure $u > f$ ($u > 15.0\\text{ cm}$). If $u < f$, refracted rays diverge into a virtual image that cannot be received on a screen.`;
    } else if (qLower.includes("formula") || qLower.includes("calculate") || qLower.includes("focal length") || qLower.includes("f =")) {
      return `To calculate the experimental focal length $f$:
1. **Thin Lens Equation**: With Cartesian sign convention ($u < 0$, $v > 0$), $\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u} = \\frac{1}{v} + \\frac{1}{|u|}$.
2. **Working Formula with Magnitudes**:
$$f = \\frac{u \\cdot v}{u + v}$$
3. **Example**: If $u = 30.0\\text{ cm}$ and $v = 30.2\\text{ cm}$:
$$f = \\frac{30.0 \\times 30.2}{30.0 + 30.2} = \\frac{906.0}{60.2} \\approx 15.05\\text{ cm}$$
4. Log at least 4 to 5 trials across different distances to calculate the mean $\\bar{f}$ and standard deviation!`;
    } else if (qLower.includes("projector") || qLower.includes("behind screen") || qLower.includes("scenario")) {
      return `In the Projector Troubleshooting scenario:
• **Symptom**: The sharp image is converging $50\\text{ cm}$ *behind* the screen ($v = 450\\text{ cm}$, screen at $400\\text{ cm}$).
• **Analysis**: To bring the image closer ($v$ must decrease from $450\\text{ cm}$ to $400\\text{ cm}$), the term $\\frac{1}{v}$ must increase.
• **Correction**: From $\\frac{1}{v} = \\frac{1}{f} - \\frac{1}{u}$, increasing $\\frac{1}{v}$ requires decreasing $\\frac{1}{u}$, which means **increasing $u$**!
• **Action**: Move the projection lens slightly *further* away from the internal slide (advance the spiral focus barrel outward) to pull the image forward onto the screen!`;
    } else if (qLower.includes("virtual") || qLower.includes("real") || qLower.includes("inverted")) {
      return `Real vs Virtual images in a convex lens:
• **When $u > f$**: Rays physically converge on the opposite side of the lens. The image is **Real, Inverted**, and can be projected onto the frosted screen.
  - At $u > 2f$: Diminished ($|m| < 1$)
  - At $u = 2f$: Equal size ($|m| = 1$, $v = 2f$)
  - At $f < u < 2f$: Magnified ($|m| > 1$, $v > 2f$)
• **When $u < f$**: Rays diverge after refraction. Tracing backwards gives an **Erect, Magnified, Virtual** image behind the lens that cannot be projected on a screen!`;
    } else {
      return `In the Convex Lens Focal Length experiment ($u\\text{--}v$ method):
• Adjust the **Object upright (x_obj)** to set your object distance $u = |x_{lens} - x_{obj}|$.
• Adjust the **Screen upright (x_screen)** until the image is crisp and sharp (100% focus).
• Click **Log Current Trial** to record $u$, $v$, $\\frac{1}{u}$, and $\\frac{1}{v}$.
• Review the $u\\text{--}v$ hyperbola and $\\frac{1}{v}$ vs $\\frac{1}{u}$ graphs to verify $f \\approx 15.0\\text{ cm}$. What would you like help with?`;
    }
  } else if (
    experimentId === "exp-pcr-gel" ||
    qLower.includes("pcr") ||
    qLower.includes("gel") ||
    qLower.includes("anneal") ||
    qLower.includes("primer") ||
    qLower.includes("ntc") ||
    qLower.includes("ladder") ||
    qLower.includes("electrophoresis")
  ) {
    if (qLower.includes("contamin") || qLower.includes("negative control") || qLower.includes("ntc") || qLower.includes("false positive")) {
      return `Here is how to interpret a band in the Negative Control (NTC):
• **Diagnosis**: A band in the NTC indicates that high-copy amplicon or target DNA contaminated one of the shared reagents (water, buffer, dNTPs, or primer stocks), or occurred via aerosol during pipetting.
• **Clinical Impact**: Any positive test result in patient samples is invalidated because the contamination may have caused a false positive!
• **Corrective Action**:
  1. Decontaminate pipettes and cleanroom surfaces with 10% bleach and UV light.
  2. Discard all working aliquots of water, buffer, dNTPs, and primers.
  3. Use aerosol-barrier filter tips and assemble fresh reactions in a dedicated pre-PCR clean area.`;
    } else if (qLower.includes("anneal") || qLower.includes("temperature") || qLower.includes("stringency") || qLower.includes("multiple bands") || qLower.includes("smear")) {
      return `Understanding Annealing Temperature ($T_a$) and Specificity:
• **Formula**: $T_a \\approx T_m - 5^\\circ\\text{C}$ (where $T_m$ is primer melting temperature).
• **If $T_a$ is too low (< 50°C)**: Low stringency allows primers to anneal to imperfect matches across the genome, resulting in **non-specific bands and smeary background**.
• **If $T_a$ is too high (> 65°C)**: Thermal motion prevents primers from stably binding, causing **low yield or complete failure to amplify**.
• **Optimal setting**: For our primer pair ($T_m \\approx 60^\\circ\\text{C}$), configure $T_a = 55.0^\\circ\\text{C}$ for a single crisp 500 bp band!`;
    } else if (qLower.includes("ladder") || qLower.includes("size") || qLower.includes("500") || qLower.includes("band")) {
      return `Analyzing bands against the 100 bp DNA ladder:
• **Ladder Rungs**: 100, 200, 300, 400, **500 bp (thick landmark)**, 600, 700, 800, 1000, and 1500 bp.
• **Migration Rate**: Smaller fragments migrate faster towards the positive anode because they thread through the agarose mesh with less friction ($R_f \\propto -\\log_{10}(\\text{bp})$).
• **Sample Interpretation**: Our target amplicon co-migrates directly with the 500 bp landmark band!`;
    } else if (qLower.includes("red") || qLower.includes("charge") || qLower.includes("cathode") || qLower.includes("anode") || qLower.includes("polarity")) {
      return `Agarose Gel Electrophoresis Polarity ("Run to Red"):
• **Charge**: The DNA sugar-phosphate backbone carries negatively charged phosphate groups ($\\text{PO}_4^{3-}$).
• **Electrode Orientation**: DNA is loaded at the cathode (negative black terminal) and migrates towards the **anode (positive red terminal)**.
• **Mnemonic**: *"Run to Red"* — if polarity is accidentally reversed, samples will run backwards out of the wells and vanish into the buffer!`;
    } else {
      return `In the PCR & Agarose Gel Electrophoresis experiment:
• **Stage 1 & 2**: Assemble the 25 µL reaction mix (Template, Primers, Taq, dNTPs, Buffer, $\\text{Mg}^{2+}$, $\\text{H}_2\\text{O}$) using sterile filter tips.
• **Stage 3 & 4**: Pulse-vortex and spin down in the mini-centrifuge, then program the thermocycler ($95^\\circ\\text{C} \\to 55^\\circ\\text{C} \\to 72^\\circ\\text{C}$).
• **Stage 5 & 6**: Mix with 6X loading dye, load into the submerged agarose gel, and run at 100V.
• **Stage 7**: Inspect under UV transillumination to size the 500 bp amplicon and check controls!`;
    }
  }

  return `I am your **Lab Mentor** for this experiment.
• Review the step instructions in your task panel on the right.
• Check all instrument meter ranges, dials, and units.
• Feel free to ask me about troubleshooting equipment faults, calculation steps, or the physical theory behind your observations!`;
}

// In-memory assignment store for custom teacher assignments and submissions
interface AssignmentSubmissionRecord {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  experimentId: string;
  submittedAt: string;
  totalScore: number;
  maxScore: number;
  competencyScores: {
    setup_adherence: number;
    measurement_precision: number;
    data_interpretation: number;
    troubleshooting_safety: number;
    experimental_design: number;
  };
  vivaResponses: Array<{
    question: string;
    studentAnswer: string;
    score: number;
    feedback: string;
  }>;
}

let submissionsStore: AssignmentSubmissionRecord[] = [
  {
    id: "sub-101",
    assignmentId: "asg-1",
    studentId: "stu-1",
    studentName: "Aarav Sharma",
    experimentId: "exp-ohms-law",
    submittedAt: "2026-09-14T14:20:00.000Z",
    totalScore: 92,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 95,
      measurement_precision: 88,
      data_interpretation: 94,
      troubleshooting_safety: 90,
      experimental_design: 92,
    },
    vivaResponses: [
      {
        question: "Why does the V-I characteristic deviate from linearity at higher voltages?",
        studentAnswer: "Joule heating increases the wire temperature, which raises its resistance according to the temperature coefficient.",
        score: 95,
        feedback: "Accurate physical explanation identifying thermal coefficient and Joule heating.",
      },
    ],
  },
  {
    id: "sub-102",
    assignmentId: "asg-1",
    studentId: "stu-2",
    studentName: "Priya Patel",
    experimentId: "exp-ohms-law",
    submittedAt: "2026-09-15T09:12:00.000Z",
    totalScore: 78,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 85,
      measurement_precision: 70,
      data_interpretation: 82,
      troubleshooting_safety: 75,
      experimental_design: 76,
    },
    vivaResponses: [
      {
        question: "Why should the ammeter have low internal resistance?",
        studentAnswer: "Because it connects in series so it does not drop too much voltage and alter the circuit current.",
        score: 85,
        feedback: "Good grasp of series burden voltage, mention negligible insertion loss for top marks.",
      },
    ],
  },
  {
    id: "sub-103",
    assignmentId: "asg-2",
    studentId: "stu-3",
    studentName: "Rahul Verma",
    experimentId: "exp-titration",
    submittedAt: "2026-09-15T11:45:00.000Z",
    totalScore: 68,
    maxScore: 100,
    competencyScores: {
      setup_adherence: 70,
      measurement_precision: 60,
      data_interpretation: 65,
      troubleshooting_safety: 72,
      experimental_design: 68,
    },
    vivaResponses: [
      {
        question: "Why does pH change rapidly near the equivalence point in strong acid-strong base titration?",
        studentAnswer: "Because all the acid is gone and it becomes neutral suddenly.",
        score: 65,
        feedback: "Partially correct. The steep curve occurs because pH is a logarithmic scale of hydrogen ion concentration.",
      },
    ],
  },
];

// --- API Endpoints ---

// --- Authentication Endpoints (delegated to modular AuthController & AuthService) ---
app.use("/api/auth", authRouter);

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
    timestamp: new Date().toISOString(),
  });
});

// AI Viva Evaluation Endpoint (evaluates short-text responses against rigorous rubric)
app.post("/api/gemini/viva-evaluate", async (req: Request, res: Response) => {
  try {
    const { question, studentAnswer, rubric, context, competencyDimension } = req.body;

    if (!question || !studentAnswer) {
      return res.status(400).json({ error: "question and studentAnswer are required" });
    }

    const ai = getGeminiClient();

    if (ai) {
      const prompt = `You are a strict, objective, and supportive university STEM lab viva examiner evaluating a student's oral/short-text lab assessment.
Experiment Context: ${context || "Syllabus Laboratory Experiment"}
Competency Dimension: ${competencyDimension || "Data Interpretation & Physical Reasoning"}

Viva Question: "${question}"
Target Rubric & Key Expected Concepts: "${rubric || "Clear understanding of underlying physical principles, correct technical terms, and cause-effect reasoning"}"
Student's Answer: "${studentAnswer}"

Evaluate the student's answer strictly against the rubric. Respond ONLY in valid JSON with this exact schema:
{
  "score": <number between 0 and 100>,
  "passed": <boolean, true if score >= 70>,
  "rubricCriterionMet": [<strings of fulfilled concepts>],
  "missingConcepts": [<strings of missing or misunderstood concepts>],
  "feedback": "<2-3 sentences of constructive examiner feedback highlighting physical insight and any misconception>",
  "adaptiveFollowUp": "<one concise follow-up question to probe their reasoning deeper based on what they answered>"
}`;

      const geminiResult = await callGeminiWithResilience(ai, prompt, {
        responseMimeType: "application/json",
        temperature: 0.2,
      });

      if (geminiResult) {
        try {
          const parsed = JSON.parse(geminiResult.text);
          return res.json({
            success: true,
            source: geminiResult.source,
            ...parsed,
          });
        } catch (parseErr) {
          console.warn("[Viva Evaluation] Could not parse model JSON output, falling back to rubric engine.");
        }
      }
    }

    // Heuristic fallback if API key is not yet set or models experiencing high demand (503)
    const fallbackEval = getHeuristicVivaEvaluation(studentAnswer, question);
    return res.json({
      success: true,
      source: "rubric-engine",
      ...fallbackEval,
    });
  } catch (error: any) {
    console.warn("Viva evaluation fallback safely engaged:", error?.message || error);
    const fallbackEval = getHeuristicVivaEvaluation(req.body?.studentAnswer, req.body?.question);
    return res.json({
      success: true,
      source: "rubric-engine",
      ...fallbackEval,
    });
  }
});

// Socratic Hint Engine
app.post("/api/gemini/hint", async (req: Request, res: Response) => {
  try {
    const { experimentName, currentStep, studentIssue, apparatusState } = req.body;
    const ai = getGeminiClient();

    if (ai) {
      const prompt = `You are a Socratic lab demonstrator guiding a student in "${experimentName}".
Current experiment step: "${currentStep}"
Apparatus state: ${JSON.stringify(apparatusState || {})}
Student's issue or confusion: "${studentIssue}"

Provide a concise, encouraging Socratic hint (maximum 2 sentences). Do NOT reveal the direct numerical answer. Instead, direct their attention to an instrument reading, scale setting, or fundamental formula so they deduce it themselves.`;

      const geminiResult = await callGeminiWithResilience(ai, prompt, {
        temperature: 0.3,
      });

      if (geminiResult) {
        return res.json({
          success: true,
          hint: geminiResult.text,
        });
      }
    }

    return res.json({
      success: true,
      hint: "Check your instrument scale multipliers and ensure all series connections are firmly latched. What does the relationship V = I * R predict when voltage increases?",
    });
  } catch (error: any) {
    return res.json({
      success: true,
      hint: "Review the instrument range switches and check if the zero-error has been accounted for.",
    });
  }
});

// Context-Aware Interactive Lab Mentor Chat
app.post("/api/gemini/mentor-chat", async (req: Request, res: Response) => {
  try {
    const {
      experimentId,
      experimentTitle,
      subject,
      syllabusTag,
      apparatusList,
      keyFormulas,
      currentStep,
      apparatusState,
      messages = [],
      question,
    } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }

    const ai = getGeminiClient();
    let reply: string | null = null;
    let source: string = "expert-rule-engine";

    if (ai) {
      const systemInstruction = `You are "Lab Mentor", an encouraging, pedagogically sharp, and supportive STEM laboratory instructor assisting a student who is actively conducting a virtual experiment in their lab session.

ACTIVE LAB CONTEXT:
- Experiment Title: ${experimentTitle || "Syllabus Virtual Lab"}
- Subject / Unit: ${subject || "Physics / Chemistry / Engineering"} (${syllabusTag || "STEM Syllabus"})
- Apparatus Available: ${Array.isArray(apparatusList) ? apparatusList.join(", ") : "Standard lab apparatus"}
- Core Governing Formulas: ${
        Array.isArray(keyFormulas)
          ? keyFormulas.map((f: any) => `${f.label}: ${f.formula}`).join(" | ")
          : "Standard fundamental equations"
      }
- Current Active Step / Milestone: ${currentStep || "Procedure Execution & Data Collection"}
${apparatusState ? `- Current Instrument / Apparatus State: ${JSON.stringify(apparatusState)}` : ""}

INSTRUCTIONAL RULES:
1. When students get stuck on specific experimental steps (e.g. circuit connections, meter zero-reading, burette titration endpoint detection, stopping potential calibration, or graph slope calculation), provide clear, actionable diagnostic steps.
2. Explain the physical/chemical *mechanism* behind their issue concisely.
3. Encourage scientific reasoning: use Socratic questioning where appropriate, pointing them towards relevant dials, meters, or equations.
4. Keep answers readable and scannable: use short paragraphs, bullet points for sequential steps, and bold key terms. Avoid overwhelming walls of text. Keep length within 2-4 focused paragraphs.
5. If they ask about safety, burnout, or experimental errors, explain practical precautions (e.g. open circuits, parallax error, heating effects, over-titration).`;

      // Build recent conversation transcript for context
      const conversationHistory = messages
        .slice(-6)
        .map((m: { role: string; content: string }) => `${m.role === "user" ? "Student" : "Lab Mentor"}: ${m.content}`)
        .join("\n\n");

      const prompt = `${systemInstruction}

CONVERSATION HISTORY:
${conversationHistory ? conversationHistory : "(New conversation)"}

Student's Latest Question / Problem:
"${question}"

Provide your contextual Lab Mentor guidance:`;

      const geminiResult = await callGeminiWithResilience(ai, prompt, {
        temperature: 0.35,
      });

      if (geminiResult) {
        reply = geminiResult.text;
        source = geminiResult.source;
      }
    }

    // If Gemini was unavailable, offline, or transient capacity spikes (503 / 429) were hit on both models,
    // seamlessly use our high-fidelity pedagogical rule engine
    if (!reply) {
      reply = getHeuristicMentorReply(experimentId, question);
      source = "expert-rule-engine";
    }

    return res.json({
      success: true,
      source,
      reply,
    });
  } catch (error: any) {
    console.warn("Mentor chat fallback safely engaged:", error?.message || error);
    const fallbackReply = getHeuristicMentorReply(req.body?.experimentId, req.body?.question || "");
    return res.json({
      success: true,
      source: "expert-rule-engine",
      reply: fallbackReply,
    });
  }
});

// Submissions CRUD for teacher and student tracking
app.get(
  "/api/submissions",
  requireAuth,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
          id,
          assignment_id AS "assignmentId",
          student_id AS "studentId",
          student_name AS "studentName",
          experiment_id AS "experimentId",
          submitted_at AS "submittedAt",
          attempt_number AS "attemptNumber",
          total_score AS "totalScore",
          max_score AS "maxScore",
          competency_scores AS "competencyScores",
          task_responses AS "taskResponses",
          data_readings_count AS "dataReadingsCount",
          instructor_feedback AS "instructorFeedback"
        FROM submissions
        ORDER BY submitted_at DESC`
      );

      return res.json({
        success: true,
        submissions: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch submissions:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch submissions.",
      });
    } finally {
      client?.release();
    }
  }
);


app.post(
  "/api/submissions",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      const {
        assignmentId,
        experimentId,
        totalScore,
        maxScore,
        competencyScores,
        vivaResponses,
      } = req.body;

      if (
        !assignmentId ||
        !experimentId ||
        totalScore == null ||
        maxScore == null ||
        !competencyScores ||
        !Array.isArray(vivaResponses)
      ) {
        return res.status(400).json({
          success: false,
          error: "Required submission fields are missing.",
        });
      }

      if (
        !Number.isFinite(Number(totalScore)) ||
        !Number.isFinite(Number(maxScore)) ||
        Number(totalScore) < 0 ||
        Number(maxScore) <= 0 ||
        Number(totalScore) > Number(maxScore)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid submission score.",
        });
      }

      const requiredCompetencies = [
        "setup_adherence",
        "measurement_precision",
        "data_interpretation",
        "troubleshooting_safety",
        "experimental_design",
      ];

      for (const key of requiredCompetencies) {
        if (
          !Number.isFinite(Number(competencyScores[key])) ||
          Number(competencyScores[key]) < 0 ||
          Number(competencyScores[key]) > 100
        ) {
          return res.status(400).json({
            success: false,
            error: `Invalid competency score: ${key}`,
          });
        }
      }

      client = await authService.getClient();

      const assignmentResult = await client.query(
        `SELECT a.id, a.experiment_id, a.attempts_allowed
         FROM assignments a
         JOIN class_students cs ON cs.class_id = a.class_id
         WHERE a.id = $1
           AND cs.student_id = $2
           AND a.status = 'active'`,
        [assignmentId, req.user!.id]
      );

      if (assignmentResult.rowCount === 0) {
        return res.status(403).json({
          success: false,
          error: "Assignment not found or not assigned to this student.",
        });
      }

      const assignment = assignmentResult.rows[0];

      if (assignment.experiment_id !== experimentId) {
        return res.status(400).json({
          success: false,
          error: "Experiment does not match the assignment.",
        });
      }

      const attemptResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM submissions
         WHERE assignment_id = $1 AND student_id = $2`,
        [assignmentId, req.user!.id]
      );

      const attemptNumber = attemptResult.rows[0].count + 1;

      if (attemptNumber > assignment.attempts_allowed) {
        return res.status(409).json({
          success: false,
          error: "You have used all allowed attempts for this assignment.",
        });
      }

      const id = `sub-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const result = await client.query(
        `INSERT INTO submissions (
          id,
          assignment_id,
          student_id,
          student_name,
          experiment_id,
          submitted_at,
          attempt_number,
          total_score,
          max_score,
          competency_scores,
          task_responses,
          data_readings_count
        )
        VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9::jsonb,$10::jsonb,$11)
        RETURNING
          id,
          assignment_id AS "assignmentId",
          student_id AS "studentId",
          student_name AS "studentName",
          experiment_id AS "experimentId",
          submitted_at AS "submittedAt",
          attempt_number AS "attemptNumber",
          total_score AS "totalScore",
          max_score AS "maxScore",
          competency_scores AS "competencyScores",
          task_responses AS "taskResponses",
          data_readings_count AS "dataReadingsCount"`,
        [
          id,
          assignmentId,
          req.user!.id,
          req.user!.name,
          experimentId,
          attemptNumber,
          Number(totalScore),
          Number(maxScore),
          JSON.stringify(competencyScores),
          JSON.stringify({ vivaResponses }),
          0,
        ]
      );

      return res.status(201).json({
        success: true,
        submission: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to save submission:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to save submission.",
      });
    } finally {
      client?.release();
    }
  }
);


// ==============================================================================
// ROLE-SCOPED SECURE ENDPOINTS (Requirements 4, 28, 29, 30)
// ==============================================================================

// 1. Student Scoped Endpoints (/api/student/*)
app.get("/api/student/experiments", requireAuth, requireRole("student"), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    studentId: req.user!.id,
    experiments: [
      { id: "millikan-oil-drop", title: "Millikan's Oil Drop Experiment", status: "assigned", dueDate: "2026-10-15" },
      { id: "photoelectric-effect", title: "Photoelectric Effect Lab", status: "in-progress", dueDate: "2026-10-20" },
      { id: "franck-hertz", title: "Franck-Hertz Experiment", status: "completed", dueDate: "2026-09-30" },
    ],
  });
});

// IDOR Guard: Returns ONLY the authenticated student's own submissions

// GET assignments for the authenticated student
app.get(
  "/api/student/assignments",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
           a.id,
           a.class_id AS "classId",
           a.title,
           a.experiment_id AS "experimentId",
           a.due_date AS "dueDate",
           a.total_marks AS "totalMarks",
           a.weight_towards_internal AS "weightTowardsInternal",
           a.attempts_allowed AS "attemptsAllowed",
           a.allow_free_exploration AS "allowFreeExploration",
           a.status,
           COUNT(s.id)::int AS "attemptsUsed"
         FROM assignments a
         JOIN class_students cs
           ON cs.class_id = a.class_id
         LEFT JOIN submissions s
           ON s.assignment_id = a.id
           AND s.student_id = cs.student_id
         WHERE cs.student_id = $1
           AND a.status = 'active'
         GROUP BY a.id
         ORDER BY a.due_date ASC`,
        [req.user!.id]
      );

      return res.json({
        success: true,
        studentId: req.user!.id,
        assignments: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch student assignments:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch student assignments.",
      });
    } finally {
      client?.release();
    }
  }
);


app.get(
  "/api/student/submissions",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
           id,
           assignment_id AS "assignmentId",
           student_id AS "studentId",
           student_name AS "studentName",
           experiment_id AS "experimentId",
           submitted_at AS "submittedAt",
           attempt_number AS "attemptNumber",
           total_score AS "totalScore",
           max_score AS "maxScore",
           competency_scores AS "competencyScores",
           task_responses AS "taskResponses",
           data_readings_count AS "dataReadingsCount",
           instructor_feedback AS "instructorFeedback"
         FROM submissions
         WHERE student_id = $1
         ORDER BY submitted_at DESC`,
        [req.user!.id]
      );

      return res.json({
        success: true,
        submissions: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch student submissions:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch student submissions.",
      });
    } finally {
      client?.release();
    }
    
  }
);





app.get(
  "/api/student/classes",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
           c.id,
           c.name,
           c.code,
           c.department,
           c.semester,
           c.academic_year AS "academicYear",
           0 AS "studentCount",
           c.average_competencies AS "averageCompetencies",
           c.common_misconceptions AS "commonMisconceptions"
         FROM classes c
         JOIN class_students cs ON cs.class_id = c.id
         WHERE cs.student_id = $1
         ORDER BY c.name`,
        [req.user!.id]
      );

      return res.json({
        success: true,
        classes: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch student classes:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch student classes.",
      });
    } finally {
      client?.release();
    }
  }
);




app.get("/api/student/profile", requireAuth, requireRole("student"), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    profile: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
      institution: req.user!.institution,
      enrollmentCode: req.user!.enrollment_code,
      competencies: {
        setup_adherence: 92,
        measurement_precision: 88,
        data_interpretation: 90,
        troubleshooting_safety: 95,
        experimental_design: 87,
      },
    },
  });
});

app.get(
  "/api/student/competencies",
  requireAuth,
  requireRole("student"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const client = await authService.getClient();

      const result = await client.query(
        `
        SELECT competency_scores AS "competencyScores"
        FROM submissions
        WHERE student_id = $1
          AND competency_scores IS NOT NULL
        ORDER BY submitted_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        `,
        [req.user!.id]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          competencyScores: null,
        });
      }

      return res.json({
        success: true,
        competencyScores: result.rows[0].competencyScores,
      });
    } catch (error) {
      console.error("Failed to fetch competency scores:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch competency scores",
      });
    }
  }
);

// 2. Teacher Scoped Endpoints (/api/teacher/*)

app.get(
  "/api/teacher/classes",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
           c.id,
           c.name,
           c.code,
           c.department,
           c.semester,
           c.academic_year AS "academicYear",
           COUNT(cs.student_id)::int AS "studentCount",
           c.average_competencies AS "averageCompetencies",
           c.common_misconceptions AS "commonMisconceptions"
         FROM classes c
         LEFT JOIN class_students cs ON cs.class_id = c.id
         WHERE c.teacher_id = $1
         GROUP BY c.id
         ORDER BY c.name`,
        [req.user!.id]
      );

      res.json({
        success: true,
        teacherId: req.user!.id,
        classes: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch teacher classes:", error);

      res.status(500).json({
        success: false,
        error: "Failed to fetch classes.",
      });
    } finally {
      client?.release();
    }
  }
);

app.post(
  "/api/teacher/assignments",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      const {
        classId,
        title,
        experimentId,
        dueDate,
        totalMarks,
        weightTowardsInternal,
        attemptsAllowed,
        allowFreeExploration,
      } = req.body;

      if (!classId || !title?.trim() || !experimentId || !dueDate) {
        return res.status(400).json({
          success: false,
          error: "classId, title, experimentId, and dueDate are required.",
        });
      }

      client = await authService.getClient();

      // Confirm the class belongs to the logged-in teacher.
      const classResult = await client.query(
        `SELECT id FROM classes
         WHERE id = $1 AND teacher_id = $2`,
        [classId, req.user!.id]
      );

      if (classResult.rowCount === 0) {
        return res.status(403).json({
          success: false,
          error: "Class not found or not assigned to this teacher.",
        });
      }

      const id = `asg-${Date.now()}`;

      const result = await client.query(
        `INSERT INTO assignments (
          id,
          class_id,
          title,
          experiment_id,
          due_date,
          total_marks,
          weight_towards_internal,
          attempts_allowed,
          allow_free_exploration,
          status,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
        RETURNING
          id,
          class_id AS "classId",
          title,
          experiment_id AS "experimentId",
          due_date AS "dueDate",
          total_marks AS "totalMarks",
          weight_towards_internal AS "weightTowardsInternal",
          attempts_allowed AS "attemptsAllowed",
          allow_free_exploration AS "allowFreeExploration",
          status`,
        [
          id,
          classId,
          title.trim(),
          experimentId,
          dueDate,
          totalMarks ?? 100,
          weightTowardsInternal ?? 0,
          attemptsAllowed ?? 1,
          allowFreeExploration ?? false,
          req.user!.id,
        ]
      );

      return res.status(201).json({
        success: true,
        assignment: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to create assignment:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to create assignment.",
      });
    } finally {
      client?.release();
    }
  }
);


app.get(
  "/api/teacher/submissions",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
          s.id,
          s.assignment_id AS "assignmentId",
          s.student_id AS "studentId",
          s.student_name AS "studentName",
          s.experiment_id AS "experimentId",
          s.submitted_at AS "submittedAt",
          s.attempt_number AS "attemptNumber",
          s.total_score AS "totalScore",
          s.max_score AS "maxScore",
          s.competency_scores AS "competencyScores",
          s.task_responses AS "taskResponses",
          s.data_readings_count AS "dataReadingsCount",
          s.instructor_feedback AS "instructorFeedback"
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN classes c ON c.id = a.class_id
        WHERE c.teacher_id = $1
        ORDER BY s.submitted_at DESC`,
        [req.user!.id]
      );

      return res.json({
        success: true,
        submissions: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch teacher submissions:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch submissions.",
      });
    } finally {
      client?.release();
    }
  }
);


app.get(
  "/api/teacher/assignments",
  requireAuth,
  requireRole("teacher"),
  async (req: AuthenticatedRequest, res: Response) => {
    let client;

    try {
      client = await authService.getClient();

      const result = await client.query(
        `SELECT
          a.id,
          a.class_id AS "classId",
          a.title,
          a.experiment_id AS "experimentId",
          a.due_date AS "dueDate",
          a.total_marks AS "totalMarks",
          a.weight_towards_internal AS "weightTowardsInternal",
          a.attempts_allowed AS "attemptsAllowed",
          a.allow_free_exploration AS "allowFreeExploration",
          a.status,
          COUNT(DISTINCT s.student_id)::int AS "completedCount",
          (
            SELECT COUNT(*)::int
            FROM class_students cs
            WHERE cs.class_id = a.class_id
          ) AS "totalStudents",
          0 AS "avgScore"
        FROM assignments a
        JOIN classes c ON c.id = a.class_id
        LEFT JOIN submissions s ON s.assignment_id = a.id
        WHERE c.teacher_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC`,
        [req.user!.id]
      );

      return res.json({
        success: true,
        assignments: result.rows,
      });
    } catch (error) {
      console.error("Failed to fetch assignments:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch assignments.",
      });
    } finally {
      client?.release();
    }
  }
);

// 3. Admin Scoped Endpoints (/api/admin/*)
app.get("/api/admin/users", requireAuth, requireRole("admin"), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const client = await authService.getClient();
    try {
      const result = await client.query(
        "SELECT id, email, name, role, status, institution, last_login_at, created_at FROM users ORDER BY created_at DESC;"
      );
      res.json({ success: true, users: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch users." });
  }
});

app.get("/api/admin/audit-logs", requireAuth, requireRole("admin"), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const client = await authService.getClient();
    try {
      const result = await client.query(
        "SELECT * FROM auth_events ORDER BY created_at DESC LIMIT 50;"
      );
      res.json({ success: true, logs: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch audit logs." });
  }
});

app.patch("/api/admin/users/:id/status", requireAuth, requireRole("admin"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const { status } = req.body;
    if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) {
      res.status(400).json({ success: false, error: "Invalid status. Must be ACTIVE, SUSPENDED, or DISABLED." });
      return;
    }
    const client = await authService.getClient();
    try {
      await client.query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2;", [status, targetUserId]);
      if (status !== "ACTIVE") {
        await client.query("UPDATE sessions SET is_revoked = TRUE, status = 'REVOKED' WHERE user_id = $1;", [targetUserId]);
      }
      res.json({ success: true, message: `User status updated to ${status}.` });
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to update status." });
  }
});


// Vite middleware & WebSocket server setup
async function startServer() {
  const server = http.createServer(app);

  // Initialize Pair Lab real-time WebSocket & REST endpoints
  setupPairLabServer(server, app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SimLab] Full-stack server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
