import React, { useState, useEffect, useMemo } from 'react';
import {
  Dna,
  Pipette,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Thermometer,
  Zap,
  Eye,
  FileText,
  Sliders,
  Maximize2,
  RefreshCw,
  Clock,
  Droplets,
  ShieldCheck,
  HelpCircle,
  TrendingUp,
  FlaskConical,
  Award,
  Users,
  MessageSquare,
  ExternalLink,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { usePairLab } from '../../hooks/usePairLab';
import { PairLabBar } from '../pairlab/PairLabBar';
import { PairLabChatModal } from '../pairlab/PairLabChatModal';
import { PairLabJoinModal } from '../pairlab/PairLabJoinModal';
import { PairLabRole } from '../../types/pairLab';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export type PcrScenario = 'scenario_a' | 'scenario_b' | 'scenario_c' | 'scenario_d';

export interface PipettingActionLog {
  id: string;
  timestamp: string;
  action: string;
  reagent: string;
  targetTube: string;
  volumeUl: number;
  tipUsed: string;
  tipChanged: boolean;
  isContaminationRisk: boolean;
  notes?: string;
}

interface PcrGelSimProps {
  onDataLogged?: (count: number) => void;
  isDark?: boolean;
}

export const PcrGelSim: React.FC<PcrGelSimProps> = ({
  onDataLogged,
  isDark = false,
}) => {
  // Current experimental stage (1 through 7)
  const [activeStage, setActiveStage] = useState<number>(1);
  const [selectedScenario, setSelectedScenario] = useState<PcrScenario>('scenario_a');

  // Notebook and logs
  const [notebookLogs, setNotebookLogs] = useState<PipettingActionLog[]>([]);
  const [showNotebook, setShowNotebook] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<'sim' | 'notebook' | 'protocol'>('sim');

  // Pair Lab Collaborative Mode State
  const [isPairLabMode, setIsPairLabMode] = useState<boolean>(false);
  const [pairRoomId, setPairRoomId] = useState<string>('PCR-101');
  const [pairStudentName, setPairStudentName] = useState<string>('Student A');
  const [pairRole, setPairRole] = useState<PairLabRole>('partner_a');
  const [showPairLabJoinModal, setShowPairLabJoinModal] = useState<boolean>(false);
  const [showPairLabChat, setShowPairLabChat] = useState<boolean>(false);

  const pairLab = usePairLab({
    roomId: isPairLabMode ? pairRoomId : null,
    userName: pairStudentName,
    preferredRole: pairRole,
    enabled: isPairLabMode,
  });

  // URL query parameter synchronization on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pairRoom = params.get('pairLab');
      const roleParam = params.get('role') as PairLabRole;
      const nameParam = params.get('name');
      if (pairRoom) {
        setPairRoomId(pairRoom.toUpperCase());
        if (roleParam) setPairRole(roleParam);
        if (nameParam) setPairStudentName(nameParam);
        setIsPairLabMode(true);
      }
    }
  }, []);

  // Shared state synchronization when remote partner or server updates
  useEffect(() => {
    if (isPairLabMode && pairLab.roomState) {
      const rs = pairLab.roomState;
      if (rs.activeStage && rs.activeStage !== activeStage) {
        setActiveStage(rs.activeStage);
      }
      if (rs.tubeContents) {
        setTubeContents(rs.tubeContents);
      }
      if (rs.selectedComponents && rs.selectedComponents.length > 0) {
        setSelectedComponents(rs.selectedComponents);
      }
      if (rs.contaminationDetected !== undefined) {
        setContaminationDetected(rs.contaminationDetected);
        setContaminationReason(rs.contaminationReason || '');
      }
      if (rs.dropletsOnWall !== undefined) {
        setDropletsOnWall(rs.dropletsOnWall);
      }
      if (rs.hasVortexed !== undefined) {
        setHasVortexed(rs.hasVortexed);
      }
      if (rs.hasCentrifuged !== undefined) {
        setHasCentrifuged(rs.hasCentrifuged);
      }
      if (rs.thermocycler) {
        setAnnealingTemp(rs.thermocycler.annealingTemp);
        setCycleCount(rs.thermocycler.cycleCount);
        setHeatedLidOn(rs.thermocycler.heatedLidOn);
        if (rs.thermocycler.pcrRunning && !pcrRunning) {
          setPcrRunning(true);
        }
        if (rs.thermocycler.pcrCompleted) {
          setPcrCompleted(true);
          setPcrRunning(false);
        }
      }
      if (rs.gel) {
        setLoadingDyeAdded(rs.gel.loadingDyeAdded);
        if (rs.gel.gelRunning && !gelRunning) {
          setGelRunning(true);
        }
        if (rs.gel.electrophoresisComplete) {
          setElectrophoresisComplete(true);
          setGelRunning(false);
        }
      }
      if (rs.uv) {
        setUvTransilluminatorOn(rs.uv.uvTransilluminatorOn);
        if (rs.uv.studentEstimatedSize) {
          setStudentEstimatedSize(String(rs.uv.studentEstimatedSize));
        }
        if (rs.uv.studentDiagnosis) {
          setStudentDiagnosis(rs.uv.studentDiagnosis);
        }
      }
    }
  }, [pairLab.roomState, isPairLabMode]);

  // Stage 1: Component Checklist State
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [stage1Submitted, setStage1Submitted] = useState<boolean>(false);

  // Stage 2: Pipetting & Bench State
  const [selectedPipette, setSelectedPipette] = useState<'P10' | 'P20' | 'P200'>('P20');
  const [dialVolume, setDialVolume] = useState<number>(2.0); // µL
  const [hasTipAttached, setHasTipAttached] = useState<boolean>(false);
  const [tipContaminatedWith, setTipContaminatedWith] = useState<string | null>(null);
  const [liquidInTip, setLiquidInTip] = useState<{ reagent: string; volumeUl: number } | null>(null);
  const [selectedReagent, setSelectedReagent] = useState<string | null>(null);
  const [selectedTargetTube, setSelectedTargetTube] = useState<'sample' | 'pos_ctrl' | 'neg_ctrl' | null>(null);

  // Contents in each 0.2 mL PCR tube
  const [tubeContents, setTubeContents] = useState<Record<'sample' | 'pos_ctrl' | 'neg_ctrl', Record<string, number>>>({
    sample: {},
    pos_ctrl: {},
    neg_ctrl: {},
  });

  const [contaminationDetected, setContaminationDetected] = useState<boolean>(false);
  const [contaminationReason, setContaminationReason] = useState<string>('');

  // Stage 3: Mixing & Centrifugation
  const [dropletsOnWall, setDropletsOnWall] = useState<boolean>(true);
  const [isVortexing, setIsVortexing] = useState<boolean>(false);
  const [hasVortexed, setHasVortexed] = useState<boolean>(false);
  const [isCentrifuging, setIsCentrifuging] = useState<boolean>(false);
  const [hasCentrifuged, setHasCentrifuged] = useState<boolean>(false);

  // Stage 4: Thermal Cycler
  const [annealingTemp, setAnnealingTemp] = useState<number>(55.0); // 45.0, 55.0, 68.0 °C
  const [cycleCount, setCycleCount] = useState<number>(30);
  const [heatedLidOn, setHeatedLidOn] = useState<boolean>(true);
  const [pcrRunning, setPcrRunning] = useState<boolean>(false);
  const [currentCycle, setCurrentCycle] = useState<number>(0);
  const [currentStepPhase, setCurrentStepPhase] = useState<'idle' | 'init_denat' | 'denat' | 'anneal' | 'extend' | 'final_extend' | 'hold'>('idle');
  const [currentBlockTemp, setCurrentBlockTemp] = useState<number>(25.0);
  const [pcrCompleted, setPcrCompleted] = useState<boolean>(false);
  const [showAdvancedAmpGraph, setShowAdvancedAmpGraph] = useState<boolean>(false);

  // Stage 5 & 6: Agarose Gel Electrophoresis
  const [loadingDyeAdded, setLoadingDyeAdded] = useState<{ [tubeId: string]: boolean }>({
    ladder: true,
    pos_ctrl: false,
    neg_ctrl: false,
    sample: false,
  });

  const [loadedWells, setLoadedWells] = useState<{
    well1: string | null; // Ladder
    well2: string | null; // Pos Ctrl
    well3: string | null; // Neg Ctrl
    well4: string | null; // Unknown
  }>({
    well1: null,
    well2: null,
    well3: null,
    well4: null,
  });

  const [isCablesConnected, setIsCablesConnected] = useState<boolean>(true);
  const [isRunToRed, setIsRunToRed] = useState<boolean>(true);
  const [gelRunning, setGelRunning] = useState<boolean>(false);
  const [migrationPercent, setMigrationPercent] = useState<number>(0); // 0 to 100%
  const [electrophoresisVoltage, setElectrophoresisVoltage] = useState<number>(100); // 100V
  const [electrophoresisComplete, setElectrophoresisComplete] = useState<boolean>(false);

  // Stage 7: Transilluminator & Gel Analysis
  const [uvTransilluminatorOn, setUvTransilluminatorOn] = useState<boolean>(false);
  const [hoveredBandSize, setHoveredBandSize] = useState<number | null>(null);
  const [selectedLadderRung, setSelectedLadderRung] = useState<number | null>(null);
  const [studentEstimatedSize, setStudentEstimatedSize] = useState<string>('');
  const [studentDiagnosis, setStudentDiagnosis] = useState<string>('');
  const [analysisSubmitted, setAnalysisSubmitted] = useState<boolean>(false);

  // Helper function to log notebook actions
  const addLog = (
    action: string,
    reagent: string,
    targetTube: string,
    volumeUl: number,
    tipUsed: string,
    tipChanged: boolean,
    isContaminationRisk: boolean,
    notes?: string
  ) => {
    const newLog: PipettingActionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action,
      reagent,
      targetTube,
      volumeUl,
      tipUsed,
      tipChanged,
      isContaminationRisk,
      notes,
    };
    setNotebookLogs((prev) => [newLog, ...prev]);
    if (onDataLogged) onDataLogged(notebookLogs.length + 1);
  };

  // Reagent list definition
  const REAGENTS = [
    {
      id: 'template_dna',
      name: 'Unknown Patient DNA',
      type: 'essential',
      typicalVol: 2.0,
      description: 'Purified patient genomic DNA template containing target sequence (if positive)',
      color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    },
    {
      id: 'pos_control_dna',
      name: 'Positive Control DNA',
      type: 'essential',
      typicalVol: 2.0,
      description: 'Validated reference DNA plasmid with known 500 bp target amplicon',
      color: 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300',
    },
    {
      id: 'nuclease_free_water',
      name: 'Nuclease-Free Water',
      type: 'essential',
      typicalVol: 14.5,
      description: 'Sterile ultra-pure H₂O (also acts as negative control No-Template sample)',
      color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-700 dark:text-cyan-300',
    },
    {
      id: 'forward_primer',
      name: 'Forward Primer (10 µM)',
      type: 'essential',
      typicalVol: 1.0,
      description: 'Oligonucleotide (20 nt) binding upstream complementary strand (Tm ≈ 60°C)',
      color: 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300',
    },
    {
      id: 'reverse_primer',
      name: 'Reverse Primer (10 µM)',
      type: 'essential',
      typicalVol: 1.0,
      description: 'Oligonucleotide (20 nt) binding downstream opposite strand (Tm ≈ 60°C)',
      color: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-700 dark:text-indigo-300',
    },
    {
      id: 'taq_polymerase',
      name: 'Taq DNA Polymerase (5 U/µL)',
      type: 'essential',
      typicalVol: 0.5,
      description: 'Thermostable DNA polymerase from Thermus aquaticus (incorporates dNTPs at 72°C)',
      color: 'bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300',
    },
    {
      id: 'dntp_mix',
      name: 'dNTP Mixture (10 mM each)',
      type: 'essential',
      typicalVol: 2.0,
      description: 'Equimolar dATP, dCTP, dGTP, dTTP building blocks providing energy and bases',
      color: 'bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300',
    },
    {
      id: 'pcr_buffer',
      name: '10X PCR Reaction Buffer',
      type: 'essential',
      typicalVol: 2.5,
      description: 'Tris-HCl buffer maintaining pH 8.3 and ionic strength with KCl',
      color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-700 dark:text-yellow-300',
    },
    {
      id: 'mgcl2',
      name: 'MgCl₂ Solution (25 mM)',
      type: 'essential',
      typicalVol: 1.5,
      description: 'Essential divalent Mg²⁺ cofactor required for Taq polymerase catalytic activity',
      color: 'bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-300',
    },
    // Distractor / Irrelevant reagents
    {
      id: 'rna_polymerase',
      name: 'T7 RNA Polymerase',
      type: 'distractor',
      typicalVol: 1.0,
      description: 'Used for in-vitro transcription, not DNA replication in standard PCR',
      color: 'bg-stone-500/20 border-stone-500/40 text-stone-700 dark:text-stone-300',
    },
    {
      id: 'dna_ligase',
      name: 'T4 DNA Ligase',
      type: 'distractor',
      typicalVol: 1.0,
      description: 'Catalyzes phosphodiester bonds in cloning; unnecessary for PCR amplification',
      color: 'bg-stone-500/20 border-stone-500/40 text-stone-700 dark:text-stone-300',
    },
  ];

  // Calculate volume totals for each tube
  const getTubeTotalVol = (tubeKey: 'sample' | 'pos_ctrl' | 'neg_ctrl'): number => {
    const values: number[] = Object.values(tubeContents[tubeKey] || {});
    return values.reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
  };

  // Automated Quick Assemble Helper
  const handleQuickAssembleMasterMix = () => {
    const fullSampleMix = {
      template_dna: 2.0,
      forward_primer: 1.0,
      reverse_primer: 1.0,
      taq_polymerase: 0.5,
      dntp_mix: 2.0,
      pcr_buffer: 2.5,
      mgcl2: 1.5,
      nuclease_free_water: 14.5,
    };

    const fullPosCtrlMix = {
      pos_control_dna: 2.0,
      forward_primer: 1.0,
      reverse_primer: 1.0,
      taq_polymerase: 0.5,
      dntp_mix: 2.0,
      pcr_buffer: 2.5,
      mgcl2: 1.5,
      nuclease_free_water: 14.5,
    };

    const fullNegCtrlMix = {
      forward_primer: 1.0,
      reverse_primer: 1.0,
      taq_polymerase: 0.5,
      dntp_mix: 2.0,
      pcr_buffer: 2.5,
      mgcl2: 1.5,
      nuclease_free_water: 16.5, // 2 µL extra water instead of template
    };

    if (selectedScenario === 'scenario_c') {
      // In scenario C, student or simulated environment contaminated the negative control
      (fullNegCtrlMix as any).pos_control_dna = 0.5;
    }

    setTubeContents({
      sample: fullSampleMix,
      pos_ctrl: fullPosCtrlMix,
      neg_ctrl: fullNegCtrlMix,
    });

    addLog(
      'Automated Master Mix Assembly',
      'Full 25 µL Cocktail',
      'All 3 tubes (Sample, +Ctrl, NTC)',
      25.0,
      'Aerosol Barrier Tips',
      true,
      selectedScenario === 'scenario_c',
      selectedScenario === 'scenario_c'
        ? 'Aerosol carryover detected during dispensing into Negative Control tube'
        : 'Reaction assembled according to standard clinical molecular protocol'
    );
  };

  // Handle Aspirating Reagent into Pipette Tip
  const handleAspirate = () => {
    if (!selectedReagent) return;
    if (!hasTipAttached) {
      alert('Error: You cannot aspirate liquid without a pipette tip attached! Attach a sterile tip first.');
      return;
    }
    if (liquidInTip) {
      alert('Error: Pipette tip already contains liquid. Dispense it first.');
      return;
    }

    // Check tip reuse contamination
    let isContaminated = false;
    if (tipContaminatedWith && tipContaminatedWith !== selectedReagent) {
      isContaminated = true;
      setContaminationDetected(true);
      setContaminationReason(`Pipette tip previously touched ${tipContaminatedWith} and was reused into ${selectedReagent}!`);
    }

    setLiquidInTip({
      reagent: selectedReagent,
      volumeUl: dialVolume,
    });
    setTipContaminatedWith(selectedReagent);

    addLog(
      'Aspirate',
      selectedReagent,
      'Pipette Tip',
      dialVolume,
      selectedPipette,
      false,
      isContaminated,
      isContaminated ? 'Reagent vial may be cross-contaminated by un-ejected tip' : 'Clean aspiration at first stop'
    );
  };

  // Handle Dispensing into Target Tube
  const handleDispense = () => {
    if (!liquidInTip || !selectedTargetTube) return;

    const { reagent, volumeUl } = liquidInTip;

    setTubeContents((prev) => {
      const currentInTube = prev[selectedTargetTube][reagent] || 0;
      return {
        ...prev,
        [selectedTargetTube]: {
          ...prev[selectedTargetTube],
          [reagent]: currentInTube + volumeUl,
        },
      };
    });

    // Check if DNA was accidentally dispensed into the Negative Control (NTC)
    if (selectedTargetTube === 'neg_ctrl' && (reagent === 'template_dna' || reagent === 'pos_control_dna')) {
      setContaminationDetected(true);
      setContaminationReason('Template DNA was added to the Negative Control (NTC). This invalidates the negative control!');
    }

    addLog(
      'Dispense',
      reagent,
      selectedTargetTube === 'sample' ? 'Unknown Sample' : selectedTargetTube === 'pos_ctrl' ? 'Positive Control' : 'Negative Control (NTC)',
      volumeUl,
      selectedPipette,
      false,
      selectedTargetTube === 'neg_ctrl' && (reagent === 'template_dna' || reagent === 'pos_control_dna'),
      'Dispensed at second plunger stop'
    );

    setLiquidInTip(null);
  };

  // Eject Pipette Tip
  const handleEjectTip = () => {
    if (!hasTipAttached) return;
    setHasTipAttached(false);
    setTipContaminatedWith(null);
    setLiquidInTip(null);
    addLog('Eject Tip', 'Empty Tip', 'Biohazard Sharp Bin', 0, selectedPipette, true, false, 'Sterile tip ejected');
  };

  // Attach New Sterile Tip
  const handleAttachTip = () => {
    if (hasTipAttached) {
      alert('Tip already attached. Eject the current tip before picking up a new one.');
      return;
    }
    setHasTipAttached(true);
    setTipContaminatedWith(null);
    addLog('Attach Tip', 'Sterile Filter Tip', selectedPipette, 0, selectedPipette, true, false, 'Fresh barrier tip mounted');
  };

  // Stage 4: Thermal Cycler Simulation Timer
  useEffect(() => {
    let timer: any = null;
    if (pcrRunning && currentCycle <= cycleCount) {
      timer = setInterval(() => {
        setCurrentCycle((prevCycle) => {
          if (prevCycle >= cycleCount) {
            setPcrRunning(false);
            setPcrCompleted(true);
            setCurrentStepPhase('hold');
            setCurrentBlockTemp(4.0);
            return cycleCount;
          }
          const next = prevCycle + 1;
          // Cycle through temperatures
          if (next % 3 === 1) {
            setCurrentStepPhase('denat');
            setCurrentBlockTemp(95.0);
          } else if (next % 3 === 2) {
            setCurrentStepPhase('anneal');
            setCurrentBlockTemp(annealingTemp);
          } else {
            setCurrentStepPhase('extend');
            setCurrentBlockTemp(72.0);
          }
          return next;
        });
      }, 250); // fast cycle for responsive lab feel
    }
    return () => clearInterval(timer);
  }, [pcrRunning, currentCycle, cycleCount, annealingTemp]);

  // Stage 6: Gel Electrophoresis Migration Timer
  useEffect(() => {
    let gelTimer: any = null;
    if (gelRunning && migrationPercent < 100) {
      gelTimer = setInterval(() => {
        setMigrationPercent((prev) => {
          if (prev >= 100) {
            setGelRunning(false);
            setElectrophoresisComplete(true);
            return 100;
          }
          return prev + 5;
        });
      }, 400);
    }
    return () => clearInterval(gelTimer);
  }, [gelRunning, migrationPercent]);

  // Theoretical DNA Amplification Curve Data (for Advanced View)
  const amplificationCurveData = useMemo(() => {
    const data = [];
    let molecules = 100; // initial copies N0
    for (let c = 1; c <= 35; c++) {
      if (c <= 26) {
        // Exponential phase N = N0 * 2^c
        molecules = molecules * 1.95;
      } else {
        // Plateau phase (exhaustion of dNTPs and Taq inactivation)
        molecules = molecules * (1 + 0.9 * Math.exp(-(c - 26) / 2.5));
      }
      data.push({
        cycle: c,
        fluorescence: Math.round(molecules / 1000),
      });
    }
    return data;
  }, []);

  // Molecular weight ladder definitions (100 bp - 1500 bp)
  const LADDER_RUNGS = [
    { bp: 1500, relativeMobility: 0.15, label: '1500 bp', isLandmark: false },
    { bp: 1000, relativeMobility: 0.23, label: '1000 bp', isLandmark: true },
    { bp: 800, relativeMobility: 0.32, label: '800 bp', isLandmark: false },
    { bp: 700, relativeMobility: 0.38, label: '700 bp', isLandmark: false },
    { bp: 600, relativeMobility: 0.45, label: '600 bp', isLandmark: false },
    { bp: 500, relativeMobility: 0.53, label: '500 bp (Reference)', isLandmark: true },
    { bp: 400, relativeMobility: 0.63, label: '400 bp', isLandmark: false },
    { bp: 300, relativeMobility: 0.73, label: '300 bp', isLandmark: false },
    { bp: 200, relativeMobility: 0.84, label: '200 bp', isLandmark: false },
    { bp: 100, relativeMobility: 0.95, label: '100 bp', isLandmark: false },
  ];

  // Derive gel bands for each lane based on the active scenario & user parameters
  const resolvedBands = useMemo(() => {
    // Check if PCR worked or failed
    const isTempTooLow = annealingTemp < 50.0;
    const isTempTooHigh = annealingTemp > 65.0;

    // Ladder (Lane 1): Always shows all 10 rungs if loaded
    const lane1Ladder = loadedWells.well1 ? LADDER_RUNGS : [];

    // Lane 2: Positive Control
    let lane2Pos: Array<{ bp: number; mobility: number; intensity: number; label: string }> = [];
    if (loadedWells.well2) {
      if (selectedScenario === 'scenario_b' || isTempTooHigh) {
        // PCR reaction failure (e.g. inactive enzyme or high temp)
        lane2Pos = [];
      } else {
        lane2Pos = [{ bp: 500, mobility: 0.53, intensity: 1.0, label: '500 bp' }];
      }
    }

    // Lane 3: Negative Control (NTC)
    let lane3Neg: Array<{ bp: number; mobility: number; intensity: number; label: string }> = [];
    if (loadedWells.well3) {
      if (selectedScenario === 'scenario_c' || contaminationDetected) {
        // Contaminated NTC! Shows unwanted 500 bp band!
        lane3Neg = [{ bp: 500, mobility: 0.53, intensity: 0.85, label: '500 bp (Contaminant)' }];
      } else {
        // Normal clean NTC (no band)
        lane3Neg = [];
      }
    }

    // Lane 4: Unknown Sample
    let lane4Sample: Array<{ bp: number; mobility: number; intensity: number; label: string }> = [];
    if (loadedWells.well4) {
      if (selectedScenario === 'scenario_b' || isTempTooHigh) {
        lane4Sample = [];
      } else if (selectedScenario === 'scenario_d' || isTempTooLow) {
        // Non-specific mispriming: Multiple bands
        lane4Sample = [
          { bp: 750, mobility: 0.35, intensity: 0.6, label: '750 bp (Non-specific)' },
          { bp: 500, mobility: 0.53, intensity: 0.9, label: '500 bp (Target)' },
          { bp: 250, mobility: 0.78, intensity: 0.5, label: '250 bp (Non-specific)' },
          { bp: 60, mobility: 0.98, intensity: 0.7, label: '<80 bp (Primer-Dimer)' },
        ];
      } else if (selectedScenario === 'scenario_a' || selectedScenario === 'scenario_c') {
        // Target present: clean 500 bp band
        lane4Sample = [{ bp: 500, mobility: 0.53, intensity: 0.95, label: '500 bp' }];
      }
    }

    return {
      lane1: lane1Ladder,
      lane2: lane2Pos,
      lane3: lane3Neg,
      lane4: lane4Sample,
    };
  }, [loadedWells, selectedScenario, annealingTemp, contaminationDetected]);

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
      {/* Simulation Header & Workflow Stages Navigation */}
      <div className="border-b border-stone-200 dark:border-stone-800 p-4 sm:p-5 bg-stone-50/75 dark:bg-stone-900/75">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Dna className="w-3.5 h-3.5" />
                Molecular Biology Practical
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                BIO-LAB-301 • 500 bp Target Amplicon
              </span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">
              PCR Amplification & Agarose Gel Electrophoresis
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">
              Empirical reaction setup, sterile micropipetting, 3-step thermal cycling, horizontal submarine electrophoresis, and UV molecular sizing.
            </p>
          </div>

          {/* Quick Scenario Selector & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-stone-200/70 dark:bg-stone-800/80 px-2.5 py-1.5 rounded-lg">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Scenario:</span>
              <select
                value={selectedScenario}
                onChange={(e) => {
                  setSelectedScenario(e.target.value as PcrScenario);
                  setContaminationDetected(false);
                }}
                className="bg-transparent font-medium text-stone-900 dark:text-stone-100 outline-none cursor-pointer text-xs"
              >
                <option value="scenario_a" className="dark:bg-stone-900">Scenario A: Normal Amplification (Target +)</option>
                <option value="scenario_b" className="dark:bg-stone-900">Scenario B: PCR Failure (Enzyme Dropout)</option>
                <option value="scenario_c" className="dark:bg-stone-900">Scenario C: Carryover Contamination (NTC +)</option>
                <option value="scenario_d" className="dark:bg-stone-900">Scenario D: Low Stringency Mispriming</option>
              </select>
            </div>

            {/* Pair Lab Launcher Button */}
            <button
              onClick={() => setShowPairLabJoinModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition shadow-xs ${
                isPairLabMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60'
              }`}
              title="Real-Time Collaborative Mode with Partner"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isPairLabMode ? `Pair Lab (${pairRoomId})` : 'Pair Lab Mode'}</span>
            </button>

            <button
              onClick={() => {
                setActiveStage(1);
                setTubeContents({ sample: {}, pos_ctrl: {}, neg_ctrl: {} });
                setHasTipAttached(false);
                setLiquidInTip(null);
                setContaminationDetected(false);
                setPcrRunning(false);
                setPcrCompleted(false);
                setCurrentCycle(0);
                setGelRunning(false);
                setMigrationPercent(0);
                setElectrophoresisComplete(false);
                setLoadedWells({ well1: null, well2: null, well3: null, well4: null });
                setUvTransilluminatorOn(false);
                setNotebookLogs([]);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition"
              title="Reset full experiment"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Lab
            </button>
          </div>
        </div>

        {/* 7-Stage Workflow Progress Stepper */}
        <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { num: 1, title: '1. Brief & Mix', subtitle: 'Component logic' },
              { num: 2, title: '2. Setup Bench', subtitle: 'Micropipetting' },
              { num: 3, title: '3. Prep & Spin', subtitle: 'Vortex & centrifuge' },
              { num: 4, title: '4. PCR Cycling', subtitle: 'Thermocycler run' },
              { num: 5, title: '5. Gel Prep', subtitle: 'Dye & 1.5% agarose' },
              { num: 6, title: '6. Electrophoresis', subtitle: 'Run to Red' },
              { num: 7, title: '7. UV Sizing', subtitle: 'Ladder & analysis' },
            ].map((st) => {
              const isCurrent = activeStage === st.num;
              const isPast = activeStage > st.num;
              return (
                <button
                  key={st.num}
                  onClick={() => setActiveStage(st.num)}
                  className={`text-left p-2.5 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100 shadow-xs'
                      : isPast
                      ? 'bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-emerald-300'
                      : 'bg-stone-100/60 dark:bg-stone-900/40 border-dashed border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{st.title}</span>
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                    {st.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pair Lab Real-Time Status Bar if active */}
        {isPairLabMode && (
          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <PairLabBar
              roomId={pairRoomId}
              roomState={pairLab.roomState}
              myUser={pairLab.myUser}
              partnerUser={pairLab.partnerUser}
              isConnected={pairLab.isConnected}
              onOpenChat={() => setShowPairLabChat(true)}
              onLeavePairLab={() => setIsPairLabMode(false)}
              onResetSession={() => pairLab.resetRoom()}
              isDark={isDark}
            />
          </div>
        )}
      </div>

      {/* Main Workspace Area */}
      <div className="p-4 sm:p-6">
        {/* STAGE 1: Experimental Brief & PCR Component Selection */}
        {activeStage === 1 && (
          <div className="space-y-6">
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 mt-0.5">
                  <Dna className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                    Stage 1: Clinical Research Question & Reagent Selection
                  </h3>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">
                    <strong>Research Question:</strong> &quot;Does the patient clinical sample contain the conserved 500 bp target DNA sequence?&quot;
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs text-stone-600 dark:text-stone-400">
                    <div className="p-2.5 bg-white dark:bg-stone-800 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="font-semibold text-stone-900 dark:text-stone-200">Target Amplicon:</span> 500 base pairs (bp)
                    </div>
                    <div className="p-2.5 bg-white dark:bg-stone-800 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="font-semibold text-stone-900 dark:text-stone-200">Forward & Reverse Primers:</span> 20 nt, Tm ≈ 60.0°C
                    </div>
                    <div className="p-2.5 bg-white dark:bg-stone-800 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="font-semibold text-stone-900 dark:text-stone-200">Required Controls:</span> Positive (+Ctrl) & No-Template (NTC)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reagent Selection Question */}
            <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Decision: Which components are essential to formulate a standard PCR reaction?
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Select all required reagents from the laboratory stock below. (Incorrect choices will display informative biochemical feedback).
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Auto-select all correct essential components
                    const correct = REAGENTS.filter((r) => r.type === 'essential').map((r) => r.id);
                    setSelectedComponents(correct);
                    setStage1Submitted(true);
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  Select All Essential
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {REAGENTS.map((r) => {
                  const isSelected = selectedComponents.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedComponents((prev) =>
                          isSelected ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                        );
                      }}
                      className={`text-left p-3 rounded-lg border text-xs transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-[10px] font-mono opacity-70">{r.typicalVol} µL</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                        {r.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Banner */}
              {stage1Submitted && (
                <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Correct Components Verified!
                  </div>
                  <p className="mt-1">
                    A standard 25 µL PCR reaction requires: <strong>Template DNA</strong> (or water for NTC), <strong>Forward & Reverse Primers</strong> (flanking target), <strong>Taq Polymerase</strong> (synthesis), <strong>dNTPs</strong> (building blocks), <strong>Buffer</strong> (pH 8.3), <strong>MgCl₂</strong> (essential enzyme cofactor), and <strong>Nuclease-Free Water</strong>. T7 RNA polymerase and DNA ligase are not needed.
                  </p>
                </div>
              )}

              <div className="flex justify-end mt-5">
                <button
                  onClick={() => {
                    setStage1Submitted(true);
                    setActiveStage(2);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-xs"
                >
                  Proceed to Reaction Setup Bench
                  <Play className="w-3.5 h-3.5 fill-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: Virtual PCR Reaction Setup Bench */}
        {activeStage === 2 && (
          <div className="space-y-6">
            {/* Contamination Alert if detected */}
            {contaminationDetected && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold">Potential Contamination Event Detected:</span> {contaminationReason}
                  <p className="mt-1 text-amber-800 dark:text-amber-300">
                    In molecular diagnostics, aerosol droplets or reused pipette tips can contaminate the Negative Control (NTC) or shared water stock. You may proceed and observe how this compromises downstream gel interpretation, or reset the tube.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Pipetting Station Controls */}
              <div className="lg:col-span-4 space-y-4">
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 bg-stone-50/50 dark:bg-stone-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <Pipette className="w-4 h-4 text-emerald-600" />
                      Adjustable Micropipette
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      hasTipAttached ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {hasTipAttached ? 'Tip Attached' : 'No Tip'}
                    </span>
                  </div>

                  {/* Pipette model selection */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {(['P10', 'P20', 'P200'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedPipette(p)}
                        className={`py-1.5 text-xs font-mono font-bold rounded border transition ${
                          selectedPipette === p
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {p}
                        <span className="block text-[9px] font-normal opacity-80">
                          {p === 'P10' ? '0.5–10 µL' : p === 'P20' ? '2–20 µL' : '20–200 µL'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Volume dial */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
                      <span>Micrometer Volume Dial:</span>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100 text-sm">
                        {dialVolume.toFixed(1)} µL
                      </span>
                    </div>
                    <input
                      type="range"
                      min={selectedPipette === 'P10' ? 0.5 : selectedPipette === 'P20' ? 2.0 : 20.0}
                      max={selectedPipette === 'P10' ? 10.0 : selectedPipette === 'P20' ? 20.0 : 200.0}
                      step={selectedPipette === 'P10' ? 0.1 : 0.5}
                      value={dialVolume}
                      onChange={(e) => setDialVolume(parseFloat(e.target.value))}
                      className="w-full mt-1.5 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Tip Actions & Liquid Status */}
                  <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleAttachTip}
                        disabled={hasTipAttached}
                        className="flex-1 py-1.5 text-xs font-semibold rounded bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700 disabled:opacity-50 transition"
                      >
                        Attach Fresh Tip
                      </button>
                      <button
                        onClick={handleEjectTip}
                        disabled={!hasTipAttached}
                        className="flex-1 py-1.5 text-xs font-semibold rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 disabled:opacity-50 transition"
                      >
                        Eject Tip (Trash)
                      </button>
                    </div>

                    {/* Liquid Column Graphic inside Tip */}
                    <div className="p-3 bg-white dark:bg-stone-800/80 rounded border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs">
                      <span className="text-stone-500 dark:text-stone-400">Tip Liquid State:</span>
                      {liquidInTip ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Droplets className="w-3.5 h-3.5" />
                          {liquidInTip.volumeUl.toFixed(1)} µL of {REAGENTS.find((r) => r.id === liquidInTip.reagent)?.name}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">Empty Tip (Awaiting Aspiration)</span>
                      )}
                    </div>
                  </div>

                  {/* Pipetting Operations */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleAspirate}
                      disabled={!selectedReagent || !hasTipAttached || !!liquidInTip}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded disabled:opacity-40 transition"
                    >
                      Aspirate Liquid (1st Stop)
                    </button>
                    <button
                      onClick={handleDispense}
                      disabled={!liquidInTip || !selectedTargetTube}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded disabled:opacity-40 transition"
                    >
                      Dispense into Tube (2nd Stop)
                    </button>
                  </div>
                </div>

                {/* Master Mix Shortcut for convenience */}
                <div className="p-3.5 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/40 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-800 dark:text-stone-200">Rapid Testing Option:</span>
                    <button
                      onClick={handleQuickAssembleMasterMix}
                      className="px-2.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold transition text-[11px]"
                    >
                      Auto-Fill Master Mix
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                    Automatically assembles all 3 tubes (25 µL standard cocktail) with sterile barrier tips so you can proceed immediately to downstream thermal cycling and gel analysis.
                  </p>
                </div>
              </div>

              {/* Middle/Right Column: Cold Reagents Rack & PCR Tube Rack */}
              <div className="lg:col-span-8 space-y-4">
                {/* Cold Reagents Ice Bucket */}
                <div className="border border-cyan-200 dark:border-cyan-900/60 rounded-xl p-4 bg-cyan-50/30 dark:bg-stone-900">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-cyan-600" />
                      Insulated Ice Bucket (4°C Reagents)
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      Click vial to select for micropipetting
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {REAGENTS.filter((r) => r.type === 'essential').map((r) => {
                      const isSelected = selectedReagent === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedReagent(r.id);
                            setDialVolume(r.typicalVol);
                          }}
                          className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 bg-white dark:bg-stone-800 shadow-sm border-emerald-500'
                              : 'bg-white/80 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 hover:border-cyan-400'
                          }`}
                        >
                          <div className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {r.name}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 mt-1">
                            <span>Stock</span>
                            <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">
                              Rec: {r.typicalVol} µL
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 0.2 mL PCR Tube Cold Rack (3 tubes) */}
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 bg-white dark:bg-stone-900">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-emerald-600" />
                      0.2 mL Thin-Wall PCR Tubes (Target: 25.0 µL Total)
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      Select target tube to dispense
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        key: 'sample' as const,
                        name: 'Unknown Sample (Patient)',
                        capColor: 'bg-emerald-500 text-white',
                        desc: 'Unknown template DNA + Master Mix',
                      },
                      {
                        key: 'pos_ctrl' as const,
                        name: 'Positive Control (+Ctrl)',
                        capColor: 'bg-amber-500 text-white',
                        desc: 'Known 500 bp control plasmid + Master Mix',
                      },
                      {
                        key: 'neg_ctrl' as const,
                        name: 'Negative Control (NTC)',
                        capColor: 'bg-cyan-500 text-white',
                        desc: 'Water only (No Template) + Master Mix',
                      },
                    ].map((tube) => {
                      const totalVol = getTubeTotalVol(tube.key);
                      const isSelected = selectedTargetTube === tube.key;
                      const hasTemplate = tube.key === 'neg_ctrl' ? false : totalVol > 0;
                      return (
                        <div
                          key={tube.key}
                          onClick={() => setSelectedTargetTube(tube.key)}
                          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                              : 'border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-800/40 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tube.capColor}`}>
                              {tube.name}
                            </span>
                            <span className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100">
                              {totalVol.toFixed(1)} / 25 µL
                            </span>
                          </div>

                          {/* Miniature visual tube */}
                          <div className="mt-3 flex items-center justify-center py-2">
                            <div className="w-12 h-20 rounded-b-xl border-2 border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 relative overflow-hidden flex flex-col justify-end p-0.5">
                              {/* Liquid fill */}
                              <div
                                style={{ height: `${Math.min(100, (totalVol / 25) * 85)}%` }}
                                className={`w-full rounded-b-lg transition-all duration-300 ${
                                  tube.key === 'pos_ctrl'
                                    ? 'bg-amber-400/60'
                                    : tube.key === 'neg_ctrl'
                                    ? 'bg-cyan-400/60'
                                    : 'bg-emerald-400/60'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Components list in tube */}
                          <div className="mt-2 text-[10px] text-stone-500 dark:text-stone-400 space-y-0.5 max-h-16 overflow-y-auto">
                            {Object.keys(tubeContents[tube.key]).length === 0 ? (
                              <span className="italic">Tube currently empty</span>
                            ) : (
                              Object.entries(tubeContents[tube.key]).map(([rId, vol]: [string, number]) => (
                                <div key={rId} className="flex justify-between">
                                  <span className="truncate">{REAGENTS.find((r) => r.id === rId)?.name}:</span>
                                  <span className="font-mono">{Number(vol).toFixed(1)} µL</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pair Lab: Dual Master Mix Co-Verification Gate */}
                {isPairLabMode && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            Pair Lab Gate 1: Master Mix Dual-Key Verification
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            pairLab.roomState?.coordination.masterMixVerifiedByB
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : pairLab.roomState?.coordination.masterMixSubmittedByA
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                          }`}>
                            {pairLab.roomState?.coordination.masterMixVerifiedByB
                              ? 'CO-SIGNED & VERIFIED'
                              : pairLab.roomState?.coordination.masterMixSubmittedByA
                              ? 'PENDING CO-SIGNATURE'
                              : 'PIPETTING IN PROGRESS'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                          {pairLab.roomState?.coordination.masterMixVerifiedByB
                            ? 'Partner B has inspected and approved reaction chemistry (25.0 µL total volume, 1X buffer, correct primers & dNTPs). Ready for thermal cycler prep.'
                            : pairLab.roomState?.coordination.masterMixSubmittedByA
                            ? 'Partner A has completed reagent additions and requested verification. Partner B must review volumes and sign off.'
                            : 'Partner A leads pipetting. When finished, submit reaction mix for Partner B review.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!pairLab.roomState?.coordination.masterMixSubmittedByA && (
                          <button
                            type="button"
                            onClick={() => pairLab.sendCoordinationAction('submit_master_mix')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Submit Mix for Co-Sign
                          </button>
                        )}

                        {pairLab.roomState?.coordination.masterMixSubmittedByA &&
                          !pairLab.roomState?.coordination.masterMixVerifiedByB && (
                            <button
                              type="button"
                              onClick={() => pairLab.sendCoordinationAction('verify_master_mix')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verify & Co-Sign Reaction
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage Progression Button */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-stone-500">
                    {isPairLabMode && !pairLab.roomState?.coordination.masterMixVerifiedByB
                      ? 'Requires Partner B verification & co-signature before unlocking Stage 3.'
                      : 'Ensure all 3 tubes are filled with 25.0 µL reaction mix before thermal cycling.'}
                  </span>
                  <button
                    onClick={() => {
                      setActiveStage(3);
                      if (isPairLabMode) pairLab.changeStage(3);
                    }}
                    disabled={
                      getTubeTotalVol('sample') < 10 ||
                      (isPairLabMode && !pairLab.roomState?.coordination.masterMixVerifiedByB)
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition shadow-xs"
                  >
                    Proceed to Mixing & Centrifugation
                    <Play className="w-3.5 h-3.5 fill-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: Sample Preparation, Vortex & Mini-Centrifuge */}
        {activeStage === 3 && (
          <div className="space-y-6">
            <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Stage 3: Mixing & Centrifugation of Reaction Droplets
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Because micropipetted reagents frequently cling to the plastic walls of 0.2 mL tubes in micro-droplets, the reaction mixture must be thoroughly mixed and spun down to form a homogeneous 25 µL pellet at the conical bottom.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Step A: Vortex Mixer */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <RefreshCw className={`w-4 h-4 ${isVortexing ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
                      Touch Vortex Mixer
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      hasVortexed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
                    }`}>
                      {hasVortexed ? 'Mixed (Homogeneous)' : 'Not Mixed'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                    Pulse vortexing gently agitates the enzyme, salts, dNTPs, and primers without shearing template DNA.
                  </p>

                  <div className="my-6 flex justify-center">
                    <div className={`w-28 h-28 rounded-2xl bg-stone-100 dark:bg-stone-800 border-2 border-stone-300 dark:border-stone-700 flex flex-col items-center justify-center p-3 transition ${
                      isVortexing ? 'animate-pulse ring-4 ring-emerald-400/40' : ''
                    }`}>
                      <div className="w-8 h-8 rounded-full bg-stone-800 dark:bg-stone-200 flex items-center justify-center text-white dark:text-stone-900 text-xs font-bold">
                        V
                      </div>
                      <span className="text-[10px] font-mono text-stone-500 mt-2">
                        {isVortexing ? '3000 RPM' : 'Standby'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsVortexing(true);
                    setTimeout(() => {
                      setIsVortexing(false);
                      setHasVortexed(true);
                      addLog('Mix', 'Reaction Cocktail', 'PCR Tubes', 25, 'Vortexer', false, false, 'Pulse vortex complete');
                    }, 1200);
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
                >
                  {isVortexing ? 'Vortexing Mix...' : 'Touch Pulse Vortex (3 sec)'}
                </button>
              </div>

              {/* Step B: Benchtop Mini-Centrifuge */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <RotateCcw className={`w-4 h-4 ${isCentrifuging ? 'animate-spin text-blue-600' : 'text-stone-500'}`} />
                      Benchtop Mini Centrifuge (Quick Spin)
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      hasCentrifuged ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
                    }`}>
                      {hasCentrifuged ? 'Pellet Settled' : 'Droplets on Wall'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                    A brief 5-second pulse centrifugation brings all liquid droplets down from the tube walls to ensure thermal contact with the thermocycler heating block.
                  </p>

                  <div className="my-6 flex justify-center">
                    <div className={`w-28 h-28 rounded-full bg-stone-100 dark:bg-stone-800 border-2 border-stone-300 dark:border-stone-700 flex flex-col items-center justify-center p-3 transition ${
                      isCentrifuging ? 'animate-spin ring-4 ring-blue-400/40' : ''
                    }`}>
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-stone-400 dark:border-stone-500 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-blue-600" />
                      </div>
                      <span className="text-[10px] font-mono text-stone-500 mt-1">
                        {isCentrifuging ? '6000 RPM' : 'Rotor Idle'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsCentrifuging(true);
                    setTimeout(() => {
                      setIsCentrifuging(false);
                      setHasCentrifuged(true);
                      setDropletsOnWall(false);
                      addLog('Centrifuge', 'Quick Spin', 'PCR Tubes', 25, 'Mini Centrifuge', false, false, 'Droplets collected at tube apex');
                    }, 1500);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  {isCentrifuging ? 'Centrifuging Rotor...' : 'Quick Spin-Down (5 sec)'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveStage(4)}
                disabled={!hasCentrifuged}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition shadow-xs"
              >
                Place in Thermal Cycler & Program Profile
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: Programmable Thermal Cycler */}
        {activeStage === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Thermocycler Instrument Screen & Controls */}
              <div className="lg:col-span-6 space-y-4">
                <div className="border border-stone-800 rounded-xl p-5 bg-stone-950 text-stone-100 shadow-md">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold tracking-wider font-mono">
                        BIORAD T100 THERMAL CYCLER
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      pcrRunning ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse' : pcrCompleted ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-stone-800 text-stone-400'
                    }`}>
                      {pcrRunning ? 'CYCLING IN PROGRESS' : pcrCompleted ? 'PROGRAM COMPLETE (4°C)' : 'READY TO RUN'}
                    </span>
                  </div>

                  {/* Digital Readout */}
                  <div className="my-4 grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-stone-900 border border-stone-800">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Block Temp</span>
                      <span className="text-2xl font-mono font-bold text-amber-400">
                        {currentBlockTemp.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-stone-900 border border-stone-800">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Cycle Count</span>
                      <span className="text-2xl font-mono font-bold text-emerald-400">
                        {currentCycle} / {cycleCount}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-stone-900 border border-stone-800">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Heated Lid</span>
                      <span className="text-2xl font-mono font-bold text-rose-400">
                        {heatedLidOn ? '105°C' : 'OFF'}
                      </span>
                    </div>
                  </div>

                  {/* Current Phase Diagram */}
                  <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs">
                    <span className="text-stone-400 text-[11px] block mb-1">Active Cycle Stage:</span>
                    <div className="flex items-center justify-between text-stone-300 font-mono text-[11px]">
                      <span className={currentStepPhase === 'denat' ? 'text-amber-400 font-bold underline' : 'opacity-60'}>
                        1. Denat (95°C)
                      </span>
                      <span>→</span>
                      <span className={currentStepPhase === 'anneal' ? 'text-cyan-400 font-bold underline' : 'opacity-60'}>
                        2. Anneal ({annealingTemp.toFixed(1)}°C)
                      </span>
                      <span>→</span>
                      <span className={currentStepPhase === 'extend' ? 'text-emerald-400 font-bold underline' : 'opacity-60'}>
                        3. Extend (72°C)
                      </span>
                    </div>
                  </div>

                  {/* Run / Coordination Buttons */}
                  <div className="mt-4 space-y-2">
                    {isPairLabMode ? (
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            Pair Lab Gate 2: Dual-Key Launch Authorization
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            pcrRunning
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : pairLab.roomState?.coordination.thermocyclerArmedByB
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                              : 'bg-stone-200 text-stone-700 dark:bg-stone-800'
                          }`}>
                            {pcrRunning
                              ? 'RUN IN PROGRESS'
                              : pairLab.roomState?.coordination.thermocyclerArmedByB
                              ? 'ARMED: AWAITING PARTNER A'
                              : 'UNARMED'}
                          </span>
                        </div>

                        <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                          {pairLab.roomState?.coordination.thermocyclerArmedByB
                            ? `Partner B programmed annealing temperature to ${pairLab.roomState?.thermocycler?.annealingTemp || annealingTemp}°C. Partner A must verify stringency and authorize launch.`
                            : 'Partner B: Program annealing temperature ($T_a$) and arm the cycler for Partner A authorization.'}
                        </p>

                        <div className="mt-2.5 flex gap-2">
                          {!pairLab.roomState?.coordination.thermocyclerArmedByB && !pcrRunning && (
                            <button
                              type="button"
                              onClick={() =>
                                pairLab.sendCoordinationAction('arm_thermocycler', { annealingTemp })
                              }
                              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Arm Cycler & Request Partner A Launch
                            </button>
                          )}

                          {pairLab.roomState?.coordination.thermocyclerArmedByB && !pcrRunning && (
                            <button
                              type="button"
                              onClick={() => {
                                pairLab.sendCoordinationAction('authorize_thermocycler');
                                setPcrRunning(true);
                                setPcrCompleted(false);
                                setCurrentCycle(1);
                              }}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-xs animate-pulse"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              Authorize Thermal Cycler Launch
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setPcrRunning(true);
                            setPcrCompleted(false);
                            setCurrentCycle(1);
                            addLog('PCR Run', `Annealing ${annealingTemp}°C`, '30 Cycles', 25, 'Thermal Cycler', false, false, 'Started 3-step thermal cycling');
                          }}
                          disabled={pcrRunning}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          {pcrRunning ? 'Cycling Active...' : 'Start Thermal Cycling'}
                        </button>
                      </div>
                    )}

                    {pcrRunning && (
                      <button
                        onClick={() => {
                          setCurrentCycle(cycleCount);
                          setPcrRunning(false);
                          setPcrCompleted(true);
                          setCurrentBlockTemp(4.0);
                          setCurrentStepPhase('hold');
                          if (isPairLabMode) {
                            pairLab.updateSharedState({
                              thermocycler: {
                                ...pairLab.roomState?.thermocycler,
                                pcrRunning: false,
                                pcrCompleted: true,
                              } as any,
                            });
                          }
                        }}
                        className="w-full py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono rounded-lg transition text-center"
                        title="Fast-forward 30 cycles"
                      >
                        ⚡ Fast-Forward 30 Cycles
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Protocol Configuration & Annealing Tuning */}
              <div className="lg:col-span-6 space-y-4">
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    PCR Protocol Parameters & Annealing Temperature Decision
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    Primers have an average melting temperature Tm = 60.0°C. Select the appropriate annealing temperature (Ta ≈ Tm - 5°C).
                  </p>

                  <div className="space-y-3 mt-4">
                    {[
                      {
                        temp: 45.0,
                        title: '45.0°C (Low Stringency)',
                        desc: 'Permits non-specific primer binding to partially matched genomic loci, creating ghost bands and smears.',
                      },
                      {
                        temp: 55.0,
                        title: '55.0°C (Optimal Recommended: Tm - 5°C)',
                        desc: 'Optimal stringency. Enables specific hybridization to target flanking sites with high yield and zero mispriming.',
                      },
                      {
                        temp: 68.0,
                        title: '68.0°C (High Stringency)',
                        desc: 'Excessive thermal kinetic motion prevents primers from annealing; results in complete amplification failure.',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.temp}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer text-xs transition ${
                          annealingTemp === opt.temp
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                            : 'border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-800/40 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="annealingTemp"
                          checked={annealingTemp === opt.temp}
                          onChange={() => setAnnealingTemp(opt.temp)}
                          className="mt-0.5 accent-emerald-600"
                        />
                        <div>
                          <span className="font-bold">{opt.title}</span>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Optional Amplification Curve Toggle */}
                  <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
                    <span className="text-xs text-stone-600 dark:text-stone-400">
                      Show Theoretical Amplification Kinetics ($N = N_0 \cdot 2^n$)
                    </span>
                    <button
                      onClick={() => setShowAdvancedAmpGraph(!showAdvancedAmpGraph)}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {showAdvancedAmpGraph ? 'Hide Kinetics' : 'View Curve'}
                    </button>
                  </div>

                  {showAdvancedAmpGraph && (
                    <div className="mt-3 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-lg border border-stone-200 dark:border-stone-700 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={amplificationCurveData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e5e7eb'} />
                          <XAxis dataKey="cycle" stroke={isDark ? '#888' : '#666'} fontSize={10} label={{ value: 'Cycle #', position: 'insideBottom', offset: -2 }} />
                          <YAxis stroke={isDark ? '#888' : '#666'} fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1c1917' : '#ffffff', borderRadius: 8, fontSize: 11 }} />
                          <Line type="monotone" dataKey="fluorescence" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stage Progression when PCR is Complete */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-stone-500">
                {pcrCompleted
                  ? 'PCR has finished. Amplified reaction products are ready for agarose gel analysis.'
                  : 'Start and complete thermal cycling to unlock gel electrophoresis.'}
              </span>
              <button
                onClick={() => setActiveStage(5)}
                disabled={!pcrCompleted}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition shadow-xs"
              >
                Proceed to Gel Preparation & Loading Dye
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 5: Post-PCR & Agarose Gel Preparation */}
        {activeStage === 5 && (
          <div className="space-y-6">
            <div className="bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                Stage 5: Agarose Gel Casting & 6X Loading Buffer Addition
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Before loading PCR products into submerged agarose wells, a 6X DNA Loading Buffer (containing glycerol and tracking dyes) must be mixed into each tube. Glycerol gives the sample high density so it sinks into the well rather than floating out into the running buffer.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gel Specification Card */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block mb-2">
                  Gel Matrix & Buffer Specifications:
                </span>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-800 rounded-lg flex justify-between">
                    <span className="text-stone-500">Agarose Concentration:</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">1.5% w/v (Optimal for 200–1500 bp)</span>
                  </div>
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-800 rounded-lg flex justify-between">
                    <span className="text-stone-500">Electrophoresis Buffer:</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">1X TAE (Tris-Acetate-EDTA, pH 8.3)</span>
                  </div>
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-800 rounded-lg flex justify-between">
                    <span className="text-stone-500">Fluorescent DNA Stain:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">GelGreen / Ethidium Bromide</span>
                  </div>
                  <div className="p-2.5 bg-stone-50 dark:bg-stone-800 rounded-lg flex justify-between">
                    <span className="text-stone-500">Submerged Comb Wells:</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">4 Wells (25 µL capacity each)</span>
                  </div>
                </div>
              </div>

              {/* Loading Dye Addition Interactive Check */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block mb-2">
                  Add 6X Loading Buffer (5 µL each):
                </span>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                  Bromophenol blue tracks migration (~300 bp in 1.5% gel) while glycerol ensures the sample sinks to the well bottom.
                </p>

                <div className="space-y-2.5">
                  {[
                    { id: 'pos_ctrl', label: 'Positive Control (+Ctrl) Tube' },
                    { id: 'neg_ctrl', label: 'Negative Control (NTC) Tube' },
                    { id: 'sample', label: 'Unknown Patient Sample Tube' },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-xs"
                    >
                      <span className="font-medium text-stone-800 dark:text-stone-200">{item.label}</span>
                      <button
                        onClick={() => {
                          setLoadingDyeAdded((prev) => ({ ...prev, [item.id]: true }));
                          addLog('Add Loading Dye', '6X Bromophenol Blue', item.label, 5.0, 'P10', true, false, 'Glycerol added for sinking density');
                        }}
                        disabled={loadingDyeAdded[item.id]}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${
                          loadingDyeAdded[item.id]
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {loadingDyeAdded[item.id] ? 'Dye Added ✓' : 'Add 5 µL Dye'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveStage(6)}
                disabled={!loadingDyeAdded.sample || !loadingDyeAdded.pos_ctrl}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition shadow-xs"
              >
                Proceed to Horizontal Electrophoresis Tank
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 6: Agarose Gel Electrophoresis Tank & Running */}
        {activeStage === 6 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Gel Chamber Visual */}
              <div className="lg:col-span-7 space-y-4">
                <div className="border border-stone-300 dark:border-stone-700 rounded-xl p-5 bg-stone-100 dark:bg-stone-950 shadow-inner">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${gelRunning ? 'text-amber-500 animate-pulse' : 'text-stone-400'}`} />
                      Horizontal Submarine Agarose Tank (1X TAE Buffer)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-stone-900 text-white font-mono text-[10px]">
                        Cathode (-)
                      </span>
                      <span className="text-stone-400">→</span>
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px]">
                        Anode (+) &quot;Run to Red&quot;
                      </span>
                    </div>
                  </div>

                  {/* Gel Tank Bed */}
                  <div className="w-full h-72 rounded-xl bg-cyan-900/10 dark:bg-cyan-950/40 border-2 border-cyan-400/40 relative overflow-hidden p-4 flex flex-col justify-between">
                    {/* Platinum Cathode Wire (-) at Top */}
                    <div className="w-full h-1 bg-stone-800 dark:bg-stone-400 relative flex items-center justify-center">
                      <span className="absolute -top-3 text-[9px] font-mono text-stone-500">
                        Negative Cathode Wire (-)
                      </span>
                    </div>

                    {/* Agarose Gel Slab */}
                    <div className="w-full h-56 rounded-lg bg-cyan-100/40 dark:bg-cyan-950/60 border border-cyan-300/40 relative p-3">
                      {/* 4 Comb Wells at Top */}
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { id: 'well1' as const, label: 'Well 1: Ladder', sampleName: '100 bp Ladder' },
                          { id: 'well2' as const, label: 'Well 2: +Ctrl', sampleName: 'Positive Ctrl' },
                          { id: 'well3' as const, label: 'Well 3: NTC', sampleName: 'Negative Ctrl' },
                          { id: 'well4' as const, label: 'Well 4: Sample', sampleName: 'Unknown DNA' },
                        ].map((w) => {
                          const isLoaded = !!loadedWells[w.id];
                          return (
                            <div key={w.id} className="flex flex-col items-center">
                              <button
                                onClick={() => {
                                  setLoadedWells((prev) => ({
                                    ...prev,
                                    [w.id]: w.sampleName,
                                  }));
                                  addLog('Load Gel Well', w.sampleName, w.label, 10.0, 'P20', true, false, 'Sample loaded into submerged agarose well');
                                }}
                                className={`w-14 h-4 rounded-b-md border border-stone-400 dark:border-stone-500 transition-all ${
                                  isLoaded ? 'bg-blue-800 shadow-sm ring-1 ring-blue-400' : 'bg-stone-300 dark:bg-stone-700 hover:bg-stone-400'
                                }`}
                                title={`Click to load ${w.sampleName}`}
                              />
                              <span className="text-[10px] font-mono font-semibold text-stone-700 dark:text-stone-300 mt-1 truncate max-w-[80px]">
                                {w.label}
                              </span>
                              <span className="text-[9px] text-stone-500">
                                {isLoaded ? 'Loaded (10 µL)' : 'Empty'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Migrating Blue Tracking Dye Front */}
                      {gelRunning || migrationPercent > 0 ? (
                        <div
                          style={{ top: `${20 + (migrationPercent / 100) * 65}%` }}
                          className="absolute left-3 right-3 h-2 rounded bg-blue-600/80 blur-xs transition-all duration-300"
                        >
                          <span className="absolute -top-3.5 right-0 text-[8px] font-mono text-blue-700 dark:text-blue-300">
                            Bromophenol Blue Dye Front (~300 bp)
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Platinum Anode Wire (+) at Bottom */}
                    <div className="w-full h-1 bg-red-600 relative flex items-center justify-center">
                      <span className="absolute -bottom-3 text-[9px] font-mono text-red-600">
                        Positive Anode Wire (+)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Power Supply Controls */}
              <div className="lg:col-span-5 space-y-4">
                <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Regulated DC Electrophoresis Power Supply
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      gelRunning ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                    }`}>
                      {gelRunning ? 'CURRENT FLOWING' : 'IDLE'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-stone-600 dark:text-stone-400">
                        <span>Constant Voltage:</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {electrophoresisVoltage} V
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        step={10}
                        value={electrophoresisVoltage}
                        onChange={(e) => setElectrophoresisVoltage(parseInt(e.target.value))}
                        disabled={gelRunning}
                        className="w-full mt-1.5 accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Lead Polarity Warning / Pair Lab Gate 3 */}
                    {isPairLabMode ? (
                      <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            Pair Lab Gate 3: &quot;Run to Red&quot; Dual Polarity Check
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            pairLab.roomState?.coordination.polarityCheckedByA &&
                            pairLab.roomState?.coordination.polarityCheckedByB
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {pairLab.roomState?.coordination.polarityCheckedByA &&
                            pairLab.roomState?.coordination.polarityCheckedByB
                              ? 'POLARITY CONFIRMED'
                              : 'CHECK REQUIRED'}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-600 dark:text-stone-400">
                          Because DNA is polyanionic (negatively charged phosphate backbone), reversing electrodes will cause samples to migrate out into the buffer and be permanently lost. Both partners must verify polarity.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => pairLab.sendCoordinationAction('check_polarity')}
                            className={`py-1.5 px-2 rounded text-[11px] font-bold border transition text-left flex items-center justify-between ${
                              pairLab.roomState?.coordination.polarityCheckedByA
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                                : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50'
                            }`}
                          >
                            <span>Partner A: Cathode (-)</span>
                            {pairLab.roomState?.coordination.polarityCheckedByA && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => pairLab.sendCoordinationAction('check_polarity')}
                            className={`py-1.5 px-2 rounded text-[11px] font-bold border transition text-left flex items-center justify-between ${
                              pairLab.roomState?.coordination.polarityCheckedByB
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                                : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50'
                            }`}
                          >
                            <span>Partner B: Anode (+)</span>
                            {pairLab.roomState?.coordination.polarityCheckedByB && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                        <span className="font-semibold text-stone-800 dark:text-stone-200">Electrode Polarity:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Run to Red (Correct)
                        </span>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="p-3 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-stone-500">Separation Migration:</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{migrationPercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${migrationPercent}%` }}
                          className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                    {/* Run Buttons */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        // Ensure all wells are loaded
                        setLoadedWells({
                          well1: '100 bp Ladder',
                          well2: 'Positive Ctrl',
                          well3: 'Negative Ctrl',
                          well4: 'Unknown DNA',
                        });
                        setGelRunning(true);
                        setElectrophoresisComplete(false);
                        addLog('Start Gel Run', '100V DC Constant', 'Submarine Chamber', 0, 'Power Supply', false, false, 'Electrophoresis initiated towards anode');
                        if (isPairLabMode) {
                          pairLab.updateSharedState({
                            gel: {
                              ...pairLab.roomState?.gel,
                              gelRunning: true,
                              electrophoresisVoltage,
                              electrophoresisComplete: false,
                            } as any,
                          });
                        }
                      }}
                      disabled={
                        gelRunning ||
                        (isPairLabMode &&
                          (!pairLab.roomState?.coordination.polarityCheckedByA ||
                            !pairLab.roomState?.coordination.polarityCheckedByB))
                      }
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      {gelRunning ? 'Electrophoresis Running...' : 'Start Electrophoresis (100V)'}
                    </button>

                    {gelRunning && (
                      <button
                        onClick={() => {
                          setMigrationPercent(100);
                          setGelRunning(false);
                          setElectrophoresisComplete(true);
                          if (isPairLabMode) {
                            pairLab.updateSharedState({
                              gel: {
                                ...pairLab.roomState?.gel,
                                gelRunning: false,
                                migrationPercent: 100,
                                electrophoresisComplete: true,
                              } as any,
                            });
                          }
                        }}
                        className="px-3 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono rounded-lg transition"
                        title="Fast-forward run"
                      >
                        ⚡ Fast-Forward
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-stone-500">
                {electrophoresisComplete
                  ? 'Electrophoresis completed. The dye front has migrated across 75% of the gel length.'
                  : 'Run the gel until the dye front separates fragments for transillumination imaging.'}
              </span>
              <button
                onClick={() => setActiveStage(7)}
                disabled={!electrophoresisComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition shadow-xs"
              >
                Proceed to UV Transilluminator & Sizing
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 7: UV Transilluminator & Gel Documentation System */}
        {activeStage === 7 && (
          <div className="space-y-6">
            <div className="border border-stone-800 rounded-xl p-5 bg-stone-950 text-stone-100 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold tracking-wider font-mono uppercase text-emerald-400">
                      GEL DOC UV TRANSILLUMINATOR HOOD
                    </h3>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Fluorescent GelGreen / Ethidium Bromide DNA band visualization under 302 nm UV light.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setUvTransilluminatorOn(!uvTransilluminatorOn)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      uvTransilluminatorOn
                        ? 'bg-emerald-500 text-stone-950 ring-2 ring-emerald-400'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {uvTransilluminatorOn ? 'UV Lamp: ACTIVE (302 nm)' : 'Turn ON UV Lamp'}
                  </button>
                </div>
              </div>

              {/* Transilluminator Viewport */}
              <div className="mt-5 flex justify-center">
                <div className="w-full max-w-2xl bg-black rounded-xl border border-stone-800 p-6 relative overflow-hidden select-none">
                  {!uvTransilluminatorOn ? (
                    <div className="h-96 flex flex-col items-center justify-center text-center text-stone-500 space-y-2">
                      <Eye className="w-8 h-8 opacity-40" />
                      <span className="text-xs font-mono">UV Dark Hood Closed</span>
                      <p className="text-[11px] max-w-xs text-stone-600">
                        Click &quot;Turn ON UV Lamp&quot; above to illuminate the fluorescent DNA bands.
                      </p>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col justify-between">
                      {/* Lane Labels at top */}
                      <div className="grid grid-cols-4 text-center text-[11px] font-mono font-bold text-stone-400 border-b border-stone-800/80 pb-2">
                        <div>Lane 1: Ladder</div>
                        <div>Lane 2: +Ctrl</div>
                        <div>Lane 3: NTC (-Ctrl)</div>
                        <div>Lane 4: Unknown</div>
                      </div>

                      {/* Gel Bands Area */}
                      <div className="relative h-80 grid grid-cols-4 gap-4 px-2">
                        {/* Lane 1: 100 bp Ladder */}
                        <div className="relative h-full flex flex-col justify-between py-2 border-r border-stone-900">
                          {resolvedBands.lane1.map((rung) => (
                            <div
                              key={rung.bp}
                              onMouseEnter={() => setHoveredBandSize(rung.bp)}
                              onMouseLeave={() => setHoveredBandSize(null)}
                              onClick={() => setSelectedLadderRung(rung.bp)}
                              style={{
                                top: `${rung.relativeMobility * 90}%`,
                              }}
                              className={`absolute left-2 right-2 rounded-full cursor-pointer transition-all ${
                                rung.isLandmark
                                  ? 'h-1.5 bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                  : 'h-1 bg-emerald-500/80 shadow-[0_0_4px_#10b981]'
                              } hover:scale-105 hover:bg-white`}
                            >
                              <span className="absolute -left-1 text-[9px] font-mono text-stone-500 hover:text-emerald-300">
                                {rung.bp} bp
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Lane 2: Positive Control */}
                        <div className="relative h-full border-r border-stone-900">
                          {resolvedBands.lane2.map((b) => (
                            <div
                              key={b.bp}
                              style={{ top: `${b.mobility * 90}%` }}
                              className="absolute left-3 right-3 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                            >
                              <span className="absolute -top-3 left-0 text-[8px] font-mono text-emerald-300">
                                500 bp
                              </span>
                            </div>
                          ))}
                          {resolvedBands.lane2.length === 0 && (
                            <div className="h-full flex items-center justify-center text-[10px] text-stone-700 italic">
                              No Band (PCR Failed)
                            </div>
                          )}
                        </div>

                        {/* Lane 3: Negative Control (NTC) */}
                        <div className="relative h-full border-r border-stone-900">
                          {resolvedBands.lane3.map((b) => (
                            <div
                              key={b.bp}
                              style={{ top: `${b.mobility * 90}%` }}
                              className="absolute left-3 right-3 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                            >
                              <span className="absolute -top-3 left-0 text-[8px] font-mono text-amber-300">
                                500 bp (Contaminant!)
                              </span>
                            </div>
                          ))}
                          {resolvedBands.lane3.length === 0 && (
                            <div className="h-full flex items-center justify-center text-[10px] text-stone-700 italic">
                              Clean (No Band)
                            </div>
                          )}
                        </div>

                        {/* Lane 4: Unknown Sample */}
                        <div className="relative h-full">
                          {resolvedBands.lane4.map((b) => (
                            <div
                              key={b.bp}
                              style={{ top: `${b.mobility * 90}%` }}
                              className={`absolute left-3 right-3 rounded-full ${
                                b.bp === 500
                                  ? 'h-1.5 bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                  : 'h-1 bg-emerald-500/60 shadow-[0_0_4px_#10b981]'
                              }`}
                            >
                              <span className="absolute -top-3 left-0 text-[8px] font-mono text-emerald-300">
                                {b.label}
                              </span>
                            </div>
                          ))}
                          {resolvedBands.lane4.length === 0 && (
                            <div className="h-full flex items-center justify-center text-[10px] text-stone-700 italic">
                              No Band
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Interactive Reticle Ruler Overlay */}
                      {selectedLadderRung && (
                        <div
                          style={{
                            top: `${(LADDER_RUNGS.find((r) => r.bp === selectedLadderRung)?.relativeMobility || 0.5) * 90}%`,
                          }}
                          className="absolute left-6 right-6 border-b border-dashed border-cyan-400 pointer-events-none flex justify-end"
                        >
                          <span className="bg-cyan-950 text-cyan-300 px-2 py-0.5 text-[9px] font-mono rounded -mt-2">
                            Ruler Landmark: {selectedLadderRung} bp
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostic Conclusion & Sizing Assessment Form */}
            <div className="border border-stone-200 dark:border-stone-800 rounded-xl p-5 bg-white dark:bg-stone-900 space-y-4">
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                Experimental Interpretation & Clinical Diagnostic Conclusion
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                    1. Estimated Unknown Amplicon Size (bp):
                  </label>
                  <input
                    type="text"
                    value={studentEstimatedSize}
                    onChange={(e) => setStudentEstimatedSize(e.target.value)}
                    placeholder="e.g. 500 bp"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 outline-none"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Compare the migration distance of the Unknown band in Lane 4 with the 100 bp ladder in Lane 1.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
                    2. Clinical Diagnostic Assessment:
                  </label>
                  <select
                    value={studentDiagnosis}
                    onChange={(e) => setStudentDiagnosis(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100 outline-none cursor-pointer"
                  >
                    <option value="">-- Select Diagnostic Conclusion --</option>
                    <option value="positive_verified">Target Sequence Present (True Positive: +Ctrl works, NTC clean, 500 bp band detected)</option>
                    <option value="negative_verified">Target Sequence Absent (True Negative: +Ctrl works, NTC clean, no band)</option>
                    <option value="invalid_contamination">Test Invalid: Carryover Contamination in Negative Control (NTC positive)</option>
                    <option value="invalid_pcr_failure">Test Inconclusive: Reaction Chemistry / Polymerase Failure (+Ctrl failed to amplify)</option>
                    <option value="invalid_nonspecific">Test Inconclusive: Non-specific Mispriming due to Suboptimal Annealing Stringency</option>
                  </select>
                </div>
              </div>

              {/* Pair Lab Dual Diagnostic Endorsement */}
              {isPairLabMode ? (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Pair Lab Gate 4: Joint Clinical Diagnostic Endorsement
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      pairLab.roomState?.coordination.diagnosisSignedByA &&
                      pairLab.roomState?.coordination.diagnosisSignedByB
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {pairLab.roomState?.coordination.diagnosisSignedByA &&
                      pairLab.roomState?.coordination.diagnosisSignedByB
                        ? 'DUAL SIGNED & ENDORSED'
                        : 'PENDING SIGNATURES'}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-600 dark:text-stone-400">
                    Clinical and forensic standards require two certified analysts to independently review ladder sizing and control validities before releasing a diagnostic report.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        pairLab.sendCoordinationAction('sign_diagnosis', {
                          diagnosis: studentDiagnosis || 'positive_verified',
                        })
                      }
                      className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                        pairLab.roomState?.coordination.diagnosisSignedByA
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                          : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">Partner A Signature</div>
                        <div className="text-[10px] opacity-75">
                          {pairLab.roomState?.coordination.diagnosisSignedByA
                            ? 'Verified & Signed'
                            : 'Click to endorse report as Partner A'}
                        </div>
                      </div>
                      {pairLab.roomState?.coordination.diagnosisSignedByA ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Award className="w-4 h-4 text-stone-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        pairLab.sendCoordinationAction('sign_diagnosis', {
                          diagnosis: studentDiagnosis || 'positive_verified',
                        })
                      }
                      className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                        pairLab.roomState?.coordination.diagnosisSignedByB
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                          : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">Partner B Signature</div>
                        <div className="text-[10px] opacity-75">
                          {pairLab.roomState?.coordination.diagnosisSignedByB
                            ? 'Verified & Signed'
                            : 'Click to endorse report as Partner B'}
                        </div>
                      </div>
                      {pairLab.roomState?.coordination.diagnosisSignedByB ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Award className="w-4 h-4 text-stone-400" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setAnalysisSubmitted(true);
                      addLog(
                        'Submit Diagnosis',
                        studentDiagnosis,
                        'Final Analysis',
                        500,
                        'UV Transilluminator',
                        true,
                        false,
                        `Student diagnosed: ${studentDiagnosis}, estimated size: ${studentEstimatedSize}`
                      );
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
                  >
                    Submit Final Gel Interpretation
                  </button>
                </div>
              )}

              {analysisSubmitted && (
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2 text-xs">
                  <span className="font-bold text-stone-900 dark:text-stone-100 block">
                    Diagnostic Quality Evaluation:
                  </span>
                  {selectedScenario === 'scenario_a' && studentDiagnosis === 'positive_verified' ? (
                    <div className="text-emerald-700 dark:text-emerald-300 font-medium">
                      ✓ Correct! The Positive Control confirmed functional master mix, the Negative Control verified lack of contamination, and the Unknown sample produced a sharp 500 bp band matching the ladder.
                    </div>
                  ) : selectedScenario === 'scenario_c' && studentDiagnosis === 'invalid_contamination' ? (
                    <div className="text-emerald-700 dark:text-emerald-300 font-medium">
                      ✓ Exemplary Scientific Reasoning! You recognized that a band in the Negative Control (NTC) invalidates all patient results, preventing a reported false positive.
                    </div>
                  ) : selectedScenario === 'scenario_b' && studentDiagnosis === 'invalid_pcr_failure' ? (
                    <div className="text-emerald-700 dark:text-emerald-300 font-medium">
                      ✓ Accurate Diagnosis! When the positive control fails to amplify, the patient cannot be called negative; the run must be repeated.
                    </div>
                  ) : (
                    <div className="text-stone-700 dark:text-stone-300">
                      Interpretation recorded in your permanent Virtual Lab Notebook below.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIRTUAL LAB NOTEBOOK DRAWER / TOGGLE */}
        <div className="mt-8 border-t border-stone-200 dark:border-stone-800 pt-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowNotebook(!showNotebook)}
              className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 hover:text-emerald-600 transition"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              {showNotebook ? 'Hide Virtual Lab Notebook' : `View Virtual Lab Notebook (${notebookLogs.length} Events Recorded)`}
            </button>
            <span className="text-[11px] text-stone-500 font-mono">
              Auto-Audit Logging Active
            </span>
          </div>

          {showNotebook && (
            <div className="mt-4 border border-stone-200 dark:border-stone-800 rounded-xl p-4 bg-stone-50 dark:bg-stone-900/60">
              <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
                {notebookLogs.length === 0 ? (
                  <p className="text-stone-400 italic text-center py-4">
                    No actions logged yet. Operations in Stages 2 through 7 will be recorded automatically.
                  </p>
                ) : (
                  notebookLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] ${
                        log.isContaminationRisk
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                          : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-400 text-[10px]">{log.timestamp}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">[{log.action}]</span>
                        <span>{log.reagent}</span>
                        <span className="text-stone-400">→</span>
                        <span className="font-semibold">{log.targetTube}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400">
                        <span>{log.volumeUl > 0 ? `${log.volumeUl} µL` : ''}</span>
                        <span>({log.tipUsed})</span>
                        {log.notes && <span className="italic">[{log.notes}]</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pair Lab Connection & Join Modal */}
      <PairLabJoinModal
        isOpen={showPairLabJoinModal}
        onClose={() => setShowPairLabJoinModal(false)}
        onJoinRoom={(roomId, name, role) => {
          setPairRoomId(roomId);
          setPairStudentName(name);
          setPairRole(role);
          setIsPairLabMode(true);
          setShowPairLabJoinModal(false);
        }}
        isDark={isDark}
      />

      {/* Pair Lab Real-Time Collaborative Chat & Signals Modal */}
      <PairLabChatModal
        isOpen={showPairLabChat}
        onClose={() => setShowPairLabChat(false)}
        messages={pairLab.chatMessages}
        myUser={pairLab.myUser}
        partnerUser={pairLab.partnerUser}
        onSendMessage={(text) => pairLab.sendChatMessage(text)}
        isDark={isDark}
      />
    </div>
  );
};
