import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Customer = { id: string; name: string; email: string; phone: string };

export default function Customers() {
  const { currentOrgId } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentOrgId]);
  async function reload() {
    if (!currentOrgId) return;
    const { data } = await supabase.from('customers').select('id, name, email, phone').eq('org_id', currentOrgId).order('created_at', { ascending: false });
    setRows(data ?? []);
  }
  async function add() {
    if (!form.name.trim() || !currentOrgId) return;
    const { error } = await supabase.from('customers').insert({ org_id: currentOrgId, ...form });
    if (error) { toast.error(error.message); return; }
    setForm({ name: '', email: '', phone: '' }); toast.success('Cliente adicionado'); reload();
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">Cadastro rápido para vincular a casos.</p>
      </div>
      <Card className="panel p-5">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="flex gap-2 items-end">
            <div className="flex-1"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <Button onClick={add}>Adicionar</Button>
          </div>
        </div>
      </Card>
      <Card className="panel">
        {rows.length === 0
          ? <div className="p-10 text-center text-sm text-muted-foreground">Nenhum cliente cadastrado.</div>
          : <div className="divide-y divide-border">
              {rows.map(r => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                  <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email || '—'} · {r.phone || '—'}</div></div>
                </div>
              ))}
            </div>}
      </Card>
    </div>
  );
}
