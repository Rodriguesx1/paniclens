import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Activity, CheckCircle2, Clock3, FileText, Smartphone, User, Save, ArrowRight, Sparkles, Wrench } from 'lucide-react';
import { getAvailableCaseTransitions, getCaseStatusBadgeClass, getCaseStatusMeta, isTerminalCaseStatus, type CaseStatus } from '@/lib/domain/caseWorkflow';

type CaseRow = {
  id: string;
  title: string;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  customer_id: string | null;
  device_id: string | null;
  reported_defect: string | null;
  initial_notes: string | null;
  perceived_symptoms: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  outcome: string | null;
};

type DeviceRow = {
  commercial_model: string | null;
  technical_identifier: string | null;
  ios_version: string | null;
  serial: string | null;
};

type CustomerRow = {
  name: string;
  email: string | null;
  phone: string | null;
};

type AnalysisRow = {
  id: string;
  primary_category: string;
  severity: string;
  confidence_score: number;
  likely_repair_tier: string;
  executive_summary: string;
  created_at: string;
};

type CaseForm = {
  title: string;
  reported_defect: string;
  initial_notes: string;
  perceived_symptoms: string;
  outcome: string;
  estimated_cost: string;
  final_cost: string;
  status: CaseStatus;
};

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentOrgId, user } = useAuth();
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null);
  const [device, setDevice] = useState<DeviceRow | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CaseForm>({
    title: '',
    reported_defect: '',
    initial_notes: '',
    perceived_symptoms: '',
    outcome: '',
    estimated_cost: '',
    final_cost: '',
    status: 'open',
  });

  useEffect(() => {
    if (!id || !currentOrgId) return;
    (async () => {
      setLoading(true);
      const { data: c, error: caseErr } = await supabase.from('cases').select('*').eq('id', id).eq('org_id', currentOrgId).single();
      if (caseErr || !c) {
        toast.error('Falha ao carregar caso', { description: caseErr?.message ?? 'caso não encontrado' });
        setLoading(false);
        return;
      }

      const nextCase = c as CaseRow;
      setCaseRow(nextCase);
      setForm({
        title: nextCase.title ?? '',
        reported_defect: nextCase.reported_defect ?? '',
        initial_notes: nextCase.initial_notes ?? '',
        perceived_symptoms: nextCase.perceived_symptoms ?? '',
        outcome: nextCase.outcome ?? '',
        estimated_cost: nextCase.estimated_cost?.toString() ?? '',
        final_cost: nextCase.final_cost?.toString() ?? '',
        status: nextCase.status,
      });

      if (nextCase.device_id) {
        const { data: d } = await supabase.from('devices').select('commercial_model, technical_identifier, ios_version, serial').eq('id', nextCase.device_id).eq('org_id', currentOrgId).single();
        setDevice((d as DeviceRow) ?? null);
      } else {
        setDevice(null);
      }

      if (nextCase.customer_id) {
        const { data: cu } = await supabase.from('customers').select('name, email, phone').eq('id', nextCase.customer_id).eq('org_id', currentOrgId).single();
        setCustomer((cu as CustomerRow) ?? null);
      } else {
        setCustomer(null);
      }

      const { data: a } = await supabase
        .from('analysis_results')
        .select('id, primary_category, severity, confidence_score, likely_repair_tier, executive_summary, created_at')
        .eq('case_id', id)
        .eq('org_id', currentOrgId)
        .order('created_at', { ascending: false })
        .limit(5);
      setAnalyses((a ?? []) as AnalysisRow[]);
      setLoading(false);
    })();
  }, [id, currentOrgId]);

  const primaryAnalysis = analyses[0];
  const availableTransitions = getAvailableCaseTransitions(form.status);
  const statusMeta = getCaseStatusMeta(form.status);
  const workflowSteps = useMemo(() => {
    return [
      'open',
      'analyzed',
      'in_repair',
      'escalated',
      'resolved',
      'closed',
    ].map(status => ({ status: status as CaseStatus, meta: getCaseStatusMeta(status), active: status === form.status }));
  }, [form.status]);

  async function saveCase(nextStatus?: CaseStatus) {
    if (!id || !currentOrgId || !user) return;
    if (!form.title.trim()) {
      toast.error('O título do caso é obrigatório.');
      return;
    }
    setSaving(true);
    const statusToSave = nextStatus ?? form.status;
    const resolvedAt = isTerminalCaseStatus(statusToSave) ? (caseRow?.resolved_at ?? new Date().toISOString()) : null;

    const payload = {
      title: form.title.trim(),
      reported_defect: form.reported_defect.trim() || null,
      initial_notes: form.initial_notes.trim() || null,
      perceived_symptoms: form.perceived_symptoms.trim() || null,
      outcome: form.outcome.trim() || null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      final_cost: form.final_cost ? Number(form.final_cost) : null,
      status: statusToSave,
      resolved_at: resolvedAt,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('cases').update(payload).eq('id', id).eq('org_id', currentOrgId);
      if (error) throw error;

      if (statusToSave !== caseRow?.status) {
        await supabase.from('audit_log').insert({
          org_id: currentOrgId,
          user_id: user.id,
          action: 'case_status_changed',
          entity: 'case',
          entity_id: id,
          payload: {
            from: caseRow?.status ?? null,
            to: statusToSave,
          },
        });
      }

      setCaseRow(prev => prev ? { ...prev, ...payload, status: statusToSave } : prev);
      setForm(prev => ({ ...prev, status: statusToSave }));
      toast.success('Caso atualizado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar o caso';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !caseRow) return <div className="text-muted-foreground">Carregando caso…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="sm" className="mt-1">
            <Link to="/app/cases"><ArrowLeft className="h-4 w-4 mr-1" /> Casos</Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
              <Badge className={`border ${getCaseStatusBadgeClass(form.status)} capitalize`}>{statusMeta.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Criado {format(new Date(caseRow.created_at), 'dd/MM/yyyy HH:mm')}
              {caseRow.resolved_at ? ` · Resolvido em ${format(new Date(caseRow.resolved_at), 'dd/MM/yyyy HH:mm')}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/new?case=${caseRow.id}`}><Sparkles className="h-4 w-4 mr-1" /> Nova análise</Link>
          </Button>
          <Button onClick={() => saveCase()} size="sm" disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando…' : 'Salvar caso'}
          </Button>
        </div>
      </div>

      <Card className="panel p-5">
        <div className="grid gap-3 md:grid-cols-6">
          {workflowSteps.map(step => (
            <div key={step.status} className={`rounded-xl border p-3 ${step.active ? 'border-primary/40 bg-primary/10' : 'border-border bg-background/30'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Etapa {step.meta.step}</div>
                {step.active && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <div className="mt-2 text-sm font-semibold">{step.meta.label}</div>
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.meta.description}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="panel p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-primary" /> Workflow operacional</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as CaseStatus })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="open">Recebido</option>
                <option value="analyzed">Analisado</option>
                <option value="in_repair">Em reparo</option>
                <option value="escalated">Escalado</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reported_defect">Defeito relatado</Label>
              <Textarea id="reported_defect" rows={2} value={form.reported_defect} onChange={e => setForm({ ...form, reported_defect: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="initial_notes">Notas iniciais</Label>
              <Textarea id="initial_notes" rows={3} value={form.initial_notes} onChange={e => setForm({ ...form, initial_notes: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="perceived_symptoms">Sintomas observados</Label>
              <Textarea id="perceived_symptoms" rows={2} value={form.perceived_symptoms} onChange={e => setForm({ ...form, perceived_symptoms: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_cost">Custo estimado</Label>
              <Input id="estimated_cost" type="number" value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="final_cost">Custo final</Label>
              <Input id="final_cost" type="number" value={form.final_cost} onChange={e => setForm({ ...form, final_cost: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="outcome">Resultado / solução</Label>
              <Textarea id="outcome" rows={2} value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {availableTransitions.map(next => (
              <Button key={next} variant="outline" size="sm" onClick={() => saveCase(next)} disabled={saving}>
                <ArrowRight className="h-4 w-4 mr-1" />
                Mover para {getCaseStatusMeta(next).label}
              </Button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="panel p-5">
            <h3 className="mb-4 flex items-center gap-2 font-semibold"><User className="h-4 w-4 text-primary" /> Cliente e aparelho</h3>
            {customer ? (
              <div className="space-y-2 text-sm">
                <div className="font-medium">{customer.name}</div>
                <div className="text-xs text-muted-foreground">{customer.email ?? '—'} · {customer.phone ?? '—'}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem cliente vinculado.</div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              {device ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4 text-primary" /> {device.commercial_model ?? 'Modelo não informado'}</div>
                  <div className="text-xs text-muted-foreground">Técnico: {device.technical_identifier ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">iOS: {device.ios_version ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">Serial: {device.serial ?? '—'}</div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem dispositivo vinculado.</div>
              )}
            </div>
          </Card>

          <Card className="panel p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4 text-primary" /> Linha do caso</h3>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-background/30 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status atual</div>
                <div className="mt-1 font-medium">{statusMeta.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{statusMeta.description}</div>
              </div>
              {primaryAnalysis && (
                <div className="rounded-lg border border-border bg-background/30 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Última análise</div>
                  <div className="mt-1 font-medium capitalize">{primaryAnalysis.primary_category.replace(/_/g, ' ')}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {primaryAnalysis.confidence_score}/100 · {primaryAnalysis.severity} · {primaryAnalysis.likely_repair_tier.replace(/_/g, ' ')}
                  </div>
                </div>
              )}
              {caseRow.resolved_at && (
                <div className="rounded-lg border border-border bg-background/30 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Resolvido em</div>
                  <div className="mt-1 font-medium">{format(new Date(caseRow.resolved_at), 'dd/MM/yyyy HH:mm')}</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="panel p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" /> Análises vinculadas</h3>
        {analyses.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma análise registrada para este caso.</div>
        ) : (
          <div className="divide-y divide-border">
            {analyses.map(a => (
              <Link key={a.id} to={`/app/analysis/${a.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg">
                <div className="min-w-0">
                  <div className="font-medium capitalize">{a.primary_category.replace(/_/g, ' ')}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.executive_summary}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="outline" className="capitalize">{a.severity}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{a.confidence_score}/100</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
