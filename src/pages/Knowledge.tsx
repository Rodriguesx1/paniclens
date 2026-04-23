import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Search, ArrowLeft } from 'lucide-react';

type Article = {
  id: string; slug: string; category: string; title: string; summary: string;
  content_md: string; key_symptoms: string[]; related_components: string[];
  recommended_tests: string[]; typical_severity: string | null; keywords: string[]; author: string | null;
};

const SEV: Record<string, string> = {
  low: 'bg-success/15 text-success border-success/30',
  moderate: 'bg-info/15 text-info border-info/30',
  high: 'bg-warning/15 text-warning border-warning/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function Knowledge() {
  const [params, setParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [active, setActive] = useState<Article | null>(null);
  const initialSlug = params.get('slug');
  const initialCategory = params.get('category');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('knowledge_articles')
        .select('*').eq('status', 'published').order('category');
      setArticles((data ?? []) as any);
      if (initialSlug && data) {
        const found = data.find((a: any) => a.slug === initialSlug);
        if (found) setActive(found as any);
      } else if (initialCategory && data) {
        const found = data.find((a: any) => a.category === initialCategory);
        if (found) setActive(found as any);
      }
    })();
  }, [initialSlug, initialCategory]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return articles;
    return articles.filter(a =>
      a.title.toLowerCase().includes(s) ||
      a.category.toLowerCase().includes(s) ||
      a.summary.toLowerCase().includes(s) ||
      (a.keywords ?? []).some(k => k.toLowerCase().includes(s))
    );
  }, [articles, q]);

  if (active) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => { setActive(null); setParams({}); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à base
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="capitalize">{active.category.replace(/_/g, ' ')}</Badge>
          {active.typical_severity && (
            <Badge className={`border ${SEV[active.typical_severity]} capitalize`}>{active.typical_severity}</Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{active.title}</h1>
        <p className="text-muted-foreground">{active.summary}</p>

        <div className="grid md:grid-cols-3 gap-3">
          <KbList title="Sintomas-chave" items={active.key_symptoms} />
          <KbList title="Componentes" items={active.related_components} />
          <KbList title="Testes recomendados" items={active.recommended_tests} />
        </div>

        <Card className="panel p-6">
          <article className="prose prose-invert max-w-none text-sm">
            {active.content_md.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-primary mt-4">{line.slice(4)}</h3>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-5">{line.slice(3)}</h2>;
              if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc">{line.slice(2)}</li>;
              if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-5 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
              if (!line.trim()) return <div key={i} className="h-2" />;
              return <p key={i} className="leading-relaxed text-foreground/90">{line}</p>;
            })}
          </article>
        </Card>

        {active.author && <div className="text-xs text-muted-foreground">Autoria: {active.author}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Base de conhecimento</h1>
        <p className="text-muted-foreground text-sm mt-1">21 categorias técnicas curadas para diagnóstico de panic-full em iPhone.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por categoria, sintoma, componente…" className="pl-9" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(a => (
          <Card key={a.id} onClick={() => { setActive(a); setParams({ slug: a.slug }); }} className="panel p-5 cursor-pointer hover:border-primary/40 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className="capitalize text-[10px]">{a.category.replace(/_/g, ' ')}</Badge>
              {a.typical_severity && <Badge className={`text-[10px] border ${SEV[a.typical_severity]} capitalize`}>{a.typical_severity}</Badge>}
            </div>
            <h3 className="font-semibold leading-tight">{a.title}</h3>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{a.summary}</p>
            {a.related_components?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {a.related_components.slice(0, 3).map(c => <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c}</span>)}
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <div className="text-sm text-muted-foreground">Nenhum artigo encontrado.</div>}
      </div>
    </div>
  );
}

function KbList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="panel p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <ul className="space-y-1">
        {(items ?? []).map((it, i) => <li key={i} className="text-xs text-foreground/85">• {it}</li>)}
      </ul>
    </Card>
  );
}
