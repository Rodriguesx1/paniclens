import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow, startOfDay, subDays, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLicense } from '@/hooks/useLicense';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FilePlus2, FolderOpen, Activity, AlertTriangle, TrendingUp, Wrench, BookOpen, ArrowRight, Clock3, Gauge, CheckCircle2, Layers3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCaseStatusBadgeClass, getCaseStatusMeta } from '@/lib/domain/caseWorkflow';

type CaseRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;
  estimated_cost: number | null;
  final_cost: number | null;
};

type AnalysisRow = {
  id: string;
  case_id: string;
  primary_category: string;
  severity: string;
  confidence_score: number;
  likely_repair_tier: string;
  created_at: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  low: 'hsl(var(--success))',
  moderate: 'hsl(var(--info))',
  high: 'hsl(var(--warning))',
  critical: 'hsl(var(--destructive))',
};

export default function Dashboard() {
  const { currentOrgId } = useAuth();
  const { hasFeature } = useLicense();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const since = subDays(new Date(), 30);
      const [casesRes, analysesRes, totalRes] = await Promise.all([
        supabase.from('cases').select('id, title, status, created_at, resolved_at, updated_at, estimated_cost, final_cost').eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(200),
        supabase.from('analysis_results').select('id, case_id, primary_category, severity, confidence_score, likely_repair_tier, created_at').eq('org_id', currentOrgId).gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId),
      ]);

      const error = casesRes.error ?? analysesRes.error ?? totalRes.error;
      if (error) {
        toast.error('Falha ao carregar dashboard', { description: error.message });
        setLoading(false);
        return;
      }

      setCases((casesRes.data ?? []) as CaseRow[]);
      setAnalyses((analysesRes.data ?? []) as AnalysisRow[]);
      setLoading(false);
    })();
  }, [currentOrgId]);

  const latestAnalysisByCase = useMemo(() => {
    const map = new Map<string, AnalysisRow>();
    for (const analysis of analyses) {
      if (!map.has(analysis.case_id)) map.set(analysis.case_id, analysis);
    }
    return map;
  }, [analyses]);

  const stats = useMemo(() => {
    const totalCases = cases.length;
    const analyses30d = analyses.length;
    const critical = analyses.filter(a => a.severity === 'critical').length;
    const avgConfidence = analyses30d
      ? Math.round(analyses.reduce((sum, a) => sum + a.confidence_score, 0) / analyses30d)
      : 0;
    const resolved = cases.filter(c => c.status === 'resolved' || c.status === 'closed').length;
    const inProgress = cases.filter(c => c.status === 'open' || c.status === 'analyzed' || c.status === 'in_repair').length;
    const escalated = cases.filter(c => c.status === 'escalated').length;
    const avgResolutionHours = averageResolutionHours(cases);
    const avgTicket = averageTicket(cases);
    return { totalCases, analyses30d, critical, avgConfidence, resolved, inProgress, escalated, avgResolutionHours, avgTicket };
  }, [cases, analyses]);

  const dailySeries = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) buckets[format(subDays(new Date(), i), 'yyyy-MM-dd')] = 0;
    for (const a of analyses) {
      const k = format(startOfDay(new Date(a.created_at)), 'yyyy-MM-dd');
      if (k in buckets) buckets[k]++;
    }
    return Object.entries(buckets).map(([k, v]) => ({ date: format(new Date(k), 'dd/MM'), n: v }));
  }, [analyses]);

  const categoryData = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of analyses) c[a.primary_category] = (c[a.primary_category] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([category, n]) => ({ category: category.replace(/_/g, ' '), n }));
  }, [analyses]);

  const severityData = useMemo(() => {
    const s: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
    for (const a of analyses) s[a.severity] = (s[a.severity] ?? 0) + 1;
    return Object.entries(s).map(([severity, n]) => ({ severity, n }));
  }, [analyses]);

  const tierData = useMemo(() => {
    const t: Record<string, number> = {};
    for (const a of analyses) t[a.likely_repair_tier] = (t[a.likely_repair_tier] ?? 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([tier, n]) => ({ tier: tier.replace(/_/g, ' '), n }));
  }, [analyses]);

  const criticalCases = useMemo(() => {
    return cases
      .map(c => {
        const latest = latestAnalysisByCase.get(c.id);
        return { case: c, latest };
      })
      .filter(item => item.latest?.severity === 'critical' || item.case.status === 'escalated' || item.case.status === 'in_repair')
      .slice(0, 6);
  }, [cases, latestAnalysisByCase]);

  const actionQueue = useMemo(() => {
    return cases
      .filter(c => c.status === 'open' || c.status === 'analyzed')
      .slice(0, 6)
      .map(c => ({ case: c, latest: latestAnalysisByCase.get(c.id) }));
  }, [cases, latestAnalysisByCase]);

  const showAdvanced = hasFeature('advanced_dashboard');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operação da bancada, últimos 30 dias e fila de decisão técnica.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app/knowledge"><BookOpen className="mr-2 h-4 w-4" /> Base técnica</Link>
          </Button>
          <Button asChild>
            <Link to="/app/new"><FilePlus2 className="mr-2 h-4 w-4" /> Nova análise</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FolderOpen} label="Casos totais" value={stats.totalCases} helper="Persistidos na org" />
        <Stat icon={Activity} label="Análises (30d)" value={stats.analyses30d} helper="Janela móvel de 30 dias" accent />
        <Stat icon={AlertTriangle} label="Críticas (30d)" value={stats.critical} helper="Precisam de atenção" danger />
        <Stat icon={TrendingUp} label="Confiança média" value={`${stats.avgConfidence}/100`} helper="Média das análises" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CheckCircle2} label="Resolvidos" value={stats.resolved} helper="Casos finalizados" />
        <Stat icon={Clock3} label="Em andamento" value={stats.inProgress} helper="Fila operacional" />
        <Stat icon={Wrench} label="Escalados" value={stats.escalated} helper="Prováveis board-level" />
        <Stat icon={Gauge} label="Ticket médio" value={stats.avgTicket ? `R$ ${stats.avgTicket.toFixed(0)}` : '—'} helper="Base de casos" />
      </div>

      {loading && <Card className="panel p-5 text-sm text-muted-foreground">Carregando métricas e séries…</Card>}

      {showAdvanced && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="panel p-5 lg:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-primary" /> Análises por dia</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Line type="monotone" dataKey="n" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="panel p-5">
            <h3 className="mb-4 font-semibold">Severidade (30d)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="severity" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Bar dataKey="n" radius={[4, 4, 0, 0]}>
                    {severityData.map((d, i) => <Cell key={i} fill={SEVERITY_COLOR[d.severity] ?? 'hsl(var(--primary))'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="panel p-5">
          <h3 className="mb-4 font-semibold">Fila de ação</h3>
          {actionQueue.length === 0 ? <Empty msg="Nenhum caso aguardando ação." /> : (
            <div className="space-y-3">
              {actionQueue.map(({ case: c, latest }) => (
                <Link key={c.id} to={`/app/cases/${c.id}`} className="block rounded-xl border border-border bg-background/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{c.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Atualizado {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                    <Badge className={`border ${getCaseStatusBadgeClass(c.status)} capitalize`}>{getCaseStatusMeta(c.status).label}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{latest ? `${latest.primary_category.replace(/_/g, ' ')} · ${latest.confidence_score}/100` : 'Sem análise recente'}</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="panel p-5">
          <h3 className="mb-4 font-semibold">Casos críticos e escalados</h3>
          {criticalCases.length === 0 ? <Empty msg="Nenhum caso crítico agora." /> : (
            <div className="space-y-3">
              {criticalCases.map(({ case: c, latest }) => (
                <div key={c.id} className="rounded-xl border border-border bg-background/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="capitalize">{c.status}</Badge>
                      {latest && <Badge className={`border ${latest.severity === 'critical' ? 'bg-destructive/15 text-destructive border-destructive/30' : 'bg-warning/15 text-warning border-warning/30'} text-[10px]`}>{latest.severity}</Badge>}
                    </div>
                  </div>
                  {latest && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {latest.primary_category.replace(/_/g, ' ')} · {latest.confidence_score}/100 · {latest.likely_repair_tier.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="panel p-5">
          <h3 className="mb-4 font-semibold">Top categorias diagnósticas</h3>
          {categoryData.length === 0 ? <Empty msg="Sem análises ainda." /> : (
            <div className="space-y-2">
              {categoryData.map(({ category, n }) => {
                const max = categoryData[0].n;
                return (
                  <div key={category}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize">{category}</span>
                      <span className="text-muted-foreground">{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="panel p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Layers3 className="h-4 w-4 text-primary" /> Distribuição por repair tier</h3>
          {tierData.length === 0 ? <Empty msg="Sem dados." /> : (
            <div className="space-y-2">
              {tierData.map(({ tier, n }) => {
                const max = Math.max(...tierData.map(t => t.n));
                return (
                  <div key={tier}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize">{tier}</span>
                      <span className="text-muted-foreground">{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary/70" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Casos recentes</h3>
          <Link to="/app/cases" className="text-xs text-primary hover:underline">Ver todos</Link>
        </div>
        {cases.length === 0 ? <Empty msg="Nenhum caso ainda. Crie sua primeira análise." /> : (
          <div className="divide-y divide-border">
            {cases.slice(0, 8).map(c => {
              const latest = latestAnalysisByCase.get(c.id);
              return (
                <Link key={c.id} to={`/app/cases/${c.id}`} className="flex items-center justify-between gap-4 rounded-lg px-2 py-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <div className="font-medium">{c.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {latest ? `${latest.primary_category.replace(/_/g, ' ')} · ${latest.confidence_score}/100 · ${latest.severity}` : 'Sem análise vinculada'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge className={`border ${getCaseStatusBadgeClass(c.status)} capitalize`}>{getCaseStatusMeta(c.status).label}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, helper, accent, danger }: { icon: LucideIcon; label: string; value: string | number; helper: string; accent?: boolean; danger?: boolean }) {
  return (
    <Card className={`panel p-5 ${accent ? 'border-primary/30' : ''} ${danger && Number(value) > 0 ? 'border-destructive/40' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${danger && Number(value) > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="truncate text-2xl font-semibold">{value}</div>
          <div className="text-[11px] text-muted-foreground">{helper}</div>
        </div>
      </div>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-sm text-muted-foreground">{msg}</div>;
}

function averageResolutionHours(cases: CaseRow[]) {
  const resolved = cases.filter(c => c.resolved_at);
  if (resolved.length === 0) return 0;
  const hours = resolved.map(c => differenceInHours(new Date(c.resolved_at as string), new Date(c.created_at))).filter(n => Number.isFinite(n) && n >= 0);
  return hours.length ? Math.round(hours.reduce((sum, n) => sum + n, 0) / hours.length) : 0;
}

function averageTicket(cases: CaseRow[]) {
  const priced = cases.filter(c => typeof c.final_cost === 'number' && c.final_cost > 0);
  if (priced.length === 0) return 0;
  return priced.reduce((sum, c) => sum + (c.final_cost ?? 0), 0) / priced.length;
}
