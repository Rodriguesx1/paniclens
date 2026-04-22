import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilePlus2, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Row = { id: string; title: string; status: string; created_at: string; reported_defect: string };

export default function Cases() {
  const { currentOrgId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!currentOrgId) return;
    supabase.from('cases').select('id, title, status, created_at, reported_defect')
      .eq('org_id', currentOrgId).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []));
  }, [currentOrgId]);

  const filtered = rows.filter(r => !q || r.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Casos</h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico de bancada da organização.</p>
        </div>
        <Button asChild><Link to="/app/new"><FilePlus2 className="h-4 w-4 mr-2" /> Novo caso</Link></Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por título…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Card className="panel">
        {filtered.length === 0
          ? <div className="p-10 text-center text-muted-foreground text-sm">Nenhum caso encontrado.</div>
          : <div className="divide-y divide-border">
              {filtered.map(r => (
                <Link key={r.id} to={`/app/cases/${r.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.reported_defect ?? '—'}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                </Link>
              ))}
            </div>}
      </Card>
    </div>
  );
}
