import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useLicense } from '@/hooks/useLicense';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilePlus2, FolderOpen, Activity, AlertTriangle, TrendingUp, Wrench, BookOpen } from 'lucide-react';
import { formatDistanceToNow, subDays, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { toast } from 'sonner';

type CaseRow = { id: string; title: string; status: string; created_at: string };
type AnalysisRow = { id: string; case_id: string; primary_category: string; severity: string; confidence_score: number; likely_repair_tier: string; created_at: string };

const SEVERITY_COLOR: Record<string, string> = { low: 'hsl(var(--success))', moderate: 'hsl(var(--info))', high: 'hsl(var(--warning))', critical: 'hsl(var(--destructive))' };

export default function Dashboard() {
  const { currentOrgId } = useAuth();
  const { hasFeature } = useLicense();
  const [stats, setStats] = useState({ total: 0, month: 0, critical: 0, avgConfidence: 0 });
  const [recentCases, setRecentCases] = useState<CaseRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const since = subDays(new Date(), 30);
      const [{ count: total, error: totalErr }, { data: monthAnalyses, error: monthErr }, { data: cases, error: casesErr }] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId),
        supabase.from('analysis_results').select('id, case_id, primary_category, severity, confidence_score, likely_repair_tier, created_at').eq('org_id', currentOrgId).gte('created_at', since.toISOString()).order('created_at'),
        supabase.from('cases').select('id, title, status, created_at').eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(6),
      ]);
      const err = totalErr ?? monthErr ?? casesErr;
      if (err) {
        toast.error('Falha ao carregar dashboard', { description: err.message });
        setLoading(false);
        return;
      }
      const list = (monthAnalyses ?? []) as AnalysisRow[];
      const critical = list.filter(a => a.severity === 'critical').length;
      const avg = list.length ? Math.round(list.reduce((s, a) => s + a.confidence_score, 0) / list.length) : 0;
      setStats({ total: total ?? 0, month: list.length, critical, avgConfidence: avg });
      setRecentCases((cases ?? []) as any);
      setAnalyses(list);
      setLoading(false);
    })();
  }, [currentOrgId]);

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
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ category: k.replace(/_/g, ' '), n: v }));
  }, [analyses]);

  const severityData = useMemo(() => {
    const s: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
    for (const a of analyses) s[a.severity] = (s[a.severity] ?? 0) + 1;
    return Object.entries(s).map(([k, v]) => ({ severity: k, n: v }));
  }, [analyses]);

  const tierData = useMemo(() => {
    const t: Record<string, number> = {};
    for (const a of analyses) t[a.likely_repair_tier] = (t[a.likely_repair_tier] ?? 0) + 1;
    return Object.entries(t).map(([k, v]) => ({ tier: k.replace(/_/g, ' '), n: v }));
  }, [analyses]);
  const showAdvanced = hasFeature('advanced_dashboard');

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da sua bancada · últimos 30 dias.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/app/knowledge"><BookOpen className="h-4 w-4 mr-2" /> KB</Link></Button>
          <Button asChild><Link to="/app/new"><FilePlus2 className="h-4 w-4 mr-2" /> Nova análise</Link></Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={FolderOpen} label="Casos totais" value={stats.total} />
        <Stat icon={Activity} label="Análises (30d)" value={stats.month} accent />
        <Stat icon={AlertTriangle} label="Críticas (30d)" value={stats.critical} danger />
        <Stat icon={TrendingUp} label="Confiança média" value={`${stats.avgConfidence}/100`} />
      </div>
      {loading && <Card className="panel p-5 text-sm text-muted-foreground">Carregando métricas e séries…</Card>}

      {showAdvanced && (
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="panel p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Análises por dia</h3>
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
          <h3 className="font-semibold mb-4">Severidade (30d)</h3>
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

      {showAdvanced && (
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="panel p-5">
          <h3 className="font-semibold mb-4">Top categorias diagnósticas</h3>
          {categoryData.length === 0 ? <Empty msg="Sem análises ainda." /> : (
            <div className="space-y-2">
              {categoryData.map(({ category, n }) => {
                const max = categoryData[0].n;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-xs mb-1"><span className="capitalize">{category}</span><span className="text-muted-foreground">{n}</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="panel p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Distribuição por repair tier</h3>
          {tierData.length === 0 ? <Empty msg="Sem dados." /> : (
            <div className="space-y-2">
              {tierData.sort((a, b) => b.n - a.n).map(({ tier, n }) => {
                const max = Math.max(...tierData.map(t => t.n));
                return (
                  <div key={tier}>
                    <div className="flex justify-between text-xs mb-1"><span className="capitalize">{tier}</span><span className="text-muted-foreground">{n}</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      )}

      <Card className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Casos recentes</h3>
          <Link to="/app/cases" className="text-xs text-primary hover:underline">Ver todos</Link>
        </div>
        {recentCases.length === 0 ? <Empty msg="Nenhum caso ainda. Crie sua primeira análise." /> : (
          <div className="divide-y divide-border">
            {recentCases.map(c => (
              <Link to={`/app/cases/${c.id}`} key={c.id} className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">{c.status}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent, danger }: any) {
  return (
    <Card className={`panel p-5 ${accent ? 'border-primary/30' : ''} ${danger && Number(value) > 0 ? 'border-destructive/40' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${danger && Number(value) > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{msg}</div>;
}
