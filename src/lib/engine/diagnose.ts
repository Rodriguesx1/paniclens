/**
 * PanicLens diagnostic orchestrator.
 * Bridges the parser, signal detector, rules resolver and legacy UI contract.
 */
import type { ParsedLog } from '@/lib/parser/panicParser';
import { detectSignals, buildParserSummary } from './signalDetector';
import { resolveEngine } from './resolver';
import { MODEL_CALIBRATION_VERSION, resolveCalibrationForModel } from './modelCalibration';
import type { EngineSummary, DetectedSignal, HypothesisResult, ReasoningStep, RepairRecommendation } from './contracts';

export const ENGINE_VERSION = '3.0.0';

export type ConfidenceLabel = 'low' | 'moderate' | 'high' | 'very_high';
export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export type EngineEvidence = {
  category: string;
  evidenceKey: string;
  matchedText: string;
  weight: number;
  isConflicting: boolean;
  context?: string;
};

export type EngineHypothesis = {
  ruleId: string;
  ruleVersion: string;
  category: string;
  isPrimary: boolean;
  rank: number;
  title: string;
  explanation: string;
  confidenceScore: number;
  suspectedComponents: string[];
  recommendedTests: string[];
};

export type EngineRepairSuggestion = {
  actionTitle: string;
  actionType: string;
  priority: number;
  difficulty: string;
  estimatedCost?: string;
  estimatedTime?: string;
  technicalRisk: string;
  expectedResolutionChance: number;
  whyThisAction: string;
  whenToEscalate?: string | null;
  fromRuleId: string;
};

export type AnalysisResult = EngineSummary & {
  engineVersion: string;
  rulesetVersion: string;
  modelCalibrationVersion?: string;
  executiveSummary: string;
  primaryCategory: string;
  severity: Severity;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  riskOfMisdiagnosis: number;
  likelyRepairTier: EngineSummary['likelyRepairTier'];
  likelySimpleSwapChance: number;
  likelyBoardRepairChance: number;
  suspectedComponents: string[];
  probableSubsystem: string;
  recommendedTestSequence: string[];
  technicalAlerts: string[];
  benchNotes?: string;
  hypotheses: EngineHypothesis[];
  evidences: EngineEvidence[];
  suggestions: EngineRepairSuggestion[];
  parserSummary: EngineSummary['parserSummary'];
  extractedMetadata: EngineSummary['extractedMetadata'];
  detectedSignals: DetectedSignal[];
  primaryDiagnosis: HypothesisResult | null;
  secondaryHypotheses: HypothesisResult[];
  recommendedRepairActions: RepairRecommendation[];
  reasoningTrace: ReasoningStep[];
};

export function diagnose(parsed: ParsedLog): AnalysisResult {
  const detectedSignals = parsed.detectedSignals?.length ? parsed.detectedSignals : detectSignals(parsed);
  const parserSummary = parsed.parserSummary ?? buildParserSummary(parsed, detectedSignals);
  const rawSummary = resolveEngine(parsed, detectedSignals, parserSummary.parseReliability);
  const calibration = getCalibration(parsed, rawSummary.primaryDiagnosis?.category ?? rawSummary.probableSubsystem);
  const calibrated = applyCalibration(rawSummary, calibration);
  const legacy = toLegacyResult(calibrated, calibration);

  return {
    ...calibrated,
    ...legacy,
    parserSummary,
    extractedMetadata: calibrated.extractedMetadata,
    detectedSignals,
    primaryDiagnosis: calibrated.primaryDiagnosis,
    secondaryHypotheses: calibrated.secondaryHypotheses,
    recommendedRepairActions: calibrated.recommendedRepairActions,
    reasoningTrace: calibrated.reasoningTrace,
  };
}

function applyCalibration(result: EngineSummary, calibration: ReturnType<typeof getCalibration>): EngineSummary {
  if (!calibration.applied) return result;
  const confidenceScore = Math.max(0, Math.min(99, result.confidenceScore + calibration.confidenceDelta));
  const boardChance = Math.max(0, Math.min(98, result.likelyBoardRepairChance + calibration.boardChanceDelta));
  const simpleChance = Math.max(2, Math.min(92, 100 - boardChance - 5));
  const technicalAlerts = Array.from(new Set([
    ...result.technicalAlerts,
    calibration.note ? calibration.note : '',
  ].filter(Boolean)));
  return {
    ...result,
    confidenceScore,
    confidenceLabel: labelForScore(confidenceScore),
    riskOfMisdiagnosis: Math.max(5, Math.min(95, 100 - confidenceScore)),
    likelyBoardRepairChance: boardChance,
    likelySimpleSwapChance: simpleChance,
    technicalAlerts,
    benchNotes: calibration.note ? `${result.benchNotes} Calibração contextual por modelo aplicada.` : result.benchNotes,
  };
}

function toLegacyResult(result: EngineSummary, calibration: ReturnType<typeof getCalibration>) {
  const primary = result.primaryDiagnosis;
  const secondary = result.secondaryHypotheses;
  const hypotheses: EngineHypothesis[] = [
    ...(primary ? [primary] : []),
    ...secondary,
  ].map((hypothesis, index) => ({
    ruleId: hypothesis.hypothesisId.split(':')[0],
    ruleVersion: '3.0.0',
    category: hypothesis.category,
    isPrimary: index === 0,
    rank: index,
    title: hypothesis.title,
    explanation: hypothesis.reasoningSummary,
    confidenceScore: hypothesis.confidenceScore,
    suspectedComponents: hypothesis.suspectedComponents,
    recommendedTests: hypothesis.recommendedTests,
  }));

  const evidences: EngineEvidence[] = result.evidenceList.map(entry => ({
    category: entry.category,
    evidenceKey: entry.signalKey,
    matchedText: entry.matchedText,
    weight: entry.weight,
    isConflicting: entry.isConflicting,
    context: entry.context,
  }));

  const suggestions: EngineRepairSuggestion[] = result.recommendedRepairActions.map(action => ({
    actionTitle: action.actionTitle,
    actionType: action.actionType,
    priority: action.priority,
    difficulty: action.technicalRisk,
    estimatedCost: action.estimatedCost,
    estimatedTime: action.estimatedTime,
    technicalRisk: action.technicalRisk,
    expectedResolutionChance: action.expectedResolutionChance,
    whyThisAction: action.whyThisAction,
    whenToEscalate: action.whenToEscalate ?? null,
    fromRuleId: action.prerequisite ?? 'rule',
  }));

  const executiveSummary = [
    result.primaryDiagnosis ? `Hipótese principal: ${result.primaryDiagnosis.title}.` : 'Nenhuma hipótese principal forte foi identificada.',
    `Confiança ${result.confidenceScore}/100 (${result.confidenceLabel}).`,
    `Repair tier provável: ${result.likelyRepairTier.replace(/_/g, ' ')}.`,
    `Chance estimada de troca simples: ${result.likelySimpleSwapChance}%.`,
    `Chance estimada de board-level: ${result.likelyBoardRepairChance}%.`,
    calibration.applied ? 'Calibração contextual por modelo aplicada.' : '',
  ].filter(Boolean).join(' ');

  return {
    engineVersion: ENGINE_VERSION,
    rulesetVersion: '3.0.0',
    modelCalibrationVersion: MODEL_CALIBRATION_VERSION,
    executiveSummary,
    primaryCategory: result.primaryDiagnosis?.category ?? 'unknown',
    severity: result.severity,
    confidenceScore: result.confidenceScore,
    confidenceLabel: result.confidenceLabel,
    riskOfMisdiagnosis: result.riskOfMisdiagnosis,
    likelyRepairTier: result.likelyRepairTier,
    likelySimpleSwapChance: result.likelySimpleSwapChance,
    likelyBoardRepairChance: result.likelyBoardRepairChance,
    suspectedComponents: result.suspectedComponents,
    probableSubsystem: result.probableSubsystem,
    recommendedTestSequence: result.recommendedTestSequence.map(step => step.title),
    technicalAlerts: result.technicalAlerts,
    benchNotes: result.benchNotes,
    hypotheses,
    evidences,
    suggestions,
  };
}

function getCalibration(parsed: ParsedLog, category: string) {
  const hardwareModel = parsed.metadata.hardwareModel ?? parsed.metadata.productType ?? '';
  if (!hardwareModel) return { applied: false, confidenceDelta: 0, boardChanceDelta: 0 } as const;
  return resolveCalibrationForModel(hardwareModel, category);
}

function labelForScore(score: number): ConfidenceLabel {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}
