/**
 * Licença ativa da org corrente + uso mensal + helpers de gating.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type ActiveLicense = {
  license_id: string;
  plan_code: string;
  plan_name: string;
  status: string;
  monthly_analyses_limit: number | null;
  members_limit: number | null;
  expires_at: string | null;
  features: string[];
};

export function useLicense() {
  const { currentOrgId } = useAuth();
  const [license, setLicense] = useState<ActiveLicense | null>(null);
  const [used, setUsed] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentOrgId) { setLicense(null); setUsed(0); setLoading(false); return; }
    setLoading(true);
    const [{ data: lic }, { data: usedCount }] = await Promise.all([
      supabase.rpc('get_active_license_for_org', { _org: currentOrgId }),
      supabase.rpc('count_analyses_this_month', { _org: currentOrgId }),
    ]);
    const row = Array.isArray(lic) ? lic[0] : lic;
    setLicense(row ? { ...row, features: row.features ?? [] } as ActiveLicense : null);
    setUsed(typeof usedCount === 'number' ? usedCount : 0);
    setLoading(false);
  }, [currentOrgId]);

  useEffect(() => { refresh(); }, [refresh]);

  const canAnalyze = (() => {
    if (!license) return false;
    if (license.monthly_analyses_limit === null) return true;
    return used < license.monthly_analyses_limit;
  })();

  const remaining = license?.monthly_analyses_limit === null
    ? Infinity
    : Math.max(0, (license?.monthly_analyses_limit ?? 0) - used);

  const hasFeature = (key: string) => !!license?.features?.includes(key);

  return { license, used, loading, canAnalyze, remaining, hasFeature, refresh };
}
