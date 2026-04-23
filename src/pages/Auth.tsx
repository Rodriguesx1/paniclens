import { useEffect, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Cpu } from 'lucide-react';
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
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
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
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
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
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
        nav('/app', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Erro de autenticação');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--gradient-noir)]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[var(--shadow-gold)]">
            <Cpu className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight">PanicLens</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">iOS panic intelligence</div>
          </div>
        </Link>

        <Card className="p-6 panel">
          <h1 className="text-2xl font-semibold mb-1">
            {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Recuperar senha' : 'Definir nova senha'}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'login'
              ? 'Acesse seu workspace técnico.'
              : mode === 'signup'
                ? 'Comece a analisar panic-fulls em minutos.'
                : mode === 'reset'
                  ? 'Informe seu email para recuperar o acesso.'
                  : 'Informe a nova senha para concluir a recuperação.'}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <Label htmlFor="fullName">Seu nome</Label>
                  <Input id="fullName" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="orgName">Nome da assistência</Label>
                  <Input id="orgName" value={form.orgName} onChange={e => setForm({ ...form, orgName: e.target.value })} placeholder="Ex.: TechRepair Premium" />
                </div>
              </>
            )}
            {mode !== 'update_password' && (
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            )}
            <div>
              <Label htmlFor="password">{mode === 'update_password' ? 'Nova senha' : 'Senha'}</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={mode === 'reset'} />
            </div>
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? '...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link' : 'Salvar nova senha'}
            </Button>
          </form>
          {mode !== 'update_password' && <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
            >
              {mode === 'login' ? 'Não tenho conta — criar agora' : 'Já tenho conta — entrar'}
            </button>
            {mode !== 'signup' && (
              <button
                type="button"
                onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
              >
                {mode === 'reset' ? 'Voltar para login' : 'Esqueci minha senha'}
              </button>
            )}
          </div>}
        </Card>
      </div>
    </div>
  );
}
