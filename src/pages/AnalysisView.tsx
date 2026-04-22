import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, ShieldCheck, Wrench, FlaskConical, ChevronRight, Cpu, Microscope, Activity } from 'lucide-react';

type AnalysisFull = {
  id: string; case_id: string; executive_summary: string;
  primary_category: string; severity: string;
  confidence_score: number; confidence_label: string; risk_of_misdiagnosis: number;
  likely_repair_tier: string; likely_simple_swap_chance: number; likely_board_repair_chance: number;
  suspected_components: string[]; probable_subsystem: string;
  recommended_test_sequence: string[]; technical_alerts: string[]; bench_notes: string;
  engine_version: string; ruleset_version: string; created_at: string;
  full_payload: any;
};
type Hyp = { id: string; rule_id: string; category: string; is_primary: boolean; title: string; explanation: string; confidence_score: number; suspected_components: string[]; rank: number };
type Ev = { id: string; category: string; evidence_key: string; matched_text: string; weight: number; is_conflicting: boolean; context: string };
type Sug = { id: string; action_title: string; action_type: string; priority: number; difficulty: string; estimated_cost: string; estimated_time: string; technical_risk: string; expected_resolution_chance: number; why_this_action: string; when_to_escalate: string };
type CaseInfo = { title: string; reported_defect: string; status: string };
type LogInfo = { raw_content: string; filename: string };

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-success/15 text-success border-success/30',
  moderate: 'bg-info/15 text-info border-info/30',
  high: 'bg-warning/15 text-warning border-warning/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};
const TIER_LABEL: Record<string, string> = {
  simple_swap: 'Troca simples',
  peripheral_diagnosis: 'Diagnóstico periférico',
  connector_or_line_check: 'Verificação de conector/linha',
  advanced_board_diagnosis: 'Diagnóstico avançado de placa',
  high_risk_board_repair: 'Reparo de placa de alto risco',
};

export default function AnalysisView() {
  const { id } = useParams<{ id: string }>();
  const { currentOrgId } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisFull | null>(null);
  const [hypotheses, setHypotheses] = useState<Hyp[]>([]);
  const [evidences, setEvidences] = useState<Ev[]>([]);
  const [suggestions, setSuggestions] = useState<Sug[]>([]);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [logInfo, setLogInfo] = useState<LogInfo | null>(null);
  const [parsedMeta, setParsedMeta] = useState<any>(null);

  useEffect(() => {
    if (!id || !currentOrgId) return;
    (async () => {
      const { data: a } = await supabase.from('analysis_results').select('*').eq('id', id).single();
      if (!a) return;
      setAnalysis(a as any);
      const [{ data: h }, { data: e }, { data: s }, { data: c }, { data: log }, { data: parsed }] = await Promise.all([
        supabase.from('diagnostic_hypotheses').select('*').eq('analysis_id', id).order('rank'),
        supabase.from('diagnostic_evidences').select('*').eq('analysis_id', id),
        supabase.from('repair_suggestions').select('*').eq('analysis_id', id).order('priority'),
        supabase.from('cases').select('title, reported_defect, status').eq('id', a.case_id).single(),
        supabase.from('panic_logs').select('raw_content, filename').eq('id', a.panic_log_id).single(),
        supabase.from('parsed_logs').select('metadata').eq('panic_log_id', a.panic_log_id).single(),
      ]);
      setHypotheses(h ?? []); setEvidences(e ?? []); setSuggestions(s ?? []);
      setCaseInfo(c ?? null); setLogInfo(log ?? null); setParsedMeta(parsed?.metadata ?? null);
    })();
  }, [id, currentOrgId]);

  if (!analysis) return <div className="text-muted-foreground">Carregando análise…</div>;

  const primary = hypotheses.find(h => h.is_primary);
  const secondaries = hypotheses.filter(h => !h.is_primary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to={`/app/cases/${analysis.case_id}`}><ArrowLeft className="h-4 w-4 mr-1" /> Caso</Link></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{caseInfo?.title ?? 'Análise'}</h1>
            <p className="text-xs text-muted-foreground">Engine v{analysis.engine_version} · Ruleset v{analysis.ruleset_version}</p>
          </div>
        </div>
        <Badge className={`border ${SEVERITY_COLOR[analysis.severity]} capitalize`}>{analysis.severity}</Badge>
      </div>

      {/* Top: confidence + tier + chances */}
      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="panel p-5 lg:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Hipótese principal</div>
          <div className="mt-2 text-lg font-semibold leading-snug">{primary?.title ?? '—'}</div>
          <div className="mt-3 text-sm text-muted-foreground">{primary?.explanation}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {primary?.suspected_components?.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
          </div>
        </Card>
        <ConfidenceCard score={analysis.confidence_score} label={analysis.confidence_label} risk={analysis.risk_of_misdiagnosis} />
        <Card className="panel p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Repair tier provável</div>
          <div className="mt-2 text-lg font-semibold">{TIER_LABEL[analysis.likely_repair_tier]}</div>
          <div className="mt-4 space-y-2">
            <Bar label="Troca simples" value={analysis.likely_simple_swap_chance} color="bg-success" />
            <Bar label="Reparo de placa" value={analysis.likely_board_repair_chance} color="bg-destructive" />
          </div>
        </Card>
      </div>

      {/* Executive summary + alerts */}
      <Card className="panel p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-2"><Microscope className="h-3 w-3" /> Resumo executivo</div>
        <p className="text-sm leading-relaxed">{analysis.executive_summary}</p>
        {analysis.technical_alerts?.length > 0 && (
          <div className="mt-4 space-y-2">
            {analysis.technical_alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm rounded-md border border-warning/30 bg-warning/10 p-3 text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{a}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Two columns: hypotheses + evidences */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="panel p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-primary" /> Hipóteses concorrentes</h3>
          <div className="space-y-3">
            {secondaries.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma hipótese secundária relevante.</div>}
            {secondaries.map(h => (
              <div key={h.id} className="border border-border rounded-lg p-3 hover:bg-muted/30">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="capitalize">{h.category.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">{h.confidence_score}/100</span>
                </div>
                <div className="mt-2 text-sm font-medium">{h.title}</div>
                <p className="text-xs text-muted-foreground mt-1">{h.explanation}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="panel p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><ShieldCheck className="h-4 w-4 text-primary" /> Evidências extraídas</h3>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {evidences.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma evidência.</div>}
            {evidences.map(e => (
              <div key={e.id} className="border border-border rounded-md p-2 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <Badge variant="outline" className="capitalize text-[10px]">{e.category.replace(/_/g, ' ')}</Badge>
                  <span className="text-muted-foreground font-mono">peso {e.weight}</span>
                </div>
                <code className="font-mono text-[11px] block bg-muted/40 p-1.5 rounded text-foreground/90 break-all">{e.matched_text}</code>
                {e.context && e.context !== e.matched_text && <div className="text-muted-foreground mt-1 text-[10px]">{e.context}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Suggestions */}
      <Card className="panel p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Wrench className="h-4 w-4 text-primary" /> Ações recomendadas (em ordem)</h3>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={s.id} className="border border-border rounded-lg p-4 flex gap-4 items-start">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center font-semibold text-sm">{i+1}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-medium">{s.action_title}</div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.action_type.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline" className="text-[10px]">dificuldade {s.difficulty}</Badge>
                    <Badge variant="outline" className="text-[10px]">risco {s.technical_risk}</Badge>
                    <Badge className="text-[10px] bg-primary/15 text-primary border border-primary/30">resolve ~{s.expected_resolution_chance}%</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{s.why_this_action}</p>
                {s.when_to_escalate && <p className="text-xs text-warning mt-2 flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Escalar quando: {s.when_to_escalate}</p>}
                {(s.estimated_time || s.estimated_cost) && (
                  <div className="text-[11px] text-muted-foreground mt-2 flex gap-3">
                    {s.estimated_time && <span>⏱ {s.estimated_time}</span>}
                    {s.estimated_cost && <span>💰 {s.estimated_cost}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Test sequence */}
      <Card className="panel p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><FlaskConical className="h-4 w-4 text-primary" /> Sequência recomendada de testes</h3>
        <ol className="space-y-2 text-sm">
          {analysis.recommended_test_sequence?.map((t, i) => (
            <li key={i} className="flex gap-3"><span className="text-primary font-mono">{String(i+1).padStart(2, '0')}</span><span>{t}</span></li>
          ))}
        </ol>
      </Card>

      {/* Bench notes + metadata */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="panel p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Cpu className="h-4 w-4 text-primary" /> Metadados do log</h3>
          {parsedMeta ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {Object.entries(parsedMeta).filter(([,v]) => !!v).map(([k,v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
                  <dd className="font-mono break-all">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : <div className="text-sm text-muted-foreground">Sem metadados.</div>}
          {analysis.bench_notes && <p className="text-sm text-muted-foreground mt-4 border-t border-border pt-3">{analysis.bench_notes}</p>}
        </Card>

        <Card className="panel p-5">
          <h3 className="font-semibold mb-3">Log original</h3>
          <pre className="font-mono text-[10px] max-h-[280px] overflow-auto bg-muted/40 p-3 rounded">{logInfo?.raw_content}</pre>
        </Card>
      </div>
    </div>
  );
}

function ConfidenceCard({ score, label, risk }: { score: number; label: string; risk: number }) {
  return (
    <Card className="panel p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Confiança</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-4xl font-semibold gold-text">{score}</div>
        <div className="text-sm text-muted-foreground">/100</div>
      </div>
      <div className="text-xs text-muted-foreground capitalize">{label.replace('_', ' ')}</div>
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">Risco de erro de diagnóstico: <span className="text-warning font-medium">{risk}%</span></div>
    </Card>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span>{label}</span><span className="font-mono text-muted-foreground">{value}%</span></div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}
