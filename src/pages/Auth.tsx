import { useState } from 'react';
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
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', orgName: '' });

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
        toast.success('Conta criada. Entrando…');
        nav('/app', { replace: true });
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
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
          <h1 className="text-2xl font-semibold mb-1">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'login' ? 'Acesse seu workspace técnico.' : 'Comece a analisar panic-fulls em minutos.'}
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
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? '...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
          >
            {mode === 'login' ? 'Não tenho conta — criar agora' : 'Já tenho conta — entrar'}
          </button>
        </Card>
      </div>
    </div>
  );
}
