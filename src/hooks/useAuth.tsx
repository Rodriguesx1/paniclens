import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

type OrgMembership = { org_id: string; role: string };

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  currentOrgId: string | null;
  memberships: OrgMembership[];
  setCurrentOrgId: (orgId: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null, session: null, loading: true, currentOrgId: null, memberships: [], setCurrentOrgId: () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
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
    const { data } = await supabase.from('memberships').select('org_id, role').eq('user_id', uid);
    if (data && data.length > 0) {
      setMemberships(data);
      const stored = localStorage.getItem('paniclens.org');
      const orgIds = [...new Set(data.map(m => m.org_id))];
      const selected = stored && orgIds.includes(stored) ? stored : orgIds[0];
      setCurrentOrgId(selected);
      localStorage.setItem('paniclens.org', selected);
    } else {
      setMemberships([]);
      setCurrentOrgId(null);
    }
    setLoading(false);
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
