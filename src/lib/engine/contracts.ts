import type { RepairTier, DiagnosticCategory } from './rules';

export type EngineInputHints = {
  modelHint?: string;
  deviceFamilyHint?: string;
  reportedSymptom?: string;
  previousActions?: string[];
  sourceType?: string;
  caseId?: string;
};

export type DetectedSignal = {
  signalKey: string;
  category: DiagnosticCategory | 'system' | 'meta' | 'signal';
  matchedText: string;
  normalizedValue: string;
  weight: number;
  confidenceContribution: number;
  sourceLine?: string;
  contextWindow?: string;
  ambiguityLevel: 'low' | 'moderate' | 'high';
};

export type ParserSummary = {
  totalLines: number;
  evidenceCount: number;
  signalCount: number;
  parseReliability: number;
  ambiguityLevel: 'low' | 'moderate' | 'high';
  notes: string[];
};

export type ReasoningStep = {
  stepKey: string;
  title: string;
  summary: string;
  signals: string[];
  impact: number;
  kind: 'support' | 'conflict' | 'neutral';
};

export type HypothesisResult = {
  hypothesisId: string;
  title: string;
  category: DiagnosticCategory;
  confidenceScore: number;
  confidenceLabel: 'low' | 'moderate' | 'high' | 'very_high';
  supportingEvidence: string[];
  conflictingEvidence: string[];
  suspectedComponents: string[];
  probableSubsystem: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  likelyRepairTier: RepairTier;
  likelySimpleSwapChance: number;
  likelyBoardRepairChance: number;
  recommendedTests: string[];
  recommendedActions: string[];
  reasoningSummary: string;
};

export type TestRecommendation = {
  stepOrder: number;
  title: string;
  actionType:
    | 'swap_test'
    | 'inspection'
    | 'connector_check'
    | 'line_check'
    | 'voltage_measurement'
    | 'communication_check'
    | 'subsystem_isolation'
    | 'board_level_investigation';
  targetComponent: string;
  whyNow: string;
  expectedSignal: string;
  interpretationIfPass: string;
  interpretationIfFail: string;
  estimatedDifficulty: 'low' | 'medium' | 'high' | 'expert';
  estimatedCost?: string;
  estimatedTime?: string;
  escalationRule?: string;
};

export type RepairRecommendation = {
  actionTitle: string;
  actionType:
    | 'inspection'
    | 'swap_test'
    | 'measurement'
    | 'connector_check'
    | 'line_check'
    | 'subsystem_isolation'
    | 'advanced_board_diagnosis';
  priority: number;
  technicalRisk: 'low' | 'medium' | 'high';
  expectedResolutionChance: number;
  estimatedCost?: string;
  estimatedTime?: string;
  whyThisAction: string;
  prerequisite?: string;
  whenToEscalate?: string;
  cautionNotes?: string;
};

export type EngineSummary = {
  parserSummary: ParserSummary;
  extractedMetadata: Record<string, unknown>;
  detectedSignals: DetectedSignal[];
  evidenceList: Array<{
    signalKey: string;
    category: string;
    matchedText: string;
    weight: number;
    isConflicting: boolean;
    context?: string;
  }>;
  primaryDiagnosis: HypothesisResult | null;
  secondaryHypotheses: HypothesisResult[];
  suspectedComponents: string[];
  probableSubsystem: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  confidenceScore: number;
  confidenceLabel: 'low' | 'moderate' | 'high' | 'very_high';
  riskOfMisdiagnosis: number;
  likelyRepairTier: RepairTier;
  likelySimpleSwapChance: number;
  likelyBoardRepairChance: number;
  recommendedTestSequence: TestRecommendation[];
  recommendedRepairActions: RepairRecommendation[];
  technicalAlerts: string[];
  benchNotes: string;
  reasoningTrace: ReasoningStep[];
};
