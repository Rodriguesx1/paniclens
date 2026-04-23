import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  DatabaseZap,
  FileSearch,
  Gauge,
  Layers3,
  LockKeyhole,
  MoveRight,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

const metrics = [
  { label: 'Parser', value: 'Real panic-full', note: 'IPS, JSON e texto legado' },
  { label: 'Rules', value: '21 categorias', note: 'Versionadas e explicáveis' },
  { label: 'Score', value: 'Confiança + risco', note: 'Hipóteses concorrentes' },
  { label: 'Output', value: 'PDF + histórico', note: 'Persistência ponta a ponta' },
];

const highlights = [
  {
    icon: FileSearch,
    title: 'Parser estrutural',
    body: 'Extrai panicString, process, modelo, iOS, evidências e metadados úteis com saída consistente.',
  },
  {
    icon: BrainCircuit,
    title: 'Engine diagnóstica',
    body: 'Rules engine versionado com score de confiança, alertas técnicos e sequência de testes priorizada.',
  },
  {
    icon: DatabaseZap,
    title: 'Persistência real',
    body: 'Cada análise salva caso, log bruto, parse, evidência, hipótese e sugestão no banco.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant seguro',
    body: 'Isolamento por organização, RBAC e licenças com gating real para uso mensal.',
  },
  {
    icon: Gauge,
    title: 'Leitura de bancada',
    body: 'Mostra reparo provável, chance de troca simples e risco board-level com explicação direta.',
  },
  {
    icon: Wrench,
    title: 'Fluxo de reparo',
    body: 'Sugestões ordenadas por prioridade, dificuldade e chance esperada de resolução.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Cole ou envie o panic-full',
    body: 'Suporte a .ips, JSON e logs crús com validação de tamanho e pré-processamento.',
  },
  {
    step: '02',
    title: 'Analise evidências reais',
    body: 'O motor compara categorias, pesos e conflitos para reduzir falso positivo e chute cego.',
  },
  {
    step: '03',
    title: 'Execute a bancada',
    body: 'Aplique testes priorizados, registre o caso e exporte relatório com rastreabilidade.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--gradient-noir)]">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-[-8rem] top-[-7rem] h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-[12rem] h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,168,76,0.10),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_26%)]" />
      </div>

      <header className="relative z-10 border-b border-border/70 bg-background/40 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-gold)]">
              <Cpu className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">PanicLens</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">iOS panic intelligence</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild className="shadow-[var(--shadow-gold)]">
              <Link to="/auth">{user ? 'Abrir workspace' : 'Criar conta'}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6">
        <section className="grid gap-14 py-16 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-success">
              <CheckCircle2 className="h-3 w-3" />
              Publicação visível no main
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-primary">
              <Sparkles className="h-3 w-3" />
              Inteligência diagnóstica para assistências Apple
            </div>

            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance leading-[1.02] text-foreground md:text-7xl">
              Transforme um <span className="gold-text">panic-full</span> em diagnóstico técnico explicável.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Parser real, motor de regras versionado, hipóteses concorrentes com score de confiança e
              sequência de testes priorizada. Menos tentativa cega, mais decisão com rastreabilidade.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="px-6">
                <Link to="/auth">
                  Começar agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/30 px-6">
                <Link to="/app">
                  Ver workspace
                  <MoveRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map(metric => (
                <Card key={metric.label} className="panel border-border/80 bg-card/80 p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{metric.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{metric.note}</div>
                </Card>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-primary/20 blur-3xl" />
            <Card className="panel relative overflow-hidden border-primary/20 bg-card/90 p-6 shadow-[var(--shadow-noir)]">
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-primary">Painel técnico</div>
                  <div className="mt-1 text-xl font-semibold">Análise de um caso real</div>
                </div>
                <div className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-success">
                  Sincronizado
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Hipótese principal</span>
                    <span className="font-mono text-primary">87/100</span>
                  </div>
                  <div className="mt-2 text-lg font-medium">Thermal monitor interrompido por sensor ausente</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    O log aponta `thermalmonitord` sem checkins e sensores ausentes. O fluxo inicia por
                    flex, conector e continuidade, antes de pensar em placa.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Troca simples', '62%'],
                    ['Board-level', '18%'],
                    ['Risco diagnóstico', '13%'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <LockKeyhole className="h-4 w-4" />
                    Gating real por licença
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Limite mensal, papel do usuário e organização ativa são verificados no fluxo e no banco.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="pb-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-primary">Capacidades</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Menos aparência. Mais instrumento técnico.</h2>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-border bg-background/30 px-4 py-2 text-xs text-muted-foreground md:flex">
              <TerminalSquare className="h-3 w-3 text-primary" />
              Saída explicável, persistida e exportável
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {highlights.map(item => (
              <Card key={item.title} className="panel group border-border/80 bg-card/80 p-6 transition-transform duration-200 hover:-translate-y-1">
                <item.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-16 lg:grid-cols-3">
          {steps.map(step => (
            <Card key={step.step} className="panel border-border/80 bg-card/80 p-6">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.24em] text-primary">Passo {step.step}</div>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p>
            </Card>
          ))}
        </section>

        <section className="pb-20">
          <Card className="panel overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary">
                  <Layers3 className="h-3 w-3" />
                  Próxima bancada
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                  Tudo pronto para a próxima análise, sem tela placebo.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Fluxo real do usuário, histórico persistido, billing com gating e painel administrativo
                  visível. É o tipo de interface que mostra o que o sistema realmente faz.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <Button asChild size="lg" className="w-full lg:w-auto">
                  <Link to="/auth">
                    Começar a usar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  Sync GitHub/Lovable via branch principal
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/70 bg-background/35">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} PanicLens · Inteligência diagnóstica para iPhone</div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-primary" />
            Rastreável, persistido, explicável
          </div>
        </div>
      </footer>
    </div>
  );
}
