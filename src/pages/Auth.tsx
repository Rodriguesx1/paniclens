import { useEffect, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ArrowRight,
  Cpu,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Workflow,
  FileSearch,
  Gauge,
  DatabaseZap,
} from 'lucide-react';
import { z } from 'zod';

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  orgName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

const proofPoints = [
  { icon: FileSearch, title: 'Parser real', text: 'Metadados, evidências e sinais estruturados do panic-full.' },
  { icon: Gauge, title: 'Diagnóstico explicável', text: 'Score, hipóteses concorrentes e repair tier com contexto.' },
  { icon: DatabaseZap, title: 'Persistência real', text: 'Caso, log e análise gravados na base com isolamento.' },
];

export default function Auth() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'update_password'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', orgName: '' });

  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery')) {
      setMode('update_password');
    }
  }, []);

  if (user) return <Navigate to="/app" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: parsed.data.fullName, org_name: parsed.data.orgName },
          },
        });
        if (error) throw error;
        toast.success('Conta criada. Verifique seu email para confirmar o acesso.');
        setMode('login');
      } else if (mode === 'reset') {
        const parsed = loginSchema.pick({ email: true }).safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success('Enviamos o link de redefinição para seu email.');
        setMode('login');
      } else if (mode === 'update_password') {
        const nextPassword = form.password.trim();
        if (nextPassword.length < 8) {
          toast.error('A nova senha deve ter ao menos 8 caracteres.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: nextPassword });
        if (error) throw error;
        toast.success('Senha redefinida com sucesso.');
        nav('/app', { replace: true });
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        nav('/app', { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro de autenticação';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--gradient-noir)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-[-5rem] h-72 w-72 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute right-[-4rem] bottom-[-6rem] h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(201,168,76,0.10),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_25%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1fr_0.95fr]">
        <section className="flex flex-col justify-center px-6 py-10 lg:px-10 xl:px-12">
          <Link to="/" className="mb-10 inline-flex items-center gap-3 self-start">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-gold)]">
              <Cpu className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-semibold tracking-tight">PanicLens</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">iOS panic intelligence</div>
            </div>
          </Link>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-primary">
              <Sparkles className="h-3 w-3" />
              Acesso ao workspace técnico
            </div>

            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance leading-[1.02] md:text-6xl xl:text-7xl">
              Diagnóstico explicável, login seguro e bancada pronta para uso.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Entre para analisar panic-fulls, salvar casos, exportar relatórios e controlar
              licenças com gating real por organização.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofPoints.map(point => (
                <Card key={point.title} className="panel border-border/80 bg-card/80 p-4">
                  <point.icon className="h-5 w-5 text-primary" />
                  <div className="mt-3 text-sm font-semibold">{point.title}</div>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">{point.text}</p>
                </Card>
              ))}
            </div>

            <div className="mt-8 grid gap-3 border-l border-primary/20 pl-5 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                RBAC, tenant isolado e licenças aplicadas na base.
              </div>
              <div className="flex items-center gap-3">
                <Workflow className="h-4 w-4 text-primary" />
                Fluxo de caso, parser e análise conectado ponta a ponta.
              </div>
              <div className="flex items-center gap-3">
                <LockKeyhole className="h-4 w-4 text-primary" />
                Recuperação de senha e criação de conta com validação real.
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-10 xl:px-12">
          <Card className="panel w-full max-w-md border-primary/20 bg-card/95 p-6 shadow-[var(--shadow-noir)] backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Recuperar senha' : 'Definir nova senha'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mode === 'login'
                  ? 'Acesse seu workspace técnico.'
                  : mode === 'signup'
                    ? 'Crie seu workspace e comece a analisar panic-fulls.'
                    : mode === 'reset'
                      ? 'Informe seu email para receber o link de redefinição.'
                      : 'Defina uma nova senha para concluir a recuperação.'}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Seu nome</Label>
                    <Input id="fullName" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Ex.: João Silva" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Nome da assistência</Label>
                    <Input id="orgName" value={form.orgName} onChange={e => setForm({ ...form, orgName: e.target.value })} placeholder="Ex.: TechRepair Premium" />
                  </div>
                </>
              )}

              {mode !== 'update_password' && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@assistencia.com" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{mode === 'update_password' ? 'Nova senha' : 'Senha'}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  disabled={mode === 'reset'}
                  placeholder={mode === 'update_password' ? 'Digite a nova senha' : '••••••••'}
                />
              </div>

              <Button className="w-full" disabled={loading} type="submit" size="lg">
                {loading
                  ? '...'
                  : mode === 'login'
                    ? 'Entrar'
                    : mode === 'signup'
                      ? 'Criar conta'
                      : mode === 'reset'
                        ? 'Enviar link'
                        : 'Salvar nova senha'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            {mode !== 'update_password' && (
              <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="flex w-full items-center justify-between rounded-lg border border-transparent px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  <span>{mode === 'login' ? 'Não tenho conta' : 'Já tenho conta'}</span>
                  <span className="text-primary">{mode === 'login' ? 'Criar agora' : 'Entrar'}</span>
                </button>
                {mode !== 'signup' && (
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}
                    className="flex w-full items-center justify-between rounded-lg border border-transparent px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  >
                    <span>{mode === 'reset' ? 'Voltar para login' : 'Esqueci minha senha'}</span>
                    <span className="text-primary">{mode === 'reset' ? 'Login' : 'Recuperar'}</span>
                  </button>
                )}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
