import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, Building2, KeyRound, BookOpen, Activity, Plus, Ban, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Org = { id: string; name: string; slug: string; created_at: string };
type Plan = { id: string; code: string; name: string };
type License = {
  id: string; org_id: string; plan_id: string; license_key: string; status: string;
  expires_at: string | null; monthly_analyses_limit_override: number | null; created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  trial: 'bg-info/15 text-info border-info/30',
  suspended: 'bg-warning/15 text-warning border-warning/30',
  expired: 'bg-muted text-muted-foreground border-border',
  revoked: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function Admin() {
  const { user, memberships, loading: authLoading } = useAuth();
  const isSuper = memberships.some(m => m.role === 'super_admin');

  const [tab, setTab] = useState<'orgs' | 'licenses' | 'plans' | 'audit'>('orgs');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [stats, setStats] = useState({ orgs: 0, users: 0, analyses: 0, activeLicenses: 0 });

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ org_id: '', plan_id: '', expires_at: '', limit_override: '', notes: '' });

  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      const [{ data: o }, { data: l }, { data: p }, { data: a }, { count: usersCount }, { count: analysesCount }] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at', { ascending: false }),
        supabase.from('licenses').select('*').order('created_at', { ascending: false }),
        supabase.from('plans').select('id, code, name').order('sort_order'),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('analysis_results').select('id', { count: 'exact', head: true }),
      ]);
      setOrgs((o ?? []) as any); setLicenses((l ?? []) as any); setPlans((p ?? []) as any); setAudit((a ?? []) as any);
      const active = (l ?? []).filter((x: any) => x.status === 'active' || x.status === 'trial').length;
      setStats({ orgs: o?.length ?? 0, users: usersCount ?? 0, analyses: analysesCount ?? 0, activeLicenses: active });
    })();
  }, [isSuper]);

  if (authLoading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isSuper) return <Navigate to="/app" replace />;

  async function reload() {
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('licenses').select('*').order('created_at', { ascending: false }),
    ]);
    setOrgs((o ?? []) as any); setLicenses((l ?? []) as any);
  }

  async function issueLicense() {
    if (!issueForm.org_id || !issueForm.plan_id) { toast.error('Selecione organização e plano'); return; }
    const key = 'PL-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { error } = await supabase.from('licenses').insert({
      org_id: issueForm.org_id,
      plan_id: issueForm.plan_id,
      license_key: key,
      status: 'active',
      expires_at: issueForm.expires_at || null,
      monthly_analyses_limit_override: issueForm.limit_override ? parseInt(issueForm.limit_override) : null,
      notes: issueForm.notes || null,
      issued_by: user?.id,
    });
    if (error) { toast.error('Falha ao emitir', { description: error.message }); return; }
    await supabase.from('audit_log').insert({
      org_id: issueForm.org_id, user_id: user?.id, action: 'license_issued', entity: 'license',
      payload: { plan_id: issueForm.plan_id, key },
    });
    toast.success('Licença emitida', { description: key });
    setIssueOpen(false);
    setIssueForm({ org_id: '', plan_id: '', expires_at: '', limit_override: '', notes: '' });
    reload();
  }

  async function setLicenseStatus(lic: License, status: string) {
    const { error } = await supabase.from('licenses').update({ status: status as any }).eq('id', lic.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('audit_log').insert({
      org_id: lic.org_id, user_id: user?.id, action: 'license_status_changed', entity: 'license', entity_id: lic.id,
      payload: { from: lic.status, to: status },
    });
    toast.success(`Licença ${status}`); reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /> Painel Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de organizações, licenças e auditoria global.</p>
        </div>
        <Button onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4 mr-2" /> Emitir licença</Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard icon={Building2} label="Organizações" value={stats.orgs} />
        <KpiCard icon={ShieldCheck} label="Licenças ativas" value={stats.activeLicenses} accent />
        <KpiCard icon={Activity} label="Análises totais" value={stats.analyses} />
        <KpiCard icon={KeyRound} label="Usuários" value={stats.users} />
      </div>

      <div className="flex gap-2 border-b border-border">
        {(['orgs', 'licenses', 'plans', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'orgs' ? 'Organizações' : t === 'licenses' ? 'Licenças' : t === 'plans' ? 'Planos' : 'Auditoria'}
          </button>
        ))}
      </div>

      {tab === 'orgs' && (
        <Card className="panel p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-2 px-2">Organização</th><th className="text-left">Slug</th><th className="text-left">Licença</th><th className="text-left">Criado em</th>
            </tr></thead>
            <tbody>
              {orgs.map(o => {
                const lic = licenses.find(l => l.org_id === o.id && (l.status === 'active' || l.status === 'trial'));
                const planName = plans.find(p => p.id === lic?.plan_id)?.name ?? '—';
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-2 font-medium">{o.name}</td>
                    <td className="text-xs font-mono text-muted-foreground">{o.slug}</td>
                    <td>{lic ? <Badge className={`border ${STATUS_COLOR[lic.status]}`}>{planName} · {lic.status}</Badge> : <span className="text-muted-foreground text-xs">sem licença</span>}</td>
                    <td className="text-xs text-muted-foreground">{format(new Date(o.created_at), 'dd/MM/yyyy')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'licenses' && (
        <Card className="panel p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-2 px-2">Organização</th><th className="text-left">Plano</th><th className="text-left">Status</th>
              <th className="text-left">Chave</th><th className="text-left">Expira</th><th className="text-left">Override</th><th></th>
            </tr></thead>
            <tbody>
              {licenses.map(l => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-2">{orgs.find(o => o.id === l.org_id)?.name ?? l.org_id.slice(0, 8)}</td>
                  <td>{plans.find(p => p.id === l.plan_id)?.name ?? '—'}</td>
                  <td><Badge className={`border ${STATUS_COLOR[l.status]} capitalize`}>{l.status}</Badge></td>
                  <td className="text-xs font-mono text-muted-foreground">{l.license_key}</td>
                  <td className="text-xs">{l.expires_at ? format(new Date(l.expires_at), 'dd/MM/yyyy') : '∞'}</td>
                  <td className="text-xs">{l.monthly_analyses_limit_override ?? '—'}</td>
                  <td className="text-right">
                    {l.status === 'active' ? (
                      <Button size="sm" variant="ghost" onClick={() => setLicenseStatus(l, 'suspended')}><Ban className="h-3 w-3 mr-1" />Suspender</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setLicenseStatus(l, 'active')}><RotateCw className="h-3 w-3 mr-1" />Ativar</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'plans' && (
        <Card className="panel p-4">
          <div className="grid md:grid-cols-2 gap-3">
            {plans.map(p => (
              <div key={p.id} className="border border-border rounded-lg p-3">
                <div className="font-semibold flex items-center gap-2">{p.name} <Badge variant="outline" className="text-[10px] font-mono">{p.code}</Badge></div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-2"><BookOpen className="h-3 w-3" /> Edição inline de planos virá em release dedicado.</p>
        </Card>
      )}

      {tab === 'audit' && (
        <Card className="panel p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left py-2 px-2">Quando</th><th className="text-left">Org</th><th className="text-left">Ação</th><th className="text-left">Entidade</th><th className="text-left">Payload</th>
            </tr></thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Sem eventos.</td></tr>}
              {audit.map(ev => (
                <tr key={ev.id} className="border-b border-border/50">
                  <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(ev.created_at), 'dd/MM HH:mm')}</td>
                  <td className="text-xs">{orgs.find(o => o.id === ev.org_id)?.name ?? '—'}</td>
                  <td className="text-xs font-mono">{ev.action}</td>
                  <td className="text-xs text-muted-foreground">{ev.entity ?? '—'}</td>
                  <td className="text-[10px] font-mono text-muted-foreground max-w-[400px] truncate">{ev.payload ? JSON.stringify(ev.payload) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Emitir nova licença</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Organização</Label>
              <Select value={issueForm.org_id} onValueChange={v => setIssueForm({ ...issueForm, org_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher organização" /></SelectTrigger>
                <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={issueForm.plan_id} onValueChange={v => setIssueForm({ ...issueForm, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher plano" /></SelectTrigger>
                <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expira em (opcional)</Label>
                <Input type="date" value={issueForm.expires_at} onChange={e => setIssueForm({ ...issueForm, expires_at: e.target.value })} />
              </div>
              <div>
                <Label>Limite override / mês</Label>
                <Input type="number" placeholder="(opcional)" value={issueForm.limit_override} onChange={e => setIssueForm({ ...issueForm, limit_override: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea rows={2} value={issueForm.notes} onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>Cancelar</Button>
            <Button onClick={issueLicense}>Emitir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className={`panel p-5 ${accent ? 'border-primary/30' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}
