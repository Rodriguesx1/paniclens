import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Activity } from 'lucide-react';
import { format } from 'date-fns';

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentOrgId } = useAuth();
  const [c, setC] = useState<any>(null);
  const [device, setDevice] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);

  useEffect(() => {
    if (!id || !currentOrgId) return;
    (async () => {
      const { data: caseRow } = await supabase.from('cases').select('*').eq('id', id).single();
      setC(caseRow);
      if (caseRow?.device_id) {
        const { data: d } = await supabase.from('devices').select('*').eq('id', caseRow.device_id).single();
        setDevice(d);
      }
      if (caseRow?.customer_id) {
        const { data: cu } = await supabase.from('customers').select('*').eq('id', caseRow.customer_id).single();
        setCustomer(cu);
      }
      const { data: a } = await supabase.from('analysis_results').select('id, primary_category, severity, confidence_score, created_at')
        .eq('case_id', id).order('created_at', { ascending: false });
      setAnalyses(a ?? []);
    })();
  }, [id, currentOrgId]);

  if (!c) return <div className="text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/cases"><ArrowLeft className="h-4 w-4 mr-1" /> Casos</Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
          <p className="text-xs text-muted-foreground">Criado {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</p>
        </div>
        <Badge variant="outline" className="ml-auto capitalize">{c.status}</Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="panel p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Cliente</h3>
          {customer
            ? <div><div className="font-medium">{customer.name}</div>{customer.email && <div className="text-xs text-muted-foreground">{customer.email}</div>}</div>
            : <div className="text-sm text-muted-foreground">Sem cliente vinculado.</div>}
        </Card>
        <Card className="panel p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Dispositivo</h3>
          {device ? (
            <div className="text-sm space-y-1">
              <div className="font-medium">{device.commercial_model ?? device.technical_identifier ?? '—'}</div>
              {device.technical_identifier && <div className="text-xs text-muted-foreground font-mono">{device.technical_identifier}</div>}
              {device.ios_version && <div className="text-xs text-muted-foreground">iOS {device.ios_version}</div>}
              {device.serial && <div className="text-xs text-muted-foreground">Serial: {device.serial}</div>}
            </div>
          ) : <div className="text-sm text-muted-foreground">Sem dispositivo vinculado.</div>}
        </Card>
        <Card className="panel p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Defeito relatado</h3>
          <div className="text-sm">{c.reported_defect ?? '—'}</div>
        </Card>
      </div>

      <Card className="panel p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-primary" /> Análises</h3>
        {analyses.length === 0
          ? <div className="text-sm text-muted-foreground">Nenhuma análise para este caso.</div>
          : <div className="divide-y divide-border">
              {analyses.map(a => (
                <Link key={a.id} to={`/app/analysis/${a.id}`} className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-2 px-2 rounded">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium capitalize">{a.primary_category.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{a.severity}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">{a.confidence_score}/100</span>
                  </div>
                </Link>
              ))}
            </div>}
      </Card>
    </div>
  );
}
