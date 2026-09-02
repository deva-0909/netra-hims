import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { portalSupabase } from './portalSupabaseClient';

interface PortalPatient {
  id: string;
  uhid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
}

interface PortalAuthContextValue {
  session: Session | null;
  patient: PortalPatient | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshPatient: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextValue | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [patient, setPatient] = useState<PortalPatient | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPatient = async () => {
    const { data } = await portalSupabase.from('patients').select('id, uhid, full_name, date_of_birth, gender, phone, email').maybeSingle();
    setPatient(data as PortalPatient | null);
  };

  useEffect(() => {
    portalSupabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadPatient();
      setLoading(false);
    });

    const { data: listener } = portalSupabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) await loadPatient(); else setPatient(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await portalSupabase.auth.signOut();
  };

  return (
    <PortalAuthContext.Provider value={{ session, patient, loading, signOut, refreshPatient: loadPatient }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}
