import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilePlus2, FolderOpen, Activity, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type CaseRow = { id: string; title: string; status: string; created_at: string };
type AnalysisRow = { id: string; case_id: string; primary_category: string; severity: string; confidence_score: number; created_at: string };

export default function Dashboard() {
  const { currentOrgId } = useAuth();
  const [stats, setStats] = useState({ total: 0, month: 0, critical: 0 });
  const [recentCases, setRecentCases] = useState<CaseRow[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisRow[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 1);
      const [{ count: total }, { count: month }, { data: cases }, { data: analyses }] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId),
        supabase.from('analysis_results').select('id', { count: 'exact', head: true }).eq('org_id', currentOrgId).gte('created_at', since.toISOString()),
        supabase.from('cases').select('id, title, status, created_at').eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(6),
        supabase.from('analysis_results').select('id, case_id, primary_category, severity, confidence_score, created_at').eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(20),
      ]);
      const critical = (analyses ?? []).filter(a => a.severity === 'critical').length;
      const cats: Record<string, number> = {};
      for (const a of analyses ?? []) cats[a.primary_category] = (cats[a.primary_category] ?? 0) + 1;
      setStats({ total: total ?? 0, month: month ?? 0, critical });
      setRecentCases(cases ?? []);
      setRecentAnalyses(analyses ?? []);
      setByCategory(cats);
    })();
  }, [currentOrgId]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da sua bancada.</p>
        </div>
        <Button asChild><Link to="/app/new"><FilePlus2 className="h-4 w-4 mr-2" /> Nova análise</Link></Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat icon={FolderOpen} label="Casos totais" value={stats.total} />
        <Stat icon={Activity} label="Análises (30 dias)" value={stats.month} accent />
        <Stat icon={AlertTriangle} label="Casos críticos recentes" value={stats.critical} danger />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Casos recentes</h3>
            <Link to="/app/cases" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {recentCases.length === 0
            ? <Empty msg="Nenhum caso ainda. Crie sua primeira análise." />
            : <div className="divide-y divide-border">
                {recentCases.map(c => (
                  <Link to={`/app/cases/${c.id}`} key={c.id} className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">{c.status}</span>
                  </Link>
                ))}
              </div>}
        </Card>

        <Card className="panel p-5">
          <h3 className="font-semibold mb-4">Categorias diagnósticas</h3>
          {Object.keys(byCategory).length === 0
            ? <Empty msg="Sem análises ainda." />
            : <div className="space-y-2">
                {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 8).map(([cat, n]) => {
                  const max = Math.max(...Object.values(byCategory));
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1"><span className="capitalize">{cat.replace(/_/g, ' ')}</span><span className="text-muted-foreground">{n}</span></div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${(n/max)*100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent, danger }: any) {
  return (
    <Card className={`panel p-5 ${accent ? 'border-primary/30' : ''} ${danger && value > 0 ? 'border-destructive/40' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${danger && value > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
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
