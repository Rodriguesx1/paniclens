import type { ParsedLog } from '@/lib/parser/panicParser';
import type { DetectedSignal, EngineSummary, HypothesisResult, ReasoningStep, RepairRecommendation, TestRecommendation } from './contracts';
import { RULES, type DiagnosticRule, type RepairTier } from './rules';

type NormalizedRule = DiagnosticRule & {
  includeSignals: string[];
  optionalSignals: string[];
  excludeSignals: string[];
  minimumEvidenceThreshold: number;
  simpleSwapProbabilityBase: number;
  boardRepairProbabilityBase: number;
  enabled: boolean;
};

type RuleMatch = {
  rule: NormalizedRule;
  support: DetectedSignal[];
  optional: DetectedSignal[];
  conflicts: DetectedSignal[];
  score: number;
  specificity: number;
  coverage: number;
};

type CalibrationAdjustment = {
  applied: boolean;
  confidenceDelta: number;
  boardChanceDelta: number;
  note?: string;
};

const REPAIR_TIER_BOARD_BASE: Record<RepairTier, number> = {
  simple_swap: 8,
  peripheral_diagnosis: 18,
  connector_or_line_check: 32,
  advanced_board_diagnosis: 68,
  high_risk_board_repair: 90,
};

function compileRules(rules: DiagnosticRule[]): NormalizedRule[] {
  return rules.map(rule => ({
    ...rule,
    includeSignals: rule.includeMatchers ?? [],
    optionalSignals: rule.optionalMatchers ?? [],
    excludeSignals: rule.excludeMatchers ?? [],
    minimumEvidenceThreshold: Math.max(1, rule.includeMatchers.length > 1 ? 2 : 1),
    simpleSwapProbabilityBase: rule.probableRepairTier === 'simple_swap' ? 64 : rule.probableRepairTier === 'connector_or_line_check' ? 48 : 22,
    boardRepairProbabilityBase: REPAIR_TIER_BOARD_BASE[rule.probableRepairTier],
    enabled: true,
  }));
}

function confidenceLabel(score: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

function normalizeWeight(signal: DetectedSignal): number {
  return Math.max(0, Math.min(30, signal.confidenceContribution + Math.round(signal.weight / 4)));
}

function buildSignalIndex(signals: DetectedSignal[]): Map<string, DetectedSignal[]> {
  const index = new Map<string, DetectedSignal[]>();
  for (const signal of signals) {
    const arr = index.get(signal.signalKey) ?? [];
    arr.push(signal);
    index.set(signal.signalKey, arr);
  }
  return index;
}

function matchRule(rule: NormalizedRule, signalIndex: Map<string, DetectedSignal[]>): RuleMatch | null {
  const includeMatches = rule.includeSignals.flatMap(key => signalIndex.get(key) ?? []);
  const optionalMatches = rule.optionalSignals.flatMap(key => signalIndex.get(key) ?? []);
  const conflictMatches = rule.excludeSignals.flatMap(key => signalIndex.get(key) ?? []);

  const includeSatisfied = rule.includeMode === 'all'
    ? rule.includeSignals.every(key => (signalIndex.get(key)?.length ?? 0) > 0)
    : includeMatches.length > 0;

  if (!includeSatisfied) return null;
  if (includeMatches.length < rule.minimumEvidenceThreshold && rule.includeMode !== 'all') {
    return null;
  }

  const supportScore = includeMatches.reduce((sum, signal) => sum + normalizeWeight(signal), 0);
  const optionalScore = optionalMatches.reduce((sum, signal) => sum + Math.round(normalizeWeight(signal) * 0.6), 0);
  const conflictScore = conflictMatches.reduce((sum, signal) => sum + Math.round(normalizeWeight(signal) * 0.7), 0);
  const coverage = Math.min(1, includeMatches.length / Math.max(1, rule.includeSignals.length));
  const specificity = rule.includeMode === 'all' ? 20 : Math.min(14, rule.includeSignals.length * 3);
  const comboBonus = rule.includeMode === 'all' && rule.optionalSignals.every(key => (signalIndex.get(key)?.length ?? 0) > 0)
    ? Math.min(16, rule.comboBonus ?? 0)
    : 0;

  let score = rule.confidenceBase;
  score += supportScore;
  score += optionalScore;
  score += comboBonus;
  score += Math.round(coverage * 10);
  score += specificity;
  score -= Math.min(24, conflictScore);
  score = Math.max(0, Math.min(99, score));

  return {
    rule,
    support: includeMatches,
    optional: optionalMatches,
    conflicts: conflictMatches,
    score,
    specificity,
    coverage,
  };
}

function sortMatches(matches: RuleMatch[]): RuleMatch[] {
  const byCategory = new Map<string, RuleMatch>();
  for (const match of matches) {
    const current = byCategory.get(match.rule.category);
    if (!current || match.score > current.score) byCategory.set(match.rule.category, match);
  }
  return [...matches]
    .map(match => {
      const best = byCategory.get(match.rule.category);
      if (best !== match) {
        return { ...match, score: Math.max(0, match.score - 8) };
      }
      return match;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.rule.evidenceWeight !== a.rule.evidenceWeight) return b.rule.evidenceWeight - a.rule.evidenceWeight;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      return b.support.length - a.support.length;
    });
}

function tierLabel(tier: RepairTier): string {
  return ({
    simple_swap: 'troca simples',
    peripheral_diagnosis: 'diagnóstico periférico',
    connector_or_line_check: 'verificação de conector/linha',
    advanced_board_diagnosis: 'diagnóstico avançado de placa',
    high_risk_board_repair: 'reparo de placa de alto risco',
  })[tier];
}

function buildReasoningTrace(signals: DetectedSignal[], matches: RuleMatch[], confidence: number, parseReliability: number, hasConflict: boolean): ReasoningStep[] {
  const topSignals = signals.slice(0, 6).map(s => s.signalKey);
  return [
    {
      stepKey: 'parser',
      title: 'Parser e normalização',
      summary: `Parser extraiu ${signals.length} sinais estruturados com confiabilidade ${parseReliability}/100.`,
      signals: topSignals,
      impact: parseReliability,
      kind: 'support',
    },
    {
      stepKey: 'rules',
      title: 'Regras ativadas',
      summary: matches.slice(0, 4).map(m => `${m.rule.id} (${m.score})`).join(' · ') || 'Nenhuma regra ativada.',
      signals: matches.slice(0, 4).flatMap(m => m.support.map(s => s.signalKey)),
      impact: matches[0]?.score ?? 0,
      kind: matches.length ? 'support' : 'neutral',
    },
    {
      stepKey: 'conflicts',
      title: 'Conflitos e ruído',
      summary: hasConflict
        ? 'Há sinais de competição entre hipóteses concorrentes; o score foi penalizado para refletir a ambiguidade.'
        : 'Não há conflitos relevantes entre as hipóteses principais.',
      signals: matches.flatMap(m => [...m.conflicts.map(s => s.signalKey), ...m.support.map(s => s.signalKey)]).slice(0, 6),
      impact: hasConflict ? -8 : 0,
      kind: hasConflict ? 'conflict' : 'neutral',
    },
    {
      stepKey: 'confidence',
      title: 'Confiança final',
      summary: `Score final ${confidence}/100 com foco em ${matches[0]?.rule.category ?? 'unknown'} e repair tier ${tierLabel(matches[0]?.rule.probableRepairTier ?? 'peripheral_diagnosis')}.`,
      signals: matches[0]?.support.map(s => s.signalKey).slice(0, 4) ?? [],
      impact: confidence,
      kind: 'support',
    },
  ];
}

function toHypothesis(match: RuleMatch, index: number, confidenceScore: number): HypothesisResult {
  const combinedSignals = [...match.support, ...match.optional];
  const supportingEvidence = combinedSignals.map(s => `${s.signalKey}: ${s.matchedText}`);
  const conflictingEvidence = match.conflicts.map(s => `${s.signalKey}: ${s.matchedText}`);
  const boardChance = Math.max(0, Math.min(98, match.rule.boardRepairProbabilityBase + Math.round((match.score - 60) / 3) - (conflictingEvidence.length * 3)));
  const simpleChance = Math.max(2, Math.min(90, match.rule.simpleSwapProbabilityBase + Math.round((match.coverage * 14)) - Math.round(boardChance / 4)));

  return {
    hypothesisId: `${match.rule.id}:${index}`,
    title: index === 0 ? match.rule.primaryHypothesis : (match.rule.secondaryHypothesis ?? match.rule.primaryHypothesis),
    category: match.rule.category,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    supportingEvidence,
    conflictingEvidence,
    suspectedComponents: match.rule.suspectedComponents,
    probableSubsystem: match.rule.probableSubsystem,
    severity: match.rule.severityImpact,
    likelyRepairTier: match.rule.probableRepairTier,
    likelySimpleSwapChance: simpleChance,
    likelyBoardRepairChance: boardChance,
    recommendedTests: match.rule.recommendedTests,
    recommendedActions: match.rule.suggestedActions.map(a => a.actionTitle),
    reasoningSummary: match.rule.explanationTemplate.replace('{evidence}', combinedSignals[0]?.matchedText ?? 'evidências estruturadas'),
  };
}

function buildTestSequence(primary: RuleMatch, secondary: RuleMatch[]): TestRecommendation[] {
  const sequence: TestRecommendation[] = [];
  const seen = new Set<string>();
  let order = 1;
  for (const match of [primary, ...secondary.slice(0, 2)]) {
    for (const test of match.rule.recommendedTests) {
      const key = `${match.rule.id}:${test}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sequence.push({
        stepOrder: order++,
        title: test,
        actionType: match.rule.probableRepairTier === 'high_risk_board_repair' ? 'board_level_investigation' : match.rule.probableRepairTier === 'advanced_board_diagnosis' ? 'voltage_measurement' : 'swap_test',
        targetComponent: match.rule.suspectedComponents[0] ?? match.rule.probableSubsystem,
        whyNow: `Confirma ou elimina a hipótese ${match.rule.category}.`,
        expectedSignal: match.support[0]?.signalKey ?? match.rule.category,
        interpretationIfPass: `Se passar, reduz a probabilidade da categoria ${match.rule.category}.`,
        interpretationIfFail: `Se falhar, reforça a hipótese ${match.rule.category}.`,
        estimatedDifficulty: match.rule.probableRepairTier === 'high_risk_board_repair' ? 'expert' : match.rule.probableRepairTier === 'advanced_board_diagnosis' ? 'high' : 'medium',
        estimatedCost: match.rule.probableRepairTier === 'simple_swap' ? '$' : match.rule.probableRepairTier === 'connector_or_line_check' ? '$$' : '$$$',
        estimatedTime: match.rule.probableRepairTier === 'simple_swap' ? '10-20 min' : match.rule.probableRepairTier === 'connector_or_line_check' ? '20-40 min' : '40-90 min',
        escalationRule: match.rule.riskNotes ?? undefined,
      });
    }
  }
  return sequence;
}

function buildRepairActions(matches: RuleMatch[]): RepairRecommendation[] {
  const out: RepairRecommendation[] = [];
  const seen = new Set<string>();
  for (const match of matches.slice(0, 4)) {
    for (const action of match.rule.suggestedActions) {
      if (seen.has(action.actionTitle)) continue;
      seen.add(action.actionTitle);
      out.push({
        actionTitle: action.actionTitle,
        actionType: action.actionType,
        priority: action.priority,
        technicalRisk: action.technicalRisk,
        expectedResolutionChance: action.expectedResolutionChance,
        estimatedCost: action.estimatedCost,
        estimatedTime: action.estimatedTime,
        whyThisAction: action.whyThisAction,
        prerequisite: match.rule.recommendedTests[0],
        whenToEscalate: action.whenToEscalate,
        cautionNotes: match.rule.riskNotes,
      });
    }
  }
  return out.sort((a, b) => a.priority - b.priority || b.expectedResolutionChance - a.expectedResolutionChance);
}

export function resolveEngine(parsed: ParsedLog, signals: DetectedSignal[], parseReliability: number, calibration: CalibrationAdjustment = { applied: false, confidenceDelta: 0, boardChanceDelta: 0 }): EngineSummary {
  const signalIndex = buildSignalIndex(signals);
  const compiledRules = compileRules(RULES).filter(rule => rule.enabled);

  const matched = compiledRules
    .map(rule => matchRule(rule, signalIndex))
    .filter((match): match is RuleMatch => Boolean(match));

  if (matched.length === 0) {
    const emptyConfidence = Math.max(0, Math.min(60, Math.round(parseReliability * 0.45)));
    const notes = [
      'Nenhuma regra do catálogo atual foi ativada com força suficiente.',
      parseReliability < 45 ? 'Confiabilidade baixa do parse reduz segurança diagnóstica.' : 'Sinais insuficientes para hipótese forte.',
    ];
    return {
      parserSummary: {
        totalLines: parsed.lines.length,
        evidenceCount: parsed.rawEvidences.length,
        signalCount: signals.length,
        parseReliability,
        ambiguityLevel: parseReliability >= 75 ? 'low' : parseReliability >= 50 ? 'moderate' : 'high',
        notes,
      },
      extractedMetadata: parsed.metadata as Record<string, unknown>,
      detectedSignals: signals,
      evidenceList: signals.map(signal => ({
        signalKey: signal.signalKey,
        category: signal.category,
        matchedText: signal.matchedText,
        weight: signal.weight,
        isConflicting: false,
        context: signal.contextWindow,
      })),
      primaryDiagnosis: null,
      secondaryHypotheses: [],
      suspectedComponents: [],
      probableSubsystem: 'desconhecido',
      severity: parseReliability >= 65 ? 'moderate' : 'low',
      confidenceScore: emptyConfidence,
      confidenceLabel: confidenceLabel(emptyConfidence),
      riskOfMisdiagnosis: Math.max(55, 100 - emptyConfidence),
      likelyRepairTier: 'peripheral_diagnosis',
      likelySimpleSwapChance: 0,
      likelyBoardRepairChance: 0,
      recommendedTestSequence: [
        {
          stepOrder: 1,
          title: 'Coletar log mais completo',
          actionType: 'inspection',
          targetComponent: 'panic-full',
          whyNow: 'O log atual não disparou regras suficientes para uma hipótese confiável.',
          expectedSignal: 'parser_reliability_improves',
          interpretationIfPass: 'Um log mais completo pode elevar a confiança e ativar regras específicas.',
          interpretationIfFail: 'Se o log continuar incompleto, mantenha diagnóstico conservador.',
          estimatedDifficulty: 'low',
          estimatedTime: '5-10 min',
          escalationRule: 'Solicitar novo panic-full antes de qualquer troca.',
        },
      ],
      recommendedRepairActions: [],
      technicalAlerts: notes,
      benchNotes: 'Amostra insuficiente. Evite tentativa cega e priorize coleta de evidências melhores.',
      reasoningTrace: buildReasoningTrace(signals, [], emptyConfidence, parseReliability, false),
    };
  }

  const sorted = sortMatches(matched);
  const primary = sorted[0];
  const secondary = sorted.slice(1, 5);
  const conflictingSignalKeys = new Set<string>();

  for (const match of secondary) {
    if (match.rule.category === primary.rule.category) continue;
    for (const signal of [...match.support, ...match.optional]) {
      conflictingSignalKeys.add(signal.signalKey);
    }
  }

  const baseConfidence = Math.round(
    (primary.score * 0.52) +
    (parseReliability * 0.18) +
    (primary.coverage * 18) +
    (primary.specificity * 0.7)
  );
  const calibrationBoost = calibration.applied ? calibration.confidenceDelta : 0;
  const conflictPenalty = Math.min(18, primary.conflicts.length * 5 + secondary.filter(m => m.score > 55).length * 2);
  const confidenceScore = Math.max(0, Math.min(99, baseConfidence + calibrationBoost - conflictPenalty));
  const confidence = confidenceLabel(confidenceScore);
  const riskOfMisdiagnosis = Math.max(5, Math.min(95, 100 - confidenceScore + (parseReliability < 45 ? 10 : 0) + conflictPenalty));

  const primaryDiagnosis = toHypothesis(primary, 0, confidenceScore);
  const secondaryHypotheses = secondary.map((match, index) => toHypothesis(match, index + 1, Math.min(96, match.score)));

  const combinedComponents = Array.from(new Set([
    ...primary.rule.suspectedComponents,
    ...secondary.flatMap(match => match.rule.suspectedComponents),
  ]));

  const topSeverity = [primary, ...secondary.filter(match => match.score >= 55)]
    .reduce<EngineSummary['severity']>((current, match) => severityRank(match.rule.severityImpact) > severityRank(current) ? match.rule.severityImpact : current, primary.rule.severityImpact);

  let boardChance = Math.max(0, Math.min(98, primaryDiagnosis.likelyBoardRepairChance + (calibration.applied ? calibration.boardChanceDelta : 0)));
  boardChance = Math.max(boardChance, primary.rule.boardRepairProbabilityBase);
  const simpleSwapChance = Math.max(2, Math.min(92, primaryDiagnosis.likelySimpleSwapChance - Math.round(boardChance / 6)));

  const evidenceList = signals.map(signal => ({
    signalKey: signal.signalKey,
    category: signal.category,
    matchedText: signal.matchedText,
    weight: signal.weight,
    isConflicting: conflictingSignalKeys.has(signal.signalKey) && signal.category !== primary.rule.category,
    context: signal.contextWindow,
  }));

  const technicalAlerts = Array.from(new Set([
    ...(primary.rule.riskNotes ? [primary.rule.riskNotes] : []),
    ...(primary.rule.falsePositiveNotes ? [primary.rule.falsePositiveNotes] : []),
    ...(secondary.flatMap(match => [match.rule.riskNotes, match.rule.falsePositiveNotes].filter(Boolean) as string[])),
    ...(calibration.note ? [calibration.note] : []),
    ...(primary.rule.probableRepairTier === 'high_risk_board_repair'
      ? ['Reparo de placa de alto risco - alinhar custo, prazo e expectativa com o cliente antes de iniciar.']
      : []),
  ]));

  const reasoningTrace = buildReasoningTrace(signals, sorted, confidenceScore, parseReliability, conflictingSignalKeys.size > 0);

  return {
    parserSummary: {
      totalLines: parsed.lines.length,
      evidenceCount: parsed.rawEvidences.length,
      signalCount: signals.length,
      parseReliability,
      ambiguityLevel: parseReliability >= 75 ? 'low' : parseReliability >= 50 ? 'moderate' : 'high',
      notes: [
        parsed.metadata.panicString ? 'panicString extraída' : 'panicString ausente',
        parsed.metadata.hardwareModel || parsed.metadata.productType ? 'modelo identificado' : 'modelo ausente',
      ],
    },
    extractedMetadata: parsed.metadata as Record<string, unknown>,
    detectedSignals: signals,
    evidenceList,
    primaryDiagnosis,
    secondaryHypotheses,
    suspectedComponents: combinedComponents,
    probableSubsystem: primary.rule.probableSubsystem,
    severity: topSeverity,
    confidenceScore,
    confidenceLabel: confidence,
    riskOfMisdiagnosis,
    likelyRepairTier: primary.rule.probableRepairTier,
    likelySimpleSwapChance: simpleSwapChance,
    likelyBoardRepairChance: boardChance,
    recommendedTestSequence: buildTestSequence(primary, secondary),
    recommendedRepairActions: buildRepairActions(sorted),
    technicalAlerts,
    benchNotes: `${primary.rule.probableSubsystem}. ${primary.rule.description}`,
    reasoningTrace,
  };
}

function severityRank(severity: EngineSummary['severity']): number {
  return ({ low: 1, moderate: 2, high: 3, critical: 4 })[severity];
}
