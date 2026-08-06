import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { MODULES } from '../modules/moduleConfig';

/** Public, unauthenticated "now serving" board for a TV in the waiting
 * area. Deliberately shows nothing but a token number per clinic — visits
 * (patient name, phone, doctor) can't be exposed to an anonymous screen
 * under its RLS, so this reads only the purpose-built now_serving table. */
export function WaitingBoardDisplayPage() {
  const { data: serving } = useQuery({
    queryKey: ['now-serving-display'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('now_serving').select('*');
      if (error) throw error;
      return data;
    },
  });

  const byModule: Record<string, string | null> = {};
  (serving ?? []).forEach((s: any) => { byModule[s.clinic_module] = s.token_number; });

  return (
    <div style={{ minHeight: '100vh', background: '#12181f', color: '#fff', padding: '48px 32px', fontFamily: 'var(--font-body, sans-serif)' }}>
      <h1 style={{ textAlign: 'center', fontSize: 36, marginBottom: 48, letterSpacing: '0.02em' }}>Now Serving</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
        {Object.values(MODULES).map((m) => (
          <div key={m.key} style={{ background: '#1c2530', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, color: '#9fb0c3', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>{m.label}</div>
            <div style={{ fontSize: 64, fontWeight: 700, color: byModule[m.key] ? '#6fd6a8' : '#4a5a6b' }}>
              {byModule[m.key] ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
