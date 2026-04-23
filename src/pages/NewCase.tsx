import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLicense } from '@/hooks/useLicense';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UploadCloud, FileText, Wand2, Lock, Crown } from 'lucide-react';
import { parsePanicLog, PARSER_VERSION } from '@/lib/parser/panicParser';
import { diagnose } from '@/lib/engine/diagnose';
import type { Json, Database } from '@/integrations/supabase/types';
import { z } from 'zod';

const caseSchema = z.object({
  title: z.string().trim().min(2).max(140),
  reportedDefect: z.string().trim().max(2000).optional(),
  customerName: z.string().trim().max(120).optional(),
  commercialModel: z.string().trim().max(80).optional(),
  serial: z.string().trim().max(40).optional(),
  imei: z.string().trim().max(40).optional(),
  raw: z.string().trim().min(20, 'Cole o panic-full (mínimo 20 caracteres)').max(2_000_000),
});

export default function NewCase() {
  const { user, currentOrgId } = useAuth();
  const { license, used, remaining, canAnalyze, refresh: refreshLicense } = useLicense();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', reportedDefect: '', customerName: '', commercialModel: '', serial: '', imei: '', raw: '',
  });
  type DiagnosticCategory = Database['public']['Enums']['diagnostic_category'];

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error('Arquivo > 10MB'); return; }
    const text = await f.text();
    setForm(prev => ({ ...prev, raw: text, title: prev.title || f.name }));
    setFilename(f.name);
    toast.success(`${f.name} carregado (${(f.size/1024).toFixed(1)} KB)`);
  }, []);

  async function rollbackCreatedEntities(ids: { caseId?: string; deviceId?: string; customerId?: string }) {
    const deletions = [];
    if (ids.caseId) deletions.push(supabase.from('cases').delete().eq('id', ids.caseId));
    if (ids.deviceId) deletions.push(supabase.from('devices').delete().eq('id', ids.deviceId));
    if (ids.customerId) deletions.push(supabase.from('customers').delete().eq('id', ids.customerId));
    await Promise.allSettled(deletions);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt', '.log', '.ips'], 'application/json': ['.ips', '.json'] },
    maxFiles: 1,
  });

  async function analyze() {
    if (!user || !currentOrgId) { toast.error('Sessão inválida'); return; }
    if (!canAnalyze) { toast.error('Limite de licença atingido', { description: 'Atualize seu plano em /app/billing.' }); return; }
    const parsedForm = caseSchema.safeParse(form);
    if (!parsedForm.success) { toast.error(parsedForm.error.issues[0].message); return; }
    const { title, reportedDefect, customerName, commercialModel, serial, imei, raw } = parsedForm.data;

    setLoading(true);
    let createdCaseId: string | null = null;
    let createdDeviceId: string | null = null;
    let createdCustomerId: string | null = null;
    try {
      // Parse + diagnose locally (deterministic)
      const parsed = parsePanicLog(raw);
      const result = diagnose(parsed);

      // Optional customer
      if (customerName) {
        const { data: c, error: cerr } = await supabase.from('customers')
          .insert({ org_id: currentOrgId, name: customerName }).select('id').single();
        if (cerr) throw cerr;
        createdCustomerId = c.id;
      }
      // Optional device
      if (commercialModel || serial || imei || parsed.metadata.hardwareModel) {
        const { data: d, error: derr } = await supabase.from('devices').insert({
          org_id: currentOrgId, customer_id: createdCustomerId,
          commercial_model: commercialModel || parsed.metadata.deviceModel || null,
          technical_identifier: parsed.metadata.hardwareModel || null,
          serial: serial || parsed.metadata.serial || null,
          imei: imei || null,
          ios_version: parsed.metadata.iosVersion || null,
        }).select('id').single();
        if (derr) throw derr;
        createdDeviceId = d.id;
      }

      // Case
      const { data: caseRow, error: caseErr } = await supabase.from('cases').insert({
        org_id: currentOrgId, technician_id: user.id, customer_id: createdCustomerId, device_id: createdDeviceId,
        title, reported_defect: reportedDefect ?? null, status: 'analyzed',
      }).select('id').single();
      if (caseErr) throw caseErr;
      const caseId = caseRow.id;
      createdCaseId = caseId;

      // Panic log
      const { data: logRow, error: logErr } = await supabase.from('panic_logs').insert({
        org_id: currentOrgId, case_id: caseId, uploaded_by: user.id,
        source: filename ? 'upload' : 'paste', filename, byte_size: new Blob([raw]).size,
        raw_content: raw,
      }).select('id').single();
      if (logErr) throw logErr;

      // Parsed log
      const { data: parsedRow, error: pErr } = await supabase.from('parsed_logs').insert({
        org_id: currentOrgId, panic_log_id: logRow.id, parser_version: PARSER_VERSION,
        metadata: parsed.metadata as Json,
        raw_evidences: parsed.rawEvidences as Json,
        detected_categories: parsed.detectedCategories as Json,
      }).select('id').single();
      if (pErr) throw pErr;

      // Analysis
      const { data: analysisRow, error: aErr } = await supabase.from('analysis_results').insert({
        org_id: currentOrgId, case_id: caseId, panic_log_id: logRow.id, parsed_log_id: parsedRow.id,
        engine_version: result.engineVersion, ruleset_version: result.rulesetVersion,
        executive_summary: result.executiveSummary,
        primary_category: result.primaryCategory as DiagnosticCategory,
        severity: result.severity,
        confidence_score: result.confidenceScore,
        confidence_label: result.confidenceLabel,
        risk_of_misdiagnosis: result.riskOfMisdiagnosis,
        likely_repair_tier: result.likelyRepairTier,
        likely_simple_swap_chance: result.likelySimpleSwapChance,
        likely_board_repair_chance: result.likelyBoardRepairChance,
        suspected_components: result.suspectedComponents as Json,
        probable_subsystem: result.probableSubsystem,
        recommended_test_sequence: result.recommendedTestSequence as Json,
        technical_alerts: result.technicalAlerts as Json,
        bench_notes: result.benchNotes,
        full_payload: result as unknown as Json,
      }).select('id').single();
      if (aErr) throw aErr;

      // Hypotheses
      if (result.hypotheses.length) {
        const { error: hErr } = await supabase.from('diagnostic_hypotheses').insert(result.hypotheses.map(h => ({
          analysis_id: analysisRow.id, org_id: currentOrgId,
          rule_id: h.ruleId, rule_version: h.ruleVersion, category: h.category as DiagnosticCategory,
          is_primary: h.isPrimary, title: h.title, explanation: h.explanation,
          confidence_score: h.confidenceScore, suspected_components: h.suspectedComponents as Json, rank: h.rank,
        })));
        if (hErr) throw hErr;
      }
      // Evidences
      if (result.evidences.length) {
        const { error: eErr } = await supabase.from('diagnostic_evidences').insert(result.evidences.map(e => ({
          analysis_id: analysisRow.id, org_id: currentOrgId,
          category: e.category as DiagnosticCategory, evidence_key: e.evidenceKey, matched_text: e.matchedText,
          weight: e.weight, is_conflicting: e.isConflicting, context: e.context,
        })));
        if (eErr) throw eErr;
      }
      // Suggestions
      if (result.suggestions.length) {
        const { error: sErr } = await supabase.from('repair_suggestions').insert(result.suggestions.map(s => ({
          analysis_id: analysisRow.id, org_id: currentOrgId,
          action_title: s.actionTitle, action_type: s.actionType, priority: s.priority,
          difficulty: s.difficulty, estimated_cost: s.estimatedCost, estimated_time: s.estimatedTime,
          technical_risk: s.technicalRisk, expected_resolution_chance: s.expectedResolutionChance,
          why_this_action: s.whyThisAction, when_to_escalate: s.whenToEscalate,
        })));
        if (sErr) throw sErr;
      }

      // Registrar consumo da licença (best-effort, não bloqueia)
      await supabase.from('usage_events').insert({
        org_id: currentOrgId, user_id: user.id, kind: 'analysis_created', ref_id: analysisRow.id,
      });
      refreshLicense();

      toast.success('Análise concluída.');
      nav(`/app/analysis/${analysisRow.id}`);
    } catch (e: unknown) {
      console.error(e);
      await rollbackCreatedEntities({
        caseId: createdCaseId ?? undefined,
        deviceId: createdDeviceId ?? undefined,
        customerId: createdCustomerId ?? undefined,
      });
      toast.error(e instanceof Error ? e.message : 'Falha ao processar análise');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Nova análise</h1>
          <p className="text-muted-foreground text-sm mt-1">Cole ou envie o panic-full do iPhone para diagnóstico imediato.</p>
        </div>
        {license && (
          <Link to="/app/billing" className="text-xs flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:border-primary/40 transition-colors">
            <Crown className="h-3 w-3 text-primary" />
            <span className="font-medium">{license.plan_name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{license.monthly_analyses_limit === null ? `${used} análises (ilimitado)` : `${used}/${license.monthly_analyses_limit} este mês`}</span>
          </Link>
        )}
      </div>

      {!canAnalyze && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-warning">{license ? 'Limite mensal atingido' : 'Sem licença ativa'}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {license
                ? `Você usou ${used} de ${license.monthly_analyses_limit} análises do plano ${license.plan_name}. Atualize o plano para continuar.`
                : 'Sua organização não tem uma licença ativa. Contate o administrador da plataforma.'}
            </p>
            <Button asChild size="sm" className="mt-3"><Link to="/app/billing">Ver planos</Link></Button>
          </div>
        </div>
      )}

      <Card className="panel p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Título do caso *</Label>
            <Input id="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: iPhone 13 Pro reboots aleatórios" />
          </div>
          <div>
            <Label htmlFor="customerName">Cliente (opcional)</Label>
            <Input id="customerName" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="commercialModel">Modelo (opcional)</Label>
            <Input id="commercialModel" value={form.commercialModel} onChange={e => setForm({ ...form, commercialModel: e.target.value })} placeholder="iPhone 13 Pro" />
          </div>
          <div>
            <Label htmlFor="serial">Serial (opcional)</Label>
            <Input id="serial" value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="defect">Defeito relatado</Label>
            <Textarea id="defect" rows={2} value={form.reportedDefect} onChange={e => setForm({ ...form, reportedDefect: e.target.value })} placeholder="O cliente relata reboots após uso da câmera…" />
          </div>
        </div>

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste"><FileText className="h-4 w-4 mr-2" />Colar texto</TabsTrigger>
            <TabsTrigger value="upload"><UploadCloud className="h-4 w-4 mr-2" />Enviar arquivo</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="mt-4">
            <Textarea rows={14} className="font-mono text-xs" value={form.raw}
              onChange={e => setForm({ ...form, raw: e.target.value })}
              placeholder='Cole aqui o panic-full bruto (.ips, JSON ou texto)…' />
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
              <input {...getInputProps()} />
              <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm">{filename ? <strong>{filename}</strong> : 'Arraste um .ips, .log ou .txt — ou clique para escolher'}</p>
              <p className="text-xs text-muted-foreground mt-1">Máx 10MB · UTF-8</p>
            </div>
            {form.raw && (
              <div className="mt-3 text-xs text-muted-foreground">{form.raw.length.toLocaleString()} caracteres carregados</div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => nav(-1)}>Cancelar</Button>
          <Button onClick={analyze} disabled={loading || !canAnalyze}>
            <Wand2 className="h-4 w-4 mr-2" />
            {loading ? 'Analisando…' : 'Analisar agora'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
