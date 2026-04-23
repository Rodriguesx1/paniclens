import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

type OrgMembership = { org_id: string; role: string };
type Organization = { id: string; name: string; slug: string };

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  currentOrgId: string | null;
  memberships: OrgMembership[];
  organizations: Organization[];
  setCurrentOrgId: (orgId: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  currentOrgId: null,
  memberships: [],
  organizations: [],
  setCurrentOrgId: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        setTimeout(() => loadMemberships(sess.user.id), 0);
      } else {
        setMemberships([]);
        setCurrentOrgId(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session); setUser(data.session?.user ?? null);
      if (data.session?.user) await loadMemberships(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadMemberships(uid: string) {
    try {
      const { data, error } = await supabase.from('memberships').select('org_id, role').eq('user_id', uid);
      if (error) throw error;
      if (data && data.length > 0) {
        setMemberships(data);
        const orgIds = [...new Set(data.map(m => m.org_id))];
        const { data: orgRows, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .in('id', orgIds);
        if (orgError) throw orgError;
        const orderedOrgs = orgIds
          .map(id => orgRows?.find(org => org.id === id))
          .filter((org): org is Organization => Boolean(org));
        setOrganizations(orderedOrgs);
        const stored = localStorage.getItem('paniclens.org');
        const selected = stored && orgIds.includes(stored) ? stored : orderedOrgs[0]?.id ?? null;
        setCurrentOrgId(selected);
        if (selected) localStorage.setItem('paniclens.org', selected);
        else localStorage.removeItem('paniclens.org');
      } else {
        setMemberships([]);
        setOrganizations([]);
        setCurrentOrgId(null);
        localStorage.removeItem('paniclens.org');
      }
    } catch (error) {
      console.error('Falha ao carregar organizações do usuário', error);
      setMemberships([]);
      setOrganizations([]);
      setCurrentOrgId(null);
      localStorage.removeItem('paniclens.org');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('paniclens.org');
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      currentOrgId,
      memberships,
      organizations,
      setCurrentOrgId: (orgId) => {
        setCurrentOrgId(orgId);
        if (orgId) localStorage.setItem('paniclens.org', orgId);
        else localStorage.removeItem('paniclens.org');
      },
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
