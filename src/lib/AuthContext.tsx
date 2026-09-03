import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Profile, StaffRole } from './types';

// Demo mode: this app is a public showcase, not a production deployment with real
// patient data. Rather than making every visitor register an account, we sign
// everyone into one shared demo staff account automatically. The sidebar's
// "Demo — viewing as" dropdown then lets you switch that shared account's role
// to preview the nav/experience for each staff type. Remove this block (and
// restore requiring sign-in) before using this codebase with real data.
const DEMO_MODE = true;
export { DEMO_MODE };
// Read from env vars rather than hardcoding — this repo is public, and while
// this demo account grants no more access than the site already auto-grants
// every visitor, credentials simply shouldn't live in source regardless.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL as string;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: StaffRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session && DEMO_MODE) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });
        if (!error && signInData.session) {
          setSession(signInData.session);
          await loadProfile(signInData.session.user.id);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(newSession.user.id);
        // Best-effort visibility for Security & Sessions — never blocks
        // sign-in on failure. Fires once per genuine sign-in event, not on
        // token refresh, so a session's lifetime doesn't spam the log.
        if (_event === 'SIGNED_IN') {
          supabase.from('login_sessions').insert({ user_id: newSession.user.id, user_agent: navigator.userAgent }).then(() => {});
        }
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: StaffRole) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role,
      });
      if (profileError) return { error: profileError.message };
      await loadProfile(data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}