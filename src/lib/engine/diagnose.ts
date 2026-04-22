/**
 * PanicLens — Diagnostic Engine
 * Consumes ParsedLog, applies the rules catalog, computes confidence,
 * and produces a structured AnalysisResult ready for UI/persistence/PDF.
 */
import type { ParsedLog, RawEvidence } from '@/lib/parser/panicParser';
import { RULES, RULESET_VERSION, type DiagnosticRule, type RepairTier, type SuggestedAction } from './rules';

export const ENGINE_VERSION = '1.0.0';

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

export type EngineRepairSuggestion = SuggestedAction & {
  fromRuleId: string;
};

export type AnalysisResult = {
  engineVersion: string;
  rulesetVersion: string;
  executiveSummary: string;
  primaryCategory: string;
  severity: Severity;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  riskOfMisdiagnosis: number;
  likelyRepairTier: RepairTier;
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
};

function severityRank(s: Severity) { return ({ low: 1, moderate: 2, high: 3, critical: 4 })[s]; }
function tierBoardChance(t: RepairTier) {
  return ({ simple_swap: 5, peripheral_diagnosis: 20, connector_or_line_check: 35, advanced_board_diagnosis: 70, high_risk_board_repair: 92 })[t];
}
function labelForScore(s: number): ConfidenceLabel {
  if (s >= 85) return 'very_high';
  if (s >= 70) return 'high';
  if (s >= 50) return 'moderate';
  return 'low';
}

export function diagnose(parsed: ParsedLog): AnalysisResult {
  const evidenceByKey = new Map<string, RawEvidence[]>();
  for (const ev of parsed.rawEvidences) {
    const arr = evidenceByKey.get(ev.key) ?? [];
    arr.push(ev);
    evidenceByKey.set(ev.key, arr);
  }

  type Scored = { rule: DiagnosticRule; score: number; hits: RawEvidence[]; combo: boolean; conflicting: RawEvidence[] };
  const scored: Scored[] = [];

  for (const rule of RULES) {
    const includeHits = rule.includeMatchers.flatMap(k => evidenceByKey.get(k) ?? []);
    if (includeHits.length === 0) continue;

    // exclusions
    const conflicts = (rule.excludeMatchers ?? []).flatMap(k => evidenceByKey.get(k) ?? []);
    if (conflicts.length > 0) continue;

    let score = rule.confidenceBase;
    score += Math.min(20, includeHits.length * 3);

    const optionalHits = (rule.optionalMatchers ?? []).flatMap(k => evidenceByKey.get(k) ?? []);
    if (optionalHits.length > 0) score += Math.min(15, optionalHits.length * 4);

    const allOptionalHit =
      (rule.optionalMatchers?.length ?? 0) > 0 &&
      rule.optionalMatchers!.every(k => (evidenceByKey.get(k)?.length ?? 0) > 0);
    if (allOptionalHit && rule.comboBonus) score += rule.comboBonus;

    score = Math.min(99, Math.max(0, score));
    scored.push({ rule, score, hits: includeHits.concat(optionalHits), combo: allOptionalHit, conflicting: [] });
  }

  // Detect cross-rule conflicts (e.g., baseband vs front_flex shouldn't be primary together)
  // Penalize same-category competitors: keep best per category, downscore the rest.
  const byCategoryBest = new Map<string, Scored>();
  for (const s of scored) {
    const cur = byCategoryBest.get(s.rule.category);
    if (!cur || s.score > cur.score) byCategoryBest.set(s.rule.category, s);
  }
  for (const s of scored) {
    const best = byCategoryBest.get(s.rule.category)!;
    if (s !== best) s.score = Math.max(0, s.score - 8);
  }

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Fallback: nothing matched
  if (scored.length === 0) {
    return buildEmptyResult(parsed);
  }

  const primary = scored[0];
  const secondaries = scored.slice(1, 5);

  // Aggregate severity = highest among top hypotheses, weighted by score
  const topSev = [primary, ...secondaries.filter(s => s.score >= 50)]
    .reduce<Severity>((acc, s) => severityRank(s.rule.severityImpact) > severityRank(acc) ? s.rule.severityImpact : acc, 'low');

  // Confidence: primary score adjusted by gap to next
  const gap = primary.score - (secondaries[0]?.score ?? 0);
  let confidence = primary.score;
  if (gap >= 15) confidence = Math.min(99, confidence + 5);
  if (gap < 5 && secondaries[0]) confidence = Math.max(0, confidence - 6);
  // Penalize if multiple high-severity but conflicting categories
  const highSevCats = new Set(scored.filter(s => severityRank(s.rule.severityImpact) >= 3 && s.score >= 55).map(s => s.rule.category));
  if (highSevCats.size > 2) confidence = Math.max(30, confidence - 8);

  const confidenceLabel = labelForScore(confidence);
  const riskOfMisdiagnosis = Math.max(5, Math.min(95, 100 - confidence + (gap < 5 ? 10 : 0)));

  const likelyTier = primary.rule.probableRepairTier;
  const boardChance = tierBoardChance(likelyTier);
  const simpleSwapChance = Math.max(2, 100 - boardChance - 5);

  // Build evidences output
  const evidences: EngineEvidence[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    for (const ev of s.hits) {
      const k = `${s.rule.id}:${ev.key}:${ev.matchedText}`;
      if (seen.has(k)) continue;
      seen.add(k);
      evidences.push({
        category: ev.category ?? s.rule.category,
        evidenceKey: ev.key,
        matchedText: ev.matchedText,
        weight: ev.weight ?? s.rule.evidenceWeight,
        isConflicting: false,
        context: ev.context,
      });
    }
  }

  // Hypotheses
  const hypotheses: EngineHypothesis[] = [primary, ...secondaries].map((s, idx) => ({
    ruleId: s.rule.id,
    ruleVersion: s.rule.version,
    category: s.rule.category,
    isPrimary: idx === 0,
    rank: idx,
    title: s.rule.primaryHypothesis,
    explanation: s.rule.explanationTemplate.replace('{evidence}', s.hits[0]?.matchedText ?? s.rule.includeMatchers.join(', ')),
    confidenceScore: idx === 0 ? confidence : s.score,
    suspectedComponents: s.rule.suspectedComponents,
    recommendedTests: s.rule.recommendedTests,
  }));

  // Suggestions: from primary first, then secondaries (dedup by title)
  const suggestions: EngineRepairSuggestion[] = [];
  const seenTitles = new Set<string>();
  for (const s of [primary, ...secondaries]) {
    for (const a of s.rule.suggestedActions) {
      if (seenTitles.has(a.actionTitle)) continue;
      seenTitles.add(a.actionTitle);
      suggestions.push({ ...a, fromRuleId: s.rule.id });
    }
  }
  suggestions.sort((a, b) => a.priority - b.priority || b.expectedResolutionChance - a.expectedResolutionChance);

  // Recommended test sequence merged
  const tests: string[] = [];
  for (const s of [primary, ...secondaries.slice(0, 2)]) {
    for (const t of s.rule.recommendedTests) {
      if (!tests.includes(t)) tests.push(t);
    }
  }

  // Technical alerts (risk notes)
  const alerts: string[] = [];
  for (const s of [primary, ...secondaries]) {
    if (s.rule.riskNotes && !alerts.includes(s.rule.riskNotes)) alerts.push(s.rule.riskNotes);
  }
  if (likelyTier === 'high_risk_board_repair') {
    alerts.push('Reparo de placa de alto risco — alinhar custo, prazo e expectativa com o cliente antes de iniciar.');
  }

  // Suspected components aggregated and de-duplicated, primary first
  const components = uniq([...primary.rule.suspectedComponents, ...secondaries.flatMap(s => s.rule.suspectedComponents)]);

  // Executive summary
  const model = parsed.metadata.deviceModel ?? parsed.metadata.hardwareModel ?? 'iPhone';
  const ios = parsed.metadata.iosVersion ?? 'iOS desconhecido';
  const summary =
`Análise de panic-full em ${model} (${ios}). ` +
`Hipótese principal: ${primary.rule.primaryHypothesis} ` +
`Confiança ${confidence}/100 (${confidenceLabel}). ` +
`Repair tier provável: ${humanTier(likelyTier)}. ` +
`Chance estimada de troca simples: ${simpleSwapChance}% / chance de board-level: ${boardChance}%.`;

  return {
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    executiveSummary: summary,
    primaryCategory: primary.rule.category,
    severity: topSev,
    confidenceScore: confidence,
    confidenceLabel,
    riskOfMisdiagnosis,
    likelyRepairTier: likelyTier,
    likelySimpleSwapChance: simpleSwapChance,
    likelyBoardRepairChance: boardChance,
    suspectedComponents: components,
    probableSubsystem: primary.rule.probableSubsystem,
    recommendedTestSequence: tests,
    technicalAlerts: alerts,
    benchNotes: bencheNotesFor(primary.rule, parsed),
    hypotheses,
    evidences,
    suggestions,
  };
}

function uniq<T>(arr: T[]): T[] { return [...new Set(arr)]; }

function humanTier(t: RepairTier): string {
  return ({
    simple_swap: 'troca simples',
    peripheral_diagnosis: 'diagnóstico periférico',
    connector_or_line_check: 'verificação de conector/linha',
    advanced_board_diagnosis: 'diagnóstico avançado de placa',
    high_risk_board_repair: 'reparo de placa de alto risco',
  })[t];
}

function bencheNotesFor(rule: DiagnosticRule, parsed: ParsedLog): string {
  const proc = parsed.metadata.process ? ` Processo envolvido: ${parsed.metadata.process}.` : '';
  return `Subsistema provável: ${rule.probableSubsystem}.${proc} Iniciar pelas ações de prioridade 1 e parar tentativa cega se as ações 1-3 não evoluírem.`;
}

function buildEmptyResult(parsed: ParsedLog): AnalysisResult {
  return {
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    executiveSummary: 'Nenhum padrão diagnóstico conhecido foi identificado. O log foi parseado mas não disparou regras do catálogo atual. Verifique se o conteúdo é realmente um panic-full e considere expandir a base de regras.',
    primaryCategory: 'unknown',
    severity: 'low',
    confidenceScore: 0,
    confidenceLabel: 'low',
    riskOfMisdiagnosis: 80,
    likelyRepairTier: 'peripheral_diagnosis',
    likelySimpleSwapChance: 0,
    likelyBoardRepairChance: 0,
    suspectedComponents: [],
    probableSubsystem: 'desconhecido',
    recommendedTestSequence: ['Confirmar que o log é um panic-full válido', 'Tentar coletar novo log com sysdiagnose'],
    technicalAlerts: ['Resultado sem hipóteses — não conduzir reparo às cegas.'],
    hypotheses: [], evidences: [], suggestions: [],
  };
}
