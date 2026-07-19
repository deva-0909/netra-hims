import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { ROLE_NAV } from '../modules/roleNav';

async function countRows(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const nav = (profile && ROLE_NAV[profile.role]) ?? { patients: false, appointments: false, journeys: [], support: [] };

  const { data } = useQuery({
    queryKey: ['dashboard-counts', profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [patients, activeVisits, todayAppointments, pendingPharmacy, pendingOptical, unpaidBills, pendingInsurance] = await Promise.all([
        nav.patients ? countRows('patients') : Promise.resolve(null),
        nav.journeys.length > 0 ? countRows('visits', (q) => q.eq('clinic_module', nav.journeys[0]).not('stage', 'in', '("completed","cancelled")')) : Promise.resolve(null),
        nav.appointments ? countRows('appointments', (q) => q.gte('scheduled_at', today.toISOString())) : Promise.resolve(null),
        nav.support.includes('pharmacy') ? countRows('pharmacy_dispenses', (q) => q.neq('status', 'dispensed')) : Promise.resolve(null),
        nav.support.includes('optical') ? countRows('optical_orders', (q) => q.not('status', 'in', '("dispensed","cancelled")')) : Promise.resolve(null),
        nav.support.includes('billing') ? countRows('bills', (q) => q.neq('payment_status', 'paid')) : Promise.resolve(null),
        nav.support.includes('insurance') ? countRows('insurance_claims', (q) => q.not('status', 'in', '("settled","rejected")')) : Promise.resolve(null),
      ]);
      return { patients, activeVisits, todayAppointments, pendingPharmacy, pendingOptical, unpaidBills, pendingInsurance };
    },
  });

  const cards = [
    nav.patients && { label: 'Registered patients', value: data?.patients, to: '/patients' },
    nav.journeys.length > 0 && { label: `Active visits — ${nav.journeys[0]}`, value: data?.activeVisits, to: `/journeys/${nav.journeys[0]}` },
    nav.appointments && { label: 'Appointments from today', value: data?.todayAppointments, to: '/appointments' },
    nav.support.includes('pharmacy') && { label: 'Prescriptions pending dispense', value: data?.pendingPharmacy, to: '/pharmacy' },
    nav.support.includes('optical') && { label: 'Optical orders pending', value: data?.pendingOptical, to: '/optical' },
    nav.support.includes('billing') && { label: 'Bills unpaid', value: data?.unpaidBills, to: '/billing' },
    nav.support.includes('insurance') && { label: 'Insurance claims pending', value: data?.pendingInsurance, to: '/insurance' },
  ].filter(Boolean) as { label: string; value: number | null | undefined; to: string }[];

  const quickActions = [
    nav.patients && { to: '/patients?new=1', label: '+ Register patient', primary: true },
    nav.appointments && { to: '/appointments', label: 'Schedule appointment' },
    nav.journeys.length > 0 && { to: `/journeys/${nav.journeys[0]}`, label: `${nav.journeys[0]} queue` },
    nav.support.includes('pharmacy') && { to: '/pharmacy', label: 'Pharmacy queue' },
    nav.support.includes('optical') && { to: '/optical', label: 'Optical queue' },
    nav.support.includes('billing') && { to: '/billing', label: 'Billing' },
    nav.support.includes('insurance') && { to: '/insurance', label: 'Insurance desk' },
  ].filter(Boolean) as { to: string; label: string; primary?: boolean }[];

  return (
    <div>
      <h2>Welcome, {profile?.full_name?.split(' ')[0] ?? 'there'}</h2>
      <p className="text-muted">
        Here's what's happening at the hospital today
        {profile && <> — viewing as <strong>{profile.role.replace(/_/g, ' ')}</strong></>}.
      </p>

      {cards.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
          {cards.map((c) => (
            <Link key={c.label} to={c.to} style={{ color: 'inherit' }}>
              <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <div className="card-kicker">Overview</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 600 }}>
                  {c.value ?? '—'}
                </div>
                <div className="card-body">{c.label}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ marginTop: 'var(--space-6)' }}>Nothing assigned to this role yet.</p>
      )}

      {quickActions.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3>Quick actions</h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {quickActions.map((a) => (
              <Link key={a.to} className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`} to={a.to}>{a.label}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
