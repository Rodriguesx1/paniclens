import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLicense } from '@/hooks/useLicense';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown, Key, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Plan = {
  id: string; code: string; name: string; description: string;
  monthly_analyses_limit: number | null; members_limit: number | null;
  features: string[]; monthly_price_cents: number; sort_order: number;
};

const FEATURE_LABEL: Record<string, string> = {
  basic_analysis: 'Análise técnica completa',
  pdf_export: 'Exportação de relatório PDF',
  knowledge_base: 'Base de conhecimento (21 categorias)',
  similar_cases: 'Comparador de casos similares',
  advanced_dashboard: 'Dashboard avançado',
  multi_user: 'Multi-técnico',
  custom_rules: 'Regras customizadas',
  priority_support: 'Suporte prioritário',
};

export default function Billing() {
  const { currentOrgId, user } = useAuth();
  const { license, used, remaining } = useLicense();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    supabase.from('plans').select('*').eq('is_public', true).order('sort_order')
      .then(({ data }) => setPlans((data ?? []) as any));
  }, []);

  const limit = license?.monthly_analyses_limit;
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  async function requestPlan(plan: Plan) {
    if (!currentOrgId || !user) {
      toast.error('Sessão inválida para solicitar plano.');
      return;
    }
    const { error } = await supabase.from('audit_log').insert({
      org_id: currentOrgId,
      user_id: user.id,
      action: 'billing_plan_requested',
      entity: 'plan',
      payload: { requested_plan_code: plan.code, requested_plan_name: plan.name },
    });
    if (error) {
      toast.error('Falha ao registrar solicitação', { description: error.message });
      return;
    }
    toast.success('Solicitação registrada', {
      description: `Pedido de upgrade para ${plan.name} enviado ao time comercial.`,
    });
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Licença & uso</h1>
        <p className="text-muted-foreground text-sm mt-1">Sua licença atual, consumo e planos disponíveis.</p>
      </div>

      <Card className="panel p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Crown className="h-3 w-3 text-primary" /> Sua licença</div>
            {license ? (
              <>
                <div className="mt-2 text-2xl font-semibold gold-text">{license.plan_name}</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className="capitalize bg-success/15 text-success border border-success/30">{license.status}</Badge>
                  {license.expires_at ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Expira {format(new Date(license.expires_at), 'dd/MM/yyyy')}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Vitalícia</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-2xl font-semibold text-warning">Sem licença ativa</div>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">Sua organização ainda não tem uma licença ativa. Solicite ao administrador para emitir uma licença ou contate-nos para liberar uma trial.</p>
              </>
            )}
          </div>
          <div className="min-w-[260px]">
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Activity className="h-3 w-3 text-primary" /> Análises este mês</div>
            <div className="mt-2 text-3xl font-semibold">{used}{limit !== null && limit !== undefined && <span className="text-sm text-muted-foreground"> / {limit}</span>}</div>
            {limit !== null && limit !== undefined ? (
              <>
                <div className="h-2 mt-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${pct > 85 ? 'bg-destructive' : 'bg-gradient-to-r from-primary to-primary-glow'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-2">{remaining === Infinity ? 'ilimitado' : `${remaining} restantes`}</div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">Volume ilimitado</div>
            )}
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-4">Planos disponíveis</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(p => {
            const isActive = license?.plan_code === p.code;
            return (
              <Card key={p.id} className={`panel p-5 flex flex-col ${isActive ? 'border-primary/50 shadow-[var(--shadow-gold)]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  {isActive && <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px]">Ativo</Badge>}
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-semibold">
                    {p.monthly_price_cents === 0 ? (p.code === 'enterprise' ? 'Sob consulta' : 'Grátis') : `R$ ${(p.monthly_price_cents/100).toFixed(0)}`}
                  </span>
                  {p.monthly_price_cents > 0 && <span className="text-xs text-muted-foreground"> /mês</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-2 min-h-[40px]">{p.description}</p>
                <ul className="mt-3 space-y-1 text-xs flex-1">
                  <li className="flex gap-2 text-foreground/85"><Check className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {p.monthly_analyses_limit === null ? 'Análises ilimitadas' : `${p.monthly_analyses_limit} análises/mês`}</li>
                  <li className="flex gap-2 text-foreground/85"><Check className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {p.members_limit === null ? 'Membros ilimitados' : `Até ${p.members_limit} membros`}</li>
                  {(p.features ?? []).map(f => (
                    <li key={f} className="flex gap-2 text-foreground/85"><Check className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {FEATURE_LABEL[f] ?? f}</li>
                  ))}
                </ul>
                <Button className="mt-4 w-full" variant={isActive ? 'outline' : 'default'} disabled={isActive}
                  onClick={() => !isActive && requestPlan(p)}>
                  {isActive ? 'Plano atual' : 'Solicitar'}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="panel p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Key className="h-3 w-3 text-primary" /> Sua chave de licença</div>
        <div className="mt-2 font-mono text-sm bg-muted/40 px-3 py-2 rounded inline-block">{license?.license_id ? `…${license.license_id.slice(-12)}` : '—'}</div>
        <p className="text-xs text-muted-foreground mt-2">A licença é vinculada à sua organização. Para alterações, contate o administrador da plataforma.</p>
      </Card>
    </div>
  );
}
