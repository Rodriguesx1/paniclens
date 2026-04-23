/**
 * PanicLens — Comparador de casos similares.
 * Pontua casos da mesma org com base em categoria, severidade e overlap de componentes suspeitos.
 */
import { supabase } from '@/integrations/supabase/client';

export type SimilarCase = {
  caseId: string;
  analysisId: string;
  caseTitle: string;
  primaryCategory: string;
  severity: string;
  confidence: number;
  outcome: string | null;
  status: string | null;
  createdAt: string;
  score: number;        // 0..100
  overlapComponents: string[];
};

type Reference = {
  orgId: string;
  excludeAnalysisId: string;
  category: string;
  severity: string;
  components: string[];
};

export async function findSimilarCases(ref: Reference, limit = 6): Promise<SimilarCase[]> {
  const since = new Date(); since.setMonth(since.getMonth() - 12);

  const { data: candidates } = await supabase
    .from('analysis_results')
    .select('id, case_id, primary_category, severity, confidence_score, suspected_components, created_at')
    .eq('org_id', ref.orgId)
    .neq('id', ref.excludeAnalysisId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (!candidates || candidates.length === 0) return [];

  const refSet = new Set(ref.components.map(c => c.toLowerCase()));

  const scored = candidates.map((c: any) => {
    let score = 0;
    if (c.primary_category === ref.category) score += 55;
    if (c.severity === ref.severity) score += 15;

    const comps: string[] = Array.isArray(c.suspected_components) ? c.suspected_components : [];
    const overlap = comps.filter(x => refSet.has(String(x).toLowerCase()));
    if (refSet.size > 0) {
      const ratio = overlap.length / Math.max(refSet.size, 1);
      score += Math.round(ratio * 30);
    }
    return { row: c, score, overlap };
  })
  .filter(s => s.score >= 30)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

  if (scored.length === 0) return [];

  const caseIds = [...new Set(scored.map(s => s.row.case_id))];
  const { data: cases } = await supabase
    .from('cases')
    .select('id, title, status, outcome')
    .in('id', caseIds);

  const caseMap = new Map((cases ?? []).map((c: any) => [c.id, c]));

  return scored.map(s => {
    const caseRow = caseMap.get(s.row.case_id);
    return {
      caseId: s.row.case_id,
      analysisId: s.row.id,
      caseTitle: caseRow?.title ?? 'Caso',
      primaryCategory: s.row.primary_category,
      severity: s.row.severity,
      confidence: s.row.confidence_score,
      outcome: caseRow?.outcome ?? null,
      status: caseRow?.status ?? null,
      createdAt: s.row.created_at,
      score: Math.min(100, s.score),
      overlapComponents: s.overlap,
    };
  });
}
