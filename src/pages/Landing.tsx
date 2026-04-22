import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cpu, ShieldCheck, Activity, FileSearch, Gauge, Microscope } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[var(--gradient-noir)]">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[var(--shadow-gold)]">
              <Cpu className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">PanicLens</span>
          </div>
          <div className="flex items-center gap-2">
            {user
              ? <Button asChild><Link to="/app">Abrir workspace</Link></Button>
              : <>
                  <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
                  <Button asChild><Link to="/auth">Criar conta</Link></Button>
                </>}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary mb-6">
            <ShieldCheck className="h-3 w-3" /> Inteligência diagnóstica para assistências Apple
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Transforme um <span className="gold-text">panic-full</span> em diagnóstico técnico explicável.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Parser real, motor de regras versionado, hipóteses concorrentes com score de confiança,
            sequência de testes priorizada e classificação entre troca simples e reparo de placa.
            Sem chute. Sem tentativa cega.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Ver workspace</Link></Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { icon: FileSearch, title: 'Parser real de panic-full', body: 'Suporte a IPS e logs legacy, extração de metadados, processo, kernel, hardware e evidências brutas.' },
          { icon: Microscope, title: 'Motor com 21 categorias', body: 'Thermal, watchdog, baseband, NAND, codec, face id, PMU/rail, I2C e mais — regras versionadas e explicáveis.' },
          { icon: Gauge, title: 'Score de confiança', body: 'Hipóteses concorrentes, evidências conflitantes, repair tier e chance de troca simples vs board-level.' },
          { icon: Activity, title: 'Sequência priorizada de testes', body: 'O que medir, trocar e isolar primeiro — quando parar a tentativa cega e escalar o caso.' },
          { icon: ShieldCheck, title: 'Multi-tenant seguro', body: 'Isolamento por organização, RLS no banco, RBAC para técnicos, premium e admin.' },
          { icon: Cpu, title: 'Histórico de bancada', body: 'Cada caso fica persistido com cliente, aparelho, log original, análise e sugestões.' },
        ].map(f => (
          <div key={f.title} className="panel p-6">
            <f.icon className="h-5 w-5 text-primary mb-3" />
            <h3 className="font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PanicLens · Inteligência diagnóstica para iPhone
      </footer>
    </div>
  );
}
