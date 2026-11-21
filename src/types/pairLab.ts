export type PairLabRole = 'partner_a' | 'partner_b' | 'observer';

export interface PairLabUser {
  id: string;
  name: string;
  role: PairLabRole;
  roleTitle: string; // e.g. "Pipetting Specialist" or "Thermocycler Engineer"
  connectedAt: string;
  lastPing: number;
}

export interface PairLabNotebookEntry {
  id: string;
  timestamp: string;
  stage: number;
  author: string;
  role: PairLabRole;
  action: string;
  details: string;
  flag?: 'normal' | 'warning' | 'critical' | 'success';
}

export interface PairLabChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: PairLabRole;
  timestamp: string;
  text: string;
  isSystem?: boolean;
}

export interface PairLabCoordinationStatus {
  // Stage 1: Component selection
  stage1VerifiedByA: boolean;
  stage1VerifiedByB: boolean;

  // Stage 2: Master mix pipetting
  masterMixSubmittedByA: boolean;
  masterMixVerifiedByB: boolean;

  // Stage 3: Mixing & Spin
  vortexDone: boolean;
  centrifugeDone: boolean;

  // Stage 4: Thermocycler dual-key authorization
  thermocyclerArmedByB: boolean;
  thermocyclerAuthorizedByA: boolean;

  // Stage 6: Electrophoresis Run-to-Red Polarity confirmation
  polarityCheckedByA: boolean;
  polarityCheckedByB: boolean;

  // Stage 7: Joint Diagnostic sign-off
  diagnosisSignedByA: boolean;
  diagnosisSignedByB: boolean;
}

export interface PairLabState {
  roomId: string;
  experimentId: string;
  createdAt: string;
  activeStage: number;
  selectedScenario: 'scenario_a' | 'scenario_b' | 'scenario_c' | 'scenario_d';

  // Selected components in Stage 1
  selectedComponents: string[];

  // Microcentrifuge tubes in Stage 2
  tubeContents: Record<'sample' | 'pos_ctrl' | 'neg_ctrl', Record<string, number>>;
  contaminationDetected: boolean;
  contaminationReason: string;

  // Physical sample prep in Stage 3
  dropletsOnWall: boolean;
  hasVortexed: boolean;
  hasCentrifuged: boolean;

  // Thermocycler in Stage 4
  thermocycler: {
    annealingTemp: number;
    cycleCount: number;
    heatedLidOn: boolean;
    pcrRunning: boolean;
    currentCycle: number;
    currentStepPhase: string;
    currentBlockTemp: number;
    pcrCompleted: boolean;
  };

  // Agarose Gel in Stage 5 & 6
  gel: {
    loadingDyeAdded: boolean;
    loadedWells: Record<number, { sample: string; volumeUl: number; loadedBy: string }>;
    isRunToRed: boolean;
    electrophoresisVoltage: number;
    gelRunning: boolean;
    migrationPercent: number;
    electrophoresisComplete: boolean;
  };

  // UV Transilluminator in Stage 7
  uv: {
    uvTransilluminatorOn: boolean;
    selectedLadderRung: number | null;
    studentEstimatedSize: number;
    studentDiagnosis: string;
    analysisSubmitted: boolean;
  };

  // Dual coordination gates
  coordination: PairLabCoordinationStatus;

  // Activity logs & Chat
  notebookLogs: PairLabNotebookEntry[];
  chatMessages: PairLabChatMessage[];
}
